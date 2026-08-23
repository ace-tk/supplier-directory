import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderKanban, Calendar, Building2 } from "lucide-react";
import { getUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/portal/status-badge";
import { EmptyStateStatic } from "@/components/shared/empty-state-static";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getProjectsForFreelancer } from "@/lib/freelancer-queries";
import { PROJECT_STATUS_LABELS, PROJECT_PRIORITY_LABELS, PRIORITY_DOT, formatShortDate } from "@/lib/freelancer-ui";
import type { ProjectRecord } from "@/types/freelancer-portal";
import { cn } from "@/lib/utils";

function ProjectCard({ project }: { project: ProjectRecord }) {
  return (
    <Link href={`/freelancer/projects/${project.id}`} className="block rounded-xl border border-border bg-card p-4 space-y-3 hover:shadow-card hover:border-primary/25 transition-all">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{project.name}</p>
        <StatusBadge status={PROJECT_STATUS_LABELS[project.status]} />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" />
        {project.clientName}
      </div>

      {project.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {formatShortDate(project.startDate)} – {formatShortDate(project.expectedEndDate)}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-1.5 h-1.5 rounded-full", PRIORITY_DOT[project.priority])} />
          <span className="text-[11px] text-muted-foreground">{PROJECT_PRIORITY_LABELS[project.priority]}</span>
        </div>
      </div>
    </Link>
  );
}

function ProjectGrid({ projects, emptyLabel }: { projects: ProjectRecord[]; emptyLabel: string }) {
  if (projects.length === 0) {
    return <EmptyStateStatic icon={FolderKanban} title={emptyLabel} description="Projects assigned to you by an admin will appear here." />;
  }
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} />
      ))}
    </div>
  );
}

export default async function FreelancerProjectsPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/projects");
  const projects = await getProjectsForFreelancer(user.id);

  const active = projects.filter((p) => p.status === "ACTIVE");
  const completed = projects.filter((p) => p.status === "COMPLETED");
  const upcoming = projects.filter((p) => p.status === "UPCOMING");

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" description="Projects assigned to you across all clients." />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <ProjectGrid projects={active} emptyLabel="No active projects" />
        </TabsContent>
        <TabsContent value="completed" className="mt-4">
          <ProjectGrid projects={completed} emptyLabel="No completed projects" />
        </TabsContent>
        <TabsContent value="upcoming" className="mt-4">
          <ProjectGrid projects={upcoming} emptyLabel="No upcoming projects" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
