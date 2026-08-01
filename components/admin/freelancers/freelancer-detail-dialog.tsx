"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/portal/status-badge";
import type { FreelancerRecord } from "@/types/freelancer";

interface FreelancerDetailDialogProps {
  freelancer: FreelancerRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export function FreelancerDetailDialog({ freelancer, open, onOpenChange }: FreelancerDetailDialogProps) {
  if (!freelancer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{freelancer.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Email">{freelancer.email}</Field>

          <Field label="Skills">
            <div className="flex flex-wrap gap-1.5">
              {freelancer.skills.map((s) => (
                <Badge key={s} variant="secondary" className="text-[11px] font-normal">
                  {s}
                </Badge>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Assigned Clients">
              <ul className="space-y-0.5">
                {freelancer.assignedClients.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </Field>
            <Field label="Assigned Suppliers">
              <ul className="space-y-0.5">
                {freelancer.assignedSuppliers.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Active Projects">{freelancer.activeProjects}</Field>
            <Field label="Performance Score">{freelancer.performanceScore}%</Field>
            <Field label="Payment Status">
              <StatusBadge status={freelancer.paymentStatus} />
            </Field>
            <Field label="Availability">
              <StatusBadge status={freelancer.status === "Deactivated" ? "Deactivated" : freelancer.availability} />
            </Field>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
