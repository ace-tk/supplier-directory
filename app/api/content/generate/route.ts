import { NextResponse } from "next/server";
import { getUser } from "@/lib/session";
import { runChatCompletion, AIConfigError, OpenAI } from "@/lib/ai/openai-client";
import { sanitizeEditorHtml } from "@/lib/ai/sanitize-html";
import { generateContentSchema } from "@/lib/validations/content";
import { buildContentGenerationPrompt, GENERATION_MAX_TOKENS } from "@/lib/ai/prompts/content-generation";

// AI Content Studio — the only place OpenAI is called from. The API key
// never leaves the server: it's read once here via process.env and used to
// construct a server-side client; nothing about it is sent to the browser.
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

  const parsed = generateContentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { title, contentType, language, tone, audience, prompt } = parsed.data;

  const { system, user: userPrompt } = buildContentGenerationPrompt({ title, contentType, language, tone, audience, prompt });

  try {
    const html = await runChatCompletion({ system, user: userPrompt, maxTokens: GENERATION_MAX_TOKENS });
    return NextResponse.json({ html: sanitizeEditorHtml(html) });
  } catch (err) {
    console.error("[content/generate] OpenAI request failed:", err);
    if (err instanceof AIConfigError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    const message =
      err instanceof OpenAI.APIError
        ? `AI generation failed: ${err.message}`
        : "AI generation failed. Please try again in a moment.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
