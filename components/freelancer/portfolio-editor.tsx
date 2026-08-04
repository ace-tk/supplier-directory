"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Link2,
  Camera,
  Palette,
  Play,
  Code2,
  Upload,
  X,
  FileText,
  Download,
  Plus,
  Loader2,
  Pencil,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { formatFileSize } from "@/lib/freelancer-ui";
import {
  updateProfileAction,
  addPortfolioItemAction,
  removePortfolioItemAction,
  uploadResumeAction,
  addExperienceAction,
  removeExperienceAction,
  type UpdateProfileInput,
  type ExperienceInput,
} from "@/services/freelancer";
import type { FreelancerProfile } from "@/types/freelancer-portal";
import { cn } from "@/lib/utils";

const SOCIAL_PLATFORMS = [
  { key: "linkedinUrl" as const, label: "LinkedIn", icon: Link2, color: "bg-blue-500/10 text-blue-500" },
  { key: "instagramUrl" as const, label: "Instagram", icon: Camera, color: "bg-pink-500/10 text-pink-500" },
  { key: "behanceUrl" as const, label: "Behance", icon: Palette, color: "bg-indigo-500/10 text-indigo-500" },
  { key: "dribbbleUrl" as const, label: "Dribbble", icon: Play, color: "bg-rose-500/10 text-rose-500" },
  { key: "githubUrl" as const, label: "GitHub", icon: Code2, color: "bg-slate-500/10 text-slate-500" },
];

export function PortfolioEditor({ initialProfile }: { initialProfile: FreelancerProfile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [linksOpen, setLinksOpen] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);
  const [expOpen, setExpOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [savingLinks, setSavingLinks] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [savingExp, setSavingExp] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const [linksForm, setLinksForm] = useState({
    linkedinUrl: profile.linkedinUrl ?? "",
    instagramUrl: profile.instagramUrl ?? "",
    behanceUrl: profile.behanceUrl ?? "",
    dribbbleUrl: profile.dribbbleUrl ?? "",
    githubUrl: profile.githubUrl ?? "",
  });
  const [bioForm, setBioForm] = useState({ bio: profile.bio ?? "", skills: profile.skills.join(", ") });
  const [expForm, setExpForm] = useState<ExperienceInput>({ role: "", company: "", startDate: "", endDate: "", description: "" });

  async function handleSaveLinks() {
    setSavingLinks(true);
    const input: UpdateProfileInput = { ...linksForm };
    const result = await updateProfileAction(input);
    setSavingLinks(false);
    if (!result.success) return toast.error(result.error);
    setProfile(result.data);
    setLinksOpen(false);
    toast.success("Links updated");
  }

  async function handleSaveBio() {
    setSavingBio(true);
    const skills = bioForm.skills.split(",").map((s) => s.trim()).filter(Boolean);
    const result = await updateProfileAction({ bio: bioForm.bio, skills });
    setSavingBio(false);
    if (!result.success) return toast.error(result.error);
    setProfile(result.data);
    setBioOpen(false);
    toast.success("Profile updated");
  }

  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingImage(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await addPortfolioItemAction({ dataUrl, mimeType: file.type, sizeBytes: file.size });
      if (!result.success) return toast.error(result.error);
      setProfile(result.data);
      toast.success("Image added");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleRemoveImage(itemId: string) {
    const result = await removePortfolioItemAction(itemId);
    if (!result.success) return toast.error(result.error);
    setProfile(result.data);
  }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingResume(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await uploadResumeAction({ fileName: file.name, mimeType: file.type, sizeBytes: file.size, dataUrl });
      if (!result.success) return toast.error(result.error);
      setProfile(result.data);
      toast.success("Resume uploaded");
    } finally {
      setUploadingResume(false);
    }
  }

  async function handleAddExperience() {
    if (!expForm.role.trim() || !expForm.company.trim() || !expForm.startDate) {
      toast.error("Role, company, and start date are required.");
      return;
    }
    setSavingExp(true);
    const result = await addExperienceAction(expForm);
    setSavingExp(false);
    if (!result.success) return toast.error(result.error);
    setProfile(result.data);
    setExpOpen(false);
    setExpForm({ role: "", company: "", startDate: "", endDate: "", description: "" });
    toast.success("Experience added");
  }

  async function handleRemoveExperience(id: string) {
    const result = await removeExperienceAction(id);
    if (!result.success) return toast.error(result.error);
    setProfile(result.data);
  }

  return (
    <div className="space-y-8">
      {/* Social & reference links */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Social &amp; Reference Links</h2>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLinksOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit Links
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {SOCIAL_PLATFORMS.map((platform) => {
            const url = profile[platform.key];
            const Icon = platform.icon;
            const content = (
              <div
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all",
                  url ? "hover:shadow-card hover:border-border/80 cursor-pointer" : "opacity-60"
                )}
              >
                <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg", platform.color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium text-foreground">{platform.label}</p>
                <p className="text-[10px] text-muted-foreground">{url ? "Connected" : "Not added"}</p>
              </div>
            );
            return url ? (
              <a key={platform.key} href={url} target="_blank" rel="noreferrer">
                {content}
              </a>
            ) : (
              <div key={platform.key}>{content}</div>
            );
          })}
        </div>
      </section>

      {/* Bio & skills */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Bio &amp; Skills</h2>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBioOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {profile.bio || <span className="text-muted-foreground">No bio added yet.</span>}
          </p>
          {profile.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((s) => (
                <Badge key={s} variant="secondary" className="font-normal">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Resume */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Resume</h2>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted shrink-0">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-foreground truncate">{profile.resumeFileName ?? "No resume uploaded"}</p>
              {profile.resumeDataUrl && (
                <p className="text-[11px] text-muted-foreground">{formatFileSize(Math.round((profile.resumeDataUrl.length * 3) / 4))}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {profile.resumeDataUrl && (
              <a href={profile.resumeDataUrl} download={profile.resumeFileName ?? "resume"}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </a>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={uploadingResume}
              onClick={() => resumeInputRef.current?.click()}
            >
              {uploadingResume ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {profile.resumeDataUrl ? "Replace" : "Upload"}
            </Button>
            <input
              ref={resumeInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={handleResumeUpload}
            />
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Portfolio Gallery</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={uploadingImage}
            className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            {uploadingImage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            <span className="text-xs">Add Image</span>
          </button>
          <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handleGalleryUpload} />

          {profile.portfolioItems.map((item) => (
            <div key={item.id} className="relative group aspect-square rounded-xl overflow-hidden bg-muted">
              <img src={item.dataUrl} alt={item.caption ?? "Portfolio item"} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemoveImage(item.id)}
                className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        {profile.portfolioItems.length === 0 && (
          <p className="text-xs text-muted-foreground">Add images showcasing your best work.</p>
        )}
      </section>

      {/* Experience */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Experience</h2>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setExpOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Experience
          </Button>
        </div>
        {profile.experience.length === 0 ? (
          <EmptyState icon={Briefcase} title="No experience added" description="Add roles you've held to build out your profile." />
        ) : (
          <div className="space-y-3">
            {profile.experience.map((exp) => (
              <div key={exp.id} className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{exp.role}</p>
                  <p className="text-xs text-muted-foreground">{exp.company}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {new Date(exp.startDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" })} –{" "}
                    {exp.endDate ? new Date(exp.endDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "Present"}
                  </p>
                  {exp.description && <p className="text-xs text-muted-foreground mt-2">{exp.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveExperience(exp.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  aria-label="Remove experience"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Edit links dialog */}
      <Dialog open={linksOpen} onOpenChange={setLinksOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Links</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {SOCIAL_PLATFORMS.map((platform) => (
              <div key={platform.key} className="space-y-1.5">
                <Label className="text-xs">{platform.label}</Label>
                <Input
                  placeholder={`https://${platform.label.toLowerCase()}.com/...`}
                  value={linksForm[platform.key]}
                  onChange={(e) => setLinksForm((f) => ({ ...f, [platform.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button onClick={handleSaveLinks} disabled={savingLinks} className="gap-1.5">
              {savingLinks && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit bio dialog */}
      <Dialog open={bioOpen} onOpenChange={setBioOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Bio &amp; Skills</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Bio</Label>
              <Textarea rows={4} value={bioForm.bio} onChange={(e) => setBioForm((f) => ({ ...f, bio: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Skills (comma-separated)</Label>
              <Input value={bioForm.skills} onChange={(e) => setBioForm((f) => ({ ...f, skills: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button onClick={handleSaveBio} disabled={savingBio} className="gap-1.5">
              {savingBio && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add experience dialog */}
      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Experience</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Input value={expForm.role} onChange={(e) => setExpForm((f) => ({ ...f, role: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Company</Label>
              <Input value={expForm.company} onChange={(e) => setExpForm((f) => ({ ...f, company: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={expForm.startDate} onChange={(e) => setExpForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date (optional)</Label>
                <Input type="date" value={expForm.endDate} onChange={(e) => setExpForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description (optional)</Label>
              <Textarea rows={3} value={expForm.description} onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button onClick={handleAddExperience} disabled={savingExp} className="gap-1.5">
              {savingExp && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
