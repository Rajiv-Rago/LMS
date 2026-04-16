import { resolveProvider, getApiKey } from "./providerResolver";

describe("providerResolver", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env to a clean state for each test
    process.env = { ...originalEnv };
    delete process.env.AI_PROVIDER;
    delete process.env.AI_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CEREBRAS_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("resolveProvider", () => {
    it("uses request provider with highest priority", () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";
      process.env.OPENAI_API_KEY = "sk-openai-test";
      process.env.AI_PROVIDER = "openai";

      const result = resolveProvider({
        requestProvider: "anthropic",
        coursePreferences: { defaultProvider: "openai" },
      });

      expect(result).not.toBeNull();
      expect(result!.provider).toBe("anthropic");
      expect(result!.apiKey).toBe("sk-ant-test");
    });

    it("uses request model with highest priority", () => {
      process.env.OPENAI_API_KEY = "sk-openai-test";
      process.env.AI_MODEL = "gpt-4o-mini";

      const result = resolveProvider({
        requestProvider: "openai",
        requestModel: "gpt-4o",
        coursePreferences: { defaultProvider: "openai", defaultModel: "gpt-3.5-turbo" },
      });

      expect(result!.model).toBe("gpt-4o");
    });

    it("falls back to course preferences when no request provider", () => {
      process.env.GEMINI_API_KEY = "gem-test";

      const result = resolveProvider({
        coursePreferences: { defaultProvider: "gemini", defaultModel: "gemini-3-flash-preview" },
      });

      expect(result!.provider).toBe("gemini");
      expect(result!.model).toBe("gemini-3-flash-preview");
    });

    it("falls back to env AI_PROVIDER when no request or course prefs", () => {
      process.env.AI_PROVIDER = "cerebras";
      process.env.CEREBRAS_API_KEY = "csk-test";

      const result = resolveProvider({});

      expect(result!.provider).toBe("cerebras");
    });

    it("falls back to env AI_MODEL when no request or course model", () => {
      process.env.OPENAI_API_KEY = "sk-test";
      process.env.AI_MODEL = "gpt-4o-mini";

      const result = resolveProvider({});

      expect(result!.model).toBe("gpt-4o-mini");
    });

    it("defaults to openai when nothing is configured", () => {
      process.env.OPENAI_API_KEY = "sk-test";

      const result = resolveProvider({});

      expect(result!.provider).toBe("openai");
    });

    it("returns null when the resolved provider has no API key", () => {
      // No API keys set, defaults to openai which has no key
      const result = resolveProvider({});

      expect(result).toBeNull();
    });

    it("falls through to env vars when request tier has no configured provider", () => {
      // Only gemini key set — balanced tier tries openai/anthropic/gemini
      process.env.GEMINI_API_KEY = "gem-test";
      process.env.AI_PROVIDER = "gemini";

      const result = resolveProvider({
        requestTier: "balanced",
      });

      expect(result).not.toBeNull();
      expect(result!.provider).toBe("gemini");
      expect(result!.apiKey).toBe("gem-test");
    });

    it("returns null when request provider has no API key", () => {
      process.env.OPENAI_API_KEY = "sk-test";

      const result = resolveProvider({
        requestProvider: "anthropic", // no ANTHROPIC_API_KEY set
      });

      expect(result).toBeNull();
    });

    it("returns model as undefined when no model is specified anywhere", () => {
      process.env.OPENAI_API_KEY = "sk-test";

      const result = resolveProvider({});

      expect(result!.model).toBeUndefined();
    });
  });

  describe("getApiKey", () => {
    it("returns the API key for openai", () => {
      process.env.OPENAI_API_KEY = "sk-openai-123";
      expect(getApiKey("openai")).toBe("sk-openai-123");
    });

    it("returns the API key for anthropic", () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-456";
      expect(getApiKey("anthropic")).toBe("sk-ant-456");
    });

    it("returns the API key for cerebras", () => {
      process.env.CEREBRAS_API_KEY = "csk-abc";
      expect(getApiKey("cerebras")).toBe("csk-abc");
    });

    it("returns the API key for gemini", () => {
      process.env.GEMINI_API_KEY = "gem-def";
      expect(getApiKey("gemini")).toBe("gem-def");
    });

    it("returns null when the key is not set", () => {
      expect(getApiKey("openai")).toBeNull();
    });

    it("returns null when the key is an empty string", () => {
      process.env.OPENAI_API_KEY = "";
      expect(getApiKey("openai")).toBeNull();
    });
  });
});
