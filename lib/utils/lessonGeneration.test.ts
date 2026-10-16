import { isLessonGenerationActive, LESSON_GENERATION_LEASE_MS } from "./lessonGeneration";

it("unlocks a generation at the lease deadline while protecting recent attempts", () => {
  const now = Date.now();
  expect(isLessonGenerationActive({ generationStatus: "generating", updatedAt: new Date(now - 1000) }, now)).toBe(true);
  expect(isLessonGenerationActive({ generationStatus: "generating", updatedAt: new Date(now - LESSON_GENERATION_LEASE_MS) }, now)).toBe(false);
  expect(isLessonGenerationActive({ generationStatus: "failed", updatedAt: new Date(now) }, now)).toBe(false);
});
