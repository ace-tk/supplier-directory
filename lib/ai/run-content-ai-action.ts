"use client";

// Single shared client-side entry point to the existing /api/content/ai-edit
// route — used by both AIAssistantToolbar (rewrite/tone/translate/etc.) and
// AI Summarize (Files/Templates), so there is exactly one place that calls
// this endpoint from client code, never a second OpenAI integration.

import type { AIEditAction } from "@/lib/ai/content-edit-actions";
import type { ContentLanguage } from "@/types/content";

export async function runContentAiAction(action: AIEditAction, html: string, targetLanguage?: ContentLanguage): Promise<string> {
  const res = await fetch("/api/content/ai-edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, html, targetLanguage }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "AI request failed. Please try again.");
  return data.html as string;
}
