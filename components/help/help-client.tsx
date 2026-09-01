"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bug,
  Lightbulb,
  Loader2,
  Mail,
  Paperclip,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HELP_ARTICLES, HELP_CATEGORIES, searchHelpArticles, type HelpArticle } from "@/lib/help-content";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateDocumentOrImage } from "@/lib/file-validation";
import { submitSupportRequestAction, updateSupportRequestStatusAction } from "@/services/support";
import type { SessionUser } from "@/types/auth";
import type {
  SupportRequestCategory,
  SupportRequestPriority,
  SupportRequestStatus,
  SupportRequestType,
} from "@/lib/generated/prisma/enums";

interface SupportRequestRow {
  id: string;
  userId: string;
  type: SupportRequestType;
  subject: string;
  category: SupportRequestCategory;
  priority: SupportRequestPriority;
  description: string;
  module: string | null;
  route: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentSize: number | null;
  status: SupportRequestStatus;
  createdAt: string;
  updatedAt: string;
  user?: { name: string; email: string };
}

interface HelpClientProps {
  user: SessionUser;
  myRequests: SupportRequestRow[];
  allRequests: SupportRequestRow[] | null;
  systemInfo: { appVersion: string; workspaceName: string | null };
}

const CATEGORY_OPTIONS: { value: SupportRequestCategory; label: string }[] = [
  { value: "ACCOUNT", label: "Account" },
  { value: "SUPPLIER_BUYER", label: "Supplier / Buyer" },
  { value: "CRM", label: "CRM" },
  { value: "ORDERS", label: "Orders" },
  { value: "INVOICES", label: "Invoices" },
  { value: "PROJECTS", label: "Projects" },
  { value: "TEAM", label: "Team" },
  { value: "MARKETING", label: "Marketing" },
  { value: "DESIGN_STUDIO", label: "Design Studio" },
  { value: "TECHNICAL", label: "Technical Issue" },
  { value: "OTHER", label: "Other" },
];

const PRIORITY_OPTIONS: { value: SupportRequestPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

const MODULE_OPTIONS = [
  "Dashboard",
  "Suppliers & Buyers",
  "Shop & Catalog",
  "CRM",
  "Project Management",
  "Team Management",
  "Invoices & Expenses",
  "Marketing",
  "Design Studio",
  "Mood Board",
  "Settings",
  "Other",
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function referenceId(id: string) {
  return `#${id.slice(-8).toUpperCase()}`;
}

function statusVariant(status: SupportRequestStatus): "default" | "secondary" | "outline" {
  if (status === "OPEN") return "default";
  if (status === "IN_PROGRESS") return "secondary";
  return "outline";
}

export function HelpClient({ user, myRequests, allRequests, systemInfo }: HelpClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [activeArticle, setActiveArticle] = useState<HelpArticle | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"contact" | "problem" | "feature" | null>(null);
  const [detail, setDetail] = useState<SupportRequestRow | null>(null);
  const [pending, startTransition] = useTransition();

  const results = useMemo(() => searchHelpArticles(query), [query]);
  const popular = useMemo(() => HELP_ARTICLES.filter((a) => a.popular), []);
  const categoryArticles = activeCategory ? HELP_ARTICLES.filter((a) => a.category === activeCategory) : null;

  function updateStatus(id: string, status: SupportRequestStatus) {
    startTransition(async () => {
      const result = await updateSupportRequestStatusAction(id, status);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Status updated");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-[1300px] space-y-8">
      {/* Hero */}
      <div className="rounded-2xl border bg-card p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Help & Support</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Search documentation, browse categories, or contact us directly.</p>
        <div className="relative mx-auto mt-5 max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveCategory(null); }}
            placeholder="How can we help?"
            className="pl-9 h-10"
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button className="gap-2" onClick={() => setDialog("contact")}><Mail className="h-4 w-4" /> Contact Support</Button>
          <Button variant="outline" className="gap-2" onClick={() => setDialog("problem")}><Bug className="h-4 w-4" /> Report a Problem</Button>
          <Button variant="outline" className="gap-2" onClick={() => setDialog("feature")}><Lightbulb className="h-4 w-4" /> Feature Request</Button>
        </div>
      </div>

      {/* Search results */}
      {query.trim() && (
        <div className="space-y-3">
          <p className="text-sm font-medium">{results.length} result{results.length === 1 ? "" : "s"} for &ldquo;{query}&rdquo;</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {results.map((article) => <ArticleCard key={article.id} article={article} onOpen={() => setActiveArticle(article)} />)}
            {!results.length && <p className="text-sm text-muted-foreground">No articles match that search. Try Contact Support instead.</p>}
          </div>
        </div>
      )}

      {!query.trim() && (
        <>
          {/* Popular help */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Popular Help</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {popular.map((article) => <ArticleCard key={article.id} article={article} onOpen={() => setActiveArticle(article)} />)}
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Browse by category</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {HELP_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                  className={`rounded-xl border p-4 text-left transition-colors hover:bg-muted/40 ${activeCategory === cat.id ? "border-primary bg-primary/5" : ""}`}
                >
                  <p className="text-sm font-medium">{cat.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{cat.description}</p>
                  <p className="mt-2 text-[11px] text-primary">{HELP_ARTICLES.filter((a) => a.category === cat.id).length} article(s)</p>
                </button>
              ))}
            </div>
          </div>

          {categoryArticles && (
            <div className="space-y-3">
              <p className="text-sm font-semibold">{HELP_CATEGORIES.find((c) => c.id === activeCategory)?.label}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {categoryArticles.map((article) => <ArticleCard key={article.id} article={article} onOpen={() => setActiveArticle(article)} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* My / All Support Requests */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">Support Requests</p>
        <Tabs defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine">My Support Requests <Badge variant="secondary" className="ml-2">{myRequests.length}</Badge></TabsTrigger>
            {allRequests && <TabsTrigger value="all">All Requests <Badge variant="secondary" className="ml-2">{allRequests.length}</Badge></TabsTrigger>}
          </TabsList>
          <TabsContent value="mine" className="mt-4">
            <RequestTable rows={myRequests} onOpen={setDetail} showRequester={false} />
          </TabsContent>
          {allRequests && (
            <TabsContent value="all" className="mt-4">
              <RequestTable rows={allRequests} onOpen={setDetail} showRequester />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* System information */}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-semibold">System Information</p>
        <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <p><span className="font-medium text-foreground">Application:</span> SupplyBase</p>
          <p><span className="font-medium text-foreground">Version:</span> {systemInfo.appVersion}</p>
          <p><span className="font-medium text-foreground">Your role:</span> {user.role}</p>
          {systemInfo.workspaceName && <p><span className="font-medium text-foreground">Workspace:</span> {systemInfo.workspaceName}</p>}
        </div>
      </div>

      <ArticleDialog article={activeArticle} onClose={() => setActiveArticle(null)} />
      <ContactSupportDialog open={dialog === "contact"} onClose={() => setDialog(null)} onSubmitted={() => router.refresh()} />
      <ReportProblemDialog open={dialog === "problem"} pathname={pathname} onClose={() => setDialog(null)} onSubmitted={() => router.refresh()} />
      <FeatureRequestDialog open={dialog === "feature"} onClose={() => setDialog(null)} onSubmitted={() => router.refresh()} />
      <RequestDetailDialog
        row={detail}
        canManage={Boolean(allRequests)}
        busy={pending}
        onClose={() => setDetail(null)}
        onStatusChange={(status) => detail && updateStatus(detail.id, status)}
      />
    </div>
  );
}

function ArticleCard({ article, onOpen }: { article: HelpArticle; onOpen(): void }) {
  return (
    <button onClick={onOpen} className="rounded-xl border bg-card p-4 text-left hover:bg-muted/40 transition-colors">
      <p className="text-sm font-medium">{article.title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{article.body}</p>
    </button>
  );
}

function ArticleDialog({ article, onClose }: { article: HelpArticle | null; onClose(): void }) {
  return (
    <Dialog open={Boolean(article)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        {article && (
          <>
            <DialogHeader>
              <DialogTitle>{article.title}</DialogTitle>
            </DialogHeader>
            <p className="text-sm leading-relaxed text-muted-foreground">{article.body}</p>
          </>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestTable({ rows, onOpen, showRequester }: { rows: SupportRequestRow[]; onOpen(row: SupportRequestRow): void; showRequester: boolean }) {
  if (!rows.length) {
    return <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">No support requests yet.</div>;
  }
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className={`hidden gap-4 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:grid ${showRequester ? "grid-cols-[90px_1fr_140px_110px_100px_110px_100px]" : "grid-cols-[90px_1fr_140px_110px_100px_100px]"}`}>
        <span>Ref</span>
        <span>Subject</span>
        {showRequester && <span>Requester</span>}
        <span>Category</span>
        <span>Priority</span>
        <span>Status</span>
        <span>Created</span>
      </div>
      {rows.map((row) => (
        <button
          key={row.id}
          onClick={() => onOpen(row)}
          className={`grid w-full gap-4 border-b px-4 py-3 text-left last:border-b-0 hover:bg-muted/30 sm:grid-cols-[90px_1fr_140px_110px_100px_100px] ${showRequester ? "sm:grid-cols-[90px_1fr_140px_110px_100px_110px_100px]" : ""}`}
        >
          <span className="text-xs font-mono text-muted-foreground">{referenceId(row.id)}</span>
          <span className="truncate text-sm font-medium">{row.subject}</span>
          {showRequester && <span className="truncate text-xs text-muted-foreground">{row.user?.name}</span>}
          <span className="text-xs text-muted-foreground">{CATEGORY_OPTIONS.find((c) => c.value === row.category)?.label}</span>
          <span className="text-xs text-muted-foreground">{PRIORITY_OPTIONS.find((p) => p.value === row.priority)?.label}</span>
          <Badge variant={statusVariant(row.status)} className="w-fit">{row.status.replace("_", " ")}</Badge>
          <span className="text-xs text-muted-foreground">{formatDate(row.createdAt)}</span>
        </button>
      ))}
    </div>
  );
}

function RequestDetailDialog({ row, canManage, busy, onClose, onStatusChange }: { row: SupportRequestRow | null; canManage: boolean; busy: boolean; onClose(): void; onStatusChange(status: SupportRequestStatus): void }) {
  return (
    <Dialog open={Boolean(row)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {row && (
          <>
            <DialogHeader>
              <DialogTitle>{row.subject}</DialogTitle>
              <DialogDescription>{referenceId(row.id)} · {formatDate(row.createdAt)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{row.type.replace("_", " ")}</Badge>
                <Badge variant="secondary">{CATEGORY_OPTIONS.find((c) => c.value === row.category)?.label}</Badge>
                <Badge variant="secondary">{PRIORITY_OPTIONS.find((p) => p.value === row.priority)?.label}</Badge>
                <Badge variant={statusVariant(row.status)}>{row.status.replace("_", " ")}</Badge>
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{row.description}</p>
              {row.module && <p className="text-xs text-muted-foreground">Module: {row.module}</p>}
              {row.attachmentUrl && (
                <a href={row.attachmentUrl} download={row.attachmentName ?? "attachment"} className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <Paperclip className="h-3.5 w-3.5" /> {row.attachmentName ?? "Attachment"}
                </a>
              )}
              {canManage && (
                <div className="space-y-1.5 border-t pt-3">
                  <Label className="text-xs font-medium">Update status</Label>
                  <Select value={row.status} onValueChange={(v) => v && onStatusChange(v as SupportRequestStatus)}>
                    <SelectTrigger className="w-full" disabled={busy}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                      <SelectItem value="RESOLVED">Resolved</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentField({ onChange }: { onChange(value: { dataUrl: string; name: string } | undefined): void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) { setFileName(null); onChange(undefined); return; }
    setUploading(true);
    try {
      const validation = validateDocumentOrImage(file.type, file.size, file.name);
      if (!validation.valid) { toast.error(validation.error); return; }
      const dataUrl = await fileToDataUrl(file);
      setFileName(file.name);
      onChange({ dataUrl, name: file.name });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">Attachment (optional)</Label>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted/40">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        <span className="truncate">{fileName ?? "Attach a file (max 10MB)"}</span>
        <input type="file" className="hidden" disabled={uploading} onChange={(e) => handleFile(e.target.files?.[0])} />
      </label>
    </div>
  );
}

function ContactSupportDialog({ open, onClose, onSubmitted }: { open: boolean; onClose(): void; onSubmitted(): void }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<SupportRequestCategory>("OTHER");
  const [priority, setPriority] = useState<SupportRequestPriority>("NORMAL");
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<{ dataUrl: string; name: string } | undefined>();
  const [submitting, setSubmitting] = useState(false);

  function reset() { setSubject(""); setCategory("OTHER"); setPriority("NORMAL"); setDescription(""); setAttachment(undefined); }

  async function submit() {
    setSubmitting(true);
    const result = await submitSupportRequestAction({ type: "TICKET", subject, category, priority, description, attachment });
    setSubmitting(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Support request submitted");
    reset();
    onSubmitted();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contact Support</DialogTitle>
          <DialogDescription>We&apos;ll get back to you as soon as possible.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Briefly describe your issue" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Category</Label>
              <Select value={category} onValueChange={(v) => v && setCategory(v as SupportRequestCategory)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Priority</Label>
              <Select value={priority} onValueChange={(v) => v && setPriority(v as SupportRequestPriority)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's going on?" />
          </div>
          <AttachmentField onChange={setAttachment} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={submitting || subject.trim().length < 3 || description.trim().length < 10} onClick={submit}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportProblemDialog({ open, pathname, onClose, onSubmitted }: { open: boolean; pathname: string; onClose(): void; onSubmitted(): void }) {
  const [module, setModule] = useState(MODULE_OPTIONS[0]);
  const [description, setDescription] = useState("");
  const [attachment, setAttachment] = useState<{ dataUrl: string; name: string } | undefined>();
  const [submitting, setSubmitting] = useState(false);

  function reset() { setModule(MODULE_OPTIONS[0]); setDescription(""); setAttachment(undefined); }

  async function submit() {
    setSubmitting(true);
    const result = await submitSupportRequestAction({
      type: "BUG_REPORT",
      subject: `Problem report: ${module}`,
      category: "TECHNICAL",
      priority: "NORMAL",
      description,
      module,
      route: pathname,
      attachment,
    });
    setSubmitting(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Thanks — we've logged this problem");
    reset();
    onSubmitted();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report a Problem</DialogTitle>
          <DialogDescription>We capture the current page and time automatically — never passwords, tokens or cookies.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Page / module</Label>
            <Select value={module} onValueChange={(v) => v && setModule(v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{MODULE_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">What happened?</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what you expected vs. what happened" />
          </div>
          <AttachmentField onChange={setAttachment} />
          <p className="text-[11px] text-muted-foreground">Captured automatically: page ({pathname}) and timestamp.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={submitting || description.trim().length < 10} onClick={submit}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeatureRequestDialog({ open, onClose, onSubmitted }: { open: boolean; onClose(): void; onSubmitted(): void }) {
  const [title, setTitle] = useState("");
  const [module, setModule] = useState(MODULE_OPTIONS[0]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() { setTitle(""); setModule(MODULE_OPTIONS[0]); setDescription(""); }

  async function submit() {
    setSubmitting(true);
    const result = await submitSupportRequestAction({
      type: "FEATURE_REQUEST",
      subject: title,
      category: "OTHER",
      priority: "NORMAL",
      description,
      module,
    });
    setSubmitting(false);
    if (!result.success) return toast.error(result.error);
    toast.success("Thanks for the idea — we've logged it");
    reset();
    onSubmitted();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Feature Request</DialogTitle>
          <DialogDescription>Tell us what you&apos;d like to see.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A short, clear title" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Relevant module</Label>
            <Select value={module} onValueChange={(v) => v && setModule(v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{MODULE_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Description</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What problem would this solve?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={submitting || title.trim().length < 3 || description.trim().length < 10} onClick={submit}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
