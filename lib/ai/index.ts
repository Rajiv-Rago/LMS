import { AIProvider, AIProviderConfig, AIProviderName } from "./types";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";
import { GroqProvider } from "./providers/groq";
import { CerebrasProvider } from "./providers/cerebras";
import { GeminiProvider } from "./providers/gemini";

export type { AIProvider, AIMessage, AICompletionOptions, AICompletionResponse, AIProviderConfig, AIProviderName } from "./types";
export { OpenAIProvider } from "./providers/openai";
export { AnthropicProvider } from "./providers/anthropic";
export { GroqProvider } from "./providers/groq";
export { CerebrasProvider } from "./providers/cerebras";
export { GeminiProvider } from "./providers/gemini";

export function createAIProvider(config: AIProviderConfig): AIProvider {
  switch (config.provider) {
    case "openai":
      return new OpenAIProvider(config.apiKey, config.model);
    case "anthropic":
      return new AnthropicProvider(config.apiKey, config.model);
    case "groq":
      return new GroqProvider(config.apiKey, config.model);
    case "cerebras":
      return new CerebrasProvider(config.apiKey, config.model);
    case "gemini":
      return new GeminiProvider(config.apiKey, config.model);
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}

const API_KEY_ENV_MAP: Record<AIProviderName, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  gemini: "GEMINI_API_KEY",
};

export function getDefaultProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || "openai") as AIProviderName;
  const envVar = API_KEY_ENV_MAP[provider];
  const apiKey = process.env[envVar] || "";

  if (!apiKey) {
    throw new Error(`${envVar} environment variable is not set`);
  }

  return createAIProvider({
    provider,
    apiKey,
    model: process.env.AI_MODEL,
  });
}

export function getProviderName(): AIProviderName {
  return (process.env.AI_PROVIDER || "openai") as AIProviderName;
}
