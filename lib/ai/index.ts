import { AIProvider, AIProviderConfig } from "./types";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicProvider } from "./providers/anthropic";

export type { AIProvider, AIMessage, AICompletionOptions, AICompletionResponse, AIProviderConfig } from "./types";
export { OpenAIProvider } from "./providers/openai";
export { AnthropicProvider } from "./providers/anthropic";

export function createAIProvider(config: AIProviderConfig): AIProvider {
  switch (config.provider) {
    case "openai":
      return new OpenAIProvider(config.apiKey, config.model);
    case "anthropic":
      return new AnthropicProvider(config.apiKey, config.model);
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}

export function getDefaultProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || "openai") as
    | "openai"
    | "anthropic";

  let apiKey: string;
  if (provider === "openai") {
    apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
  } else {
    apiKey = process.env.ANTHROPIC_API_KEY || "";
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    }
  }

  return createAIProvider({
    provider,
    apiKey,
    model: process.env.AI_MODEL,
  });
}

export function getProviderName(): "openai" | "anthropic" {
  return (process.env.AI_PROVIDER || "openai") as "openai" | "anthropic";
}
