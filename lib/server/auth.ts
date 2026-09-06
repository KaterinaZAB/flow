import {getChatGPTUser} from '../../app/chatgpt-auth';
import {db} from './db';
export class ApiError extends Error{constructor(public status:number,message:string){super(message)}}
export async function authorize(request?:Request){const user=await getChatGPTUser();if(!user)throw new ApiError(401,'Войдите в аккаунт, чтобы продолжить.');
 if(request&& !['GET','HEAD'].includes(request.method)){const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)throw new ApiError(403,'Запрос должен быть отправлен из приложения.')}
 await db().prepare('INSERT OR IGNORE INTO users (id,created_at) VALUES (?,?)').bind(user.userId,new Date().toISOString()).run();return user;
}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
export function apiError(error:unknown){return json({error:error instanceof ApiError?error.message:'Не удалось выполнить действие. Попробуйте ещё раз.'},error instanceof ApiError?error.status:500)}
export async function body(request:Request){const length=Number(request.headers.get('content-length')??0);if(length>16000)throw new ApiError(413,'Запрос слишком большой.');const text=await request.text();if(text.length>16000)throw new ApiError(413,'Запрос слишком большой.');try{return JSON.parse(text)}catch{throw new ApiError(400,'Некорректные данные запроса.')}}

