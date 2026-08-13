import { NextResponse } from "next/server";
import { getUser } from "@/lib/session";
import { runChatCompletion, AIConfigError, OpenAI } from "@/lib/ai/openai-client";
import { generateProductDescriptionSchema } from "@/lib/validations/product-ai";
import { buildProductDescriptionPrompt, PRODUCT_DESCRIPTION_MAX_TOKENS } from "@/lib/ai/prompts/product-description";

// "Create Product Description" on the Product module's Add/Edit form —
// reuses the same server-side-only OpenAI engine as /api/content/generate
// and /api/content/ai-edit (lib/ai/openai-client.ts). This is the only
// place Product field data is sent to OpenAI, and only to generate
// description text — never anything else.
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

  const parsed = generateProductDescriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { system, user: userPrompt } = buildProductDescriptionPrompt(parsed.data);

  try {
    const text = await runChatCompletion({ system, user: userPrompt, maxTokens: PRODUCT_DESCRIPTION_MAX_TOKENS });
    // Plain-text field (never rendered as HTML) — just strip stray code
    // fences/markdown the model might still slip in, no HTML sanitizer needed.
    const cleaned = text.replace(/```[a-z]*\n?/gi, "").trim();
    return NextResponse.json({ text: cleaned });
  } catch (err) {
    console.error("[product/generate-description] AI request failed:", err);
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
