"use client";

// Single shared client-side entry point to /api/product/generate-description
// — mirrors run-content-ai-action.ts's role for /api/content/ai-edit, so
// there is exactly one place that calls this endpoint from client code.

import type { GenerateProductDescriptionInput } from "@/lib/validations/product-ai";

export async function runProductDescriptionAction(input: GenerateProductDescriptionInput): Promise<string> {
  const res = await fetch("/api/product/generate-description", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "AI request failed. Please try again.");
  return data.text as string;
}
