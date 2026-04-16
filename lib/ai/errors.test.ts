import { AIProviderError, classifyProviderError } from "./errors";
import { ErrorCodes } from "@/lib/telemetry/errorCodes";

describe("AIProviderError", () => {
  it("extends Error with provider context", () => {
    const err = new AIProviderError({
      provider: "openai",
      model: "gpt-4o-mini",
      operation: "chat",
      errorCode: ErrorCodes.AI_PROVIDER_RATE_LIMITED,
      isTransient: true,
      statusCode: 429,
      originalError: new Error("rate limited"),
    });

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AIProviderError");
    expect(err.provider).toBe("openai");
    expect(err.model).toBe("gpt-4o-mini");
    expect(err.operation).toBe("chat");
    expect(err.errorCode).toBe("AI_PROVIDER_RATE_LIMITED");
    expect(err.isTransient).toBe(true);
    expect(err.statusCode).toBe(429);
  });

  it("generates a default message from context", () => {
    const err = new AIProviderError({
      provider: "gemini",
      model: "gemini-2.5-flash",
      operation: "chatStream",
      errorCode: ErrorCodes.AI_PROVIDER_TIMEOUT,
      isTransient: true,
      originalError: new Error("timeout"),
    });

    expect(err.message).toContain("gemini");
    expect(err.message).toContain("chatStream");
    expect(err.message).toContain("AI_PROVIDER_TIMEOUT");
  });

  it("uses custom message when provided", () => {
    const err = new AIProviderError({
      provider: "openai",
      model: "gpt-4o-mini",
      operation: "chat",
      errorCode: ErrorCodes.AI_UNKNOWN,
      isTransient: false,
      originalError: new Error("something"),
      message: "Custom error message",
    });

    expect(err.message).toBe("Custom error message");
  });
});

describe("classifyProviderError", () => {
  it("classifies 401 as auth failed (not transient)", () => {
    const result = classifyProviderError({ status: 401 }, "openai");
    expect(result.errorCode).toBe(ErrorCodes.AI_PROVIDER_AUTH_FAILED);
    expect(result.isTransient).toBe(false);
    expect(result.statusCode).toBe(401);
  });

  it("classifies 403 as auth failed (not transient)", () => {
    const result = classifyProviderError({ status: 403 }, "anthropic");
    expect(result.errorCode).toBe(ErrorCodes.AI_PROVIDER_AUTH_FAILED);
    expect(result.isTransient).toBe(false);
  });

  it("classifies 429 as rate limited (transient)", () => {
    const result = classifyProviderError({ status: 429 }, "openai");
    expect(result.errorCode).toBe(ErrorCodes.AI_PROVIDER_RATE_LIMITED);
    expect(result.isTransient).toBe(true);
    expect(result.statusCode).toBe(429);
  });

  it("classifies 500+ as server error (transient)", () => {
    const result = classifyProviderError({ status: 502 }, "anthropic");
    expect(result.errorCode).toBe(ErrorCodes.AI_PROVIDER_SERVER_ERROR);
    expect(result.isTransient).toBe(true);
    expect(result.statusCode).toBe(502);
  });

  it("classifies ETIMEDOUT as timeout (transient)", () => {
    const result = classifyProviderError({ code: "ETIMEDOUT" }, "openai");
    expect(result.errorCode).toBe(ErrorCodes.AI_PROVIDER_TIMEOUT);
    expect(result.isTransient).toBe(true);
  });

  it("classifies timeout message as timeout (transient)", () => {
    const result = classifyProviderError(
      { message: "Request timeout after 30000ms" },
      "gemini"
    );
    expect(result.errorCode).toBe(ErrorCodes.AI_PROVIDER_TIMEOUT);
    expect(result.isTransient).toBe(true);
  });

  it("classifies ECONNREFUSED as server error (transient)", () => {
    const result = classifyProviderError({ code: "ECONNREFUSED" }, "cerebras");
    expect(result.errorCode).toBe(ErrorCodes.AI_PROVIDER_SERVER_ERROR);
    expect(result.isTransient).toBe(true);
  });

  it("classifies ECONNRESET as server error (transient)", () => {
    const result = classifyProviderError({ code: "ECONNRESET" }, "openai");
    expect(result.errorCode).toBe(ErrorCodes.AI_PROVIDER_SERVER_ERROR);
    expect(result.isTransient).toBe(true);
  });

  it("classifies Gemini quota exceeded as rate limited", () => {
    const result = classifyProviderError(
      { message: "Quota exceeded for project" },
      "gemini"
    );
    expect(result.errorCode).toBe(ErrorCodes.AI_PROVIDER_RATE_LIMITED);
    expect(result.isTransient).toBe(true);
  });

  it("classifies Gemini resource exhausted as rate limited", () => {
    const result = classifyProviderError(
      { message: "RESOURCE_EXHAUSTED: limit reached" },
      "gemini"
    );
    expect(result.errorCode).toBe(ErrorCodes.AI_PROVIDER_RATE_LIMITED);
    expect(result.isTransient).toBe(true);
  });

  it("does not apply Gemini quota heuristic to other providers", () => {
    const result = classifyProviderError(
      { message: "Quota exceeded for project" },
      "openai"
    );
    expect(result.errorCode).toBe(ErrorCodes.AI_UNKNOWN);
  });

  it("extracts status from Gemini bracket format", () => {
    const result = classifyProviderError(
      { message: "Error [429] rate limit" },
      "gemini"
    );
    expect(result.errorCode).toBe(ErrorCodes.AI_PROVIDER_RATE_LIMITED);
    expect(result.statusCode).toBe(429);
  });

  it("reads statusCode property as fallback", () => {
    const result = classifyProviderError({ statusCode: 401 }, "openai");
    expect(result.errorCode).toBe(ErrorCodes.AI_PROVIDER_AUTH_FAILED);
  });

  it("returns AI_UNKNOWN for unrecognized errors", () => {
    const result = classifyProviderError(
      { message: "something unexpected" },
      "openai"
    );
    expect(result.errorCode).toBe(ErrorCodes.AI_UNKNOWN);
    expect(result.isTransient).toBe(false);
  });

  it("handles null/undefined error gracefully", () => {
    expect(classifyProviderError(null, "openai").errorCode).toBe(ErrorCodes.AI_UNKNOWN);
    expect(classifyProviderError(undefined, "openai").errorCode).toBe(ErrorCodes.AI_UNKNOWN);
  });

  it("handles string error gracefully", () => {
    const result = classifyProviderError("raw string error", "openai");
    expect(result.errorCode).toBe(ErrorCodes.AI_UNKNOWN);
  });
});
