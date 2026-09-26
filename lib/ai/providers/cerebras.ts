import { ChatOpenAI } from "@langchain/openai";
import type { AICompletionOptions } from "../types";
import { LangChainProvider } from "./langchain";

export class CerebrasProvider extends LangChainProvider {
  name = "cerebras" as const;

  constructor(apiKey: string, model = "gpt-oss-120b") {
    super(apiKey, model);
  }

  protected createModel(options?: AICompletionOptions): ChatOpenAI {
    return new ChatOpenAI({
      apiKey: this.apiKey,
      model: this.model,
      maxTokens: options?.maxTokens || 2048,
      temperature: options?.temperature ?? 0.7,
      streamUsage: false,
      configuration: { baseURL: "https://api.cerebras.ai/v1" },
    });
  }
}
