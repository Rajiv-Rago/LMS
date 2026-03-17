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
} from "../types";

const DEFAULT_MODEL = "gemini-2.5-flash";

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
    if (options?.googleSearch) {
      try {
        return await this.doChat(messages, options, true);
      } catch {
        // Google Search grounding may not be available (free tier, model incompatibility).
        // Fall back to generation without it.
        return await this.doChat(messages, options, false);
      }
    }
    return this.doChat(messages, options, false);
  }

  private async doChat(
    messages: AIMessage[],
    options: AICompletionOptions | undefined,
    useSearch: boolean
  ): Promise<AICompletionResponse> {
    const tools = useSearch
      ? [{ googleSearchRetrieval: {} }]
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

  async generateText(
    prompt: string,
    options?: AICompletionOptions
  ): Promise<AICompletionResponse> {
    return this.chat([{ role: "user", content: prompt }], options);
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
