import { formatMoney, formatShortDate, PAYMENT_METHOD_LABELS } from "@/lib/invoicing/ui";
import type { PaymentRecord } from "@/types/invoicing";

export function PaymentHistory({ payments, currency }: { payments: PaymentRecord[]; currency: string }) {
  if (payments.length === 0) {
    return <p className="text-xs text-muted-foreground py-4 text-center">No payments recorded yet.</p>;
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground">
              <th className="text-left font-medium px-3 py-2">Date</th>
              <th className="text-left font-medium px-3 py-2">Method</th>
              <th className="text-left font-medium px-3 py-2">Reference</th>
              <th className="text-left font-medium px-3 py-2">Recorded By</th>
              <th className="text-right font-medium px-3 py-2">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 align-top">{formatShortDate(p.paymentDate)}</td>
                <td className="px-3 py-2 align-top">{PAYMENT_METHOD_LABELS[p.method]}</td>
                <td className="px-3 py-2 align-top text-muted-foreground">{p.referenceNumber || "—"}</td>
                <td className="px-3 py-2 align-top text-muted-foreground">{p.createdByName}</td>
                <td className="px-3 py-2 align-top text-right tabular-nums font-medium text-foreground">
                  {formatMoney(p.amount, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
