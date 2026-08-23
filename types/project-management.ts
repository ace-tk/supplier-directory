export type ProjectUserOption = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
};

export type ProjectClientRecord = {
  id: string;
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
  projectCount: number;
};

export type ProjectListRecord = {
  id: string;
  name: string;
  description: string | null;
  clientId: string | null;
  clientName: string;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  startDate: string;
  expectedEndDate: string;
  head: ProjectUserOption | null;
  members: ProjectUserOption[];
  taskCount: number;
  completedTaskCount: number;
  progress: number;
  updatedAt: string;
};

export type ProjectManagementOverview = {
  projects: ProjectListRecord[];
  clients: ProjectClientRecord[];
  users: ProjectUserOption[];
  stats: { activeProjects: number; tasksDue: number; completedTasks: number; teamMembers: number };
};

export type ProjectWorkspaceRecord = ProjectListRecord & {
  city: string | null;
  pointOfContact: string | null;
  email: string | null;
  whatsapp: string | null;
  currentUserId: string;
  canManage: boolean;
  availableUsers: ProjectUserOption[];
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    dueDate: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
    status: "NOT_STARTED" | "IN_PROGRESS" | "REVIEW" | "COMPLETED" | "OVERDUE";
    assignees: ProjectUserOption[];
    checklist: Array<{ id: string; title: string; completed: boolean; order: number }>;
  }>;
  milestones: Array<{
    id: string;
    title: string;
    description: string | null;
    startDate: string | null;
    dueDate: string;
    status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED";
    order: number;
    owner: ProjectUserOption | null;
  }>;
  resources: Array<{
    id: string;
    title: string;
    type: "FILE" | "LINK";
    url: string | null;
    fileName: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    dataUrl: string | null;
    note: string | null;
    addedBy: ProjectUserOption;
    createdAt: string;
  }>;
  notes: Array<{
    id: string;
    title: string;
    content: string;
    author: ProjectUserOption;
    createdAt: string;
    updatedAt: string;
  }>;
  conversations: Array<{
    id: string;
    name: string | null;
    taskId: string | null;
    participants: ProjectUserOption[];
    messages: Array<{ id: string; content: string; createdAt: string; sender: ProjectUserOption }>;
    updatedAt: string;
  }>;
  activities: Array<{
    id: string;
    type: string;
    detail: string;
    createdAt: string;
    actor: ProjectUserOption;
  }>;
};
