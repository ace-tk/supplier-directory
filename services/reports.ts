"use server";

import { getUser } from "@/lib/session";
import { getReportRows } from "@/lib/invoicing/reports";
import type { ReportKind, ReportFilter, ReportResult } from "@/lib/invoicing/reports-types";
import type { InvoiceActionResult } from "@/types/invoicing";

export async function getReportAction(kind: ReportKind, filter: ReportFilter): Promise<InvoiceActionResult<ReportResult>> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };
  return { success: true, data: await getReportRows(user.id, kind, filter) };
}
