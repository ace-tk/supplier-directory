import { refuseExportCall } from "@/features/pattern-print-studio/export/server/guard";
import { assetHead, assetPut } from "@/features/pattern-print-studio/export/server/handlers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hash: string }> };

/** Pattern Print Studio: does the server already hold this original image (by SHA-256)? */
export async function HEAD(_request: Request, ctx: Ctx) {
  const refused = await refuseExportCall();
  if (refused) return new Response(null, { status: refused.status });
  return assetHead((await ctx.params).hash);
}

/** Pattern Print Studio: upload one original image, stored under its SHA-256. */
export async function PUT(request: Request, ctx: Ctx) {
  return (await refuseExportCall()) ?? assetPut((await ctx.params).hash, request);
}
