// Reusable AI engine — the ONLY place `new OpenAI(...)` is instantiated.
// Any module (Content Management, and future Marketing/Email/WhatsApp/CRM/
// Catalog modules) should call `runChatCompletion` instead of talking to the
// OpenAI SDK directly, so the API key and client setup are never duplicated.

import OpenAI from "openai";

export class AIConfigError extends Error {
  constructor(message = "AI generation isn't configured yet. Add OPENAI_API_KEY to the server environment.") {
    super(message);
    this.name = "AIConfigError";
  }
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AIConfigError();
  return new OpenAI({ apiKey });
}

export interface RunChatCompletionParams {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function runChatCompletion({
  system,
  user,
  model = "gpt-4o-mini",
  temperature = 0.7,
  maxTokens = 1200,
}: RunChatCompletionParams): Promise<string> {
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("The AI didn't return any content. Please try again.");
  return text;
}

export interface RunVisionChatCompletionParams {
  system: string;
  user: string;
  /** Data URLs (data:image/...;base64,...) — sent as image_url content parts. */
  images: string[];
  model?: string;
  maxTokens?: number;
}

/** Same shared client as runChatCompletion, extended to accept image inputs
 * (gpt-4o-mini and gpt-4o both read images natively via image_url content
 * parts) — used to have the AI actually look at uploaded reference photos
 * rather than only ever reasoning over text. */
export async function runVisionChatCompletion({
  system,
  user,
  images,
  model = "gpt-4o-mini",
  maxTokens = 600,
}: RunVisionChatCompletionParams): Promise<string> {
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: user },
          ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
        ],
      },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("The AI didn't return any content. Please try again.");
  return text;
}

export interface GenerateImageParams {
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
}

/** Real text-to-image generation via the same OpenAI client/API key —
 * gpt-image-1 returns base64 (b64_json), which is exactly the data-URL
 * shape this codebase already persists images as everywhere else, so no
 * separate file-storage integration is needed. */
export async function generateImage({ prompt, size = "1024x1024" }: GenerateImageParams): Promise<string> {
  const client = getOpenAIClient();
  const result = await client.images.generate({ model: "gpt-image-1", prompt, size, n: 1 });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("The AI didn't return an image. Please try again.");
  return `data:image/png;base64,${b64}`;
}

export { OpenAI };
