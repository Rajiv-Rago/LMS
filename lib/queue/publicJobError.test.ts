import { publicJobError } from "./publicJobError";

it("gives actionable guidance for known AI failures without returning raw exceptions", () => {
  expect(publicJobError("openrouter/free failed: AI_GENERATION_PARSE_FAILED")).toContain("Try a different model");
  expect(publicJobError("Syllabus output was truncated at the token limit")).toContain("smaller course");
  expect(publicJobError("openrouter/free failed: AI_PROVIDER_RATE_LIMITED")).toContain("rate-limited");
  expect(publicJobError("Unexpected private internal message")).toBe("Job failed — please try again");
  expect(publicJobError()).toBeUndefined();
});
