import {
  AIProvider,
  AIProviderName,
  AIMessage,
  AICompletionOptions,
  AICompletionResponse,
} from "@/lib/ai/types";

interface MockCallRecord {
  method: "chat" | "generateText";
  messages?: AIMessage[];
  prompt?: string;
  options?: AICompletionOptions;
}

/**
 * Creates a mock AI provider for testing.
 * Returns predictable responses and tracks all calls.
 */
export function createMockAIProvider(
  overrides: Partial<{
    name: AIProviderName;
    chatResponse: string;
    generateTextResponse: string;
    shouldError: boolean;
    errorMessage: string;
  }> = {}
): AIProvider & { calls: MockCallRecord[]; reset: () => void } {
  const config = {
    name: (overrides.name || "openai") as AIProviderName,
    chatResponse: overrides.chatResponse || '{"result": "mock response"}',
    generateTextResponse:
      overrides.generateTextResponse || '{"result": "mock generated text"}',
    shouldError: overrides.shouldError || false,
    errorMessage: overrides.errorMessage || "Mock AI error",
  };

  const calls: MockCallRecord[] = [];

  return {
    name: config.name,
    calls,

    async chat(
      messages: AIMessage[],
      options?: AICompletionOptions
    ): Promise<AICompletionResponse> {
      calls.push({ method: "chat", messages, options });

      if (config.shouldError) {
        throw new Error(config.errorMessage);
      }

      return {
        content: config.chatResponse,
        finishReason: "stop",
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };
    },

    async generateText(
      prompt: string,
      options?: AICompletionOptions
    ): Promise<AICompletionResponse> {
      calls.push({ method: "generateText", prompt, options });

      if (config.shouldError) {
        throw new Error(config.errorMessage);
      }

      return {
        content: config.generateTextResponse,
        finishReason: "stop",
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };
    },

    reset() {
      calls.length = 0;
    },
  };
}
