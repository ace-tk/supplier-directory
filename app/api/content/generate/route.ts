import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getUser } from "@/lib/session";
import { generateContentSchema } from "@/lib/validations/content";
import { CONTENT_TYPE_LABELS, CONTENT_LANGUAGE_LABELS, CONTENT_TONE_LABELS, CONTENT_AUDIENCE_LABELS } from "@/lib/content-ui";

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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI generation isn't configured yet. Add OPENAI_API_KEY to the server environment." },
      { status: 500 }
    );
  }

  const systemPrompt = [
    "You are an expert B2B wholesale marketplace copywriter working for SupplyBase, a supplier/buyer trading platform.",
    "Write copy that is specific, credible, and free of generic filler — no vague superscript claims, no placeholder brackets.",
    `Content type: ${CONTENT_TYPE_LABELS[contentType]}.`,
    `Tone: ${CONTENT_TONE_LABELS[tone]}.`,
    `Target audience: ${CONTENT_AUDIENCE_LABELS[audience]}.`,
    `Language: write the entire response in ${CONTENT_LANGUAGE_LABELS[language]}.`,
    "Output ONLY clean semantic HTML fit to insert directly into a rich text editor's content area.",
    "Use tags like <h2>, <h3>, <p>, <ul>/<li>, <strong>, <em> where appropriate for the content type.",
    "Do NOT include <html>, <head>, <body>, markdown syntax, or code fences — just the inner HTML fragment.",
    "Keep the length appropriate to the content type (concise for a product description or social caption, longer for a blog or newsletter).",
  ].join(" ");

  const userPrompt = `Title: ${title}\n\nInstructions: ${prompt}`;

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 1200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const html = completion.choices[0]?.message?.content?.trim();
    if (!html) {
      return NextResponse.json({ error: "The AI didn't return any content. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ html });
  } catch (err) {
    console.error("[content/generate] OpenAI request failed:", err);
    const message =
      err instanceof OpenAI.APIError
        ? `AI generation failed: ${err.message}`
        : "AI generation failed. Please try again in a moment.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
