import mongoose from "mongoose";
import Course from "./Course";
import { MAX_COURSE_SYLLABUS_PROMPT_LENGTH } from "@/lib/validation/coursePlanning";

it("accepts the full course input plus saved prompt metadata", () => {
  const context = "学".repeat(20_000);
  const syllabusPrompt = `Topic: ${"T".repeat(500)}\nLevel: advanced\nComplexity: deep\nDuration: ${"D".repeat(100)}\nPassing Score: 100\nContext: ${context}\nKnowledge Profile: ${"K".repeat(5_000)}`;
  const course = new Course({
    title: "Generated course", description: "A concise generated description.",
    instructor: new mongoose.Types.ObjectId(), syllabusPrompt,
  });
  expect(course.validateSync()).toBeUndefined();
  expect(course.syllabusPrompt).toBe(syllabusPrompt);
});

it("retains a bounded storage limit for syllabus prompts", () => {
  const course = new Course({
    title: "Generated course", description: "A concise generated description.",
    instructor: new mongoose.Types.ObjectId(),
    syllabusPrompt: "x".repeat(MAX_COURSE_SYLLABUS_PROMPT_LENGTH + 1),
  });
  expect(course.validateSync()?.errors.syllabusPrompt.message).toContain("Syllabus prompt cannot exceed");
});
