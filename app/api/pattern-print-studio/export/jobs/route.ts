import { DEFAULT_EXPORT_API } from "@/features/pattern-print-studio/export/client";
import { exportCaller } from "@/features/pattern-print-studio/export/server/guard";
import { jobsCreate, jobsList } from "@/features/pattern-print-studio/export/server/handlers";

export const runtime = "nodejs";

/** Pattern Print Studio: the last 20 exports of a document (?doc=<id>). */
export async function GET(request: Request) {
  const who = await exportCaller();
  return "refused" in who ? who.refused : jobsList(DEFAULT_EXPORT_API, who.userId, request);
}

/** Pattern Print Studio: start an export as a background job. */
export async function POST(request: Request) {
  const who = await exportCaller();
  return "refused" in who ? who.refused : jobsCreate(DEFAULT_EXPORT_API, who.userId, request);
}
