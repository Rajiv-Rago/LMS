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

export interface AIProvider {
  name: "openai" | "anthropic";
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
  provider: "openai" | "anthropic";
  apiKey: string;
  model?: string;
}
