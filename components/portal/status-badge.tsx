import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  Delivered: "bg-mint text-mint-ink ",
  Accepted: "bg-mint text-mint-ink ",
  Fulfilled: "bg-mint text-mint-ink ",
  Active: "bg-mint text-mint-ink ",
  Replied: "bg-mint text-mint-ink ",
  Processing: "bg-sky text-sky-ink ",
  Shipped: "bg-sky text-sky-ink ",
  Pending: "bg-butter text-butter-ink ",
  New: "bg-butter text-butter-ink ",
  Invited: "bg-butter text-butter-ink ",
  Countered: "bg-lav text-lav-ink ",
  Cancelled: "bg-rose text-rose-ink ",
  Rejected: "bg-rose text-rose-ink ",
  Declined: "bg-rose text-rose-ink ",
  Closed: "bg-soft/10 text-muted-foreground ",
  "In Stock": "bg-mint text-mint-ink ",
  Approved: "bg-mint text-mint-ink ",
  Paid: "bg-mint text-mint-ink ",
  Available: "bg-mint text-mint-ink ",
  Completed: "bg-mint text-mint-ink ",
  "Low Stock": "bg-butter text-butter-ink ",
  Scheduled: "bg-butter text-butter-ink ",
  Busy: "bg-butter text-butter-ink ",
  Draft: "bg-soft/10 text-muted-foreground ",
  "Partially Paid": "bg-butter text-butter-ink ",
  "Out of Stock": "bg-rose text-rose-ink ",
  Overdue: "bg-rose text-rose-ink ",
  "Due Today": "bg-butter text-butter-ink ",
  "Due Soon": "bg-butter text-butter-ink ",
  Unavailable: "bg-rose text-rose-ink ",
  Deactivated: "bg-rose text-rose-ink ",
  Restocked: "bg-mint text-mint-ink ",
  Sold: "bg-sky text-sky-ink ",
  Adjusted: "bg-butter text-butter-ink ",
  Damaged: "bg-rose text-rose-ink ",
  "In Progress": "bg-sky text-sky-ink ",
  Delayed: "bg-rose text-rose-ink ",
  Upcoming: "bg-soft/10 text-muted-foreground ",
  "Not Started": "bg-soft/10 text-muted-foreground ",
  Waiting: "bg-butter text-butter-ink ",
  Sent: "bg-sky text-sky-ink ",
  Submitted: "bg-sky text-sky-ink ",
  Viewed: "bg-lav text-lav-ink ",
  Published: "bg-mint text-mint-ink ",
  Archived: "bg-soft/10 text-muted-foreground ",
  Warehouse: "bg-sky text-sky-ink ",
  "Retail Store": "bg-lav text-lav-ink ",
  Unassigned: "bg-soft/10 text-muted-foreground ",
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
