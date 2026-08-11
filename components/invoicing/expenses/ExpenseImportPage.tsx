"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/expenses/ui";
import { formatShortDate } from "@/lib/invoicing/ui";
import { validateExpenseImportAction, confirmExpenseImportAction } from "@/services/expenses";
import type { ExpenseImportRowResult, ExpenseImportSummary } from "@/lib/expenses/import-types";

type Step = "upload" | "preview" | "result";

export function ExpenseImportPage({ basePath }: { basePath: string }) {
  const router = useRouter();
  const expensesPath = `${basePath}/expenses`;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [previewRows, setPreviewRows] = useState<ExpenseImportRowResult[]>([]);
  const [summary, setSummary] = useState<ExpenseImportSummary | null>(null);

  const validCount = previewRows.filter((r) => r.status === "valid").length;
  const invalidCount = previewRows.length - validCount;

  async function handleDownloadTemplate() {
    const { downloadExpenseImportTemplate } = await import("@/lib/expenses/expenses-io");
    downloadExpenseImportTemplate();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    try {
      const { parseExpenseImportFile } = await import("@/lib/expenses/expenses-io");
      const rawRows = await parseExpenseImportFile(file);
      if (rawRows.length === 0) {
        toast.error("No rows found in that file — check it matches the template's columns.");
        return;
      }
      const result = await validateExpenseImportAction(rawRows);
      if (!result.success) return toast.error(result.error);
      setPreviewRows(result.data);
      setStep("preview");
    } catch {
      toast.error("Could not read that file. Make sure it's a valid .xlsx or .xls file.");
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    try {
      const rawRows = previewRows.map((r) => r.raw);
      const result = await confirmExpenseImportAction(rawRows);
      if (!result.success) return toast.error(result.error);
      setSummary(result.data);
      setStep("result");
    } finally {
      setConfirming(false);
    }
  }

  function reset() {
    setStep("upload");
    setFileName("");
    setPreviewRows([]);
    setSummary(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Expenses from Excel"
        description="Bulk-create expenses from a .xlsx or .xls file — every row is validated against your real data before anything is saved."
        breadcrumbs={[
          { label: "Invoice Management", href: basePath },
          { label: "Expenses", href: expensesPath },
          { label: "Import" },
        ]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" render={<Link href={expensesPath} />} nativeButton={false}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Expenses
          </Button>
        }
      />

      {step === "upload" && (
        <div className="rounded-2xl border border-border bg-card p-8 max-w-2xl space-y-6">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">1. Download the template</h2>
            <p className="text-xs text-muted-foreground">
              Columns: Date · Time · Category · Location · Amount · Currency · Buyer/Supplier · Related Invoice · Notes. Category
              must be one of: {Object.values(EXPENSE_CATEGORY_LABELS).join(", ")}.
            </p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadTemplate}>
              <Download className="h-3.5 w-3.5" /> Download Template
            </Button>
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <h2 className="text-sm font-semibold text-foreground">2. Upload your filled-in file</h2>
            <p className="text-xs text-muted-foreground">
              Buyer/Supplier and Related Invoice are matched against your real records — unrecognized or ambiguous values will be
              flagged for review before anything is imported.
            </p>
            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-10 text-center cursor-pointer hover:border-primary/50 transition-colors">
              {parsing ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
              )}
              <span className="text-sm text-foreground font-medium">{parsing ? "Reading file…" : "Click to choose a file"}</span>
              <span className="text-xs text-muted-foreground">{fileName || ".xlsx or .xls"}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileSelected}
                disabled={parsing}
              />
            </label>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> {validCount} valid
              </span>
              <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4" /> {invalidCount} invalid
              </span>
              <span className="text-muted-foreground">— invalid rows will be skipped, not imported.</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                Choose Different File
              </Button>
              <Button size="sm" onClick={handleConfirm} disabled={confirming || validCount === 0} className="gap-1.5">
                {confirming && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Import ({validCount})
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground">
                    <th className="text-left font-medium px-3 py-2">Row</th>
                    <th className="text-left font-medium px-3 py-2">Date</th>
                    <th className="text-left font-medium px-3 py-2">Category</th>
                    <th className="text-right font-medium px-3 py-2">Amount</th>
                    <th className="text-left font-medium px-3 py-2">Buyer/Supplier</th>
                    <th className="text-left font-medium px-3 py-2">Related Invoice</th>
                    <th className="text-left font-medium px-3 py-2">Validation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {previewRows.map((row) => (
                    <tr key={row.rowNumber} className={row.status === "invalid" ? "bg-red-500/5" : undefined}>
                      <td className="px-3 py-2 align-top tabular-nums text-muted-foreground">{row.rowNumber}</td>
                      <td className="px-3 py-2 align-top">
                        {row.resolved.occurredAt ? formatShortDate(row.resolved.occurredAt) : row.raw.date || "—"}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {row.resolved.customCategoryId
                          ? row.raw.category
                          : row.resolved.category
                            ? EXPENSE_CATEGORY_LABELS[row.resolved.category]
                            : row.raw.category || "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-right tabular-nums">{row.raw.amount || "—"}</td>
                      <td className="px-3 py-2 align-top">{row.resolved.partyLabel || row.raw.party || "—"}</td>
                      <td className="px-3 py-2 align-top font-mono">{row.resolved.relatedInvoiceLabel || row.raw.invoice || "—"}</td>
                      <td className="px-3 py-2 align-top">
                        {row.status === "valid" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Valid
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-600 dark:text-red-400">
                              <XCircle className="h-3 w-3" /> Invalid
                            </span>
                            <ul className="text-[11px] text-red-600 dark:text-red-400 list-disc list-inside">
                              {row.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {step === "result" && summary && (
        <div className="rounded-2xl border border-border bg-card p-8 max-w-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {summary.importedCount} expense{summary.importedCount === 1 ? "" : "s"} imported
                {summary.rejectedCount > 0 && <> · {summary.rejectedCount} row{summary.rejectedCount === 1 ? "" : "s"} rejected</>}
              </p>
              <p className="text-xs text-muted-foreground">Rejected rows were not saved — nothing was guessed or created for them.</p>
            </div>
          </div>

          {summary.rows.some((r) => r.status === "invalid") && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">Rejected rows</p>
              <ul className="text-xs text-muted-foreground space-y-1 max-h-48 overflow-y-auto">
                {summary.rows
                  .filter((r) => r.status === "invalid")
                  .map((r) => (
                    <li key={r.rowNumber}>
                      Row {r.rowNumber}: {r.errors.join(" ")}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Import Another File
            </Button>
            <Button
              size="sm"
              onClick={() => {
                router.push(expensesPath);
                router.refresh();
              }}
            >
              Back to Expenses
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
