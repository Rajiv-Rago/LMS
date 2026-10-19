import { captureException } from "./logger";
import { AIProviderError, classifyProviderError } from "./ai/errors";

jest.mock("./axiom", () => ({ getAxiomLogger: () => null, flushAxiom: jest.fn() }));

function wrap(cause: Error) {
  return new AIProviderError({
    provider: "openrouter", model: "openrouter/free", operation: "chat",
    originalError: cause, ...classifyProviderError(cause, "openrouter"),
  });
}

it("includes the SDK cause in server logs without echoing malformed model content", () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    captureException(wrap(new SyntaxError('Unexpected token in "Private learner text"')), { jobId: "job-123" });
    const output = log.mock.calls[0][0] as string;
    expect(output).toContain("providerErrorName");
    expect(output).toContain("SyntaxError");
    expect(output).toContain("Provider returned invalid structured JSON.");
    expect(output).toContain("AI_GENERATION_PARSE_FAILED");
    expect(output).toContain("job-123");
    expect(output).not.toContain("Private learner text");
  } finally { log.mockRestore(); }
});

it("redacts configured credentials, bearer values and URLs from provider causes", () => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  const previous = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = "test-sensitive-value";
  try {
    captureException(wrap(new Error("Request rejected test-sensitive-value Bearer another-value https://example.test/?token=hidden")));
    const output = log.mock.calls[0][0] as string;
    expect(output).toContain("Request rejected");
    for (const value of ["test-sensitive-value", "another-value", "token=hidden"])
      expect(output).not.toContain(value);
  } finally {
    if (previous === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previous;
    log.mockRestore();
  }
});
