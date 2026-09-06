import {getChatGPTUser} from '../../app/chatgpt-auth';
import {db} from './db';
export class ApiError extends Error{constructor(public status:number,message:string){super(message)}}
export async function authorize(request?:Request){const user=await getChatGPTUser();if(!user)throw new ApiError(401,'Войдите в аккаунт, чтобы продолжить.');
 if(request&&!['GET','HEAD'].includes(request.method)){const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)throw new ApiError(403,'Запрос должен быть отправлен из приложения.')}
 await db().prepare('INSERT OR IGNORE INTO users (id,created_at) VALUES (?,?)').bind(user.userId,new Date().toISOString()).run();return user;
}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
export function apiError(error:unknown){return json({error:error instanceof ApiError?error.message:'Не удалось выполнить действие. Попробуйте ещё раз.'},error instanceof ApiError?error.status:500)}
export async function body(request:Request){if(Number(request.headers.get('content-length')??0)>16000)throw new ApiError(413,'Запрос слишком большой.');const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'Запрос пуст.');let length=0;const parts:Uint8Array[]=[];while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>16000){await reader.cancel();throw new ApiError(413,'Запрос слишком большой.')}parts.push(value)}const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}try{return JSON.parse(new TextDecoder().decode(bytes))}catch{throw new ApiError(400,'Некорректные данные запроса.')}}
