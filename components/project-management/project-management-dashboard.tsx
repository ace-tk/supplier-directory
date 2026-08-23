"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BriefcaseBusiness, CalendarClock, CheckCircle2, ChevronRight, FolderKanban, Plus, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClientAction, createManagedProjectAction, updateClientAction } from "@/services/project-management";
import type { ProjectManagementOverview } from "@/types/project-management";
import { initials } from "@/utils/format";
import { cn } from "@/lib/utils";

const STATUS_LABEL = { UPCOMING: "Upcoming", ACTIVE: "Active", COMPLETED: "Completed" } as const;
const STATUS_STYLE = { UPCOMING: "bg-sky-500/10 text-sky-700", ACTIVE: "bg-emerald-500/10 text-emerald-700", COMPLETED: "bg-slate-500/10 text-slate-700" } as const;

export function ProjectManagementDashboard({ initialData }: { initialData: ProjectManagementOverview }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [clientOpen, setClientOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [clientForm, setClientForm] = useState({ id: "", companyName: "", contactPerson: "", email: "", phone: "", whatsapp: "", notes: "" });
  const today = new Date().toISOString().slice(0, 10);
  const [projectForm, setProjectForm] = useState({ clientId: "", name: "", description: "", status: "ACTIVE" as const, priority: "MEDIUM" as const, startDate: today, expectedEndDate: today, headUserId: "", memberIds: [] as string[] });

  const projects = useMemo(() => initialData.projects.filter((project) => {
    const query = search.trim().toLowerCase();
    return (!query || project.name.toLowerCase().includes(query) || project.clientName.toLowerCase().includes(query))
      && (clientFilter === "all" || project.clientId === clientFilter)
      && (statusFilter === "all" || project.status === statusFilter)
      && (memberFilter === "all" || project.members.some((member) => member.id === memberFilter) || project.head?.id === memberFilter);
  }), [clientFilter, initialData.projects, memberFilter, search, statusFilter]);

  function refresh() { startTransition(() => router.refresh()); }

  async function saveClient() {
    const result = clientForm.id ? await updateClientAction(clientForm.id, clientForm) : await createClientAction(clientForm);
    if (!result.success) return toast.error(result.error);
    toast.success(clientForm.id ? "Client updated" : "Client added");
    setClientOpen(false);
    setClientForm({ id: "", companyName: "", contactPerson: "", email: "", phone: "", whatsapp: "", notes: "" });
    refresh();
  }

  async function saveProject() {
    const result = await createManagedProjectAction(projectForm);
    if (!result.success) return toast.error(result.error);
    toast.success("Project workspace created");
    setProjectOpen(false);
    router.push(`/projects/${result.data.id}`);
  }

  const stats = [
    { label: "Active Projects", value: initialData.stats.activeProjects, icon: FolderKanban, color: "text-blue-600 bg-blue-500/10" },
    { label: "Tasks Due", value: initialData.stats.tasksDue, icon: CalendarClock, color: "text-amber-600 bg-amber-500/10" },
    { label: "Completed Tasks", value: initialData.stats.completedTasks, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-500/10" },
    { label: "Team Members", value: initialData.stats.teamMembers, icon: Users, color: "text-violet-600 bg-violet-500/10" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Project Management" description="Manage clients, projects, tasks and team collaboration."
        actions={<div className="flex gap-2"><Button variant="outline" onClick={() => { setClientForm({ id: "", companyName: "", contactPerson: "", email: "", phone: "", whatsapp: "", notes: "" }); setClientOpen(true); }}><Plus className="h-4 w-4" /> Add Client</Button><Button onClick={() => setProjectOpen(true)} disabled={!initialData.clients.length}><Plus className="h-4 w-4" /> New Project</Button></div>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => <div key={label} className="rounded-2xl border bg-card p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div><span className={cn("grid h-10 w-10 place-items-center rounded-xl", color)}><Icon className="h-5 w-5" /></span></div></div>)}
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_160px_190px]">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search projects or clients..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <Select value={clientFilter} onValueChange={(value) => value && setClientFilter(value)}><SelectTrigger className="w-full"><SelectValue placeholder="All clients" /></SelectTrigger><SelectContent><SelectItem value="all">All clients</SelectItem>{initialData.clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.companyName}</SelectItem>)}</SelectContent></Select>
          <Select value={statusFilter} onValueChange={(value) => value && setStatusFilter(value)}><SelectTrigger className="w-full"><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="UPCOMING">Upcoming</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem></SelectContent></Select>
          <Select value={memberFilter} onValueChange={(value) => value && setMemberFilter(value)}><SelectTrigger className="w-full"><SelectValue placeholder="All team members" /></SelectTrigger><SelectContent><SelectItem value="all">All team members</SelectItem>{initialData.users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>

      {projects.length ? <div className="grid gap-4 xl:grid-cols-2">{projects.map((project) => (
        <Link href={`/projects/${project.id}`} key={project.id} className="group rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium text-primary">{project.clientName}</p><h2 className="mt-1 truncate text-lg font-semibold">{project.name}</h2><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description || "No project description yet."}</p></div><Badge className={cn("border-0", STATUS_STYLE[project.status])}>{STATUS_LABEL[project.status]}</Badge></div>
          <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground"><span>Due {new Date(project.expectedEndDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span><span>{project.completedTaskCount}/{project.taskCount} tasks</span><span>{project.priority.toLowerCase()} priority</span></div>
          <div className="mt-4"><div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">Progress</span><span className="font-medium">{project.progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${project.progress}%` }} /></div></div>
          <div className="mt-5 flex items-center justify-between border-t pt-4"><div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials(project.head?.name || "?")}</div><div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Project head</p><p className="text-xs font-medium">{project.head?.name || "Unassigned"}</p></div></div><div className="flex items-center"><div className="flex -space-x-2">{project.members.slice(0, 4).map((member) => <div key={member.id} title={member.name} className="grid h-7 w-7 place-items-center rounded-full border-2 border-card bg-muted text-[9px] font-medium">{initials(member.name)}</div>)}</div><ChevronRight className="ml-3 h-4 w-4 transition-transform group-hover:translate-x-1" /></div></div>
        </Link>
      ))}</div> : <div className="rounded-2xl border border-dashed py-16 text-center"><BriefcaseBusiness className="mx-auto h-10 w-10 text-muted-foreground/50" /><h2 className="mt-3 font-semibold">No projects found</h2><p className="mt-1 text-sm text-muted-foreground">Add a client, then create the first collaborative project workspace.</p></div>}

      {initialData.clients.length > 0 && <section><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold">Clients</h2><p className="text-xs text-muted-foreground">Reusable client records connected to project workspaces.</p></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{initialData.clients.map((client) => <button key={client.id} onClick={() => { setClientForm({ id: client.id, companyName: client.companyName, contactPerson: client.contactPerson || "", email: client.email || "", phone: client.phone || "", whatsapp: client.whatsapp || "", notes: client.notes || "" }); setClientOpen(true); }} className="rounded-xl border bg-card p-4 text-left shadow-sm hover:border-primary/25"><div className="flex items-center justify-between"><p className="font-medium">{client.companyName}</p><Badge variant="secondary">{client.projectCount} projects</Badge></div><p className="mt-2 text-xs text-muted-foreground">{client.contactPerson || "No contact person"}{client.email ? ` · ${client.email}` : ""}</p><p className="mt-3 text-[11px] font-medium text-primary">View / edit client</p></button>)}</div></section>}

      <Dialog open={clientOpen} onOpenChange={setClientOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{clientForm.id ? "Client Details" : "Add Client"}</DialogTitle></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2"><Field label="Company name *"><Input value={clientForm.companyName} onChange={(e) => setClientForm({ ...clientForm, companyName: e.target.value })} /></Field><Field label="Contact person"><Input value={clientForm.contactPerson} onChange={(e) => setClientForm({ ...clientForm, contactPerson: e.target.value })} /></Field><Field label="Email"><Input type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} /></Field><Field label="Phone"><Input value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} /></Field><Field label="WhatsApp"><Input value={clientForm.whatsapp} onChange={(e) => setClientForm({ ...clientForm, whatsapp: e.target.value })} /></Field><div className="sm:col-span-2"><Field label="Notes"><Textarea value={clientForm.notes} onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })} /></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setClientOpen(false)}>Cancel</Button><Button onClick={saveClient} disabled={pending}>{clientForm.id ? "Save Changes" : "Add Client"}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={projectOpen} onOpenChange={setProjectOpen}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Create Project</DialogTitle></DialogHeader><div className="grid max-h-[65vh] gap-4 overflow-y-auto py-2 sm:grid-cols-2"><Field label="Client *"><Select value={projectForm.clientId} onValueChange={(value) => value && setProjectForm({ ...projectForm, clientId: value })}><SelectTrigger className="w-full"><SelectValue placeholder="Select client" /></SelectTrigger><SelectContent>{initialData.clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.companyName}</SelectItem>)}</SelectContent></Select></Field><Field label="Project name *"><Input value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} /></Field><div className="sm:col-span-2"><Field label="Description"><Textarea value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} /></Field></div><Field label="Status"><Select value={projectForm.status} onValueChange={(value) => value && setProjectForm({ ...projectForm, status: value as typeof projectForm.status })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="UPCOMING">Upcoming</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem></SelectContent></Select></Field><Field label="Priority"><Select value={projectForm.priority} onValueChange={(value) => value && setProjectForm({ ...projectForm, priority: value as typeof projectForm.priority })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field><Field label="Start date"><Input type="date" value={projectForm.startDate} onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })} /></Field><Field label="Target date"><Input type="date" value={projectForm.expectedEndDate} onChange={(e) => setProjectForm({ ...projectForm, expectedEndDate: e.target.value })} /></Field><Field label="Project head *"><Select value={projectForm.headUserId} onValueChange={(value) => value && setProjectForm({ ...projectForm, headUserId: value })}><SelectTrigger className="w-full"><SelectValue placeholder="Select project head" /></SelectTrigger><SelectContent>{initialData.users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name} · {user.role.toLowerCase()}</SelectItem>)}</SelectContent></Select></Field><div className="sm:col-span-2"><Label className="text-xs">Team members</Label><div className="mt-2 grid max-h-36 grid-cols-2 gap-2 overflow-y-auto rounded-xl border p-3">{initialData.users.map((user) => <label key={user.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={projectForm.memberIds.includes(user.id)} onChange={(e) => setProjectForm({ ...projectForm, memberIds: e.target.checked ? [...projectForm.memberIds, user.id] : projectForm.memberIds.filter((id) => id !== user.id) })} />{user.name}</label>)}</div></div></div><DialogFooter><Button variant="outline" onClick={() => setProjectOpen(false)}>Cancel</Button><Button onClick={saveProject} disabled={pending}>Create Workspace</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
