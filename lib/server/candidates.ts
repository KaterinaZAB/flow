import {median} from '../domain/detection';
import {db,camelRow} from './db';
import {ApiError} from './auth';
import {detectRecurring} from '../domain/detection';
import {validateExpense} from '../domain/validation';
import {normalizeMerchant} from '../domain/catalog';
import {addPeriod,advanceTo,daysBetween,today} from '../domain/calendar';
import {listExpenses,listTransactions,insertExpense} from './expenses';
import type {Candidate,Transaction,RecurringExpense} from '../domain/types';
export async function listCandidates(userId:string){const rows=await db().prepare('SELECT payload,decision FROM detection_candidates WHERE user_id=? AND decision=?').bind(userId,'pending').all<{payload:string;decision:Candidate['decision']}>();return rows.results.map(r=>({...JSON.parse(r.payload),decision:r.decision}) as Candidate)}
export async function runDetection(userId:string,importId:string){
 const [all,expenses]=await Promise.all([listTransactions(userId),listExpenses(userId)]);
 // Attach only unambiguous charges matching a confirmed expense's merchant, currency and schedule.
 const links=new Map<string,Set<string>>();for(const t of all){if(t.recurringExpenseId){const keys=links.get(t.recurringExpenseId)??new Set();keys.add(t.normalizedMerchant);links.set(t.recurringExpenseId,keys)}}
 const newCharges=all.filter(t=>!t.recurringExpenseId&&t.sourceImportId===importId);const updates=[];
 for(const t of newCharges){const matches=expenses.filter(e=>{
 if(e.currency!==t.currency||!e.nextPaymentAt||!(links.get(e.id)?.has(t.normalizedMerchant)||(e.serviceId&&t.normalizedMerchant==='service:'+e.serviceId)))return false;
 const ratio=t.amountMinor/e.amountMinor;if(ratio<.35||ratio>2.5)return false;
 let expected=e.nextPaymentAt;let n=0;while(expected>t.paidAt&&n++<2000)expected=addPeriod(expected,e.billingPeriod,-1,e.anchorDay,e.customDays);
 const next=addPeriod(expected,e.billingPeriod,1,e.anchorDay,e.customDays);return Math.min(Math.abs(daysBetween(expected,t.paidAt)),Math.abs(daysBetween(next,t.paidAt)))<=(e.billingPeriod==='weekly'?1:4);
 });if(matches.length===1){t.recurringExpenseId=matches[0].id;updates.push(db().prepare('UPDATE transactions SET recurring_expense_id=? WHERE id=? AND user_id=? AND recurring_expense_id IS NULL').bind(matches[0].id,t.id,userId));}}
 for(let n=0;n<updates.length;n+=80)await db().batch(updates.slice(n,n+80));
 for(const e of expenses.filter(e=>e.status==='active')){const linked=all.filter(t=>t.recurringExpenseId===e.id).sort((a,b)=>a.paidAt.localeCompare(b.paidAt));const last=linked[linked.length-1];if(!last||last.sourceImportId!==importId)continue;const amount=e.type==='utility'?median(linked.slice(-4).map(t=>t.amountMinor)):last.amountMinor;const next=advanceTo(addPeriod(last.paidAt,e.billingPeriod,1,e.anchorDay,e.customDays),e.billingPeriod,today(),e.anchorDay,e.customDays);await db().prepare('UPDATE recurring_expenses SET amount_minor=?,next_payment_at=?,updated_at=? WHERE id=? AND user_id=? AND status=?').bind(amount,next,new Date().toISOString(),e.id,userId,'active').run();}
 const decisions=await db().prepare('SELECT payload FROM detection_candidates WHERE user_id=?').bind(userId).all<{payload:string}>();
 const previous=decisions.results.map(r=>JSON.parse(r.payload) as Candidate);const reserved=new Set(previous.flatMap(c=>c.transactionIds));
 const available=all.filter(t=>!t.recurringExpenseId&&!reserved.has(t.id));
 const found=detectRecurring(available,importId).slice(0,100);
 for(let n=0;n<found.length;n+=40)await db().batch(found.slice(n,n+40).map(c=>db().prepare('INSERT INTO detection_candidates (id,user_id,import_id,payload,decision) VALUES (?,?,?,?,?)').bind(c.id,userId,importId,JSON.stringify(c),'pending')));
 return (await listCandidates(userId)).length;
}
export async function decideCandidates(userId:string,input:unknown){
 if(!input||typeof input!=='object')throw new ApiError(400,'Выберите расходы.');const x=input as {ids?:unknown;decision?:unknown;edit?:unknown};
 if(!Array.isArray(x.ids)||x.ids.length<1||x.ids.length>100||x.ids.some(id=>typeof id!=='string'))throw new ApiError(400,'Выберите от 1 до 100 расходов.');
 if(!['confirmed','rejected','edit'].includes(String(x.decision)))throw new ApiError(400,'Некорректное действие.');
 const ids=[...new Set(x.ids as string[])];if(x.decision==='edit'&&ids.length!==1)throw new ApiError(400,'Редактируйте один расход за раз.');
 let completed=0;
 for(const id of ids){
 const row=await db().prepare('SELECT payload,decision FROM detection_candidates WHERE id=? AND user_id=?').bind(id,userId).first<{payload:string;decision:string}>();if(!row)throw new ApiError(404,'Результат не найден.');if(row.decision!=='pending')continue;
 const c=JSON.parse(row.payload) as Candidate;
 if(x.decision==='edit'){let edit;try{edit=validateExpense(x.edit)}catch(e){throw new ApiError(400,(e as Error).message)}c.expense={...c.expense,...edit,updatedAt:new Date().toISOString()};await db().prepare('UPDATE detection_candidates SET payload=? WHERE id=? AND user_id=? AND decision=?').bind(JSON.stringify(c),id,userId,'pending').run();completed++;continue}
 if(x.decision==='rejected'){await db().prepare('UPDATE detection_candidates SET decision=? WHERE id=? AND user_id=? AND decision=?').bind('rejected',id,userId,'pending').run();completed++;continue}
 const e=c.expense;e.updatedAt=new Date().toISOString();
 const statements=[db().prepare('INSERT INTO recurring_expenses (id,user_id,name,type,amount_minor,currency,billing_period,custom_days,next_payment_at,anchor_day,status,service_id,source,confidence,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM detection_candidates WHERE id=? AND user_id=? AND decision=?)').bind(e.id,userId,e.name,e.type,e.amountMinor,e.currency,e.billingPeriod,e.customDays,e.nextPaymentAt,e.anchorDay,e.status,e.serviceId,e.source,e.confidence,e.createdAt,e.updatedAt,id,userId,'pending')];
 for(let offset=0;offset<c.transactionIds.length;offset+=70){const subset=c.transactionIds.slice(offset,offset+70);statements.push(db().prepare('UPDATE transactions SET recurring_expense_id=? WHERE user_id=? AND recurring_expense_id IS NULL AND id IN ('+subset.map(()=>'?').join(',')+') AND EXISTS (SELECT 1 FROM detection_candidates WHERE id=? AND user_id=? AND decision=?)').bind(e.id,userId,...subset,id,userId,'pending'))}
 statements.push(db().prepare('UPDATE detection_candidates SET decision=? WHERE id=? AND user_id=? AND decision=?').bind('confirmed',id,userId,'pending'));await db().batch(statements);completed++;
 }
 return {completed,pending:(await listCandidates(userId)).length};
}
