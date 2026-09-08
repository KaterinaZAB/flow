import {createVault,failure} from '@/lib/server/vault';
export async function POST(req:Request){try{return await createVault(req);}catch(e){return failure(e);}}
