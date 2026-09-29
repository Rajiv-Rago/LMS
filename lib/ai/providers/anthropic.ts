import { ChatAnthropic } from "@langchain/anthropic";
import type { AICompletionOptions } from "../types";
import { LangChainProvider } from "./langchain";

export class AnthropicProvider extends LangChainProvider {
  name = "anthropic" as const;

  constructor(apiKey: string, model = "claude-3-haiku-20240307") {
    super(apiKey, model);
  }

  protected createModel(options?: AICompletionOptions): ChatAnthropic {
    return new ChatAnthropic({
      anthropicApiKey: this.apiKey,
      model: this.model,
      maxTokens: options?.maxTokens || 2048,
      // Preserve the previous Anthropic default when temperature is unspecified.
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
    });
  }
}
