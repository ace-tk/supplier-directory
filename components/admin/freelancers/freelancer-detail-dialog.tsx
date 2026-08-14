"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/portal/status-badge";
import { initials } from "@/utils/format";
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

  const metaLine = [freelancer.role, freelancer.location].filter(Boolean).join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{freelancer.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center">
              {freelancer.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={freelancer.avatar} alt={freelancer.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-muted-foreground">{initials(freelancer.name)}</span>
              )}
            </div>
            <div className="min-w-0">
              {metaLine && <p className="text-sm text-muted-foreground truncate">{metaLine}</p>}
              <p className="text-sm text-foreground truncate">{freelancer.email}</p>
            </div>
          </div>

          {freelancer.bio && <Field label="About">{freelancer.bio}</Field>}

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
