import { formatDateTime } from "@/lib/invoicing/ui";
import type { InvoiceActivityRecord } from "@/types/invoicing";

/** Compact, real-events-only audit trail — one row per logged mutation (see lib/invoicing/activity.ts). */
export function ActivityTimeline({ activity }: { activity: InvoiceActivityRecord[] }) {
  if (activity.length === 0) {
    return <p className="text-xs text-muted-foreground py-4 text-center">No activity recorded yet.</p>;
  }

  return (
    <div className="space-y-0">
      {activity.map((a, i) => (
        <div key={a.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
            {i < activity.length - 1 && <div className="w-px flex-1 bg-border my-1" />}
          </div>
          <div className="pb-4">
            <p className="text-xs text-foreground">{a.description}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {formatDateTime(a.createdAt)}
              {a.actorName ? ` · ${a.actorName}` : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
