"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, PenLine } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CONTENT_TYPE_LABELS,
  CONTENT_LANGUAGE_LABELS,
  CONTENT_TONE_LABELS,
  CONTENT_AUDIENCE_LABELS,
} from "@/lib/content-ui";
import type { ContentType, ContentLanguage, ContentTone, ContentAudience } from "@/types/content";

export interface GeneratedContentMeta {
  title: string;
  contentType: ContentType;
  language: ContentLanguage;
  tone: ContentTone;
  audience: ContentAudience;
  prompt: string;
}

interface ContentGenerationFormProps {
  basePath: string;
  onGenerated: (html: string, meta: GeneratedContentMeta) => void;
  onSkip: () => void;
}

const CONTENT_TYPES = Object.keys(CONTENT_TYPE_LABELS) as ContentType[];
const LANGUAGES = Object.keys(CONTENT_LANGUAGE_LABELS) as ContentLanguage[];
const TONES = Object.keys(CONTENT_TONE_LABELS) as ContentTone[];
const AUDIENCES = Object.keys(CONTENT_AUDIENCE_LABELS) as ContentAudience[];

export function ContentGenerationForm({ basePath, onGenerated, onSkip }: ContentGenerationFormProps) {
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<ContentType>("PRODUCT_DESCRIPTION");
  const [language, setLanguage] = useState<ContentLanguage>("ENGLISH");
  const [tone, setTone] = useState<ContentTone>("PROFESSIONAL");
  const [audience, setAudience] = useState<ContentAudience>("BUYERS");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    if (!title.trim()) return toast.error("Give your content a title first.");
    if (prompt.trim().length < 10) return toast.error("Describe what you'd like generated in a bit more detail.");

    setGenerating(true);
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, contentType, language, tone, audience, prompt }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error ?? "AI generation failed. Please try again.");
        return;
      }
      toast.success("Content generated — review and edit below.");
      onGenerated(result.html, { title, contentType, language, tone, audience, prompt });
    } catch {
      toast.error("Couldn't reach the AI service. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="AI Content Studio"
        description="Describe what you need, and generate a first draft to edit and save as a template."
        breadcrumbs={[{ label: "Content Management", href: basePath }, { label: "Create" }]}
      />

      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Generate with AI</p>
            <p className="text-xs text-muted-foreground">Configure the brief, then let AI write a first draft.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Content Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cotton Oversized Hoodie — Wholesale" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Content Type</Label>
            <Select value={contentType} onValueChange={(v) => v && setContentType(v as ContentType)}>
              <SelectTrigger className="w-full">
                <SelectValue>{CONTENT_TYPE_LABELS[contentType]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CONTENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Language</Label>
            <Select value={language} onValueChange={(v) => v && setLanguage(v as ContentLanguage)}>
              <SelectTrigger className="w-full">
                <SelectValue>{CONTENT_LANGUAGE_LABELS[language]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {CONTENT_LANGUAGE_LABELS[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Tone</Label>
            <Select value={tone} onValueChange={(v) => v && setTone(v as ContentTone)}>
              <SelectTrigger className="w-full">
                <SelectValue>{CONTENT_TONE_LABELS[tone]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CONTENT_TONE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Target Audience</Label>
            <Select value={audience} onValueChange={(v) => v && setAudience(v as ContentAudience)}>
              <SelectTrigger className="w-full">
                <SelectValue>{CONTENT_AUDIENCE_LABELS[audience]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {AUDIENCES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {CONTENT_AUDIENCE_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Prompt</Label>
          <Textarea
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Write a premium product description for cotton oversized hoodies targeting wholesale buyers in Europe."
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button onClick={handleGenerate} disabled={generating} className="gap-1.5">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Generating..." : "Generate with AI"}
          </Button>
          <Button variant="ghost" onClick={onSkip} disabled={generating} className="gap-1.5 text-muted-foreground">
            <PenLine className="h-3.5 w-3.5" /> Skip, write manually
          </Button>
        </div>
      </div>
    </div>
  );
}
