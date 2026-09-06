import {authorize,json,apiError,body,ApiError} from '@/lib/server/auth';
import {getExpense,saveExpense} from '@/lib/server/expenses';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){try{const u=await authorize();const {id}=await params;const e=await getExpense(u.userId,id);if(!e)throw new ApiError(404,'Расход не найден.');return json(e)}catch(e){return apiError(e)}}
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){try{const u=await authorize(req);const {id}=await params;return json(await saveExpense(u.userId,await body(req),id))}catch(e){return apiError(e)}}
