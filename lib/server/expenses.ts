import type {RecurringExpense,Transaction} from '../domain/types';
import {validateExpense} from '../domain/validation';
import {db,camelRow} from './db';
import {ApiError} from './auth';
export async function listExpenses(userId:string){const r=await db().prepare('SELECT * FROM recurring_expenses WHERE user_id=? ORDER BY created_at DESC').bind(userId).all();return r.results.map(r=>camelRow<RecurringExpense>(r))}
export async function getExpense(userId:string,id:string){const r=await db().prepare('SELECT * FROM recurring_expenses WHERE user_id=? AND id=?').bind(userId,id).first();return r?camelRow<RecurringExpense>(r):null}
export async function listTransactions(userId:string,expenseId?:string){const sql='SELECT * FROM transactions WHERE user_id=?'+(expenseId?' AND recurring_expense_id=?':'')+' ORDER BY paid_at DESC';const r=await db().prepare(sql).bind(...(expenseId?[userId,expenseId]:[userId])).all();return r.results.map(r=>camelRow<Transaction>(r))}
export function insertExpense(userId:string,e:RecurringExpense){return db().prepare('INSERT INTO recurring_expenses (id,user_id,name,type,amount_minor,currency,billing_period,custom_days,next_payment_at,anchor_day,status,service_id,source,confidence,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(e.id,userId,e.name,e.type,e.amountMinor,e.currency,e.billingPeriod,e.customDays,e.nextPaymentAt,e.anchorDay,e.status,e.serviceId,e.source,e.confidence,e.createdAt,e.updatedAt)}
export async function saveExpense(userId:string,input:unknown,id?:string){let data;try{data=validateExpense(input)}catch(e){throw new ApiError(400,(e as Error).message)}
 if(!id){const count=await db().prepare('SELECT COUNT(*) AS n FROM recurring_expenses WHERE user_id=?').bind(userId).first<{n:number}>();if((count?.n??0)>=500)throw new ApiError(400,'Лимит MVP — 500 расходов.');}
 const previous=id?await getExpense(userId,id):null;if(id&&!previous)throw new ApiError(404,'Расход не найден.');
 const now=new Date().toISOString();const e:RecurringExpense={...data,id:id??crypto.randomUUID(),source:previous?.source??'manual',confidence:previous?.confidence??null,createdAt:previous?.createdAt??now,updatedAt:now};
 if(previous){await db().prepare('UPDATE recurring_expenses SET name=?,type=?,amount_minor=?,currency=?,billing_period=?,custom_days=?,next_payment_at=?,anchor_day=?,status=?,service_id=?,updated_at=? WHERE id=? AND user_id=?').bind(e.name,e.type,e.amountMinor,e.currency,e.billingPeriod,e.customDays,e.nextPaymentAt,e.anchorDay,e.status,e.serviceId,e.updatedAt,e.id,userId).run()}else{await insertExpense(userId,e).run()}return e;
}
