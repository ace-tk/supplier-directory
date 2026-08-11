import { CheckCircle2, CircleDot, FilePlus2 } from "lucide-react";
import { formatMoney, formatShortDate } from "@/lib/invoicing/ui";
import type { PaymentRecord } from "@/types/invoicing";

interface TimelineStep {
  icon: typeof FilePlus2;
  label: string;
  detail: string;
  date: string;
  done: boolean;
}

/**
 * Built strictly from events that actually happened — invoice creation and
 * real Payment rows. No "Sent"/"Viewed" step is fabricated here since this
 * codebase has no real timestamp for those yet (see Stage 7's activity
 * trail, which will supply one).
 */
export function PaymentTimeline({
  createdAt,
  payments,
  currency,
  isFullyPaid,
}: {
  createdAt: string;
  payments: PaymentRecord[];
  currency: string;
  isFullyPaid: boolean;
}) {
  const sorted = [...payments].sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());

  const steps: TimelineStep[] = [
    { icon: FilePlus2, label: "Created", detail: "Invoice created", date: createdAt, done: true },
    ...sorted.map((p, i) => ({
      icon: CircleDot,
      label: i === sorted.length - 1 && isFullyPaid ? "Payment Received" : "Partial Payment",
      detail: `${formatMoney(p.amount, currency)} via ${p.method.replace("_", " ").toLowerCase()}`,
      date: p.paymentDate,
      done: true,
    })),
  ];

  if (isFullyPaid && sorted.length > 0) {
    steps.push({
      icon: CheckCircle2,
      label: "Paid in Full",
      detail: "Balance settled",
      date: sorted[sorted.length - 1].paymentDate,
      done: true,
    });
  }

  return (
    <div className="flex flex-col gap-0">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <step.icon className="h-4 w-4 text-primary shrink-0" />
            {i < steps.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
          </div>
          <div className="pb-4 -mt-0.5">
            <p className="text-xs font-medium text-foreground">{step.label}</p>
            <p className="text-xs text-muted-foreground">{step.detail}</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">{formatShortDate(step.date)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
