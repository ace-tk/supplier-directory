"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { validateDocumentOrImage } from "@/lib/file-validation";
import { hasTeamPermission } from "@/lib/team-auth";
import type {
  ProjectClientRecord,
  ProjectListRecord,
  ProjectManagementOverview,
  ProjectUserOption,
  ProjectWorkspaceRecord,
} from "@/types/project-management";

type Result<T = void> = { success: true; data: T } | { success: false; error: string };

const userSelect = { id: true, name: true, email: true, role: true, avatar: true } as const;

function mapUser(user: { id: string; name: string; email: string; role: string; avatar: string | null }): ProjectUserOption {
  return user;
}

async function currentUser() {
  return getUser();
}

async function canAccessProject(projectId: string, userId: string, role: string) {
  if (role === "ADMIN") return true;
  return Boolean(await db.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { createdById: userId },
        { headUserId: userId },
        { freelancerUserId: userId },
        { members: { some: { userId } } },
        { tasks: { some: { assignees: { some: { userId } } } } },
      ],
    },
    select: { id: true },
  }));
}

async function canManageProject(projectId: string, userId: string, role: string) {
  if (role === "ADMIN") return true;
  return Boolean(await db.project.findFirst({
    where: { id: projectId, OR: [{ createdById: userId }, { headUserId: userId }] },
    select: { id: true },
  }));
}

const projectListInclude = {
  head: { select: userSelect },
  members: { include: { user: { select: userSelect } } },
  tasks: { where: { archived: false }, select: { status: true, dueDate: true } },
} as const;

function mapProjectList(project: {
  id: string; name: string; description: string | null; clientId: string | null; clientName: string;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED"; priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  startDate: Date; expectedEndDate: Date; updatedAt: Date;
  head: { id: string; name: string; email: string; role: string; avatar: string | null } | null;
  members: Array<{ user: { id: string; name: string; email: string; role: string; avatar: string | null } }>;
  tasks: Array<{ status: string; dueDate: Date }>;
}): ProjectListRecord {
  const completedTaskCount = project.tasks.filter((task) => task.status === "COMPLETED").length;
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    clientId: project.clientId,
    clientName: project.clientName,
    status: project.status,
    priority: project.priority,
    startDate: project.startDate.toISOString(),
    expectedEndDate: project.expectedEndDate.toISOString(),
    head: project.head ? mapUser(project.head) : null,
    members: project.members.map((member) => mapUser(member.user)),
    taskCount: project.tasks.length,
    completedTaskCount,
    progress: project.tasks.length ? Math.round((completedTaskCount / project.tasks.length) * 100) : 0,
    updatedAt: project.updatedAt.toISOString(),
  };
}

export async function getProjectManagementOverview(): Promise<ProjectManagementOverview> {
  const user = await currentUser();
  if (!user || !(await hasTeamPermission("projects.view"))) return { projects: [], clients: [], users: [], stats: { activeProjects: 0, tasksDue: 0, completedTasks: 0, teamMembers: 0 } };

  const membership = await db.workspaceMember.findFirst({ where: { userId: user.id, status: "ACTIVE" }, select: { workspaceId: true } });
  const projectWhere = user.role === "ADMIN" ? { isDraft: false } : { isDraft: false, OR: [{ createdById: user.id }, { headUserId: user.id }, { members: { some: { userId: user.id } } }, { tasks: { some: { assignees: { some: { userId: user.id } } } } }] };

  const [projects, clients, users] = await Promise.all([
    db.project.findMany({ where: projectWhere, include: projectListInclude, orderBy: { updatedAt: "desc" } }),
    db.projectClient.findMany({ include: { _count: { select: { projects: true } } }, orderBy: { companyName: "asc" } }),
    membership ? db.user.findMany({ where: { workspaceMemberships: { some: { workspaceId: membership.workspaceId, status: "ACTIVE" } } }, select: userSelect, orderBy: { name: "asc" } }) : db.user.findMany({ where: { id: user.id }, select: userSelect }),
  ]);
  const mapped = projects.map(mapProjectList);
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 86400000);
  return {
    projects: mapped,
    clients: clients.map((client): ProjectClientRecord => ({
      id: client.id, companyName: client.companyName, contactPerson: client.contactPerson,
      email: client.email, phone: client.phone, whatsapp: client.whatsapp, notes: client.notes,
      projectCount: client._count.projects,
    })),
    users: users.map(mapUser),
    stats: {
      activeProjects: mapped.filter((project) => project.status === "ACTIVE").length,
      tasksDue: projects.flatMap((project) => project.tasks).filter((task) => task.status !== "COMPLETED" && task.dueDate >= now && task.dueDate <= week).length,
      completedTasks: projects.flatMap((project) => project.tasks).filter((task) => task.status === "COMPLETED").length,
      teamMembers: new Set(projects.flatMap((project) => project.members.map((member) => member.user.id))).size,
    },
  };
}

export async function createClientAction(input: { companyName: string; contactPerson?: string; email?: string; phone?: string; whatsapp?: string; notes?: string }): Promise<Result<{ id: string }>> {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return { success: false, error: "Admin access required." };
  if (input.companyName.trim().length < 2) return { success: false, error: "Client/company name is required." };
  if (input.email && !/^\S+@\S+\.\S+$/.test(input.email)) return { success: false, error: "Enter a valid email address." };
  const client = await db.projectClient.create({ data: {
    companyName: input.companyName.trim(), contactPerson: input.contactPerson?.trim() || null,
    email: input.email?.trim().toLowerCase() || null, phone: input.phone?.trim() || null,
    whatsapp: input.whatsapp?.trim() || null, notes: input.notes?.trim() || null,
  }, select: { id: true } });
  revalidatePath("/projects");
  return { success: true, data: client };
}

export async function updateClientAction(id: string, input: { companyName: string; contactPerson?: string; email?: string; phone?: string; whatsapp?: string; notes?: string }): Promise<Result> {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return { success: false, error: "Admin access required." };
  if (input.companyName.trim().length < 2) return { success: false, error: "Client/company name is required." };
  await db.projectClient.update({ where: { id }, data: {
    companyName: input.companyName.trim(), contactPerson: input.contactPerson?.trim() || null,
    email: input.email?.trim().toLowerCase() || null, phone: input.phone?.trim() || null,
    whatsapp: input.whatsapp?.trim() || null, notes: input.notes?.trim() || null,
  } });
  revalidatePath("/projects");
  return { success: true, data: undefined };
}

export async function createManagedProjectAction(input: {
  clientId: string; name: string; description?: string; status: "UPCOMING" | "ACTIVE" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"; startDate: string; expectedEndDate: string;
  headUserId: string; memberIds: string[];
}): Promise<Result<{ id: string }>> {
  const user = await currentUser();
  if (!user || !(await hasTeamPermission("projects.manage"))) return { success: false, error: "Project management access required." };
  if (input.name.trim().length < 2) return { success: false, error: "Project name is required." };
  const [client, head] = await Promise.all([
    db.projectClient.findUnique({ where: { id: input.clientId } }),
    db.user.findUnique({ where: { id: input.headUserId }, select: { id: true } }),
  ]);
  if (!client) return { success: false, error: "Select a valid client." };
  if (!head) return { success: false, error: "Select a valid project head." };
  const startDate = new Date(input.startDate);
  const expectedEndDate = new Date(input.expectedEndDate);
  if (Number.isNaN(startDate.valueOf()) || expectedEndDate < startDate) return { success: false, error: "Target date must be on or after the start date." };
  const memberIds = [...new Set([user.id, input.headUserId, ...input.memberIds])];
  const ownerMembership = await db.workspaceMember.findFirst({ where: { userId: user.id, status: "ACTIVE" }, select: { workspaceId: true } });
  const validMembers = await db.user.findMany({ where: { id: { in: memberIds }, ...(ownerMembership ? { workspaceMemberships: { some: { workspaceId: ownerMembership.workspaceId, status: "ACTIVE" } } } : {}) }, select: { id: true } });
  if (validMembers.length !== memberIds.length) return { success: false, error: "One or more team members were not found." };

  const project = await db.project.create({ data: {
    name: input.name.trim(), clientId: client.id, clientName: client.companyName,
    description: input.description?.trim() || null, status: input.status, priority: input.priority,
    startDate, expectedEndDate, headUserId: input.headUserId,
    freelancerUserId: input.headUserId, createdById: user.id,
    members: { create: memberIds.map((userId) => ({ userId })) },
    activities: { create: { actorId: user.id, type: "PROJECT_CREATED", detail: `Created project “${input.name.trim()}”` } },
  }, select: { id: true } });
  revalidatePath("/projects");
  return { success: true, data: project };
}

export async function getProjectWorkspace(projectId: string): Promise<ProjectWorkspaceRecord | null> {
  const user = await currentUser();
  if (!user || !(await canAccessProject(projectId, user.id, user.role))) return null;
  const workspaceMembership = await db.workspaceMember.findFirst({ where: { userId: user.id, status: "ACTIVE" }, select: { workspaceId: true } });
  const [project, availableUsers] = await Promise.all([db.project.findUnique({ where: { id: projectId }, include: {
    ...projectListInclude,
    tasks: { where: { archived: false }, include: { assignees: { include: { user: { select: userSelect } } }, checklist: { orderBy: { order: "asc" } } }, orderBy: { dueDate: "asc" } },
    timeline: { include: { owner: { select: userSelect } }, orderBy: { order: "asc" } },
    resources: { include: { addedBy: { select: userSelect } }, orderBy: { createdAt: "desc" } },
    projectNotes: { where: { archived: false }, include: { author: { select: userSelect } }, orderBy: { updatedAt: "desc" } },
    conversations: { where: { participants: { some: { userId: user.id } } }, include: {
      participants: { include: { user: { select: userSelect } } },
      messages: { include: { sender: { select: userSelect } }, orderBy: { createdAt: "asc" }, take: 100 },
    }, orderBy: { updatedAt: "desc" } },
    activities: { include: { actor: { select: userSelect } }, orderBy: { createdAt: "desc" }, take: 30 },
  } }), workspaceMembership ? db.user.findMany({ where: { workspaceMemberships: { some: { workspaceId: workspaceMembership.workspaceId, status: "ACTIVE" } } }, select: userSelect, orderBy: { name: "asc" } }) : db.user.findMany({ where: { id: user.id }, select: userSelect })]);
  if (!project) return null;
  const base = mapProjectList(project);
  return {
    ...base, city: project.city, pointOfContact: project.pointOfContact, email: project.email,
    whatsapp: project.whatsapp, currentUserId: user.id,
    canManage: await canManageProject(projectId, user.id, user.role),
    availableUsers: availableUsers.map(mapUser),
    tasks: project.tasks.map((task) => ({ id: task.id, title: task.title, description: task.description,
      dueDate: task.dueDate.toISOString(), priority: task.priority, status: task.status,
      assignees: task.assignees.map((item) => mapUser(item.user)), checklist: task.checklist })),
    milestones: project.timeline.map((item) => ({ id: item.id, title: item.title, description: item.description,
      startDate: item.startDate?.toISOString() ?? null, dueDate: (item.dueDate ?? item.date).toISOString(),
      status: item.status, order: item.order, owner: item.owner ? mapUser(item.owner) : null })),
    resources: project.resources.map((item) => ({ ...item, addedBy: mapUser(item.addedBy), createdAt: item.createdAt.toISOString() })),
    notes: project.projectNotes.map((note) => ({ ...note, author: mapUser(note.author), createdAt: note.createdAt.toISOString(), updatedAt: note.updatedAt.toISOString() })),
    conversations: project.conversations.map((conversation) => ({ id: conversation.id, name: conversation.name, taskId: conversation.taskId,
      participants: conversation.participants.map((item) => mapUser(item.user)), updatedAt: conversation.updatedAt.toISOString(),
      messages: conversation.messages.map((message) => ({ id: message.id, content: message.content, createdAt: message.createdAt.toISOString(), sender: mapUser(message.sender) })) })),
    activities: project.activities.map((activity) => ({ id: activity.id, type: activity.type, detail: activity.detail, createdAt: activity.createdAt.toISOString(), actor: mapUser(activity.actor) })),
  };
}

function refreshProject(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/freelancer/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function updateProjectTeamAction(projectId: string, headUserId: string, memberIds: string[]): Promise<Result> {
  const user = await currentUser();
  if (!user || !(await canManageProject(projectId, user.id, user.role))) return { success: false, error: "Project head or admin access required." };
  const ids = [...new Set([headUserId, ...memberIds])];
  const members = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (members.length !== ids.length) return { success: false, error: "One or more members were not found." };
  await db.$transaction([
    db.project.update({ where: { id: projectId }, data: { headUserId, freelancerUserId: headUserId } }),
    db.projectMember.deleteMany({ where: { projectId, userId: { notIn: ids } } }),
    ...ids.map((userId) => db.projectMember.upsert({ where: { projectId_userId: { projectId, userId } }, create: { projectId, userId }, update: {} })),
  ]);
  refreshProject(projectId);
  return { success: true, data: undefined };
}

export async function createProjectTaskAction(projectId: string, input: { title: string; description?: string; dueDate: string; priority: "LOW" | "MEDIUM" | "HIGH"; status: "NOT_STARTED" | "IN_PROGRESS" | "REVIEW" | "COMPLETED"; assigneeIds: string[]; checklist: string[] }): Promise<Result> {
  const user = await currentUser();
  if (!user || !(await canManageProject(projectId, user.id, user.role))) return { success: false, error: "Project head or admin access required." };
  if (!input.title.trim() || !input.dueDate || input.assigneeIds.length === 0) return { success: false, error: "Title, due date, and at least one assignee are required." };
  const allowed = await db.projectMember.count({ where: { projectId, userId: { in: input.assigneeIds } } });
  if (allowed !== new Set(input.assigneeIds).size) return { success: false, error: "Tasks can only be assigned to project members." };
  await db.freelancerTask.create({ data: {
    projectId, title: input.title.trim(), description: input.description?.trim() || null, dueDate: new Date(input.dueDate),
    priority: input.priority, status: input.status, freelancerUserId: input.assigneeIds[0],
    assignees: { create: [...new Set(input.assigneeIds)].map((userId) => ({ userId })) },
    checklist: { create: input.checklist.filter(Boolean).map((title, order) => ({ title: title.trim(), order })) },
  } });
  await db.projectActivity.create({ data: { projectId, actorId: user.id, type: "TASK_CREATED", detail: `Created task “${input.title.trim()}”` } });
  refreshProject(projectId);
  return { success: true, data: undefined };
}

export async function updateProjectTaskAction(projectId: string, taskId: string, input: { title: string; description?: string; dueDate: string; priority: "LOW" | "MEDIUM" | "HIGH"; status: "NOT_STARTED" | "IN_PROGRESS" | "REVIEW" | "COMPLETED"; assigneeIds: string[]; checklist: string[] }): Promise<Result> {
  const user = await currentUser();
  if (!user || !(await canManageProject(projectId, user.id, user.role))) return { success: false, error: "Project head or admin access required." };
  if (!input.title.trim() || !input.dueDate || input.assigneeIds.length === 0) return { success: false, error: "Title, due date, and at least one assignee are required." };
  const allowed = await db.projectMember.count({ where: { projectId, userId: { in: input.assigneeIds } } });
  if (allowed !== new Set(input.assigneeIds).size) return { success: false, error: "Tasks can only be assigned to project members." };
  const task = await db.freelancerTask.findFirst({ where: { id: taskId, projectId }, select: { id: true } });
  if (!task) return { success: false, error: "Task not found." };
  await db.$transaction(async (tx) => {
    await tx.freelancerTask.update({ where: { id: task.id }, data: { title: input.title.trim(), description: input.description?.trim() || null, dueDate: new Date(input.dueDate), priority: input.priority, status: input.status, freelancerUserId: input.assigneeIds[0] } });
    await tx.projectTaskAssignee.deleteMany({ where: { taskId } });
    await tx.projectTaskAssignee.createMany({ data: [...new Set(input.assigneeIds)].map((userId) => ({ taskId, userId })) });
    await tx.projectTaskChecklistItem.deleteMany({ where: { taskId } });
    const checklist = input.checklist.filter(Boolean).map((title, order) => ({ taskId, title: title.trim(), order }));
    if (checklist.length) await tx.projectTaskChecklistItem.createMany({ data: checklist });
  });
  refreshProject(projectId);
  return { success: true, data: undefined };
}

export async function updateProjectTaskStatusAction(projectId: string, taskId: string, status: "NOT_STARTED" | "IN_PROGRESS" | "REVIEW" | "COMPLETED"): Promise<Result> {
  const user = await currentUser();
  if (!user || !(await canAccessProject(projectId, user.id, user.role))) return { success: false, error: "Access denied." };
  const task = await db.freelancerTask.findFirst({ where: user.role === "ADMIN"
    ? { id: taskId, projectId }
    : { id: taskId, projectId, OR: [{ assignees: { some: { userId: user.id } } }, { project: { headUserId: user.id } }, { project: { createdById: user.id } }] } });
  if (!task) return { success: false, error: "Only assignees or the project head can update this task." };
  await db.freelancerTask.update({ where: { id: task.id }, data: { status } });
  if (status === "COMPLETED" && task.status !== "COMPLETED") await db.projectActivity.create({ data: { projectId, actorId: user.id, type: "TASK_COMPLETED", detail: `Completed task “${task.title}”` } });
  refreshProject(projectId);
  return { success: true, data: undefined };
}

export async function archiveProjectTaskAction(projectId: string, taskId: string): Promise<Result> {
  const user = await currentUser();
  if (!user || !(await canManageProject(projectId, user.id, user.role))) return { success: false, error: "Project head or admin access required." };
  await db.freelancerTask.updateMany({ where: { id: taskId, projectId }, data: { archived: true } });
  refreshProject(projectId);
  return { success: true, data: undefined };
}

export async function toggleChecklistItemAction(projectId: string, itemId: string): Promise<Result> {
  const user = await currentUser();
  if (!user || !(await canAccessProject(projectId, user.id, user.role))) return { success: false, error: "Access denied." };
  const item = await db.projectTaskChecklistItem.findFirst({ where: { id: itemId, task: { projectId } } });
  if (!item) return { success: false, error: "Checklist item not found." };
  await db.projectTaskChecklistItem.update({ where: { id: item.id }, data: { completed: !item.completed } });
  refreshProject(projectId);
  return { success: true, data: undefined };
}

export async function createMilestoneAction(projectId: string, input: { title: string; description?: string; startDate?: string; dueDate: string; ownerId?: string }): Promise<Result> {
  const user = await currentUser();
  if (!user || !(await canManageProject(projectId, user.id, user.role))) return { success: false, error: "Project head or admin access required." };
  if (!input.title.trim() || !input.dueDate) return { success: false, error: "Milestone title and due date are required." };
  const order = await db.projectTimelineEntry.count({ where: { projectId } });
  await db.projectTimelineEntry.create({ data: { projectId, title: input.title.trim(), description: input.description?.trim() || null,
    date: new Date(input.dueDate), startDate: input.startDate ? new Date(input.startDate) : null, dueDate: new Date(input.dueDate), ownerId: input.ownerId || null, order } });
  await db.projectActivity.create({ data: { projectId, actorId: user.id, type: "MILESTONE_CREATED", detail: `Added milestone “${input.title.trim()}”` } });
  refreshProject(projectId);
  return { success: true, data: undefined };
}

export async function updateMilestoneStatusAction(projectId: string, milestoneId: string, status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "DELAYED"): Promise<Result> {
  const user = await currentUser();
  if (!user || !(await canManageProject(projectId, user.id, user.role))) return { success: false, error: "Project head or admin access required." };
  const milestone = await db.projectTimelineEntry.findFirst({ where: { id: milestoneId, projectId } });
  if (!milestone) return { success: false, error: "Milestone not found." };
  await db.projectTimelineEntry.update({ where: { id: milestoneId }, data: { status } });
  if (status === "COMPLETED" && milestone.status !== "COMPLETED") await db.projectActivity.create({ data: { projectId, actorId: user.id, type: "MILESTONE_COMPLETED", detail: `Completed milestone “${milestone.title}”` } });
  refreshProject(projectId);
  return { success: true, data: undefined };
}

export async function reorderMilestonesAction(projectId: string, orderedIds: string[]): Promise<Result> {
  const user = await currentUser();
  if (!user || !(await canManageProject(projectId, user.id, user.role))) return { success: false, error: "Project head or admin access required." };
  await db.$transaction(orderedIds.map((id, order) => db.projectTimelineEntry.updateMany({ where: { id, projectId }, data: { order } })));
  refreshProject(projectId);
  return { success: true, data: undefined };
}

export async function addProjectLinkAction(projectId: string, input: { title: string; url: string; note?: string }): Promise<Result> {
  const user = await currentUser();
  if (!user || !(await canAccessProject(projectId, user.id, user.role))) return { success: false, error: "Access denied." };
  try { new URL(input.url); } catch { return { success: false, error: "Enter a valid URL." }; }
  await db.projectResource.create({ data: { projectId, addedById: user.id, title: input.title.trim() || input.url, type: "LINK", url: input.url, note: input.note?.trim() || null } });
  await db.projectActivity.create({ data: { projectId, actorId: user.id, type: "RESOURCE_ADDED", detail: `Added link “${input.title.trim() || input.url}”` } });
  refreshProject(projectId);
  return { success: true, data: undefined };
}

export async function addProjectFileAction(projectId: string, input: { title: string; fileName: string; mimeType: string; sizeBytes: number; dataUrl: string; note?: string }): Promise<Result> {
  const user = await currentUser();
  if (!user || !(await canAccessProject(projectId, user.id, user.role))) return { success: false, error: "Access denied." };
  const validation = validateDocumentOrImage(input.mimeType, input.sizeBytes, input.fileName);
  if (!validation.valid) return { success: false, error: validation.error! };
  await db.projectResource.create({ data: { projectId, addedById: user.id, title: input.title.trim() || input.fileName, type: "FILE", fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, dataUrl: input.dataUrl, note: input.note?.trim() || null } });
  await db.projectActivity.create({ data: { projectId, actorId: user.id, type: "RESOURCE_ADDED", detail: `Uploaded “${input.fileName}”` } });
  refreshProject(projectId);
  return { success: true, data: undefined };
}

export async function createProjectNoteAction(projectId: string, input: { title: string; content: string }): Promise<Result> {
  const user = await currentUser();
  if (!user || !(await canAccessProject(projectId, user.id, user.role))) return { success: false, error: "Access denied." };
  if (!input.title.trim() || !input.content.trim()) return { success: false, error: "Note title and content are required." };
  await db.projectNote.create({ data: { projectId, authorId: user.id, title: input.title.trim(), content: input.content.trim() } });
  await db.projectActivity.create({ data: { projectId, actorId: user.id, type: "NOTE_ADDED", detail: `Added note “${input.title.trim()}”` } });
  refreshProject(projectId);
  return { success: true, data: undefined };
}

export async function updateProjectNoteAction(projectId: string, noteId: string, input: { title: string; content: string }): Promise<Result> {
  const user = await currentUser();
  if (!user || !(await canAccessProject(projectId, user.id, user.role))) return { success: false, error: "Access denied." };
  const note = await db.projectNote.findFirst({ where: { id: noteId, projectId } });
  if (!note || (user.role !== "ADMIN" && note.authorId !== user.id && !(await canManageProject(projectId, user.id, user.role)))) return { success: false, error: "You cannot edit this note." };
  await db.projectNote.update({ where: { id: noteId }, data: { title: input.title.trim(), content: input.content.trim() } });
  refreshProject(projectId);
  return { success: true, data: undefined };
}

export async function archiveProjectNoteAction(projectId: string, noteId: string): Promise<Result> {
  const user = await currentUser();
  if (!user || !(await canAccessProject(projectId, user.id, user.role))) return { success: false, error: "Access denied." };
  const note = await db.projectNote.findFirst({ where: { id: noteId, projectId } });
  if (!note || (user.role !== "ADMIN" && note.authorId !== user.id && !(await canManageProject(projectId, user.id, user.role)))) return { success: false, error: "You cannot archive this note." };
  await db.projectNote.update({ where: { id: noteId }, data: { archived: true } });
  refreshProject(projectId);
  return { success: true, data: undefined };
}

export async function createProjectConversationAction(projectId: string, input: { name?: string; participantIds: string[]; taskId?: string }): Promise<Result> {
  const user = await currentUser();
  if (!user || !(await canManageProject(projectId, user.id, user.role))) return { success: false, error: "Project head or admin access required." };
  const ids = [...new Set([user.id, ...input.participantIds])];
  if (ids.length < 2) return { success: false, error: "Select at least one other participant." };
  const idsRequiringMembership = user.role === "ADMIN" ? ids.filter((id) => id !== user.id) : ids;
  const allowed = await db.projectMember.count({ where: { projectId, userId: { in: idsRequiringMembership } } });
  if (allowed !== idsRequiringMembership.length) return { success: false, error: "Conversations can only include project members." };
  if (input.taskId && !(await db.freelancerTask.findFirst({ where: { id: input.taskId, projectId }, select: { id: true } }))) return { success: false, error: "Selected task was not found." };
  await db.projectConversation.create({ data: { projectId, createdById: user.id, name: input.name?.trim() || null, taskId: input.taskId || null, participants: { create: ids.map((userId) => ({ userId })) } } });
  refreshProject(projectId);
  return { success: true, data: undefined };
}

export async function sendProjectMessageAction(projectId: string, conversationId: string, content: string): Promise<Result> {
  const user = await currentUser();
  if (!user || !content.trim()) return { success: false, error: "Message cannot be empty." };
  const conversation = await db.projectConversation.findFirst({ where: { id: conversationId, projectId, participants: { some: { userId: user.id } } }, select: { id: true } });
  if (!conversation) return { success: false, error: "Conversation not found or access denied." };
  await db.$transaction([
    db.projectMessage.create({ data: { conversationId, senderId: user.id, content: content.trim() } }),
    db.projectConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
    db.projectActivity.create({ data: { projectId, actorId: user.id, type: "MESSAGE_SENT", detail: "Sent a project message" } }),
  ]);
  refreshProject(projectId);
  return { success: true, data: undefined };
}
