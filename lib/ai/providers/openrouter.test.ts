import { createAIProvider } from "../index";
import { getConfiguredProviders } from "../utils/tierCatalog";
import { MODEL_REGISTRY } from "../utils/modelRegistry";
import { aiProviderSchema } from "@/lib/validation/aiSchemas";

const mockInvoke = jest.fn();
const mockStream = jest.fn();
const mockConstructor = jest.fn();

jest.mock("@langchain/openai", () => ({
  ChatOpenAI: class {
    invoke = mockInvoke;
    stream = mockStream;
    constructor(options: unknown) { mockConstructor(options); }
  },
}));
jest.mock("@langchain/google", () => ({ ChatGoogle: jest.fn() }));
jest.mock("@langchain/anthropic", () => ({ ChatAnthropic: jest.fn() }));

describe("OpenRouter integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockResolvedValue({
      text: "Generated lesson",
      usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      additional_kwargs: {},
      response_metadata: {},
    });
  });

  it("creates a provider using the free router through the OpenRouter endpoint", async () => {
    const provider = createAIProvider({ provider: "openrouter", apiKey: "test-key" });
    const result = await provider.generateText("Write a lesson");
    expect(provider.name).toBe("openrouter");
    expect(mockConstructor).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: "test-key",
      model: "openrouter/free",
      configuration: { baseURL: "https://openrouter.ai/api/v1" },
    }));
    expect(result).toMatchObject({ content: "Generated lesson", usage: { totalTokens: 15 } });
  });

  it("preserves an explicit OpenRouter model and generation options", async () => {
    await createAIProvider({ provider: "openrouter", apiKey: "test-key", model: "vendor/test:free" })
      .generateText("Write a lesson", { maxTokens: 100, temperature: 0 });
    expect(mockConstructor).toHaveBeenCalledWith(expect.objectContaining({
      model: "vendor/test:free", maxTokens: 100, temperature: 0,
    }));
  });

  it("streams text and preserves token usage", async () => {
    mockStream.mockResolvedValue((async function* () {
      yield { text: "Hello", usage_metadata: undefined, additional_kwargs: {}, response_metadata: {} };
      yield { text: " world", usage_metadata: { input_tokens: 4, output_tokens: 2, total_tokens: 6 }, additional_kwargs: {}, response_metadata: {} };
    })());
    const provider = createAIProvider({ provider: "openrouter", apiKey: "test-key" });
    const result = await provider.chatStream!([{ role: "user", content: "Hello" }]);
    const chunks: string[] = [];
    for await (const chunk of result.stream) chunks.push(chunk);
    expect(chunks.join("")).toBe("Hello world");
    expect(await result.response).toMatchObject({ usage: { totalTokens: 6 } });
  });

  it("uses the provider default for a blank model", async () => {
    await createAIProvider({ provider: "openrouter", apiKey: "test-key", model: "  " }).generateText("Hello");
    expect(mockConstructor).toHaveBeenCalledWith(expect.objectContaining({ model: "openrouter/free" }));
  });

  it("exposes OpenRouter when configured and keeps the free router opt-in", () => {
    const originalKey = process.env.OPENROUTER_API_KEY;
    try {
      delete process.env.OPENROUTER_API_KEY;
      expect(getConfiguredProviders()).not.toContain("openrouter");
      process.env.OPENROUTER_API_KEY = "test-key";
      expect(getConfiguredProviders()).toContain("openrouter");
      expect(aiProviderSchema.parse("openrouter")).toBe("openrouter");
      expect(MODEL_REGISTRY.find((model) => model.id === "openrouter/free"))
        .toMatchObject({ provider: "openrouter", tiers: [] });
    } finally {
      if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = originalKey;
    }
  });
});
