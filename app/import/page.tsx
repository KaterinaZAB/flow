import {requireChatGPTUser} from '../chatgpt-auth';import {Shell} from '@/components/product/shell';import {ImportForm} from '@/components/product/import-form';import {listImports} from '@/lib/server/imports';
export const dynamic='force-dynamic';
export default async function ImportPage(){const user=await requireChatGPTUser('/import');return <Shell active="import" userName={user.displayName}><ImportForm imports={await listImports(user.userId)}/></Shell>}
