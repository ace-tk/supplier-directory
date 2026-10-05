import { DEFAULT_EXPORT_API } from "@/features/pattern-print-studio/export/client";
import { isPatternStudioEnabled } from "@/features/pattern-print-studio/flag";
import { exportCaller } from "@/features/pattern-print-studio/export/server/guard";
import { jobAction, jobDownload } from "@/features/pattern-print-studio/export/server/handlers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; action: string }> };

/**
 * Pattern Print Studio export jobs.
 *   GET  …/jobs/<id>/download?…  the finished file — needs a valid signed link, not a session
 *   GET  …/jobs/<id>/link?doc=…  a fresh signed link
 */
export async function GET(request: Request, ctx: Ctx) {
  const { id, action } = await ctx.params;
  if (action === "download") return isPatternStudioEnabled() ? jobDownload(id, request) : new Response(null, { status: 404 });
  const who = await exportCaller();
  return "refused" in who ? who.refused : jobAction(DEFAULT_EXPORT_API, who.userId, id, action, request);
}

/** POST …/jobs/<id>/cancel?doc=… · POST …/jobs/<id>/retry?doc=… */
export async function POST(request: Request, ctx: Ctx) {
  const { id, action } = await ctx.params;
  const who = await exportCaller();
  return "refused" in who ? who.refused : jobAction(DEFAULT_EXPORT_API, who.userId, id, action, request);
}
