import { AIProviderName } from "./types";
import { ErrorCode, ErrorCodes } from "@/lib/telemetry/errorCodes";

export class AIProviderError extends Error {
  provider: AIProviderName;
  model: string;
  operation: "chat" | "generateText" | "chatStream";
  errorCode: ErrorCode;
  isTransient: boolean;
  statusCode?: number;
  originalError: unknown;

  constructor(opts: {
    provider: AIProviderName;
    model: string;
    operation: "chat" | "generateText" | "chatStream";
    errorCode: ErrorCode;
    isTransient: boolean;
    statusCode?: number;
    originalError: unknown;
    message?: string;
  }) {
    const msg =
      opts.message ||
      `${opts.provider}/${opts.model} ${opts.operation} failed: ${opts.errorCode}`;
    super(msg);
    this.name = "AIProviderError";
    this.provider = opts.provider;
    this.model = opts.model;
    this.operation = opts.operation;
    this.errorCode = opts.errorCode;
    this.isTransient = opts.isTransient;
    this.statusCode = opts.statusCode;
    this.originalError = opts.originalError;
  }
}

export function classifyProviderError(
  error: unknown,
  provider: AIProviderName
): { errorCode: ErrorCode; isTransient: boolean; statusCode?: number } {
  const status = getStatusCode(error, provider);

  if (status === 401 || status === 403) {
    return {
      errorCode: ErrorCodes.AI_PROVIDER_AUTH_FAILED,
      isTransient: false,
      statusCode: status,
    };
  }

  if (status === 429) {
    return {
      errorCode: ErrorCodes.AI_PROVIDER_RATE_LIMITED,
      isTransient: true,
      statusCode: status,
    };
  }

  if (status && status >= 500) {
    return {
      errorCode: ErrorCodes.AI_PROVIDER_SERVER_ERROR,
      isTransient: true,
      statusCode: status,
    };
  }

  if (isTimeoutError(error)) {
    return {
      errorCode: ErrorCodes.AI_PROVIDER_TIMEOUT,
      isTransient: true,
    };
  }

  if (isNetworkError(error)) {
    return {
      errorCode: ErrorCodes.AI_PROVIDER_SERVER_ERROR,
      isTransient: true,
    };
  }

  if (provider === "gemini" && isGeminiQuotaError(error)) {
    return {
      errorCode: ErrorCodes.AI_PROVIDER_RATE_LIMITED,
      isTransient: true,
    };
  }

  return {
    errorCode: ErrorCodes.AI_UNKNOWN,
    isTransient: false,
    statusCode: status,
  };
}

function getStatusCode(error: unknown, provider: AIProviderName): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const e = error as Record<string, unknown>;

  if (typeof e.status === "number") return e.status;
  if (typeof e.statusCode === "number") return e.statusCode;

  if (provider === "gemini" && e.message && typeof e.message === "string") {
    const match = e.message.match(/\[(\d{3})\]/);
    if (match) return Number(match[1]);
  }

  return undefined;
}

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  if (e.code === "ETIMEDOUT" || e.code === "ESOCKETTIMEDOUT") return true;
  if (typeof e.message === "string" && /timeout/i.test(e.message)) return true;
  return false;
}

function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as Record<string, unknown>).code;
  return code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ENOTFOUND";
}

function isGeminiQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const msg = (error as Record<string, unknown>).message;
  if (typeof msg !== "string") return false;
  return /quota.exceeded/i.test(msg) || /resource.exhausted/i.test(msg);
}
