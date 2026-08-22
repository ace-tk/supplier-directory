"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Camera, Loader2, Check, Copy, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateImage } from "@/lib/file-validation";
import { initials } from "@/utils/format";
import { createFreelancerAction } from "@/services/freelancer-service";
import { createFreelancerSchema, type CreateFreelancerFormValues } from "@/lib/validations/freelancer-admin";

const EMPTY_VALUES: CreateFreelancerFormValues = {
  name: "",
  email: "",
  phone: "",
  role: "",
  company: "",
  location: "",
  bio: "",
  skills: [],
  availability: "AVAILABLE",
  avatarDataUrl: "",
  linkedinUrl: "",
  instagramUrl: "",
  behanceUrl: "",
  dribbbleUrl: "",
  githubUrl: "",
};

export function AddFreelancerForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [skillsInput, setSkillsInput] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activation, setActivation] = useState<{ name: string; link: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateFreelancerFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zodResolver type diverges from RHF Resolver generic
    resolver: zodResolver(createFreelancerSchema) as any,
    defaultValues: EMPTY_VALUES,
  });

  const availability = watch("availability");
  const name = watch("name");

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const match = /^data:(.+);base64,/.exec(dataUrl);
      const mimeType = match?.[1] ?? "";
      const sizeBytes = Math.round((dataUrl.length * 3) / 4);
      const validation = validateImage(mimeType, sizeBytes, file.name);
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }
      setAvatarPreview(dataUrl);
      setValue("avatarDataUrl", dataUrl);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function onSubmit(values: CreateFreelancerFormValues) {
    const skills = skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const result = await createFreelancerAction({ ...values, skills });
    if (!result.success) {
      toast.error(result.error);
      return;
    }

    const link = `${window.location.origin}/reset-password?token=${result.data.resetToken}`;
    setActivation({ name: values.name, link });
  }

  async function handleCopyLink() {
    if (!activation) return;
    try {
      await navigator.clipboard.writeText(activation.link);
      setLinkCopied(true);
      toast.success("Activation link copied");
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  if (activation) {
    return (
      <div>
        <PageHeader title="Freelancer created" description="Share the activation link so they can set their own password." />
        <div className="max-w-lg rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
            <Check className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">{activation.name} was created</p>
              <p className="text-muted-foreground mt-0.5">
                They now exist as a real Freelancer account — but nobody, including you, knows their
                password. Copy the one-time activation link below and send it to them yourself (email,
                Slack, WhatsApp — whatever channel you&apos;d normally use). This app has no automated email
                delivery configured, so no email was sent automatically.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
            <TriangleAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300">
              This link is shown once and expires in 24 hours. It won&apos;t be retrievable again after you
              leave this page.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Input readOnly value={activation.link} className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={handleCopyLink} aria-label="Copy activation link">
              {linkCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <Button className="w-full" onClick={() => router.push("/freelancers")}>
            Done — view freelancers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Add Freelancer" description="Create a real freelancer account and profile." />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-2xl space-y-6">
        {/* Basic Information */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Basic Information</h2>

          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary text-lg font-semibold overflow-hidden">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="Profile preview" className="w-full h-full object-cover" />
                ) : (
                  initials(name || "?")
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1.5 -right-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground border-2 border-background hover:bg-primary/90 transition-colors"
                aria-label="Upload profile photo"
              >
                {uploadingAvatar ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <p className="text-xs text-muted-foreground">
              Optional. If no photo is uploaded, the freelancer card shows their initials — same as
              every self-registered freelancer.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="f-name" className="text-xs">Full Name *</Label>
              <Input id="f-name" placeholder="e.g. Priya Sharma" aria-invalid={!!errors.name} {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-email" className="text-xs">Email *</Label>
              <Input id="f-email" type="email" placeholder="priya@example.com" aria-invalid={!!errors.email} {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="f-phone" className="text-xs">Phone</Label>
              <Input id="f-phone" placeholder="+91 98765 43210" aria-invalid={!!errors.phone} {...register("phone")} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-location" className="text-xs">Location</Label>
              <Input id="f-location" placeholder="e.g. Mumbai, India" {...register("location")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="f-role" className="text-xs">Professional Role / Title *</Label>
              <Input id="f-role" placeholder="e.g. UI/UX Designer" aria-invalid={!!errors.role} {...register("role")} />
              {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-company" className="text-xs">
                Company <span className="text-muted-foreground font-normal">(optional — defaults to &quot;Independent&quot;)</span>
              </Label>
              <Input id="f-company" placeholder="e.g. Freelance / Studio Name" {...register("company")} />
            </div>
          </div>
        </section>

        {/* Professional Profile */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Professional Profile</h2>

          <div className="space-y-1.5">
            <Label htmlFor="f-bio" className="text-xs">About / Bio</Label>
            <Textarea id="f-bio" rows={3} placeholder="A short bio about this freelancer..." {...register("bio")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-skills" className="text-xs">Skills</Label>
            <Input
              id="f-skills"
              placeholder="e.g. Figma, Branding, Illustration (comma-separated)"
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="f-availability" className="text-xs">Availability</Label>
            <Select value={availability} onValueChange={(v) => v && setValue("availability", v as CreateFreelancerFormValues["availability"])}>
              <SelectTrigger id="f-availability" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AVAILABLE">Available</SelectItem>
                <SelectItem value="BUSY">Busy</SelectItem>
                <SelectItem value="UNAVAILABLE">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Social / Contact */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Social / Contact</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="f-linkedin" className="text-xs">LinkedIn</Label>
              <Input id="f-linkedin" placeholder="https://linkedin.com/in/..." aria-invalid={!!errors.linkedinUrl} {...register("linkedinUrl")} />
              {errors.linkedinUrl && <p className="text-xs text-destructive">{errors.linkedinUrl.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-instagram" className="text-xs">Instagram</Label>
              <Input id="f-instagram" placeholder="https://instagram.com/..." aria-invalid={!!errors.instagramUrl} {...register("instagramUrl")} />
              {errors.instagramUrl && <p className="text-xs text-destructive">{errors.instagramUrl.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="f-behance" className="text-xs">Behance</Label>
              <Input id="f-behance" placeholder="https://behance.net/..." aria-invalid={!!errors.behanceUrl} {...register("behanceUrl")} />
              {errors.behanceUrl && <p className="text-xs text-destructive">{errors.behanceUrl.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-dribbble" className="text-xs">Dribbble</Label>
              <Input id="f-dribbble" placeholder="https://dribbble.com/..." aria-invalid={!!errors.dribbbleUrl} {...register("dribbbleUrl")} />
              {errors.dribbbleUrl && <p className="text-xs text-destructive">{errors.dribbbleUrl.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-github" className="text-xs">GitHub</Label>
              <Input id="f-github" placeholder="https://github.com/..." aria-invalid={!!errors.githubUrl} {...register("githubUrl")} />
              {errors.githubUrl && <p className="text-xs text-destructive">{errors.githubUrl.message}</p>}
            </div>
          </div>
        </section>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/freelancers")} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="gap-1.5">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Add Freelancer
          </Button>
        </div>
      </form>
    </div>
  );
}
