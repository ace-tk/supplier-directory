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

export { OpenAI };
