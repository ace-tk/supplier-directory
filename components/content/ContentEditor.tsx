"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Send,
  Archive,
  ImageIcon,
  X,
  Eye,
  ArrowLeft,
  BookMarked,
  MoreHorizontal,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RichTextEditor } from "@/components/content/RichTextEditor";
import { ContentGenerationForm } from "@/components/content/ContentGenerationForm";
import { AIAssistantToolbar } from "@/components/content/AIAssistantToolbar";
import { ContentWorkspaceSidebar } from "@/components/content/ContentWorkspaceSidebar";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateImage } from "@/lib/file-validation";
import { saveContentAction, type SaveContentPayload } from "@/services/content";
import { CONTENT_CATEGORIES } from "@/lib/content-ui";
import type { ContentItemRecord, ContentType, ContentLanguage, ContentTone, ContentAudience, DraftAttachment } from "@/types/content";

export function ContentEditor({
  basePath,
  initialItem,
  startInPreview = false,
}: {
  basePath: string;
  initialItem: ContentItemRecord | null;
  startInPreview?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialItem?.title ?? "");
  const [category, setCategory] = useState(initialItem?.category ?? "");
  const [tagsInput, setTagsInput] = useState("");
  const [tags, setTags] = useState<string[]>(initialItem?.tags ?? []);
  const [featuredImage, setFeaturedImage] = useState<string | null>(initialItem?.featuredImageUrl ?? null);
  const [bodyHtml, setBodyHtml] = useState(initialItem?.bodyHtml ?? "");
  const [attachments, setAttachments] = useState<DraftAttachment[]>(initialItem?.attachments ?? []);
  const [saving, setSaving] = useState<"draft" | "publish" | "archive" | "template" | null>(null);
  const [preview, setPreview] = useState(startInPreview);
  const [mode, setMode] = useState<"generate" | "edit">(initialItem ? "edit" : "generate");
  const [aiProcessing, setAiProcessing] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<ContentItemRecord | null>(null);

  const [contentType, setContentType] = useState<ContentType | undefined>(initialItem?.contentType ?? undefined);
  const [language, setLanguage] = useState<ContentLanguage | undefined>(initialItem?.language ?? undefined);
  const [tone, setTone] = useState<ContentTone | undefined>(initialItem?.tone ?? undefined);
  const [audience, setAudience] = useState<ContentAudience | undefined>(initialItem?.audience ?? undefined);
  const [prompt, setPrompt] = useState(initialItem?.prompt ?? "");

  const imageInputRef = useRef<HTMLInputElement>(null);

  const { wordCount, charCount } = useMemo(() => {
    const text = bodyHtml.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim();
    return { wordCount: text ? text.split(/\s+/).length : 0, charCount: text.length };
  }, [bodyHtml]);

  function addTag() {
    const t = tagsInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagsInput("");
  }

  async function handleFeaturedImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const v = validateImage(file.type, file.size);
    if (!v.valid) return toast.error(v.error);
    setFeaturedImage(await fileToDataUrl(file));
  }

  async function handleSave(status: "DRAFT" | "PUBLISHED" | "ARCHIVED", opts?: { asTemplate?: boolean }) {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    setSaving(opts?.asTemplate ? "template" : status === "DRAFT" ? "draft" : status === "PUBLISHED" ? "publish" : "archive");

    const payload: SaveContentPayload = {
      id: initialItem?.id,
      title,
      category: category || undefined,
      tags,
      featuredImageUrl: featuredImage || undefined,
      bodyHtml,
      attachments,
      status,
      prompt: prompt || undefined,
      contentType,
      language,
      tone,
      audience,
      isTemplate: opts?.asTemplate ? true : initialItem?.isTemplate,
    };

    const result = await saveContentAction(payload);
    setSaving(null);
    if (!result.success) return toast.error(result.error);

    toast.success(
      opts?.asTemplate
        ? "Saved as template"
        : status === "PUBLISHED"
          ? "Content published"
          : status === "ARCHIVED"
            ? "Content archived"
            : "Draft saved"
    );
    router.push(basePath);
    router.refresh();
  }

  function handleGenerated(
    html: string,
    meta: { title: string; contentType: ContentType; language: ContentLanguage; tone: ContentTone; audience: ContentAudience; prompt: string }
  ) {
    setTitle(meta.title);
    setBodyHtml(html);
    setContentType(meta.contentType);
    setLanguage(meta.language);
    setTone(meta.tone);
    setAudience(meta.audience);
    setPrompt(meta.prompt);
    setMode("edit");
  }

  function applyTemplate(item: ContentItemRecord) {
    setTitle(item.title);
    setCategory(item.category ?? "");
    setTags(item.tags);
    setFeaturedImage(item.featuredImageUrl);
    setBodyHtml(item.bodyHtml);
    setAttachments(item.attachments);
    toast.success(`Applied template "${item.title}"`);
  }

  function handleUseTemplate(item: ContentItemRecord) {
    const hasUnsavedContent = title.trim() || bodyHtml.trim() || tags.length > 0 || attachments.length > 0;
    if (hasUnsavedContent) {
      setPendingTemplate(item);
    } else {
      applyTemplate(item);
    }
  }

  if (mode === "generate") {
    return <ContentGenerationForm basePath={basePath} onGenerated={handleGenerated} onSkip={() => setMode("edit")} />;
  }

  return (
    <div className="space-y-4 max-w-[1400px]">
      <PageHeader
        title={initialItem ? "Edit Content" : "Create Content"}
        breadcrumbs={[{ label: "Content Management", href: basePath }, { label: initialItem ? "Edit" : "Create" }]}
        actions={
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push(basePath)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPreview((v) => !v)}>
              <Eye className="h-3.5 w-3.5" /> {preview ? "Edit" : "Preview"}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" disabled={!!saving} onClick={() => handleSave("DRAFT")}>
              {saving === "draft" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Draft
            </Button>
            <Button size="sm" className="gap-1.5" disabled={!!saving} onClick={() => handleSave("PUBLISHED")}>
              {saving === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Publish
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="More actions" />}>
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSave(initialItem?.status ?? "DRAFT", { asTemplate: true })} disabled={!!saving}>
                  {saving === "template" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookMarked className="h-3.5 w-3.5" />} Save Template
                </DropdownMenuItem>
                {initialItem && (
                  <DropdownMenuItem onClick={() => handleSave("ARCHIVED")} disabled={!!saving}>
                    {saving === "archive" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />} Archive
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {preview ? (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          {featuredImage && <img src={featuredImage} alt={title} className="w-full aspect-video object-cover rounded-xl" />}
          <h1 className="text-2xl font-bold text-foreground">{title || "Untitled"}</h1>
          <div className="flex flex-wrap gap-1.5">
            {category && <Badge variant="secondary">{category}</Badge>}
            {tags.map((t) => (
              <Badge key={t} variant="secondary" className="font-normal">
                {t}
              </Badge>
            ))}
          </div>
          <div className="tiptap-content" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
          <ContentWorkspaceSidebar
            basePath={basePath}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
            onUseTemplate={handleUseTemplate}
          />

          <div className="space-y-4 min-w-0">
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Content title" className="text-base font-medium h-9" />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Category</Label>
                  <Select value={category || undefined} onValueChange={(v) => v && setCategory(v)}>
                    <SelectTrigger className="w-full h-8">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Tags</Label>
                  <div className="flex gap-1.5">
                    <Input
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="Add a tag, press Enter"
                      className="h-8"
                    />
                    <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={addTag}>
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1 font-normal">
                      {t}
                      <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-medium">Featured Image</Label>
                {featuredImage ? (
                  <div className="relative w-full max-w-[220px] aspect-video rounded-lg overflow-hidden bg-muted group">
                    <img src={featuredImage} alt="Featured" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFeaturedImage(null)}
                      className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove featured image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    <ImageIcon className="h-3.5 w-3.5" /> Add featured image
                  </button>
                )}
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleFeaturedImage} />
              </div>
            </div>

            <AIAssistantToolbar html={bodyHtml} onReplace={setBodyHtml} onProcessingChange={setAiProcessing} disabled={!bodyHtml.trim()} />

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <RichTextEditor value={bodyHtml} onChange={setBodyHtml} editable={!aiProcessing} />
              <div className="flex items-center justify-end gap-3 px-4 py-1.5 border-t border-border text-[11px] text-muted-foreground tabular-nums">
                <span>{wordCount} words</span>
                <span>{charCount} characters</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!pendingTemplate} onOpenChange={(open) => !open && setPendingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply this template?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces the title, content, tags, featured image, and attachments below with &quot;{pendingTemplate?.title}&quot;. Anything
              unsaved here will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingTemplate) applyTemplate(pendingTemplate);
                setPendingTemplate(null);
              }}
            >
              Apply Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
