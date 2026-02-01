import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  AIProvider,
  AIMessage,
  AICompletionOptions,
  AICompletionResponse,
} from "../types";

const DEFAULT_MODEL = "gemini-1.5-flash";

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
    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: options?.systemPrompt,
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
    };
  }

  async generateText(
    prompt: string,
    options?: AICompletionOptions
  ): Promise<AICompletionResponse> {
    return this.chat([{ role: "user", content: prompt }], options);
  }
}
