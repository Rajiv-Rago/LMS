export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AICompletionOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface AICompletionResponse {
  content: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type AIProviderName = "openai" | "anthropic" | "groq" | "cerebras" | "gemini";

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
