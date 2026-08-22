import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Single place where the LLM API is configured.
 * The key never leaves the server: it is read from process.env inside handlers.
 */
export const AGENT_MODEL = "google/gemini-3.7-flash";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}

export function getGatewayApiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured: missing LOVABLE_API_KEY.");
  return key;
}
