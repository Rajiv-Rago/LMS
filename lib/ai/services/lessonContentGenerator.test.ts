import { LessonContentGeneratorService } from "./lessonContentGenerator";

const mockGenerateText = jest.fn();
jest.mock("../index", () => ({
  createAIProvider: () => ({
    name: "openai",
    chat: jest.fn(),
    generateText: mockGenerateText,
  }),
}));

describe("LessonContentGeneratorService", () => {
  let service: LessonContentGeneratorService;

  beforeEach(() => {
    mockGenerateText.mockReset();
    service = new LessonContentGeneratorService({
      provider: "openai",
      apiKey: "test-key",
    });
  });

  const validContentJson = JSON.stringify({
    content: "# Introduction\n\nThis lesson covers TypeScript basics...",
    keyTakeaways: [
      "TypeScript adds static types to JavaScript",
      "Types help catch errors at compile time",
      "TypeScript compiles to plain JavaScript",
    ],
  });

  it("generates valid lesson content", async () => {
    mockGenerateText.mockResolvedValue({
      content: validContentJson,
      finishReason: "stop",
      usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
    });

    const result = await service.generateLessonContent({
      courseTitle: "TypeScript 101",
      courseDescription: "Learn TypeScript",
      moduleTitle: "Getting Started",
      lessonTitle: "Introduction",
      lessonOutline: "Overview of TypeScript",
      targetLevel: "beginner",
    });

    expect(result.content.content).toContain("TypeScript basics");
    expect(result.content.keyTakeaways).toHaveLength(3);
    expect(result.usage!.totalTokens).toBe(150);
  });

  it("passes correct prompt to provider", async () => {
    mockGenerateText.mockResolvedValue({
      content: validContentJson,
      finishReason: "stop",
    });

    await service.generateLessonContent({
      courseTitle: "TypeScript 101",
      courseDescription: "Learn TS",
      moduleTitle: "Basics",
      lessonTitle: "Variables",
      lessonOutline: "Variable declarations",
      targetLevel: "intermediate",
      previousLessonsSummary: "We covered types last time.",
    });

    const [prompt, options] = mockGenerateText.mock.calls[0];
    expect(prompt).toContain("TypeScript 101");
    expect(prompt).toContain("Basics");
    expect(prompt).toContain("Variables");
    expect(prompt).toContain("intermediate");
    expect(prompt).toContain("We covered types last time.");
    expect(options.maxTokens).toBe(4096);
    expect(options.temperature).toBe(0.7);
  });

  it("throws on missing content field", async () => {
    mockGenerateText.mockResolvedValue({
      content: JSON.stringify({ keyTakeaways: ["point 1"] }), // missing content
      finishReason: "stop",
    });

    await expect(
      service.generateLessonContent({
        courseTitle: "Test",
        courseDescription: "Test",
        moduleTitle: "Test",
        lessonTitle: "Test",
        lessonOutline: "Test",
        targetLevel: "beginner",
      })
    ).rejects.toThrow("missing required fields");
  });

  it("throws on missing keyTakeaways", async () => {
    mockGenerateText.mockResolvedValue({
      content: JSON.stringify({ content: "Some content" }), // missing keyTakeaways
      finishReason: "stop",
    });

    await expect(
      service.generateLessonContent({
        courseTitle: "Test",
        courseDescription: "Test",
        moduleTitle: "Test",
        lessonTitle: "Test",
        lessonOutline: "Test",
        targetLevel: "beginner",
      })
    ).rejects.toThrow("missing required fields");
  });

  it("handles markdown-wrapped JSON", async () => {
    mockGenerateText.mockResolvedValue({
      content: "```json\n" + validContentJson + "\n```",
      finishReason: "stop",
    });

    const result = await service.generateLessonContent({
      courseTitle: "Test",
      courseDescription: "Test",
      moduleTitle: "Test",
      lessonTitle: "Test",
      lessonOutline: "Test",
      targetLevel: "beginner",
    });

    expect(result.content.keyTakeaways).toHaveLength(3);
  });

  it("works without previousLessonsSummary", async () => {
    mockGenerateText.mockResolvedValue({
      content: validContentJson,
      finishReason: "stop",
    });

    await service.generateLessonContent({
      courseTitle: "Test",
      courseDescription: "Test",
      moduleTitle: "Test",
      lessonTitle: "Test",
      lessonOutline: "Test",
      targetLevel: "beginner",
    });

    const [prompt] = mockGenerateText.mock.calls[0];
    expect(prompt).not.toContain("previous lessons");
  });
});
