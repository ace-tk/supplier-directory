"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileBarChart } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { getReportAction } from "@/services/reports";
import { REPORT_KIND_LABELS, type ReportKind, type ReportFilter, type ReportResult } from "@/lib/invoicing/reports-types";
import { INVOICE_STATUS_LABELS } from "@/lib/invoicing/ui";
import type { InvoiceStatus, InvoiceType } from "@/types/invoicing";

const REPORT_KINDS: ReportKind[] = ["SALES", "PURCHASE", "RECEIVABLES", "PAYABLES", "GST_SUMMARY", "EXPENSE", "PAYMENT"];
const STATUS_OPTIONS: InvoiceStatus[] = ["DRAFT", "SENT", "PENDING", "PARTIALLY_PAID", "PAID", "CANCELLED"];

export function InvoiceReports({ basePath }: { basePath: string }) {
  const [kind, setKind] = useState<ReportKind>("SALES");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [partyName, setPartyName] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "ALL">("ALL");
  const [documentType, setDocumentType] = useState<InvoiceType | "ALL">("ALL");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(true);

  const showStatusFilter = kind === "SALES" || kind === "PURCHASE" || kind === "RECEIVABLES" || kind === "PAYABLES";
  const showDocTypeFilter = kind === "GST_SUMMARY" || kind === "PAYMENT";

  const filter: ReportFilter = useMemo(
    () => ({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      partyName: partyName || undefined,
      status: showStatusFilter && status !== "ALL" ? status : undefined,
      documentType: showDocTypeFilter && documentType !== "ALL" ? documentType : undefined,
    }),
    [dateFrom, dateTo, partyName, status, documentType, showStatusFilter, showDocTypeFilter]
  );

  useEffect(() => {
    let cancelled = false;
    getReportAction(kind, filter).then((r) => {
      if (cancelled) return;
      if (r.success) setResult(r.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, filter]);

  async function handleExport() {
    if (!result) return;
    const { exportReportToCsv } = await import("@/lib/invoicing/reports-export");
    exportReportToCsv(result, `${kind.toLowerCase()}-report`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Real, filtered data from your invoices, payments, and expenses."
        breadcrumbs={[{ label: "Invoice Management", href: basePath }, { label: "Reports" }]}
      />

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Report">
          <Select value={kind} onValueChange={(v) => v && setKind(v as ReportKind)}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {REPORT_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="From">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </Field>
        <Field label="To">
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </Field>
        <Field label="Party">
          <Input value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="Search party name" className="w-48" />
        </Field>

        {showStatusFilter && (
          <Field label="Status">
            <Select value={status} onValueChange={(v) => v && setStatus(v as InvoiceStatus | "ALL")}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {INVOICE_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {showDocTypeFilter && (
          <Field label="Direction">
            <Select value={documentType} onValueChange={(v) => v && setDocumentType(v as InvoiceType | "ALL")}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Sales &amp; Purchase</SelectItem>
                <SelectItem value="SALES">Sales</SelectItem>
                <SelectItem value="PURCHASE">Purchase</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}

        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport} disabled={!result || result.rows.length === 0}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {kind === "GST_SUMMARY" && (
        <p className="text-xs text-muted-foreground">
          This is a raw taxable-amount and GST breakdown for your own records — it is not an official GST filing document.
        </p>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-card h-64 animate-pulse" />
      ) : !result || result.rows.length === 0 ? (
        <EmptyState icon={FileBarChart} title="No data for these filters" description="Try widening the date range or clearing a filter." />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground">
                  {result.columns.map((col) => (
                    <th key={col.key} className={`font-medium px-3 py-2 ${col.align === "right" ? "text-right" : "text-left"}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.rows.map((row, i) => (
                  <tr key={i}>
                    {result.columns.map((col) => (
                      <td key={col.key} className={`px-3 py-2 tabular-nums ${col.align === "right" ? "text-right" : "text-left"}`}>
                        {row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
