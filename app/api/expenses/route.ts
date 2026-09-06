import {authorize,json,apiError,body} from '@/lib/server/auth';
import {listExpenses,saveExpense} from '@/lib/server/expenses';
export async function GET(){try{const u=await authorize();return json(await listExpenses(u.userId))}catch(e){return apiError(e)}}
export async function POST(req:Request){try{const u=await authorize(req);return json(await saveExpense(u.userId,await body(req)),201)}catch(e){return apiError(e)}}
