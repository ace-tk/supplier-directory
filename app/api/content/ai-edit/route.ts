import { NextResponse } from "next/server";
import { getUser } from "@/lib/session";
import { runChatCompletion, AIConfigError, OpenAI } from "@/lib/ai/openai-client";
import { buildContentEditPrompt, maxTokensForAction } from "@/lib/ai/content-edit-actions";
import { sanitizeEditorHtml } from "@/lib/ai/sanitize-html";
import { aiEditContentSchema } from "@/lib/validations/content";
import { CONTENT_LANGUAGE_LABELS } from "@/lib/content-ui";

// AI Editing Assistant — reuses the same server-side-only OpenAI engine as
// /api/content/generate (lib/ai/openai-client.ts). The API key never leaves
// the server and this route is the only place editor content is sent to
// OpenAI for in-place rewriting/tone/translation actions.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = aiEditContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { action, html, targetLanguage } = parsed.data;

  const { system, user: userPrompt } = buildContentEditPrompt(action, html, {
    targetLanguage: targetLanguage ? CONTENT_LANGUAGE_LABELS[targetLanguage] : undefined,
  });

  try {
    const result = await runChatCompletion({
      system,
      user: userPrompt,
      maxTokens: maxTokensForAction(action),
    });
    return NextResponse.json({ html: sanitizeEditorHtml(result) });
  } catch (err) {
    console.error("[content/ai-edit] AI request failed:", err);
    if (err instanceof AIConfigError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    const message =
      err instanceof OpenAI.APIError
        ? `AI editing failed: ${err.message}`
        : "AI editing failed. Please try again in a moment.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
