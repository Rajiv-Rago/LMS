import { NextRequest } from "next/server";
import { POST } from "./route";
import { decodeSession, encodeSession } from "@/lib/ai/intake/session";
import { env } from "@/lib/env";

const mockGenerate = jest.fn();
const mockAuthenticate = jest.fn().mockResolvedValue({ userId: "learner-1" });
jest.mock("@/lib/auth", () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
  requireCsrf: jest.fn().mockReturnValue(null),
}));
jest.mock("@/lib/ai/utils/providerResolver", () => ({
  resolveProvider: () => ({ provider: "openai", apiKey: "test" }),
}));
jest.mock("@/lib/ai", () => ({
  createAIProvider: () => ({ generateText: mockGenerate }),
}));
jest.mock("@/lib/logger", () => ({ captureException: jest.fn() }));

const question = (topic: string) => ({
  question: `Explain ${topic}`,
  options: ["A", "B", "C", "D"],
  correctIndex: 0,
  topic,
});
async function post(body: object) {
  const response = await POST(
    new NextRequest("http://localhost/api/courses/diagnostic", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, ...(await response.json()) };
}
async function start(context?: string) {
  mockGenerate.mockResolvedValueOnce({
    content: JSON.stringify({
      goals: ["Automate files", "Build APIs", "Analyze data", "Create tools"],
    }),
  });
  return post({ action: "start", topic: "Python", additionalContext: context });
}
async function knowledge(experience = "intermediate") {
  const goals = await start();
  mockGenerate.mockResolvedValueOnce({
    content: JSON.stringify({
      questions: [question("Loops"), question("Files"), question("Errors")],
    }),
  });
  return post({
    action: "goals",
    token: goals.token,
    goalIndex: 0,
    experience,
  });
}
beforeEach(() => {
  mockGenerate.mockReset();
  mockAuthenticate.mockResolvedValue({ userId: "learner-1" });
  env.DIAGNOSTIC_MAX_ITERATIONS = 3;
});

it("offers topic goals, existing requirements, and broad exploration", async () => {
  const r = await start("Focus on payroll spreadsheets");
  expect(r.status).toBe(200);
  expect(r.goalOptions).toHaveLength(6);
  expect(r.questionCount).toBe(2);
  expect(r.goalOptions[4]).toContain("already provided");
});
it("stops beginners after the initial check even with mixed results", async () => {
  const r = await knowledge("beginner");
  const final = await post({
    action: "evaluate",
    token: r.token,
    answers: [0, 1, -1],
  });
  expect(final.phase).toBe("summary");
  expect(final.profile.goals).toEqual(["Automate files"]);
  expect(final.profile.observedGaps).toEqual(["Files", "Errors"]);
  expect(mockGenerate).toHaveBeenCalledTimes(2);
});
it.each([
  [0, 0, 0],
  [-1, -1, -1],
])("stops consistent evidence without essays (%j)", async (...answers) => {
  const r = await knowledge();
  const final = await post({ action: "evaluate", token: r.token, answers });
  expect(final.phase).toBe("summary");
});
it("asks one targeted follow-up and stops at 3 rounds / 8 items", async () => {
  const r = await knowledge();
  mockGenerate.mockResolvedValueOnce({
    content: JSON.stringify({
      questions: [question("Conditions"), question("Functions")],
    }),
  });
  const next = await post({
    action: "evaluate",
    token: r.token,
    answers: [0, 1, -1],
    explanation: "I have used spreadsheet scripts",
  });
  expect(next.round).toBe(3);
  expect(next.questionCount).toBe(8);
  expect(next.questions).toHaveLength(2);
  expect(next.questions[0]).not.toHaveProperty("correctIndex");
  expect(mockGenerate.mock.calls[2][0]).toContain("Automate files");
  expect(mockGenerate.mock.calls[2][0]).toContain("previousObservations");
  const final = await post({
    action: "evaluate",
    token: next.token,
    answers: [0, 1],
  });
  expect(final.phase).toBe("summary");
  expect(final.profile.observedStrengths).toEqual(["Loops", "Conditions"]);
  expect(final.profile.observedGaps).toEqual(["Files", "Errors", "Functions"]);
  expect(final.profile.explanation).toContain("spreadsheet scripts");
  expect(mockGenerate).toHaveBeenCalledTimes(3);
});
it("clamps even a larger environment setting to three rounds", async () => {
  env.DIAGNOSTIC_MAX_ITERATIONS = 50;
  const r = await knowledge();
  expect(r.maxRounds).toBe(3);
});
it("honors a lower configured limit", async () => {
  env.DIAGNOSTIC_MAX_ITERATIONS = 1;
  const r = await start();
  const final = await post({
    action: "goals",
    token: r.token,
    goalIndex: 0,
    experience: "unsure",
  });
  expect(final.phase).toBe("summary");
  expect(mockGenerate).toHaveBeenCalledTimes(1);
});
it("rejects tampering, expired sessions, and another learner's session", async () => {
  const r = await start();
  expect((await post({ action: "skip", token: r.token + "x" })).status).toBe(
    400,
  );
  const session = decodeSession(r.token, "learner-1");
  expect(
    (
      await post({
        action: "skip",
        token: encodeSession({ ...session, expiresAt: 0 }),
      })
    ).status,
  ).toBe(400);
  mockAuthenticate.mockResolvedValue({ userId: "learner-2" });
  expect((await post({ action: "skip", token: r.token })).status).toBe(400);
});
it("rejects answers that do not match server questions", async () => {
  const r = await knowledge();
  expect(
    (await post({ action: "evaluate", token: r.token, answers: [0] })).status,
  ).toBe(400);
});
it("skip preserves custom goals and needs no scoring/model call", async () => {
  const r = await start();
  const final = await post({
    action: "skip",
    token: r.token,
    goalIndex: 0,
    customGoal: "Automate payroll",
    experience: "advanced",
  });
  expect(final.profile.goals).toEqual(["Automate payroll"]);
  expect(final.profile.startingLevel).toBe("advanced");
  expect(final.profile.assessmentSkipped).toBe(true);
  expect(mockGenerate).toHaveBeenCalledTimes(1);
});
it("keeps accumulated evidence when follow-up generation fails", async () => {
  const r = await knowledge();
  mockGenerate.mockRejectedValueOnce(new Error("Provider unavailable"));
  const final = await post({
    action: "evaluate",
    token: r.token,
    answers: [0, 1, -1],
  });
  expect(final.phase).toBe("summary");
  expect(final.profile.observedStrengths).toEqual(["Loops"]);
  expect(final.profile.assumptions.join(" ")).toContain("unavailable");
});
it("falls back to broad/existing goals when goal suggestions fail", async () => {
  mockGenerate.mockRejectedValueOnce(new Error("Provider unavailable"));
  const r = await post({ action: "start", topic: "Python" });
  expect(r.phase).toBe("goals");
  expect(r.goalOptions).toHaveLength(1);
});
it("rejects malformed model questions rather than scoring an invalid answer key", async () => {
  const r = await start();
  mockGenerate.mockResolvedValueOnce({
    content: JSON.stringify({
      questions: [{ ...question("Loops"), correctIndex: 10 }],
    }),
  });
  const final = await post({
    action: "goals",
    token: r.token,
    goalIndex: 0,
    experience: "unsure",
  });
  expect(final.phase).toBe("summary");
  expect(final.profile.assessmentSkipped).toBe(true);
});
