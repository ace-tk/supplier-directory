"use client";

import { useState, type ComponentType } from "react";
import { Phone, Mail, MessageCircle, Users, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getCommunicationHistory,
  formatHistoryDate,
  type CommunicationType,
  type CommunicationStatus,
} from "@/lib/communication-history";

const FILTERS: { key: "All" | CommunicationType; label: string }[] = [
  { key: "All", label: "All" },
  { key: "Call", label: "Calls" },
  { key: "Email", label: "Emails" },
  { key: "WhatsApp", label: "WhatsApp" },
  { key: "Meeting", label: "Meetings" },
];

const TYPE_ICON: Record<CommunicationType, ComponentType<{ className?: string }>> = {
  Call: Phone,
  Email: Mail,
  WhatsApp: MessageCircle,
  Meeting: Users,
};

const STATUS_STYLE: Record<CommunicationStatus, string> = {
  Sent: "bg-sky text-sky-ink ",
  Opened: "bg-lav text-lav-ink ",
  Completed: "bg-mint text-mint-ink ",
  Pending: "bg-butter text-butter-ink ",
  Missed: "bg-rose text-rose-ink ",
  Scheduled: "bg-sky text-sky-ink ",
};

export function CommunicationHistoryModal({
  supplierId,
  companyName,
  open,
  onOpenChange,
}: {
  supplierId: string | null;
  companyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [filter, setFilter] = useState<"All" | CommunicationType>("All");

  const entries = supplierId ? getCommunicationHistory(supplierId) : [];
  const filtered = filter === "All" ? entries : entries.filter((e) => e.type === filter);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Communication History
          </DialogTitle>
          <DialogDescription>{companyName}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors duration-150",
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-transparent hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2 min-h-0">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">
              No communication records for this filter.
            </p>
          ) : (
            filtered.map((entry) => {
              const Icon = TYPE_ICON[entry.type];
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-muted/20"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted shrink-0">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-xs font-medium text-foreground">{entry.type}</p>
                      <span
                        className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0",
                          STATUS_STYLE[entry.status]
                        )}
                      >
                        {entry.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{entry.notes}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1.5">
                      <span>{formatHistoryDate(entry.date)}</span>
                      <span>·</span>
                      <span>{entry.user}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
