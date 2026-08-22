"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, Briefcase, UserCheck, TrendingUp, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatWidget } from "@/components/portal/stat-widget";
import { ListToolbar } from "@/components/admin/list-toolbar";
import { FreelancerCard } from "@/components/admin/freelancers/freelancer-card";
import { AddTaskDialog } from "@/components/admin/freelancers/add-task-dialog";
import { CreateProjectDialog } from "@/components/admin/freelancers/create-project/create-project-dialog";
import { FreelancerDetailDialog } from "@/components/admin/freelancers/freelancer-detail-dialog";
import { SendMessageDialog } from "@/components/admin/freelancers/send-message-dialog";
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
  const router = useRouter();
  const [freelancers, setFreelancers] = useState<FreelancerRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [detailTarget, setDetailTarget] = useState<FreelancerRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [assignTarget, setAssignTarget] = useState<FreelancerRecord | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignInitialMode, setAssignInitialMode] = useState<"proposal" | undefined>(undefined);

  const [createProjectTarget, setCreateProjectTarget] = useState<FreelancerRecord | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  const [messageTarget, setMessageTarget] = useState<FreelancerRecord | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<FreelancerRecord | null>(null);

  function refresh() {
    getFreelancers().then((data) => {
      setFreelancers(data);
      setLoading(false);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

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
    setAssignInitialMode(undefined);
    setAssignTarget(freelancer);
    setAssignOpen(true);
  }

  function handleSendProposal(freelancer: FreelancerRecord) {
    setAssignInitialMode("proposal");
    setAssignTarget(freelancer);
    setAssignOpen(true);
  }

  function handleAssignSelected(freelancer: FreelancerRecord) {
    setCreateProjectTarget(freelancer);
    setCreateProjectOpen(true);
  }

  function handleDiscuss(freelancer: FreelancerRecord) {
    setMessageTarget(freelancer);
    setMessageOpen(true);
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    const result = await deactivateFreelancer(deactivateTarget.id);
    setFreelancers((prev) =>
      prev.map((f) => (f.id === deactivateTarget.id ? { ...f, status: result.status } : f))
    );
    toast.success(result.status === "Deactivated" ? `${deactivateTarget.name} deactivated` : `${deactivateTarget.name} reactivated`);
    setDeactivateTarget(null);
  }

  const activeCount = freelancers.filter((f) => f.status === "Active").length;
  const availableCount = freelancers.filter((f) => f.availability === "Available" && f.status === "Active").length;
  const totalProjects = freelancers.reduce((sum, f) => sum + f.activeProjects, 0);
  const avgPerformance = freelancers.length
    ? Math.round(freelancers.reduce((sum, f) => sum + f.performanceScore, 0) / freelancers.length)
    : 0;

  return (
    <div>
      <PageHeader
        title="Freelancers"
        description="Manage freelancers associated with the platform."
        actions={
          <Button onClick={() => router.push("/freelancers/new")} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Freelancer
          </Button>
        }
      />

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
        {filtered.map((freelancer, index) => (
          <FreelancerCard
            key={freelancer.id}
            freelancer={freelancer}
            index={index}
            onView={handleView}
            onEdit={handleEdit}
            onAssignTask={handleAssignTask}
            onDeactivate={setDeactivateTarget}
            onSendProposal={handleSendProposal}
            onAssignWork={handleAssignSelected}
            onDiscuss={handleDiscuss}
          />
        ))}
      </div>
      {!loading && filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-10">
          {freelancers.length === 0 ? "No freelancers have registered yet." : "No freelancers match your search."}
        </p>
      )}

      <FreelancerDetailDialog freelancer={detailTarget} open={detailOpen} onOpenChange={setDetailOpen} />
      <AddTaskDialog
        freelancer={assignTarget}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onCreated={refresh}
        onAssignSelected={handleAssignSelected}
        initialMode={assignInitialMode}
      />
      <CreateProjectDialog
        freelancer={createProjectTarget}
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        onCreated={refresh}
      />
      <SendMessageDialog freelancer={messageTarget} open={messageOpen} onOpenChange={setMessageOpen} />

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
