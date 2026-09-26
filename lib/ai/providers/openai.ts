import { ChatOpenAI } from "@langchain/openai";
import type { AICompletionOptions } from "../types";
import { LangChainProvider } from "./langchain";

export class OpenAIProvider extends LangChainProvider {
  name = "openai" as const;

  constructor(apiKey: string, model = "gpt-4o-mini") {
    super(apiKey, model);
  }

  protected createModel(options?: AICompletionOptions): ChatOpenAI {
    return new ChatOpenAI({
      apiKey: this.apiKey,
      model: this.model,
      maxTokens: options?.maxTokens || 2048,
      temperature: options?.temperature ?? 0.7,
    });
  }
}
