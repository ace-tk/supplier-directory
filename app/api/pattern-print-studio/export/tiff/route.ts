import { refuseExportCall } from "@/features/pattern-print-studio/export/server/guard";
import { tiffNow } from "@/features/pattern-print-studio/export/server/handlers";

export const runtime = "nodejs";

/** Pattern Print Studio: a low-resolution TIFF (20–72 DPI), rendered straight away by the export renderer. */
export async function POST(request: Request) {
  return (await refuseExportCall()) ?? tiffNow(request);
}
