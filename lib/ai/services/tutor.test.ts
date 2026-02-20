import { AITutorService, TutorContext } from "./tutor";
import { createMockAIProvider } from "../../../__tests__/mocks/aiProvider";

describe("AITutorService", () => {
  const mockProvider = createMockAIProvider({
    chatResponse: "I'd be happy to help you understand that concept!",
  });

  let service: AITutorService;

  beforeEach(() => {
    mockProvider.reset();
    service = new AITutorService(mockProvider);
  });

  const basicContext: TutorContext = {
    courseName: "TypeScript 101",
  };

  const fullContext: TutorContext = {
    courseName: "TypeScript 101",
    lessonTitle: "Generics",
    lessonContent: "Generics allow reusable code with type parameters...",
    aiContext: "Focus on practical examples",
  };

  describe("chat", () => {
    it("sends messages to the provider with system prompt", async () => {
      const messages = [{ role: "user" as const, content: "What are generics?" }];
      await service.chat(messages, basicContext);

      expect(mockProvider.calls).toHaveLength(1);
      const call = mockProvider.calls[0];
      expect(call.method).toBe("chat");
      expect(call.messages).toEqual(messages);
      expect(call.options?.systemPrompt).toContain("TypeScript 101");
    });

    it("includes lesson title in system prompt when provided", async () => {
      await service.chat(
        [{ role: "user", content: "Help" }],
        fullContext
      );

      const systemPrompt = mockProvider.calls[0].options?.systemPrompt || "";
      expect(systemPrompt).toContain("Generics");
    });

    it("includes lesson content in system prompt when provided", async () => {
      await service.chat(
        [{ role: "user", content: "Help" }],
        fullContext
      );

      const systemPrompt = mockProvider.calls[0].options?.systemPrompt || "";
      expect(systemPrompt).toContain("type parameters");
    });

    it("includes aiContext in system prompt when provided", async () => {
      await service.chat(
        [{ role: "user", content: "Help" }],
        fullContext
      );

      const systemPrompt = mockProvider.calls[0].options?.systemPrompt || "";
      expect(systemPrompt).toContain("Focus on practical examples");
    });

    it("defaults temperature to 0.7", async () => {
      await service.chat(
        [{ role: "user", content: "Hello" }],
        basicContext
      );

      expect(mockProvider.calls[0].options?.temperature).toBe(0.7);
    });

    it("allows custom temperature", async () => {
      await service.chat(
        [{ role: "user", content: "Hello" }],
        basicContext,
        { temperature: 0.3 }
      );

      expect(mockProvider.calls[0].options?.temperature).toBe(0.3);
    });

    it("returns provider response", async () => {
      const result = await service.chat(
        [{ role: "user", content: "Hello" }],
        basicContext
      );

      expect(result.content).toBe("I'd be happy to help you understand that concept!");
      expect(result.finishReason).toBe("stop");
    });
  });

  describe("askQuestion", () => {
    it("converts a single question into a chat message", async () => {
      await service.askQuestion("What is TypeScript?", basicContext);

      expect(mockProvider.calls).toHaveLength(1);
      const messages = mockProvider.calls[0].messages!;
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toBe("What is TypeScript?");
    });

    it("includes conversation history", async () => {
      const history = [
        { role: "user" as const, content: "What is TS?" },
        { role: "assistant" as const, content: "TypeScript is a superset of JS." },
      ];

      await service.askQuestion("Tell me more", basicContext, history);

      const messages = mockProvider.calls[0].messages!;
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe("What is TS?");
      expect(messages[1].content).toBe("TypeScript is a superset of JS.");
      expect(messages[2].content).toBe("Tell me more");
    });

    it("works with empty conversation history", async () => {
      await service.askQuestion("Hello", basicContext, []);

      const messages = mockProvider.calls[0].messages!;
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("Hello");
    });
  });

  describe("system prompt content", () => {
    it("mentions Socratic method", async () => {
      await service.chat(
        [{ role: "user", content: "test" }],
        basicContext
      );

      const systemPrompt = mockProvider.calls[0].options?.systemPrompt || "";
      expect(systemPrompt).toContain("Socratic");
    });

    it("mentions course name", async () => {
      await service.chat(
        [{ role: "user", content: "test" }],
        { courseName: "Advanced React" }
      );

      const systemPrompt = mockProvider.calls[0].options?.systemPrompt || "";
      expect(systemPrompt).toContain("Advanced React");
    });

    it("does not include lesson content when not provided", async () => {
      await service.chat(
        [{ role: "user", content: "test" }],
        basicContext
      );

      const systemPrompt = mockProvider.calls[0].options?.systemPrompt || "";
      expect(systemPrompt).not.toContain("Lesson content for reference");
    });
  });

  describe("error handling", () => {
    it("propagates provider errors", async () => {
      const errorProvider = createMockAIProvider({
        shouldError: true,
        errorMessage: "API rate limit exceeded",
      });
      const errorService = new AITutorService(errorProvider);

      await expect(
        errorService.chat(
          [{ role: "user", content: "Hello" }],
          basicContext
        )
      ).rejects.toThrow("API rate limit exceeded");
    });
  });
});
