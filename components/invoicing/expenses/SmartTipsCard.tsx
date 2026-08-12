"use client";

import { Lightbulb } from "lucide-react";

/** Static, contextual UX tips — no LLM call. Each tip only shows while
 * it's still actionable for the current form state. */
export function SmartTipsCard({
  hasInvoice,
  hasGst,
  hasAttachment,
}: {
  hasInvoice: boolean;
  hasGst: boolean;
  hasAttachment: boolean;
}) {
  const tips: string[] = [];
  if (!hasInvoice) tips.push("Link this expense to an invoice to keep your records organized.");
  if (!hasGst) tips.push("Add GST details for accurate tax reporting.");
  if (!hasAttachment) tips.push("Attach a receipt to improve record keeping.");
  if (tips.length === 0) tips.push("This expense looks complete — nice work keeping your records tidy.");

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
      <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Smart Tips
      </h3>
      <ul className="space-y-1.5">
        {tips.map((tip) => (
          <li key={tip} className="text-[11px] text-muted-foreground flex gap-1.5">
            <span className="text-amber-500 shrink-0">•</span> {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}
