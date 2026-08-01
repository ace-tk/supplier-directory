"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, MessageCircleQuestion, Users2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/portal/status-badge";
import { formatMockDate } from "@/lib/mock-data";
import {
  verifyBuyerLead,
  rejectBuyerLead,
  requestMoreInfoAction,
  assignSuppliersToLead,
  updateBuyerLeadStatus,
} from "@/services/buyer-leads";
import type { BuyerLeadRecord, BuyerLeadStatus } from "@/types/buyer-lead";
import type { SUPPLIERS } from "@/data/suppliers";

const STATUS_OPTIONS: BuyerLeadStatus[] = [
  "Pending Verification",
  "Verified",
  "Supplier Matching",
  "Supplier Contacted",
  "Closed",
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

interface LeadDetailDialogProps {
  lead: BuyerLeadRecord | null;
  suppliers: typeof SUPPLIERS;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (lead: BuyerLeadRecord) => void;
}

export function LeadDetailDialog({ lead, suppliers, open, onOpenChange, onUpdated }: LeadDetailDialogProps) {
  const [infoNote, setInfoNote] = useState("");
  const [showInfoForm, setShowInfoForm] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>(() => lead?.assignedSupplierIds ?? []);
  const [busy, setBusy] = useState(false);

  if (!lead) return null;

  const relevantSuppliers = lead.category
    ? suppliers.filter((s) => s.industry.toLowerCase().includes(lead.category!.toLowerCase()) || true)
    : suppliers;

  async function runAction(action: () => Promise<{ success: boolean; data?: BuyerLeadRecord; error?: string }>) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.success || !result.data) {
      toast.error(result.error ?? "Something went wrong.");
      return;
    }
    onUpdated(result.data);
  }

  async function handleVerify() {
    await runAction(() => verifyBuyerLead(lead!.id));
    toast.success("Buyer verified");
  }

  async function handleReject() {
    await runAction(() => rejectBuyerLead(lead!.id));
    toast.success("Buyer lead rejected");
  }

  async function handleRequestInfo() {
    if (!infoNote.trim()) {
      toast.error("Enter what information you need from the buyer.");
      return;
    }
    await runAction(() => requestMoreInfoAction(lead!.id, infoNote));
    toast.success("Info request logged for this lead");
    setShowInfoForm(false);
    setInfoNote("");
  }

  async function handleStatusChange(status: string) {
    await runAction(() => updateBuyerLeadStatus(lead!.id, status as BuyerLeadStatus));
  }

  function toggleSupplier(id: string) {
    setSelectedSupplierIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function handleSaveAssignment() {
    await runAction(() => assignSuppliersToLead(lead!.id, selectedSupplierIds));
    toast.success(`${selectedSupplierIds.length} supplier${selectedSupplierIds.length !== 1 ? "s" : ""} assigned`);
    setShowAssign(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead.buyerName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Company">{lead.company}</Field>
            <Field label="Status">
              <StatusBadge status={lead.status} />
            </Field>
            <Field label="Email">{lead.email}</Field>
            <Field label="Phone">{lead.phone}</Field>
          </div>

          <Field label="Requirement">
            <p className="rounded-lg bg-muted/40 border border-border/40 p-3">{lead.requirement}</p>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">{lead.category ?? "—"}</Field>
            <Field label="Quantity">{lead.quantity ?? "—"}</Field>
            <Field label="Budget">{lead.budget ?? "—"}</Field>
            <Field label="Country">{lead.country ?? "—"}</Field>
          </div>

          <Field label="Created">{formatMockDate(lead.createdAt)}</Field>

          {lead.verificationNote && (
            <Field label="Verification Note">
              <p className="text-amber-600 dark:text-amber-400">{lead.verificationNote}</p>
            </Field>
          )}

          <Field label="Update Status">
            <Select value={lead.status} onValueChange={(v) => v && handleStatusChange(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {lead.status === "Pending Verification" && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleVerify} disabled={busy} className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Verify Buyer
              </Button>
              <Button size="sm" variant="outline" onClick={handleReject} disabled={busy} className="gap-1.5 text-red-500 hover:text-red-600">
                <XCircle className="h-3.5 w-3.5" /> Reject Buyer
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowInfoForm((v) => !v)} disabled={busy} className="gap-1.5">
                <MessageCircleQuestion className="h-3.5 w-3.5" /> Request More Info
              </Button>
            </div>
          )}

          {showInfoForm && (
            <div className="space-y-2">
              <Textarea
                rows={2}
                value={infoNote}
                onChange={(e) => setInfoNote(e.target.value)}
                placeholder="What additional information do you need from this buyer?"
              />
              <Button size="sm" onClick={handleRequestInfo} disabled={busy}>
                Send Request
              </Button>
            </div>
          )}

          <div>
            <Button size="sm" variant="outline" onClick={() => setShowAssign((v) => !v)} className="gap-1.5">
              <Users2 className="h-3.5 w-3.5" />
              {lead.assignedSupplierIds.length > 0
                ? `${lead.assignedSupplierIds.length} supplier${lead.assignedSupplierIds.length !== 1 ? "s" : ""} assigned`
                : "Assign Suppliers"}
            </Button>

            {showAssign && (
              <div className="mt-3 space-y-2">
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
                  {relevantSuppliers.slice(0, 30).map((s) => (
                    <label key={s.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={selectedSupplierIds.includes(s.id)}
                        onChange={() => toggleSupplier(s.id)}
                        className="h-3.5 w-3.5 rounded border-input accent-primary"
                      />
                      <span className="flex-1 truncate text-foreground">{s.companyName}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{s.industry}</span>
                    </label>
                  ))}
                </div>
                <Button size="sm" onClick={handleSaveAssignment} disabled={busy}>
                  Save Assignment
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
