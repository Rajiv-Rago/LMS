import Anthropic from "@anthropic-ai/sdk";
import {
  AIProvider,
  AIMessage,
  AICompletionOptions,
  AICompletionResponse,
} from "../types";

const DEFAULT_MODEL = "claude-3-haiku-20240307";

export class AnthropicProvider implements AIProvider {
  name: "anthropic" = "anthropic";
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model || DEFAULT_MODEL;
  }

  async chat(
    messages: AIMessage[],
    options?: AICompletionOptions
  ): Promise<AICompletionResponse> {
    const systemPrompt = options?.systemPrompt;

    const anthropicMessages: Anthropic.MessageParam[] = messages
      .filter((msg) => msg.role !== "system")
      .map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options?.maxTokens || 2048,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    const textContent = response.content.find((block) => block.type === "text");

    return {
      content: textContent?.type === "text" ? textContent.text : "",
      finishReason: response.stop_reason || undefined,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async generateText(
    prompt: string,
    options?: AICompletionOptions
  ): Promise<AICompletionResponse> {
    return this.chat([{ role: "user", content: prompt }], options);
  }
}
