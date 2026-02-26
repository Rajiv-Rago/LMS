import OpenAI from "openai";
import {
  AIProvider,
  AIMessage,
  AICompletionOptions,
  AICompletionResponse,
} from "../types";

const DEFAULT_MODEL = "gpt-4o-mini";

export class OpenAIProvider implements AIProvider {
  name = "openai" as const;
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model || DEFAULT_MODEL;
  }

  async chat(
    messages: AIMessage[],
    options?: AICompletionOptions
  ): Promise<AICompletionResponse> {
    const systemMessages: OpenAI.Chat.ChatCompletionMessageParam[] =
      options?.systemPrompt
        ? [{ role: "system", content: options.systemPrompt }]
        : [];

    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map(
      (msg) => ({
        role: msg.role,
        content: msg.content,
      })
    );

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [...systemMessages, ...chatMessages],
      max_tokens: options?.maxTokens || 2048,
      temperature: options?.temperature ?? 0.7,
    });

    const choice = response.choices[0];

    return {
      content: choice.message.content || "",
      finishReason: choice.finish_reason || undefined,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
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
