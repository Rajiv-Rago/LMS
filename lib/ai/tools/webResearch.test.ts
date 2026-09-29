import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { researchWithTools } from "./webResearch";
import { readWebPage, searchWeb } from "../services/webResearch";

jest.mock("../services/webResearch", () => ({ searchWeb: jest.fn(), readWebPage: jest.fn() }));
const mockSearch = jest.mocked(searchWeb);
const mockRead = jest.mocked(readWebPage);

function researchModel(...answers: AIMessage[]): BaseChatModel {
  const invoke = jest.fn();
  answers.forEach(answer => invoke.mockResolvedValueOnce(answer));
  return { bindTools: jest.fn(() => ({ invoke })) } as unknown as BaseChatModel;
}

const call = (name: string, args: Record<string, string>, id: string) => ({ name, args, id, type: "tool_call" as const });

describe("web research tool loop", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("searches, reads, and records only pages actually opened", async () => {
    mockSearch.mockResolvedValue([{ url: "https://example.com/guide", title: "Guide", description: "snippet" }]);
    mockRead.mockResolvedValue({ url: "https://example.com/guide", title: "Guide", text: "Evidence" });
    const model = researchModel(
      new AIMessage({ content: "", tool_calls: [call("search_web", { query: "tutorial" }, "s1")] }),
      new AIMessage({ content: "", tool_calls: [call("read_web_page", { url: "https://example.com/guide" }, "r1")] }),
      new AIMessage("Research complete"),
    );
    const result = await researchWithTools(model, [new HumanMessage("Write a lesson")]);
    expect(mockSearch).toHaveBeenCalledWith("tutorial", 5);
    expect(mockRead).toHaveBeenCalledWith("https://example.com/guide");
    expect(result.sources).toEqual([{ url: "https://example.com/guide", title: "Guide" }]);
    expect(result.messages.at(-1)?.content).toContain("Evidence");
  });

  it("refuses URLs not returned by search and does not cite them", async () => {
    const model = researchModel(
      new AIMessage({ content: "", tool_calls: [call("read_web_page", { url: "https://example.com/guessed" }, "r1")] }),
      new AIMessage("Done"),
    );
    const result = await researchWithTools(model, [new HumanMessage("Write")]);
    expect(mockRead).not.toHaveBeenCalled();
    expect(result.sources).toEqual([]);
  });

  it("keeps lesson generation available if tool calls are unsupported", async () => {
    const model = { bindTools: jest.fn(() => ({ invoke: jest.fn().mockRejectedValue(new Error("unsupported")) })) } as unknown as BaseChatModel;
    const input = [new HumanMessage("Write")];
    const result = await researchWithTools(model, input);
    expect(result.messages).toEqual(input);
    expect(result.sources).toEqual([]);
  });

  it("returns no citations if a page cannot be read", async () => {
    mockSearch.mockResolvedValue([{ url: "https://example.com", title: "Result", description: "" }]);
    mockRead.mockRejectedValue(new Error("unavailable"));
    const model = researchModel(
      new AIMessage({ content: "", tool_calls: [call("search_web", { query: "topic" }, "s1")] }),
      new AIMessage({ content: "", tool_calls: [call("read_web_page", { url: "https://example.com" }, "r1")] }),
      new AIMessage("Done"),
    );
    const result = await researchWithTools(model, [new HumanMessage("Write")]);
    expect(result.sources).toEqual([]);
    expect(result.messages.at(-1)?.content).toContain("Page unavailable");
  });
});
