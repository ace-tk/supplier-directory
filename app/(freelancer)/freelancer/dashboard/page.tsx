import Link from "next/link";
import { FolderKanban, FileText, ListChecks, CheckCircle2, Bell, ArrowRight } from "lucide-react";
import { getUser } from "@/lib/session";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { StatWidget } from "@/components/portal/stat-widget";
import { StatusBadge } from "@/components/portal/status-badge";
import { EmptyStateStatic } from "@/components/shared/empty-state-static";
import { getFreelancerDashboardStats, getProjectsForFreelancer, getTasksForFreelancer } from "@/lib/freelancer-queries";
import { getNotificationsAction } from "@/services/notifications";
import { PROJECT_STATUS_LABELS, TASK_STATUS_LABELS, formatShortDate } from "@/lib/freelancer-ui";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function FreelancerDashboardPage() {
  const user = await getUser();
  const userId = user!.id;

  const [stats, projects, tasks, { notifications }] = await Promise.all([
    getFreelancerDashboardStats(userId),
    getProjectsForFreelancer(userId),
    getTasksForFreelancer(userId),
    getNotificationsAction(),
  ]);

  const activeProjects = projects.filter((p) => p.status === "ACTIVE").slice(0, 4);
  const upcomingTasks = tasks.filter((t) => t.status !== "COMPLETED").slice(0, 5);
  const recentActivity = notifications.slice(0, 6);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${user!.name.split(" ")[0]}`}
        description="Here's what's happening across your projects and proposals."
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatWidget icon={FolderKanban} label="Active Projects" value={stats.activeProjects} />
        <StatWidget icon={FileText} label="Pending Proposals" value={stats.pendingProposals} />
        <StatWidget icon={ListChecks} label="Assigned Tasks" value={stats.assignedTasks} />
        <StatWidget icon={CheckCircle2} label="Completed Projects" value={stats.completedProjects} />
        <StatWidget icon={Bell} label="Notifications" value={stats.unreadNotifications} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-4">
          <SectionHeader
            title="Active Projects"
            actions={
              <Link href="/freelancer/projects" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          {activeProjects.length === 0 ? (
            <EmptyStateStatic icon={FolderKanban} title="No active projects" description="Projects assigned to you by an admin will show up here." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {activeProjects.map((p) => (
                <div key={p.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    <StatusBadge status={PROJECT_STATUS_LABELS[p.status]} />
                  </div>
                  <p className="text-xs text-muted-foreground">{p.clientName}</p>
                  <p className="text-[11px] text-muted-foreground">Due {formatShortDate(p.expectedEndDate)}</p>
                </div>
              ))}
            </div>
          )}

          <SectionHeader
            title="Upcoming Tasks"
            actions={
              <Link href="/freelancer/tasks" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            }
            className="mt-6"
          />
          {upcomingTasks.length === 0 ? (
            <EmptyStateStatic icon={ListChecks} title="No tasks yet" description="Tasks assigned within your projects will show up here." />
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {upcomingTasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground">Due {formatShortDate(t.dueDate)}</p>
                  </div>
                  <StatusBadge status={TASK_STATUS_LABELS[t.status]} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <SectionHeader
            title="Recent Activity"
            actions={
              <Link href="/freelancer/notifications" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          {recentActivity.length === 0 ? (
            <EmptyStateStatic icon={Bell} title="No activity yet" description="Proposals, project assignments, and admin messages will appear here." />
          ) : (
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {recentActivity.map((n) => (
                <div key={n.id} className="px-4 py-3 space-y-0.5">
                  <p className="text-xs font-medium text-foreground">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground/70">{timeAgo(n.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
