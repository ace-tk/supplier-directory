"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, FolderPlus, Loader2, ArrowLeft, Mail, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProposalAction } from "@/services/proposals";
import type { FreelancerRecord } from "@/types/freelancer";

interface AddTaskDialogProps {
  freelancer: FreelancerRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
  onAssignSelected: (freelancer: FreelancerRecord) => void;
}

type Mode = "choose" | "proposal";

const emptyProposal = { title: "", clientName: "", description: "", email: true, whatsapp: false };

export function AddTaskDialog({ freelancer, open, onOpenChange, onCreated, onAssignSelected }: AddTaskDialogProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [submitting, setSubmitting] = useState(false);
  const [proposal, setProposal] = useState(emptyProposal);

  function reset() {
    setMode("choose");
    setProposal(emptyProposal);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleSendProposal() {
    if (!freelancer) return;
    if (!proposal.title.trim() || !proposal.clientName.trim()) {
      toast.error("Proposal title and client are required.");
      return;
    }
    if (!proposal.email && !proposal.whatsapp) {
      toast.error("Select at least one channel to send through.");
      return;
    }
    setSubmitting(true);
    const channel = proposal.email && proposal.whatsapp ? "BOTH" : proposal.email ? "EMAIL" : "WHATSAPP";
    const result = await createProposalAction({
      freelancerUserId: freelancer.id,
      title: proposal.title,
      clientName: proposal.clientName,
      description: proposal.description || undefined,
      channel,
    });
    setSubmitting(false);
    if (!result.success) return toast.error(result.error);
    toast.success(`Proposal sent to ${freelancer.name}`);
    onCreated();
    handleOpenChange(false);
  }

  function handleAssignClick() {
    if (!freelancer) return;
    handleOpenChange(false);
    onAssignSelected(freelancer);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "choose" && `Add Task${freelancer ? ` — ${freelancer.name}` : ""}`}
            {mode === "proposal" && "Create Proposal"}
          </DialogTitle>
        </DialogHeader>

        {mode === "choose" && (
          <div className="grid grid-cols-2 gap-3 py-2">
            <button
              type="button"
              onClick={() => setMode("proposal")}
              className="flex flex-col items-center gap-2 rounded-xl border border-border p-5 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-foreground">Proposal</span>
              <span className="text-[11px] text-muted-foreground">Send a proposal via Email or WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={handleAssignClick}
              className="flex flex-col items-center gap-2 rounded-xl border border-border p-5 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                <FolderPlus className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-foreground">Assign</span>
              <span className="text-[11px] text-muted-foreground">Create and assign a new project</span>
            </button>
          </div>
        )}

        {mode === "proposal" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Proposal Title</Label>
              <Input value={proposal.title} onChange={(e) => setProposal((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Product photography for Q3 catalog" />
            </div>
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Input value={proposal.clientName} onChange={(e) => setProposal((f) => ({ ...f, clientName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea rows={3} value={proposal.description} onChange={(e) => setProposal((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Send via</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setProposal((f) => ({ ...f, email: !f.email }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${proposal.email ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}
                >
                  <Mail className="h-3.5 w-3.5" /> Email
                </button>
                <button
                  type="button"
                  onClick={() => setProposal((f) => ({ ...f, whatsapp: !f.whatsapp }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${proposal.whatsapp ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}
                >
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {mode !== "choose" && (
            <Button variant="ghost" className="mr-auto gap-1.5" onClick={() => setMode("choose")}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
          )}
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          {mode === "proposal" && (
            <Button onClick={handleSendProposal} disabled={submitting} className="gap-1.5">
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Send Proposal
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
