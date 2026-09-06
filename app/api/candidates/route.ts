import {authorize,json,apiError,body} from '@/lib/server/auth';import {listCandidates,decideCandidates} from '@/lib/server/candidates';
export async function GET(){try{const u=await authorize();return json(await listCandidates(u.userId))}catch(e){return apiError(e)}}
export async function POST(req:Request){try{const u=await authorize(req);return json(await decideCandidates(u.userId,await body(req)))}catch(e){return apiError(e)}}
