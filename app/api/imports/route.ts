import {extractPdf} from '@/lib/import/pdf';
import {authorize,json,apiError,ApiError} from '@/lib/server/auth';
import {importStatement,listImports} from '@/lib/server/imports';
import {MappingError,type ImportOptions} from '@/lib/import/parse';
export async function GET(){try{const u=await authorize();return json(await listImports(u.userId))}catch(e){return apiError(e)}}
export async function POST(req:Request){try{const u=await authorize(req);const max=5*1024*1024+700000;if(Number(req.headers.get('content-length')??0)>max)throw new ApiError(413,'Максимальный размер PDF — 5 МБ; CSV/XLSX — 2 МБ.');
 const reader=req.body?.getReader();if(!reader)throw new ApiError(400,'Выберите файл.');const chunks:Uint8Array[]=[];let length=0;while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();throw new ApiError(413,'Максимальный размер PDF — 5 МБ; CSV/XLSX — 2 МБ.')}chunks.push(value)}
 const data=await new Response(new Blob(chunks as BlobPart[]),{headers:{'content-type':req.headers.get('content-type')??''}}).formData();const file=data.get('file');if(!(file instanceof File))throw new ApiError(400,'Выберите PDF, CSV или XLSX.');let mapping;try{mapping=data.get('mapping')?JSON.parse(String(data.get('mapping'))):undefined}catch{throw new ApiError(400,'Некорректные столбцы.')}
 const isPdf=file.name.toLowerCase().endsWith('.pdf');const bytes=new Uint8Array(await file.arrayBuffer());
 if(isPdf&&data.get('pdfReviewed')!=='true'){try{return json({pdfPreview:await extractPdf(bytes,String(data.get('currency')??'RUB'))})}catch(e){throw new ApiError(400,(e as Error).message)}}
 let pdfRows;try{pdfRows=data.get('pdfRows')?JSON.parse(String(data.get('pdfRows'))):undefined}catch{throw new ApiError(400,'Некорректные операции PDF.')}
 const options:ImportOptions={currency:String(data.get('currency')??'RUB'),amountMode:String(data.get('amountMode')??'negative') as 'negative'|'positive',mapping,pdfRows};
 return json(await importStatement(u.userId,bytes,file.name,options),201);
 }catch(e){if(e instanceof MappingError)return json({error:e.message,headers:e.headers,mappingRequired:true},422);return apiError(e)}}
