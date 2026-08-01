"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Users, Briefcase, UserCheck, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatWidget } from "@/components/portal/stat-widget";
import { ListToolbar } from "@/components/admin/list-toolbar";
import { FreelancerCard } from "@/components/admin/freelancers/freelancer-card";
import { AssignTaskDialog } from "@/components/admin/freelancers/assign-task-dialog";
import { FreelancerDetailDialog } from "@/components/admin/freelancers/freelancer-detail-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSearchFilter } from "@/hooks/use-search-filter";
import { getFreelancers, deactivateFreelancer } from "@/services/freelancer-service";
import type { FreelancerRecord } from "@/types/freelancer";

export default function FreelancersPage() {
  const [freelancers, setFreelancers] = useState<FreelancerRecord[]>(() => getFreelancers());

  const [detailTarget, setDetailTarget] = useState<FreelancerRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [assignTarget, setAssignTarget] = useState<FreelancerRecord | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<FreelancerRecord | null>(null);

  const { search, setSearch, filterValue, setFilterValue, filtered } = useSearchFilter(
    freelancers,
    (f, q) => f.name.toLowerCase().includes(q) || f.skills.some((s) => s.toLowerCase().includes(q)),
    (f) => f.availability
  );

  function handleView(freelancer: FreelancerRecord) {
    setDetailTarget(freelancer);
    setDetailOpen(true);
  }

  function handleEdit() {
    toast.info("Edit form coming soon");
  }

  function handleAssignTask(freelancer: FreelancerRecord) {
    setAssignTarget(freelancer);
    setAssignOpen(true);
  }

  function handleAssigned(freelancerId: string) {
    setFreelancers((prev) =>
      prev.map((f) => (f.id === freelancerId ? { ...f, activeProjects: f.activeProjects + 1 } : f))
    );
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    await deactivateFreelancer(deactivateTarget.id);
    const willReactivate = deactivateTarget.status === "Deactivated";
    setFreelancers((prev) =>
      prev.map((f) => (f.id === deactivateTarget.id ? { ...f, status: willReactivate ? "Active" : "Deactivated" } : f))
    );
    toast.success(willReactivate ? `${deactivateTarget.name} reactivated` : `${deactivateTarget.name} deactivated`);
    setDeactivateTarget(null);
  }

  const activeCount = freelancers.filter((f) => f.status === "Active").length;
  const availableCount = freelancers.filter((f) => f.availability === "Available" && f.status === "Active").length;
  const totalProjects = freelancers.reduce((sum, f) => sum + f.activeProjects, 0);
  const avgPerformance = Math.round(freelancers.reduce((sum, f) => sum + f.performanceScore, 0) / freelancers.length);

  return (
    <div>
      <PageHeader title="Freelancers" description="Manage freelancers associated with the platform." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatWidget icon={Users} label="Total Freelancers" value={activeCount} />
        <StatWidget icon={UserCheck} label="Available Now" value={availableCount} accentClassName="text-emerald-500" />
        <StatWidget icon={Briefcase} label="Active Projects" value={totalProjects} />
        <StatWidget icon={TrendingUp} label="Avg Performance" value={`${avgPerformance}%`} accentClassName="text-blue-500" />
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or skill..."
        filterValue={filterValue}
        onFilterChange={setFilterValue}
        filterLabel="All availability"
        filterOptions={[
          { value: "Available", label: "Available" },
          { value: "Busy", label: "Busy" },
          { value: "Unavailable", label: "Unavailable" },
        ]}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((freelancer) => (
          <FreelancerCard
            key={freelancer.id}
            freelancer={freelancer}
            onView={handleView}
            onEdit={handleEdit}
            onAssignTask={handleAssignTask}
            onDeactivate={setDeactivateTarget}
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-10">No freelancers match your search.</p>
      )}

      <FreelancerDetailDialog freelancer={detailTarget} open={detailOpen} onOpenChange={setDetailOpen} />
      <AssignTaskDialog freelancer={assignTarget} open={assignOpen} onOpenChange={setAssignOpen} onAssigned={handleAssigned} />

      <AlertDialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deactivateTarget?.status === "Deactivated" ? "Reactivate freelancer?" : "Deactivate freelancer?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget?.status === "Deactivated"
                ? `${deactivateTarget?.name} will be able to receive new task assignments again.`
                : `${deactivateTarget?.name} will no longer be able to receive new task assignments.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeactivate}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
