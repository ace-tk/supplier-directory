import { Briefcase, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/portal/status-badge";
import { initials } from "@/utils/format";
import type { FreelancerRecord } from "@/types/freelancer";

interface FreelancerCardProps {
  freelancer: FreelancerRecord;
  onView: (freelancer: FreelancerRecord) => void;
  onEdit: (freelancer: FreelancerRecord) => void;
  onAssignTask: (freelancer: FreelancerRecord) => void;
  onDeactivate: (freelancer: FreelancerRecord) => void;
}

export function FreelancerCard({ freelancer, onView, onEdit, onAssignTask, onDeactivate }: FreelancerCardProps) {
  const isDeactivated = freelancer.status === "Deactivated";

  return (
    <div className="rounded-xl bg-card border border-border p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/20 text-primary text-sm font-semibold shrink-0">
            {initials(freelancer.name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{freelancer.name}</p>
            <p className="text-xs text-muted-foreground truncate">{freelancer.email}</p>
          </div>
        </div>
        <StatusBadge status={isDeactivated ? "Deactivated" : freelancer.availability} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {freelancer.skills.map((skill) => (
          <Badge key={skill} variant="secondary" className="text-[11px] font-normal">
            {skill}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{freelancer.assignedClients.length} clients</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{freelancer.activeProjects} active projects</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">Performance</span>
          <span className="text-foreground font-medium">{freelancer.performanceScore}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary/70 rounded-full" style={{ width: `${freelancer.performanceScore}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <StatusBadge status={freelancer.paymentStatus} />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onView(freelancer)}>
            View
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(freelancer)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAssignTask(freelancer)} disabled={isDeactivated}>
            Assign
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600"
            onClick={() => onDeactivate(freelancer)}
          >
            {isDeactivated ? "Reactivate" : "Deactivate"}
          </Button>
        </div>
      </div>
    </div>
  );
}
