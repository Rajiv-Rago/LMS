import { GeminiProvider } from "./gemini";

const mockSendMessage = jest.fn();
const mockStartChat = jest.fn(() => ({ sendMessage: mockSendMessage }));
const mockGetGenerativeModel = jest.fn(() => ({ startChat: mockStartChat }));

jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

describe("GeminiProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMessage.mockResolvedValue({
      response: {
        text: () => "Generated text",
        candidates: [{ finishReason: "STOP" }],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 20,
          totalTokenCount: 30,
        },
      },
    });
  });

  it("uses Gemini 3.1 Flash Lite by default", async () => {
    const provider = new GeminiProvider("test-key");

    await provider.generateText("Generate a lesson");

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-3.1-flash-lite",
      })
    );
  });

  it("uses an explicit model when provided", async () => {
    const provider = new GeminiProvider("test-key", "gemini-custom");

    await provider.generateText("Generate a lesson");

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-custom",
      })
    );
  });
});
