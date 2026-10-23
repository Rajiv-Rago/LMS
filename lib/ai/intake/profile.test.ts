import { BROAD_GOAL, buildLearnerProfile } from "./profile";
import { extractComplexity, extractTargetLevel } from "../utils/promptUtils";

describe("bounded learner profile", () => {
  it("defaults a skipped, unsure learner to beginner with explicit assumptions", () => {
    const p = buildLearnerProfile([BROAD_GOAL], "unsure");
    expect(p.startingLevel).toBe("beginner");
    expect(p.assessmentSkipped).toBe(true);
    expect(p.assumptions).toHaveLength(2);
  });
  it("consolidates strengths and unknowns across rounds", () => {
    const p = buildLearnerProfile(["Automate files"], "intermediate", [
      { topic: "Loops", correct: true },
      { topic: "Files", correct: null },
      { topic: "Loops", correct: true },
      { topic: "Errors", correct: false },
    ]);
    expect(p.observedStrengths).toEqual(["Loops"]);
    expect(p.observedGaps).toEqual(["Errors"]);
    expect(p.uncertainties).toContain("Files has not been verified.");
    expect(p.startingLevel).toBe("intermediate");
  });
  it("keeps explicit beginner level independent of deep course depth", () => {
    const prompt =
      "Topic: Python\nLevel: beginner\nComplexity: deep\nDuration: 6 hours";
    expect(extractTargetLevel(prompt)).toBe("beginner");
    expect(extractComplexity(prompt)).toBe("deep");
    expect(extractComplexity("Level: advanced")).toBe("deep");
  });
});
