import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage } from "@langchain/core/messages";
import { LangChainProvider } from "./langchain";
import { readWebPage, searchWeb } from "../services/webResearch";

jest.mock("../services/webResearch", () => ({ searchWeb: jest.fn(), readWebPage: jest.fn() }));

const toolCall = (name: string, args: Record<string, string>, id: string) => ({ name, args, id, type: "tool_call" as const });

class TestProvider extends LangChainProvider {
  name = "openai" as const;
  constructor(private fake: BaseChatModel) { super("test-key", "test-model"); }
  protected createModel(): BaseChatModel { return this.fake; }
}

describe("LangChainProvider research integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(searchWeb).mockResolvedValue([{ url: "https://example.com", title: "Page", description: "Snippet" }]);
    jest.mocked(readWebPage).mockResolvedValue({ url: "https://example.com", title: "Page", text: "Retrieved evidence" });
  });

  function fakeModel() {
    const planning = jest.fn()
      .mockResolvedValueOnce(new AIMessage({ content: "", tool_calls: [toolCall("search_web", { query: "topic" }, "s1")] }))
      .mockResolvedValueOnce(new AIMessage({ content: "", tool_calls: [toolCall("read_web_page", { url: "https://example.com" }, "r1")] }))
      .mockResolvedValueOnce(new AIMessage("Done"));
    const final = jest.fn().mockResolvedValue(new AIMessage({
      content: "Final lesson", usage_metadata: { input_tokens: 4, output_tokens: 3, total_tokens: 7 },
    }));
    const stream = jest.fn().mockImplementation(async () => (async function* () {
      yield { text: "Final ", usage_metadata: undefined, additional_kwargs: {}, response_metadata: {} };
      yield { text: "lesson", usage_metadata: { input_tokens: 4, output_tokens: 3, total_tokens: 7 }, additional_kwargs: {}, response_metadata: {} };
    })());
    const model = { bindTools: jest.fn(() => ({ invoke: planning })), invoke: final, stream } as unknown as BaseChatModel;
    return { model, final, stream };
  }

  it("provides tool evidence to the final call and returns only read page URLs", async () => {
    const { model, final } = fakeModel();
    const result = await new TestProvider(model).chat([{ role: "user", content: "Write a lesson" }], { webResearch: true });
    expect(final.mock.calls[0][0].at(-1).content).toContain("Retrieved evidence");
    expect(result.content).toBe("Final lesson");
    expect(result.sources).toEqual([{ url: "https://example.com", title: "Page" }]);
  });

  it("streams the final response after research and returns the same sources", async () => {
    const { model, stream } = fakeModel();
    const result = await new TestProvider(model).chatStream([{ role: "user", content: "Write a lesson" }], { webResearch: true });
    const chunks: string[] = [];
    for await (const text of result.stream) chunks.push(text);
    expect(chunks.join("")).toBe("Final lesson");
    expect(stream.mock.calls[0][0].at(-1).content).toContain("Retrieved evidence");
    expect(await result.response).toEqual({ sources: [{ url: "https://example.com", title: "Page" }], usage: { promptTokens: 4, completionTokens: 3, totalTokens: 7 } });
  });
});
