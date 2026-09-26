import { ChatGoogle } from "@langchain/google";
import type { AICompletionOptions, AICompletionResponse, AIMessage, AIStreamResult } from "../types";
import { LangChainProvider } from "./langchain";

export class GeminiProvider extends LangChainProvider {
  name = "gemini" as const;

  constructor(apiKey: string, model = "gemini-3.1-flash-lite") {
    super(apiKey, model);
  }

  protected createModel(options?: AICompletionOptions): ChatGoogle {
    const model = new ChatGoogle({
      apiKey: this.apiKey,
      model: this.model,
      maxOutputTokens: options?.maxTokens || 2048,
      temperature: options?.temperature ?? 0.7,
    });
    // The Google built-in tool is passed through LangChain without changing the app contract.
    return options?.googleSearch ? model.bindTools([{ googleSearch: {} }]) as ChatGoogle : model;
  }

  async chat(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResponse> {
    if (!options?.googleSearch) return super.chat(messages, options);
    try {
      return await this.invoke(messages, options);
    } catch {
      return super.chat(messages, { ...options, googleSearch: false });
    }
  }

  async chatStream(messages: AIMessage[], options?: AICompletionOptions): Promise<AIStreamResult> {
    if (!options?.googleSearch) return super.chatStream(messages, options);
    let active: AIStreamResult;
    try {
      active = await super.chatStream(messages, options);
    } catch {
      return super.chatStream(messages, { ...options, googleSearch: false });
    }

    let resolveResponse!: (value: Awaited<AIStreamResult["response"]>) => void;
    let rejectResponse!: (reason: unknown) => void;
    const response = new Promise<Awaited<AIStreamResult["response"]>>((resolve, reject) => {
      resolveResponse = resolve;
      rejectResponse = reject;
    });
    void response.catch(() => {});
    const fallback = () => super.chatStream(messages, { ...options, googleSearch: false });
    async function* stream(): AsyncGenerator<string> {
      let emitted = false;
      try {
        try {
          for await (const chunk of active.stream) {
            emitted = true;
            yield chunk;
          }
        } catch (error) {
          // Retry only before emitting text, so a partial answer is never duplicated.
          if (emitted) throw error;
          active = await fallback();
          for await (const chunk of active.stream) yield chunk;
        }
        resolveResponse(await active.response);
      } catch (error) {
        rejectResponse(error);
        throw error;
      }
    }
    return { stream: stream(), response };
  }
}
