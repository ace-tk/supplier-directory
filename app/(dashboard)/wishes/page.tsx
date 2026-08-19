"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { StatusBadge } from "@/components/portal/status-badge";
import { Button } from "@/components/ui/button";
import { getAllWishesAction, updateWishStatusAction } from "@/services/wishes";
import type { ProductWishRecord } from "@/types/wishes";

const STATUS_LABELS = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
} as const;

const NEXT_STATUS: Partial<Record<ProductWishRecord["status"], { label: string; next: ProductWishRecord["status"] }>> = {
  SUBMITTED: { label: "Move to In Progress", next: "IN_PROGRESS" },
  IN_PROGRESS: { label: "Mark Completed", next: "COMPLETED" },
};

/** Minimal, read-oriented admin view — reuses the same RecordsTable/
 * StatusBadge pattern already used for Buyer Enquiries/Counter Offers,
 * not a new admin module. Only shows real submitted wishes (DRAFT wishes
 * are the buyer's private, unsubmitted scratch space). */
export default function WishBoardPage() {
  const [wishes, setWishes] = useState<ProductWishRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  function refresh() {
    getAllWishesAction().then((result) => {
      if (result.success) setWishes(result.data);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAdvance(wish: ProductWishRecord) {
    const transition = NEXT_STATUS[wish.status];
    if (!transition) return;
    setUpdatingId(wish.id);
    const result = await updateWishStatusAction(wish.id, transition.next);
    setUpdatingId(null);
    if (!result.success) return toast.error(result.error);
    toast.success(`${wish.name} moved to ${STATUS_LABELS[transition.next]}`);
    refresh();
  }

  const columns: RecordColumn<ProductWishRecord>[] = [
    { key: "name", label: "Wish", render: (r) => <span className="font-medium text-foreground">{r.name}</span> },
    { key: "owner", label: "Buyer", render: (r) => r.ownerName, className: "text-muted-foreground" },
    { key: "category", label: "Category", render: (r) => r.category || "—" },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={STATUS_LABELS[r.status]} /> },
    { key: "date", label: "Submitted", render: (r) => new Date(r.createdAt).toLocaleDateString(), className: "text-muted-foreground" },
    {
      key: "action",
      label: "",
      render: (r) => {
        const transition = NEXT_STATUS[r.status];
        if (!transition) return null;
        return (
          <Button variant="outline" size="sm" className="gap-1.5" disabled={updatingId === r.id} onClick={() => handleAdvance(r)}>
            {updatingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
            {transition.label}
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader title="Wish Board" description="Products buyers have submitted for sourcing or manufacturing." />
      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">Loading wishes...</div>
      ) : (
        <RecordsTable columns={columns} rows={wishes} emptyMessage="No wishes have been submitted yet." />
      )}
    </div>
  );
}
