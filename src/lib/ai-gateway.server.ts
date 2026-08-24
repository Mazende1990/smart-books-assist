import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Single place where the LLM API is configured.
 * The key never leaves the server: it is read from process.env inside handlers.
 */
export const AGENT_MODEL = "gemini-3.7-flash";

export function createGoogleAiProvider(apiKey: string) {
  return createGoogleGenerativeAI({ apiKey });
}

export function getGoogleAiApiKey(): string {
  const key = process.env["GOOGLE_GENERATIVE_AI_API_KEY"];
  if (!key) throw new Error("AI is not configured: missing GOOGLE_GENERATIVE_AI_API_KEY.");
  return key;
}
