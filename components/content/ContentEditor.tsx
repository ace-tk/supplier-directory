"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Send,
  Archive,
  ImageIcon,
  X,
  Paperclip,
  FileText,
  Eye,
  ArrowLeft,
  BookMarked,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/content/RichTextEditor";
import { ContentGenerationForm } from "@/components/content/ContentGenerationForm";
import { AIAssistantToolbar } from "@/components/content/AIAssistantToolbar";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateImage, validateDocument } from "@/lib/file-validation";
import { formatFileSize } from "@/lib/content-ui";
import { saveContentAction, type SaveContentPayload } from "@/services/content";
import { CONTENT_CATEGORIES } from "@/lib/content-ui";
import type { ContentItemRecord, ContentType, ContentLanguage, ContentTone, ContentAudience } from "@/types/content";

interface DraftAttachment {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

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

  const [contentType, setContentType] = useState<ContentType | undefined>(initialItem?.contentType ?? undefined);
  const [language, setLanguage] = useState<ContentLanguage | undefined>(initialItem?.language ?? undefined);
  const [tone, setTone] = useState<ContentTone | undefined>(initialItem?.tone ?? undefined);
  const [audience, setAudience] = useState<ContentAudience | undefined>(initialItem?.audience ?? undefined);
  const [prompt, setPrompt] = useState(initialItem?.prompt ?? "");

  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const file of files) {
      const okDoc = validateDocument(file.type, file.size).valid;
      const okImg = validateImage(file.type, file.size).valid;
      if (!okDoc && !okImg) {
        toast.error(`${file.name}: unsupported file type or too large.`);
        continue;
      }
      const dataUrl = await fileToDataUrl(file);
      setAttachments((prev) => [...prev, { fileName: file.name, mimeType: file.type, sizeBytes: file.size, dataUrl }]);
    }
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

  if (mode === "generate") {
    return <ContentGenerationForm basePath={basePath} onGenerated={handleGenerated} onSkip={() => setMode("edit")} />;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={initialItem ? "Edit Content" : "Create Content"}
        breadcrumbs={[{ label: "Content Management", href: basePath }, { label: initialItem ? "Edit" : "Create" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push(basePath)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPreview((v) => !v)}>
              <Eye className="h-3.5 w-3.5" /> {preview ? "Edit" : "Preview"}
            </Button>
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
        <>
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Content title" className="text-base font-medium" />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Category</Label>
                <Select value={category || undefined} onValueChange={(v) => v && setCategory(v)}>
                  <SelectTrigger className="w-full">
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
              <div className="space-y-1.5">
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
                    placeholder="Add a tag and press Enter"
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    Add
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
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
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Featured Image</Label>
              {featuredImage ? (
                <div className="relative w-full max-w-sm aspect-video rounded-xl overflow-hidden bg-muted group">
                  <img src={featuredImage} alt="Featured" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFeaturedImage(null)}
                    className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove featured image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <ImageIcon className="h-4 w-4" /> Add featured image
                </button>
              )}
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleFeaturedImage} />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-medium">Content</Label>
            <AIAssistantToolbar
              html={bodyHtml}
              onReplace={setBodyHtml}
              onProcessingChange={setAiProcessing}
              disabled={!bodyHtml.trim()}
            />
            <RichTextEditor value={bodyHtml} onChange={setBodyHtml} editable={!aiProcessing} />
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
            <Label className="text-xs font-medium">Attachments</Label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Paperclip className="h-4 w-4" /> Attach files
            </button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleAttachment} />

            {attachments.length > 0 && (
              <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                {attachments.map((a, i) => (
                  <div key={`${a.fileName}-${i}`} className="flex items-center gap-3 px-3 py-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-foreground truncate">{a.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">{formatFileSize(a.sizeBytes)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove attachment"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex items-center gap-2 pb-8">
        <Button variant="outline" className="gap-1.5" disabled={!!saving} onClick={() => handleSave("DRAFT")}>
          {saving === "draft" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Draft
        </Button>
        <Button className="gap-1.5" disabled={!!saving} onClick={() => handleSave("PUBLISHED")}>
          {saving === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Publish
        </Button>
        {initialItem && (
          <Button variant="secondary" className="gap-1.5" disabled={!!saving} onClick={() => handleSave("ARCHIVED")}>
            {saving === "archive" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />} Archive
          </Button>
        )}
        <Button
          variant="outline"
          className="gap-1.5 ml-auto"
          disabled={!!saving}
          onClick={() => handleSave(initialItem?.status ?? "DRAFT", { asTemplate: true })}
        >
          {saving === "template" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookMarked className="h-3.5 w-3.5" />} Save Template
        </Button>
      </div>
    </div>
  );
}
