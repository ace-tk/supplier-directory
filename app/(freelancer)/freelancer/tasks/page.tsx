import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/portal/status-badge";
import { RecordsTable, type RecordColumn } from "@/components/portal/records-table";
import { getTasksForFreelancer } from "@/lib/freelancer-queries";
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS, formatShortDate } from "@/lib/freelancer-ui";
import type { FreelancerTaskRecord } from "@/types/freelancer-portal";

const columns: RecordColumn<FreelancerTaskRecord>[] = [
  { key: "title", label: "Task", render: (t) => <span className="font-medium text-foreground">{t.title}</span> },
  { key: "project", label: "Project", render: (t) => <span className="text-muted-foreground">{t.projectName ?? "—"}</span> },
  { key: "dueDate", label: "Due Date", render: (t) => formatShortDate(t.dueDate) },
  { key: "priority", label: "Priority", render: (t) => <StatusBadge status={TASK_PRIORITY_LABELS[t.priority]} /> },
  { key: "status", label: "Status", render: (t) => <StatusBadge status={TASK_STATUS_LABELS[t.status]} /> },
];

export default async function FreelancerTasksPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/tasks");
  const tasks = await getTasksForFreelancer(user.id);

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Tasks assigned to you within your active projects." />
      <RecordsTable
        columns={columns}
        rows={tasks}
        emptyMessage="No tasks assigned yet."
      />
    </div>
  );
}
