import { ChatOpenAI } from "@langchain/openai";
import type { AICompletionOptions } from "../types";
import { LangChainProvider } from "./langchain";

export class OpenRouterProvider extends LangChainProvider {
  name = "openrouter" as const;

  constructor(apiKey: string, model = "openrouter/free") {
    super(apiKey, model);
  }

  protected createModel(options?: AICompletionOptions): ChatOpenAI {
    return new ChatOpenAI({
      apiKey: this.apiKey,
      model: this.model,
      maxTokens: options?.maxTokens || 2048,
      temperature: options?.temperature ?? 0.7,
      configuration: { baseURL: "https://openrouter.ai/api/v1" },
    });
  }
}
