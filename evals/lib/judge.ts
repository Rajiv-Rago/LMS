import { computeCost } from "./cost";
import type { JudgeCall, UsageRecord } from "./types";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export const JUDGE_MODELS = {
  rubric: "openai/gpt-oss-120b",
  bounded: "llama-3.1-8b-instant",
} as const;

export type JudgeKind = keyof typeof JUDGE_MODELS;

interface JudgeOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormatJson?: boolean;
}

interface JudgeRawResponse {
  content: string;
  usage: UsageRecord | undefined;
  latencyMs: number;
  model: string;
}

function getGroqApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error("GROQ_API_KEY is not set; required for evals judge");
  }
  return key;
}

async function callGroq(
  model: string,
  prompt: string,
  options: JudgeOptions = {}
): Promise<JudgeRawResponse> {
  const messages: Array<{ role: string; content: string }> = [];
  if (options.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.0,
    max_tokens: options.maxTokens ?? 1024,
  };
  if (options.responseFormatJson) {
    body.response_format = { type: "json_object" };
  }

  const start = Date.now();
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getGroqApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq judge call failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  const content = data.choices?.[0]?.message?.content ?? "";
  const usage = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
        totalTokens: data.usage.total_tokens ?? 0,
      }
    : undefined;

  return { content, usage, latencyMs, model };
}

export interface JudgeResult<T> {
  parsed: T;
  raw: string;
  call: JudgeCall;
}

function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fence) return fence[1].trim();
  const match = trimmed.match(/[{[][\s\S]*[}\]]/);
  return match ? match[0] : trimmed;
}

export async function judgeJson<T>(
  kind: JudgeKind,
  prompt: string,
  options: JudgeOptions = {}
): Promise<JudgeResult<T>> {
  const model = JUDGE_MODELS[kind];
  const res = await callGroq(model, prompt, {
    ...options,
    responseFormatJson: true,
  });
  const jsonText = extractJsonBlock(res.content);
  let parsed: T;
  try {
    parsed = JSON.parse(jsonText) as T;
  } catch (err) {
    throw new Error(
      `Judge JSON parse failed for model ${model}: ${(err as Error).message}\nRaw: ${res.content.slice(0, 500)}`
    );
  }
  const cost = computeCost("groq", model, res.usage);
  return {
    parsed,
    raw: res.content,
    call: {
      model: `groq:${model}`,
      usage: res.usage,
      cost,
      latencyMs: res.latencyMs,
    },
  };
}

export async function judgeText(
  kind: JudgeKind,
  prompt: string,
  options: JudgeOptions = {}
): Promise<{ text: string; call: JudgeCall }> {
  const model = JUDGE_MODELS[kind];
  const res = await callGroq(model, prompt, options);
  const cost = computeCost("groq", model, res.usage);
  return {
    text: res.content,
    call: {
      model: `groq:${model}`,
      usage: res.usage,
      cost,
      latencyMs: res.latencyMs,
    },
  };
}
