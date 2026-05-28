import {
  GoogleGenerativeAI,
  type EnhancedGenerateContentResponse,
} from "@google/generative-ai";
import {
  AIProvider,
  AIMessage,
  AICompletionOptions,
  AICompletionResponse,
  AISource,
  AIStreamResult,
} from "../types";
import { AIProviderError, classifyProviderError } from "../errors";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

export class GeminiProvider implements AIProvider {
  name = "gemini" as const;
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model || DEFAULT_MODEL;
  }

  async chat(
    messages: AIMessage[],
    options?: AICompletionOptions
  ): Promise<AICompletionResponse> {
    try {
      if (options?.googleSearch) {
        try {
          return await this.doChat(messages, options, true);
        } catch {
          return await this.doChat(messages, options, false);
        }
      }
      return await this.doChat(messages, options, false);
    } catch (error) {
      throw this.wrapError(error, "chat");
    }
  }

  private async doChat(
    messages: AIMessage[],
    options: AICompletionOptions | undefined,
    useSearch: boolean
  ): Promise<AICompletionResponse> {
    const tools = useSearch
      ? [{ googleSearch: {} } as Record<string, unknown>]
      : undefined;

    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: options?.systemPrompt,
      tools,
    });

    const history = messages.slice(0, -1).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: options?.maxTokens || 2048,
        temperature: options?.temperature ?? 0.7,
      },
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    const response = result.response;

    const usageMetadata = response.usageMetadata;
    const sources = this.extractSources(response);

    return {
      content: response.text(),
      finishReason: response.candidates?.[0]?.finishReason || undefined,
      usage: usageMetadata
        ? {
            promptTokens: usageMetadata.promptTokenCount || 0,
            completionTokens: usageMetadata.candidatesTokenCount || 0,
            totalTokens: usageMetadata.totalTokenCount || 0,
          }
        : undefined,
      sources: sources.length > 0 ? sources : undefined,
    };
  }

  async chatStream(
    messages: AIMessage[],
    options?: AICompletionOptions
  ): Promise<AIStreamResult> {
    try {
      if (options?.googleSearch) {
        try {
          return await this.doChatStream(messages, options, true);
        } catch {
          return await this.doChatStream(messages, options, false);
        }
      }
      return await this.doChatStream(messages, options, false);
    } catch (error) {
      throw this.wrapError(error, "chatStream");
    }
  }

  private async doChatStream(
    messages: AIMessage[],
    options: AICompletionOptions | undefined,
    useSearch: boolean
  ): Promise<AIStreamResult> {
    const tools = useSearch
      ? [{ googleSearch: {} } as Record<string, unknown>]
      : undefined;

    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: options?.systemPrompt,
      tools,
    });

    const history = messages.slice(0, -1).map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: options?.maxTokens || 2048,
        temperature: options?.temperature ?? 0.7,
      },
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessageStream(lastMessage.content);

    async function* streamChunks() {
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield text;
      }
    }

    const response = result.response.then((res) => {
      const usageMetadata = res.usageMetadata;
      return {
        sources: this.extractSources(res),
        usage: usageMetadata
          ? {
              promptTokens: usageMetadata.promptTokenCount || 0,
              completionTokens: usageMetadata.candidatesTokenCount || 0,
              totalTokens: usageMetadata.totalTokenCount || 0,
            }
          : undefined,
      };
    });

    return { stream: streamChunks(), response };
  }

  async generateText(
    prompt: string,
    options?: AICompletionOptions
  ): Promise<AICompletionResponse> {
    return this.chat([{ role: "user", content: prompt }], options);
  }

  private wrapError(error: unknown, operation: "chat" | "generateText" | "chatStream"): AIProviderError {
    if (error instanceof AIProviderError) return error;
    const classified = classifyProviderError(error, "gemini");
    return new AIProviderError({
      provider: "gemini",
      model: this.model,
      operation,
      originalError: error,
      ...classified,
    });
  }

  private extractSources(
    response: EnhancedGenerateContentResponse
  ): AISource[] {
    const chunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (!chunks) return [];

    const seen = new Set<string>();
    const sources: AISource[] = [];

    for (const chunk of chunks) {
      const uri = chunk.web?.uri;
      if (!uri || seen.has(uri)) continue;
      seen.add(uri);
      sources.push({
        title: chunk.web?.title || uri,
        url: uri,
      });
    }

    return sources;
  }
}
