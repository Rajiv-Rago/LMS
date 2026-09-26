import { AIMessage as LangChainAIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { AIProvider, AIMessage, AICompletionOptions, AICompletionResponse, AISource, AIStreamResult, AIProviderName } from "../types";
import { AIProviderError, classifyProviderError } from "../errors";
import { researchWithTools } from "../tools/webResearch";

/** Keep the app's provider contract while routing inference through LangChain. */
export abstract class LangChainProvider implements AIProvider {
  abstract name: AIProviderName;
  protected constructor(protected apiKey: string, protected model: string) {}

  protected abstract createModel(options?: AICompletionOptions): BaseChatModel;

  protected messages(messages: AIMessage[], options?: AICompletionOptions): BaseMessage[] {
    return [
      ...(options?.systemPrompt ? [new SystemMessage(options.systemPrompt)] : []),
      ...messages.map((message) => {
        switch (message.role) {
          case "system": return new SystemMessage(message.content);
          case "assistant": return new LangChainAIMessage(message.content);
          case "user": return new HumanMessage(message.content);
        }
      }),
    ];
  }

  protected sources(metadata: Record<string, unknown>): AISource[] {
    const grounding = (metadata.groundingMetadata ?? metadata.grounding_metadata) as
      | { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> }
      | undefined;
    const seen = new Set<string>();
    return (grounding?.groundingChunks ?? []).flatMap(({ web }) => {
      if (!web?.uri || seen.has(web.uri)) return [];
      seen.add(web.uri);
      return [{ url: web.uri, title: web.title || web.uri }];
    });
  }

  protected async invoke(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResponse> {
    const model = this.createModel(options);
    const research = options?.webResearch
      ? await researchWithTools(model, this.messages(messages, options))
      : undefined;
    const response = await model.invoke(research?.messages ?? this.messages(messages, options));
    const usage = response.usage_metadata;
    const sources = research?.sources ?? this.sources({ ...response.additional_kwargs, ...response.response_metadata });
    return {
      content: response.text,
      finishReason: String(response.response_metadata.finish_reason ?? response.response_metadata.finishReason ?? "") || undefined,
      usage: usage || research ? {
        promptTokens: (usage?.input_tokens ?? 0) + (research?.usage.promptTokens ?? 0),
        completionTokens: (usage?.output_tokens ?? 0) + (research?.usage.completionTokens ?? 0),
        totalTokens: (usage?.total_tokens ?? 0) + (research?.usage.totalTokens ?? 0),
      } : undefined,
      sources: sources.length ? sources : undefined,
    };
  }

  async chat(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResponse> {
    try {
      return await this.invoke(messages, options);
    } catch (error) {
      throw this.wrapError(error, "chat");
    }
  }

  async generateText(prompt: string, options?: AICompletionOptions): Promise<AICompletionResponse> {
    return this.chat([{ role: "user", content: prompt }], options);
  }

  async chatStream(messages: AIMessage[], options?: AICompletionOptions): Promise<AIStreamResult> {
    try {
      const model = this.createModel(options);
      const research = options?.webResearch
        ? await researchWithTools(model, this.messages(messages, options))
        : undefined;
      const chunks = await model.stream(research?.messages ?? this.messages(messages, options));
      let resolveResponse!: (result: Awaited<AIStreamResult["response"]>) => void;
      let rejectResponse!: (error: unknown) => void;
      const response = new Promise<Awaited<AIStreamResult["response"]>>((resolve, reject) => {
        resolveResponse = resolve;
        rejectResponse = reject;
      });
      // A consumer may stop on a stream error without awaiting the response promise.
      void response.catch(() => {});
      const extractSources = (metadata: Record<string, unknown>) => this.sources(metadata);
      const wrapStreamError = (error: unknown) => this.wrapError(error, "chatStream");
      async function* stream(): AsyncGenerator<string> {
        let promptTokens = research?.usage.promptTokens ?? 0;
        let completionTokens = research?.usage.completionTokens ?? 0;
        let totalTokens = research?.usage.totalTokens ?? 0;
        let hasUsage = Boolean(research);
        let sources: AISource[] = research?.sources ?? [];
        try {
          for await (const chunk of chunks) {
            if (chunk.usage_metadata) {
              // Streamed usage may be cumulative; the final reported value wins.
              promptTokens = (research?.usage.promptTokens ?? 0) + (chunk.usage_metadata.input_tokens ?? 0);
              completionTokens = (research?.usage.completionTokens ?? 0) + (chunk.usage_metadata.output_tokens ?? 0);
              totalTokens = (research?.usage.totalTokens ?? 0) + (chunk.usage_metadata.total_tokens ?? 0);
              hasUsage = true;
            }
            const found = research ? [] : extractSources({ ...chunk.additional_kwargs, ...chunk.response_metadata });
            if (found.length) sources = [...new Map([...sources, ...found].map(source => [source.url, source])).values()];
            if (chunk.text) yield chunk.text;
          }
          resolveResponse({ sources, usage: hasUsage ? { promptTokens, completionTokens, totalTokens } : undefined });
        } catch (error) {
          const wrapped = wrapStreamError(error);
          rejectResponse(wrapped);
          throw wrapped;
        }
      }
      return { stream: stream(), response };
    } catch (error) {
      throw this.wrapError(error, "chatStream");
    }
  }

  protected wrapError(error: unknown, operation: "chat" | "chatStream"): AIProviderError {
    if (error instanceof AIProviderError) return error;
    return new AIProviderError({
      provider: this.name,
      model: this.model,
      operation,
      originalError: error,
      ...classifyProviderError(error, this.name),
    });
  }
}
