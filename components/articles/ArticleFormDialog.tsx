"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoiceNotesField } from "./VoiceNotesField";
import { createArticleAction, updateArticleAction, fetchArticleMetadataAction } from "@/services/article";
import type { ArticleRecord } from "@/types/article";

interface FormState {
  url: string;
  title: string;
  description: string;
  notes: string;
  category: string;
  tags: string;
  thumbnailUrl: string;
}

function formFromArticle(article: ArticleRecord | null): FormState {
  return {
    url: article?.url ?? "",
    title: article?.title ?? "",
    description: article?.description ?? "",
    notes: article?.notes ?? "",
    category: article?.category ?? "",
    tags: article?.tags.join(", ") ?? "",
    thumbnailUrl: article?.thumbnailUrl ?? "",
  };
}

export function ArticleFormDialog({
  open,
  onOpenChange,
  article,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article: ArticleRecord | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => formFromArticle(article));
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [saving, setSaving] = useState(false);

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  async function handleFetchPreview() {
    if (!form.url.trim()) {
      toast.error("Enter a URL first.");
      return;
    }
    setFetchingMeta(true);
    try {
      const result = await fetchArticleMetadataAction(form.url.trim());
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const { title, description, thumbnailUrl } = result.data;
      if (!title && !description && !thumbnailUrl) {
        toast.error("Couldn't fetch a preview for that URL — you can still fill in the details and save.");
        return;
      }
      patch({
        title: form.title || title || "",
        description: form.description || description || "",
        thumbnailUrl: form.thumbnailUrl || thumbnailUrl || "",
      });
      toast.success("Preview fetched");
    } finally {
      setFetchingMeta(false);
    }
  }

  async function handleSave() {
    if (!form.url.trim()) {
      toast.error("URL is required.");
      return;
    }
    setSaving(true);
    const payload = {
      url: form.url.trim(),
      title: form.title,
      description: form.description,
      notes: form.notes,
      category: form.category,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      thumbnailUrl: form.thumbnailUrl,
    };
    const result = article ? await updateArticleAction(article.id, payload) : await createArticleAction(payload);
    setSaving(false);
    if (!result.success) return toast.error(result.error);
    toast.success(article ? "Article updated" : "Article saved");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{article ? "Edit Article" : "Add Article"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">URL</Label>
            <div className="flex gap-2">
              <Input
                value={form.url}
                onChange={(e) => patch({ url: e.target.value })}
                placeholder="https://example.com/article"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleFetchPreview} disabled={fetchingMeta}>
                {fetchingMeta ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Fetch Preview
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Optional — if fetching fails, just fill in the details yourself and save.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={form.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Optional" />
          </div>

          <VoiceNotesField value={form.description} onChange={(v) => patch({ description: v })} />

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Input value={form.category} onChange={(e) => patch({ category: e.target.value })} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tags</Label>
              <Input value={form.tags} onChange={(e) => patch({ tags: e.target.value })} placeholder="Comma separated" />
            </div>
          </div>

          {form.thumbnailUrl && (
            <div className="space-y-1.5">
              <Label className="text-xs">Thumbnail Preview</Label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form.thumbnailUrl} alt="" className="h-24 w-full object-cover rounded-lg border border-border" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {article ? "Save Changes" : "Save Article"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
