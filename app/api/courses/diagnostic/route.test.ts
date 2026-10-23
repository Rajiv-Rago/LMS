import { NextRequest } from "next/server";
import { POST } from "./route";
import { loadAssessment, saveAssessment } from "@/lib/ai/intake/store";
import { connectTestDb, clearTestDb, disconnectTestDb } from "@/__tests__/helpers/db";
import { env } from "@/lib/env";
import { MAX_COURSE_CONTEXT_LENGTH } from "@/lib/validation/coursePlanning";

const mockGenerate = jest.fn();
const mockAuthenticate = jest.fn().mockResolvedValue({ userId: "learner-1" });
jest.mock("@/lib/auth", () => ({ authenticate: (...args: unknown[]) => mockAuthenticate(...args), requireCsrf: jest.fn().mockReturnValue(null) }));
jest.mock("@/lib/ai/utils/providerResolver", () => ({ resolveProvider: jest.fn(() => ({ provider: "openai", apiKey: "test" })) }));
jest.mock("@/lib/ai", () => ({ createAIProvider: () => ({ generateText: mockGenerate }) }));
jest.mock("@/lib/logger", () => ({ captureException: jest.fn() }));
const decision = { sufficient: false, confidence: 0.6, knowledge_gaps: ["Functions"], strengths: [], next_question_focus: "Function parameters", starting_level: "beginner", prerequisite_coverage: ["Functions"], uncertainties: ["Parameter understanding"] };
const q = { question: "Which value is passed to a function?", options: ["A", "B", "C", "D"], correctIndex: 0, topic: "Functions" };
const respond = (data: unknown) => mockGenerate.mockResolvedValueOnce({ content: JSON.stringify(data) });
async function post(body: object) {
  const response = await POST(new NextRequest("http://localhost/api/courses/diagnostic", { method: "POST", body: JSON.stringify(body) }));
  return { status: response.status, ...(await response.json()) };
}
async function start(context?: string) {
  respond({ goals: ["Automate files", "Build APIs", "Analyze data"] });
  return post({ action: "start", topic: "Python", additionalContext: context });
}
async function knowledge() {
  const s = await start();
  respond(decision); respond({ questions: [q] });
  return post({ action: "goals", token: s.token, revision: s.revision, goalIndex: 0, experience: "intermediate" });
}
beforeAll(connectTestDb, 60000);
afterAll(disconnectTestDb);
beforeEach(() => { mockGenerate.mockReset(); mockAuthenticate.mockResolvedValue({ userId: "learner-1" }); env.DIAGNOSTIC_MAX_ITERATIONS = 5; });
afterEach(clearTestDb);

it("persists Unicode context server-side without exposing state or answer keys", async () => {
  const context = "学".repeat(MAX_COURSE_CONTEXT_LENGTH);
  const s = await start(context);
  expect(s.status).toBe(200);
  expect(s.token).toHaveLength(36);
  expect(s.round).toBe(0);
  expect(s.questionCount).toBe(0);
  expect((await loadAssessment(s.token, "learner-1"))?.state.context).toBe(context);
  respond(decision); respond({ questions: [q] });
  const k = await post({ action: "goals", token: s.token, revision: s.revision, goalIndex: 0 });
  expect(k.questions[0]).not.toHaveProperty("correctIndex");
  expect(k).not.toHaveProperty("history");
});
it("allows an LLM to finish immediately using existing context", async () => {
  const s = await start();
  respond({ ...decision, sufficient: true });
  const done = await post({ action: "goals", token: s.token, revision: s.revision, goalIndex: 0 });
  expect(done.phase).toBe("summary");
  expect(done.completionReason).toBe("sufficient");
  expect(done.questionCount).toBe(0);
});
it("resumes the exact pending round and rejects stale or duplicate answer submissions", async () => {
  const k = await knowledge();
  const resumed = await post({ action: "resume", token: k.token });
  expect(resumed).toEqual(k);
  respond({ ...decision, sufficient: true, strengths: ["Functions"] });
  const done = await post({ action: "evaluate", token: k.token, revision: k.revision, answers: [0], explanation: "I use scripts" });
  expect(done.phase).toBe("summary");
  const row = await loadAssessment(k.token, "learner-1");
  expect(row?.state.history[0]).toMatchObject({ answer: 0, explanation: "I use scripts" });
  expect((await post({ action: "evaluate", token: k.token, revision: k.revision, answers: [1] })).status).toBe(409);
  expect((await post({ action: "resume", token: k.token })).profile.observedStrengths).toEqual(["Functions"]);
});
it("does not allow another learner to read or skip an assessment", async () => {
  const k = await knowledge();
  mockAuthenticate.mockResolvedValue({ userId: "other" });
  expect((await post({ action: "resume", token: k.token })).status).toBe(404);
  expect((await post({ action: "skip", token: k.token, revision: k.revision })).status).toBe(404);
});
it("skips without a model and retains the chosen goal and evidence", async () => {
  const k = await knowledge();
  const calls = mockGenerate.mock.calls.length;
  const done = await post({ action: "skip", token: k.token, revision: k.revision });
  expect(done.completionReason).toBe("skipped");
  expect(done.profile.goals).toEqual(["Automate files"]);
  expect(mockGenerate).toHaveBeenCalledTimes(calls);
});
it("keeps partial answers on invalid LLM output", async () => {
  const k = await knowledge();
  respond({ sufficient: "yes" });
  const done = await post({ action: "evaluate", token: k.token, revision: k.revision, answers: [0] });
  expect(done.completionReason).toBe("error");
  expect(done.profile.observedStrengths).toEqual(["Functions"]);
  expect((await loadAssessment(k.token, "learner-1"))?.state.history[0].answer).toBe(0);
});
it("rejects malformed answers and oversized context before calling the model", async () => {
  expect((await post({ action: "start", topic: "Python", additionalContext: "x".repeat(MAX_COURSE_CONTEXT_LENGTH + 1) })).status).toBe(400);
  expect(mockGenerate).not.toHaveBeenCalled();
  const k = await knowledge();
  expect((await post({ action: "evaluate", token: k.token, revision: k.revision, answers: [0, 1] })).status).toBe(400);
});
it("bounds provider timeout and forwards cancellation", async () => {
  const s = await start();
  mockGenerate.mockReturnValueOnce(new Promise(() => {}));
  const done = await post({ action: "goals", token: s.token, revision: s.revision, goalIndex: 0 });
  expect(done.completionReason).toBe("timeout");
  expect(mockGenerate.mock.calls.at(-1)[1].signal.aborted).toBe(true);
}, 20000);
it("atomically accepts only one concurrent state update", async () => {
  const s = await start();
  const record = (await loadAssessment(s.token, "learner-1"))!;
  const results = await Promise.all([saveAssessment(record, record.state), saveAssessment(record, record.state)]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect((await loadAssessment(s.token, "learner-1"))?.revision).toBe(1);
});
