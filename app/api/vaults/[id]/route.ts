import { getVault, putVault, deleteVault, failure } from '@/lib/server/vault';
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, ctx: Context) {
  try {
    return await getVault(req, (await ctx.params).id);
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(req: Request, ctx: Context) {
  try {
    return await putVault(req, (await ctx.params).id);
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request, ctx: Context) {
  try {
    return await deleteVault(req, (await ctx.params).id);
  } catch (e) {
    return failure(e);
  }
}
