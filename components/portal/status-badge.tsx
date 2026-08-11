import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  Delivered: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Accepted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Fulfilled: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Replied: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Processing: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Shipped: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  New: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Invited: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Countered: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  Cancelled: "bg-red-500/10 text-red-600 dark:text-red-400",
  Rejected: "bg-red-500/10 text-red-600 dark:text-red-400",
  Declined: "bg-red-500/10 text-red-600 dark:text-red-400",
  Closed: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  "In Stock": "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Available: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "Low Stock": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Scheduled: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Busy: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Draft: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  "Partially Paid": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "Out of Stock": "bg-red-500/10 text-red-600 dark:text-red-400",
  Overdue: "bg-red-500/10 text-red-600 dark:text-red-400",
  "Due Today": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "Due Soon": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Unavailable: "bg-red-500/10 text-red-600 dark:text-red-400",
  Deactivated: "bg-red-500/10 text-red-600 dark:text-red-400",
  Restocked: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Sold: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Adjusted: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Damaged: "bg-red-500/10 text-red-600 dark:text-red-400",
  "In Progress": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Delayed: "bg-red-500/10 text-red-600 dark:text-red-400",
  Upcoming: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  "Not Started": "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  Waiting: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Sent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Viewed: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  Published: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Archived: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {status}
    </span>
  );
}
