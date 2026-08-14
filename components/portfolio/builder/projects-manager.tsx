"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, X, Loader2, Pencil, Trash2, ArrowUp, ArrowDown, Star, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { cn } from "@/lib/utils";
import {
  addProjectAction,
  updateProjectAction,
  deleteProjectAction,
  reorderProjectsAction,
  type PortfolioProjectInput,
} from "@/services/portfolio";
import type { PortfolioViewModel, PortfolioProjectVM } from "@/types/portfolio";
import { Briefcase } from "lucide-react";

const EMPTY_FORM: PortfolioProjectInput = {
  title: "",
  category: "",
  description: "",
  coverImage: "",
  galleryImages: [],
  projectUrl: "",
  clientName: "",
  year: undefined,
  tools: [],
  role: "",
  featured: false,
};

export function ProjectsManager({ data, onChange }: { data: PortfolioViewModel; onChange: (d: PortfolioViewModel) => void }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PortfolioProjectInput>(EMPTY_FORM);
  const [toolsText, setToolsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const projects = [...data.projects].sort((a, b) => a.position - b.position);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setToolsText("");
    setDialogOpen(true);
  }

  function openEdit(project: PortfolioProjectVM) {
    setEditingId(project.id);
    setForm({
      title: project.title,
      category: project.category ?? "",
      description: project.description ?? "",
      coverImage: project.coverImage ?? "",
      galleryImages: project.galleryImages,
      projectUrl: project.projectUrl ?? "",
      clientName: project.clientName ?? "",
      year: project.year ?? undefined,
      tools: project.tools,
      role: project.role ?? "",
      featured: project.featured,
    });
    setToolsText(project.tools.join(", "));
    setDialogOpen(true);
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingCover(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((f) => ({ ...f, coverImage: dataUrl }));
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingGallery(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((f) => ({ ...f, galleryImages: [...(f.galleryImages ?? []), dataUrl] }));
    } finally {
      setUploadingGallery(false);
    }
  }

  function removeGalleryImage(idx: number) {
    setForm((f) => ({ ...f, galleryImages: (f.galleryImages ?? []).filter((_, i) => i !== idx) }));
  }

  async function handleSave() {
    if (!form.title.trim()) return toast.error("Project title is required.");
    setSaving(true);
    const input: PortfolioProjectInput = {
      ...form,
      tools: toolsText.split(",").map((t) => t.trim()).filter(Boolean),
    };
    const result = editingId ? await updateProjectAction(editingId, input) : await addProjectAction(input);
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    onChange(result.data);
    setDialogOpen(false);
    toast.success(editingId ? "Project updated" : "Project added");
  }

  async function handleDelete(id: string) {
    const result = await deleteProjectAction(id);
    if (!result.success) return toast.error(result.error);
    onChange(result.data);
    toast.success("Project removed");
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= projects.length) return;
    const reordered = [...projects];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const result = await reorderProjectsAction(reordered.map((p) => p.id));
    if (!result.success) return toast.error(result.error);
    onChange(result.data);
  }

  async function toggleFeatured(project: PortfolioProjectVM) {
    const result = await updateProjectAction(project.id, {
      title: project.title,
      category: project.category ?? "",
      description: project.description ?? "",
      coverImage: project.coverImage ?? "",
      galleryImages: project.galleryImages,
      projectUrl: project.projectUrl ?? "",
      clientName: project.clientName ?? "",
      year: project.year ?? undefined,
      tools: project.tools,
      role: project.role ?? "",
      featured: !project.featured,
    });
    if (!result.success) return toast.error(result.error);
    onChange(result.data);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Selected Work</h3>
          <p className="text-xs text-muted-foreground">Case studies shown on your published portfolio.</p>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState icon={Briefcase} title="No projects yet" description="Add your best work to showcase on your portfolio." action={{ label: "Add Project", onClick: openAdd }} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project, i) => (
            <div key={project.id} className="rounded-xl border border-border overflow-hidden">
              <div className="aspect-video bg-muted relative">
                {project.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={project.coverImage} alt={project.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No cover image</div>
                )}
                {project.featured && (
                  <span className="absolute top-2 left-2 bg-foreground text-background text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Star className="h-2.5 w-2.5 fill-current" /> Featured
                  </span>
                )}
              </div>
              <div className="p-3 space-y-2">
                <p className="text-sm font-medium text-foreground truncate">{project.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[project.category, project.year].filter(Boolean).join(" · ") || "—"}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon-sm" onClick={() => handleMove(i, -1)} disabled={i === 0} aria-label="Move up">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleMove(i, 1)} disabled={i === projects.length - 1} aria-label="Move down">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleFeatured(project)}
                      aria-label="Toggle featured"
                      className={cn(project.featured && "text-amber-500")}
                    >
                      <Star className={cn("h-3.5 w-3.5", project.featured && "fill-current")} />
                    </Button>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(project)} aria-label="Edit project">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(project.id)} aria-label="Delete project">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Project" : "Add Project"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Cover Image</Label>
              <div className="aspect-video rounded-lg border border-dashed border-border bg-muted overflow-hidden flex items-center justify-center relative">
                {form.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.coverImage} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <button type="button" onClick={() => coverInputRef.current?.click()} disabled={uploadingCover} className="flex flex-col items-center gap-1 text-muted-foreground text-xs">
                    {uploadingCover ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                    Upload cover image
                  </button>
                )}
                {form.coverImage && (
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="absolute bottom-2 right-2 text-[11px] font-medium bg-background/90 border border-border rounded-full px-2.5 py-1"
                  >
                    Replace
                  </button>
                )}
              </div>
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Title</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Branding" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Client (optional)</Label>
                <Input value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Year</Label>
                <Input
                  type="number"
                  value={form.year ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, year: e.target.value ? Number(e.target.value) : undefined }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Your role</Label>
                <Input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Lead Designer" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Project URL (optional)</Label>
                <Input value={form.projectUrl} onChange={(e) => setForm((f) => ({ ...f, projectUrl: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tools / skills (comma-separated)</Label>
              <Input value={toolsText} onChange={(e) => setToolsText(e.target.value)} placeholder="Figma, Webflow, Illustrator" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Gallery images</Label>
              <div className="flex flex-wrap gap-2">
                {(form.galleryImages ?? []).map((img, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-md overflow-hidden bg-muted group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeGalleryImage(i)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={uploadingGallery}
                  className="w-16 h-16 rounded-md border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary/50"
                >
                  {uploadingGallery ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </button>
              </div>
              <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleGalleryUpload} />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} className="rounded border-border" />
              Mark as featured
            </label>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {editingId ? "Save Changes" : "Add Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
