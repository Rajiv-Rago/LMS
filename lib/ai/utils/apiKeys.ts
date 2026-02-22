import { AIProviderName } from "../types";

export const API_KEY_ENV_MAP: Record<AIProviderName, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  gemini: "GEMINI_API_KEY",
};

/**
 * Gets the API key for a given provider from environment variables.
 * Returns null if not configured.
 */
export function getApiKey(provider: AIProviderName): string | null {
  const envVar = API_KEY_ENV_MAP[provider];
  const apiKey = process.env[envVar];
  return apiKey || null;
}
