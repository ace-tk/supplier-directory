import { refuseExportCall } from "@/features/pattern-print-studio/export/server/guard";
import { preview } from "@/features/pattern-print-studio/export/server/handlers";

// sharp needs the Node.js runtime.
export const runtime = "nodejs";

/** Pattern Print Studio: a low-resolution preview of an export, made by the export renderer. */
export async function POST(request: Request) {
  return (await refuseExportCall()) ?? preview(request);
}
