import { GeminiProvider } from "./gemini";

const mockInvoke = jest.fn();
const mockStream = jest.fn();
const mockBindTools = jest.fn();
const mockConstructor = jest.fn();

jest.mock("@langchain/google", () => ({
  ChatGoogle: class {
    invoke = mockInvoke;
    stream = mockStream;
    bindTools = mockBindTools;
    constructor(options: unknown) { mockConstructor(options); }
  },
}));

describe("GeminiProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvoke.mockResolvedValue({
      text: "Generated text",
      usage_metadata: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      additional_kwargs: {},
      response_metadata: { finish_reason: "STOP" },
    });
    mockBindTools.mockReturnValue({ invoke: mockInvoke, stream: mockStream });
  });

  it("uses Gemini 3.1 Flash Lite by default", async () => {
    const result = await new GeminiProvider("test-key").generateText("Generate a lesson");
    expect(mockConstructor).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-3.1-flash-lite", apiKey: "test-key" }));
    expect(result).toMatchObject({ content: "Generated text", usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 } });
  });

  it("uses an explicit model and preserves Google Search sources", async () => {
    mockInvoke.mockResolvedValueOnce({
      text: "Grounded text",
      usage_metadata: undefined,
      additional_kwargs: { groundingMetadata: { groundingChunks: [{ web: { uri: "https://example.com", title: "Example" } }] } },
      response_metadata: {},
    });
    const provider = new GeminiProvider("test-key", "gemini-custom");
    const result = await provider.chat([{ role: "user", content: "Research" }], { googleSearch: true });
    expect(mockConstructor).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-custom" }));
    expect(mockBindTools).toHaveBeenCalledWith([{ googleSearch: {} }]);
    expect(result.sources).toEqual([{ title: "Example", url: "https://example.com" }]);
  });

  it("streams text and returns grounding sources from the final chunk", async () => {
    async function* chunks() {
      yield { text: "Hello ", usage_metadata: undefined, additional_kwargs: {}, response_metadata: {} };
      yield {
        text: "world", usage_metadata: { input_tokens: 4, output_tokens: 2, total_tokens: 6 },
        additional_kwargs: {},
        response_metadata: { groundingMetadata: { groundingChunks: [{ web: { uri: "https://example.com", title: "Example" } }] } },
      };
    }
    mockStream.mockResolvedValue(chunks());
    const result = await new GeminiProvider("test-key").chatStream([{ role: "user", content: "Research" }], { googleSearch: true });
    const text: string[] = [];
    for await (const chunk of result.stream) text.push(chunk);
    expect(text.join("")).toBe("Hello world");
    expect(await result.response).toEqual({
      sources: [{ title: "Example", url: "https://example.com" }],
      usage: { promptTokens: 4, completionTokens: 2, totalTokens: 6 },
    });
  });

  it("retries an unsuccessful grounded stream before emitting text", async () => {
    async function* failed() { throw new Error("Search unavailable"); yield ""; }
    async function* successful() { yield { text: "Fallback", usage_metadata: undefined, additional_kwargs: {}, response_metadata: {} }; }
    mockStream.mockResolvedValueOnce(failed()).mockResolvedValueOnce(successful());
    const result = await new GeminiProvider("test-key").chatStream([{ role: "user", content: "Research" }], { googleSearch: true });
    const text: string[] = [];
    for await (const chunk of result.stream) text.push(chunk);
    expect(text).toEqual(["Fallback"]);
    expect(mockBindTools).toHaveBeenCalledTimes(1);
    expect((await result.response).sources).toEqual([]);
  });

  it("falls back to ungrounded generation when Google Search fails", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Search unavailable"));
    const result = await new GeminiProvider("test-key").chat([{ role: "user", content: "Research" }], { googleSearch: true });
    expect(mockBindTools).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(result.content).toBe("Generated text");
  });
});
