import {runDetection} from './candidates';
import {db,camelRow} from './db';
import {ApiError} from './auth';
import {parseStatement,MappingError,type ImportOptions} from '../import/parse';
import type {TransactionImport,Transaction} from '../domain/types';
export async function listImports(userId:string){const r=await db().prepare('SELECT * FROM transaction_imports WHERE user_id=? ORDER BY created_at DESC').bind(userId).all();return r.results.map(r=>camelRow<TransactionImport>(r))}
export async function importStatement(userId:string,bytes:Uint8Array,filename:string,options:ImportOptions){
 const id=crypto.randomUUID();let result;try{result=await parseStatement(bytes,filename,id,options)}catch(e){if(e instanceof MappingError)throw e;throw new ApiError(400,(e as Error).message)}
 const existing=await db().prepare('SELECT fingerprint,occurrence FROM transactions WHERE user_id=?').bind(userId).all<{fingerprint:string;occurrence:number}>();const keys=new Set(existing.results.map(t=>t.fingerprint+':'+t.occurrence));const fresh=result.transactions.filter(t=>!keys.has(t.fingerprint+':'+t.occurrence));const duplicates=result.transactions.length-fresh.length;
 if(!fresh.length)throw new ApiError(409,'Все операции из этой выписки уже загружены.');
 const count=await db().prepare('SELECT COUNT(*) AS n FROM transactions WHERE user_id=?').bind(userId).first<{n:number}>();if((count?.n??0)+fresh.length>30000)throw new ApiError(400,'Лимит MVP — 30 000 операций. Удалите старые импорты в настройках.');
 const safeFilename=filename.replace(/[^\p{L}\p{N}. _()-]/gu,'').slice(0,120)||'statement';
 await db().prepare('INSERT INTO transaction_imports (id,user_id,filename,format,status,created_at) VALUES (?,?,?,?,?,?)').bind(id,userId,safeFilename,filename.toLowerCase().endsWith('.pdf')?'pdf':filename.toLowerCase().endsWith('.xlsx')?'xlsx':'csv','processing',new Date().toISOString()).run();
 try{for(let offset=0;offset<fresh.length;offset+=80){await db().batch(fresh.slice(offset,offset+80).map(t=>db().prepare('INSERT OR IGNORE INTO transactions (id,user_id,original_merchant,normalized_merchant,amount_minor,currency,paid_at,recurring_expense_id,source_import_id,fingerprint,occurrence) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(t.id,userId,t.originalMerchant,t.normalizedMerchant,t.amountMinor,t.currency,t.paidAt,null,id,t.fingerprint,t.occurrence)))}
 const saved=await db().prepare('SELECT COUNT(*) AS n FROM transactions WHERE source_import_id=? AND user_id=?').bind(id,userId).first<{n:number}>();
 await db().prepare('UPDATE transaction_imports SET status=?,transaction_count=?,skipped_count=? WHERE id=? AND user_id=?').bind('completed',saved?.n??0,result.skipped+duplicates,id,userId).run();
 const candidateCount=await runDetection(userId,id);
 return {id,candidateCount,transactionCount:saved?.n??0,skippedCount:result.skipped+duplicates,duplicates,warnings:result.warnings};
 }catch{await db().batch([db().prepare('DELETE FROM detection_candidates WHERE import_id=? AND user_id=?').bind(id,userId),db().prepare('DELETE FROM transactions WHERE source_import_id=? AND user_id=?').bind(id,userId),db().prepare('UPDATE transaction_imports SET status=?,error=? WHERE id=? AND user_id=?').bind('failed','Импорт не завершён. Повторите загрузку.',id,userId)]);throw new ApiError(500,'Импорт не завершён. Попробуйте ещё раз.')}
}

