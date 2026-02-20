import { SyllabusGeneratorService } from "./syllabusGenerator";

// Mock createAIProvider to return our mock provider
const mockGenerateText = jest.fn();
jest.mock("../index", () => ({
  createAIProvider: () => ({
    name: "openai",
    chat: jest.fn(),
    generateText: mockGenerateText,
  }),
}));

describe("SyllabusGeneratorService", () => {
  let service: SyllabusGeneratorService;

  beforeEach(() => {
    mockGenerateText.mockReset();
    service = new SyllabusGeneratorService({
      provider: "openai",
      apiKey: "test-key",
    });
  });

  const validSyllabusJson = JSON.stringify({
    courseTitle: "Intro to TypeScript",
    courseDescription: "Learn TypeScript from scratch.",
    modules: [
      {
        title: "Getting Started",
        description: "Set up your environment.",
        order: 0,
        lessons: [
          { title: "Installing TypeScript", outline: "How to install TS.", order: 0 },
          { title: "First Program", outline: "Write your first TS program.", order: 1 },
          { title: "Types Overview", outline: "Overview of type system.", order: 2 },
        ],
      },
      {
        title: "Advanced Types",
        description: "Generics, unions, and more.",
        order: 1,
        lessons: [
          { title: "Generics", outline: "Learn about generics.", order: 0 },
          { title: "Union Types", outline: "Union and intersection types.", order: 1 },
          { title: "Type Guards", outline: "Using type guards.", order: 2 },
        ],
      },
    ],
  });

  it("generates a valid syllabus", async () => {
    mockGenerateText.mockResolvedValue({
      content: validSyllabusJson,
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
    });

    const result = await service.generateSyllabus({
      topic: "TypeScript",
      targetLevel: "beginner",
      estimatedDuration: "4 weeks",
    });

    expect(result.syllabus.courseTitle).toBe("Intro to TypeScript");
    expect(result.syllabus.modules).toHaveLength(2);
    expect(result.syllabus.modules[0].lessons).toHaveLength(3);
    expect(result.usage).toEqual({
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
    });
  });

  it("passes correct options to provider", async () => {
    mockGenerateText.mockResolvedValue({
      content: validSyllabusJson,
      finishReason: "stop",
    });

    await service.generateSyllabus({
      topic: "TypeScript",
      targetLevel: "advanced",
      estimatedDuration: "8 weeks",
      additionalContext: "Focus on type-level programming",
    });

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const [prompt, options] = mockGenerateText.mock.calls[0];
    expect(prompt).toContain("TypeScript");
    expect(prompt).toContain("advanced");
    expect(prompt).toContain("8 weeks");
    expect(prompt).toContain("Focus on type-level programming");
    expect(options.maxTokens).toBe(4096);
    expect(options.temperature).toBe(0.7);
  });

  it("throws on missing required fields in response", async () => {
    mockGenerateText.mockResolvedValue({
      content: JSON.stringify({ courseTitle: "Test" }), // missing courseDescription and modules
      finishReason: "stop",
    });

    await expect(
      service.generateSyllabus({
        topic: "Test",
        targetLevel: "beginner",
        estimatedDuration: "1 week",
      })
    ).rejects.toThrow("missing required fields");
  });

  it("throws on invalid module structure", async () => {
    mockGenerateText.mockResolvedValue({
      content: JSON.stringify({
        courseTitle: "Test",
        courseDescription: "Test desc",
        modules: [{ title: "Module 1" }], // missing lessons
      }),
      finishReason: "stop",
    });

    await expect(
      service.generateSyllabus({
        topic: "Test",
        targetLevel: "beginner",
        estimatedDuration: "1 week",
      })
    ).rejects.toThrow("missing title or lessons");
  });

  it("throws on invalid lesson structure", async () => {
    mockGenerateText.mockResolvedValue({
      content: JSON.stringify({
        courseTitle: "Test",
        courseDescription: "Test desc",
        modules: [
          {
            title: "Module 1",
            lessons: [{ title: "Lesson 1" }], // missing outline
          },
        ],
      }),
      finishReason: "stop",
    });

    await expect(
      service.generateSyllabus({
        topic: "Test",
        targetLevel: "beginner",
        estimatedDuration: "1 week",
      })
    ).rejects.toThrow("missing title or outline");
  });

  it("handles markdown-wrapped JSON responses", async () => {
    const wrappedJson = "```json\n" + validSyllabusJson + "\n```";
    mockGenerateText.mockResolvedValue({
      content: wrappedJson,
      finishReason: "stop",
    });

    const result = await service.generateSyllabus({
      topic: "TypeScript",
      targetLevel: "beginner",
      estimatedDuration: "4 weeks",
    });

    expect(result.syllabus.courseTitle).toBe("Intro to TypeScript");
  });

  it("throws on completely invalid JSON", async () => {
    mockGenerateText.mockResolvedValue({
      content: "This is not JSON at all",
      finishReason: "stop",
    });

    await expect(
      service.generateSyllabus({
        topic: "Test",
        targetLevel: "beginner",
        estimatedDuration: "1 week",
      })
    ).rejects.toThrow();
  });
});
