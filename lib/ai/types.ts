export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AICompletionOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  googleSearch?: boolean;
}

export interface AISource {
  title: string;
  url: string;
}

export interface AICompletionResponse {
  content: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  sources?: AISource[];
}

export type AIProviderName = "openai" | "anthropic" | "cerebras" | "gemini";

export interface AIProvider {
  name: AIProviderName;
  chat(
    messages: AIMessage[],
    options?: AICompletionOptions
  ): Promise<AICompletionResponse>;
  generateText(
    prompt: string,
    options?: AICompletionOptions
  ): Promise<AICompletionResponse>;
}

export interface AIProviderConfig {
  provider: AIProviderName;
  apiKey: string;
  model?: string;
}

export type AITier = "concise" | "balanced" | "thorough";

export interface UserAIPreferences {
  defaultTier?: AITier;
  defaultProvider?: AIProviderName;
  defaultModel?: string;
}
