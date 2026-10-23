import { advanceAssessment, redundantQuestion, withAssessmentTimeout, AssessmentTimeout } from "./graph";
import { buildLearnerProfile } from "./profile";
import { sessionSchema, type IntakeSession } from "./session";

jest.mock("@/lib/logger", () => ({ captureException: jest.fn() }));

const decision = { sufficient: false, confidence: 0.99, knowledge_gaps: ["Functions"], strengths: [], next_question_focus: "Function parameters", starting_level: "beginner", prerequisite_coverage: ["Functions"], uncertainties: ["Parameter understanding"] };
const question = (n: number) => ({ question: `What is concept ${n}?`, options: ["A", "B", "C", "D"], correctIndex: 0, topic: `Concept ${n}` });
function initial(): IntakeSession {
  return { userId: "learner", expiresAt: Date.now() + 10000, topic: "Python", context: "Automate reports", phase: "goals", round: 0, completedRounds: 0, questionCount: 0, maxRounds: 5, goalOptions: ["Automate reports"], profile: buildLearnerProfile(["Automate reports"], "intermediate"), observations: [], questions: [], history: [], lowGainRounds: 0 };
}
const result = (value: unknown) => Promise.resolve({ content: JSON.stringify(value) });
function answer(s: IntakeSession, value = 0): IntakeSession {
  const offset = s.history.length - s.questions.length;
  return { ...s, completedRounds: s.completedRounds + 1, history: s.history.map((q, i) => i < offset ? q : { ...q, answer: value }), observations: [...s.observations, ...s.questions.map(q => ({ topic: q.topic, correct: value === -1 ? null : value === q.correctIndex }))] };
}
it.each(["beginner", "advanced"] as const)("probes a self-reported %s even when the model claims enough evidence", async level => {
  const session = initial();
  session.profile = buildLearnerProfile(["Automate reports"], level);
  const generate = jest.fn()
    .mockImplementationOnce(() => result({ ...decision, sufficient: true, next_question_focus: "" }))
    .mockImplementationOnce(() => result({ questions: [question(1), question(2), question(3)] }));
  const s = await advanceAssessment(session, generate);
  expect(s.phase).toBe("knowledge");
  expect(s.completionReason).toBeUndefined();
  expect(s.round).toBe(1);
  expect(s.questions).toHaveLength(3);
});
it("requires a follow-up and uses demonstrated skills rather than self-report for the final profile", async () => {
  const first = answer({ ...initial(), phase: "knowledge", round: 1, questionCount: 3,
    questions: [question(1), question(2), question(3)], history: [question(1), question(2), question(3)] });
  const generate = jest.fn()
    .mockImplementationOnce(() => result({ ...decision, sufficient: true }))
    .mockImplementationOnce(() => result({ questions: [question(4)] }));
  const next = await advanceAssessment(first, generate);
  expect(next.phase).toBe("knowledge");
  expect(next.round).toBe(2);
  expect(generate.mock.calls[1][0]).toContain('"answer":0');
  expect(generate.mock.calls[0][0]).toContain('"observations":[');
  expect(generate.mock.calls[1][0]).toContain('"observations":[');
  const evaluate = jest.fn(() => result({ ...decision, sufficient: true, starting_level: "advanced", strengths: ["Functions"], knowledge_gaps: ["Error handling"] }));
  const done = await advanceAssessment(answer(next), evaluate);
  expect(done.completionReason).toBe("sufficient");
  expect(done.profile).toMatchObject({ startingLevel: "advanced", selfReportedLevel: "intermediate", observedStrengths: ["Functions"], observedGaps: ["Error handling"] });
});
it("does not declare sufficient evidence after only two one-question rounds", async () => {
  const session = answer({ ...initial(), phase: "knowledge", round: 2, completedRounds: 1, questionCount: 2,
    observations: [{ topic: "First", correct: true }], questions: [question(2)], history: [{ ...question(1), answer: 0 }, question(2)] });
  const generate = jest.fn()
    .mockImplementationOnce(() => result({ ...decision, sufficient: true }))
    .mockImplementationOnce(() => result({ questions: [question(3)] }));
  expect((await advanceAssessment(session, generate)).phase).toBe("knowledge");
});
it("accepts a useful detailed follow-up focus instead of failing the whole assessment", async () => {
  const generate = jest.fn()
    .mockImplementationOnce(() => result({ ...decision, next_question_focus: "Probe prerequisites and practical application. ".repeat(10) }))
    .mockImplementationOnce(() => result({ questions: [question(1)] }));
  const next = await advanceAssessment(initial(), generate);
  expect(next.phase).toBe("knowledge");
  sessionSchema.parse(next);
});
it("enforces five completed rounds even when the model always wants more", async () => {
  let s = initial();
  for (let n = 1; n <= 6; n++) {
    const generate = jest.fn().mockImplementationOnce(() => result({ ...decision, uncertainties: [`Unknown ${n}`] })).mockImplementationOnce(() => result({ questions: [question(n)] }));
    s = await advanceAssessment(s, generate);
    if (n < 6) { expect(s.round).toBe(n); s = answer(s); }
    else { expect(s.completionReason).toBe("max_rounds"); expect(generate).toHaveBeenCalledTimes(1); }
    sessionSchema.parse(s);
  }
  expect(s.round).toBe(5);
});
it("bounds total questions and passes real answer history to both model nodes", async () => {
  let s = initial();
  for (let n = 0; n < 5; n++) {
    const count = Math.min(3, 10 - s.questionCount);
    const generate = jest.fn().mockImplementationOnce(() => result({ ...decision, uncertainties: [`Round ${n}`] })).mockImplementationOnce(() => result({ questions: Array.from({ length: count }, (_, i) => question(n * 3 + i)) }));
    s = await advanceAssessment(s, generate);
    expect(s.questionCount).toBeLessThanOrEqual(10);
    if (n > 0) expect(generate.mock.calls[0][0]).toContain('"answer":0');
    if (n < 4) s = answer(s);
  }
  expect(s.completionReason).toBe("question_budget");
});
it("bounds low-value rounds without using confidence as a stopping threshold", async () => {
  let s = initial();
  for (let n = 0; n < 3; n++) {
    const generate = jest.fn().mockImplementationOnce(() => result(decision)).mockImplementationOnce(() => result({ questions: [question(n)] }));
    s = await advanceAssessment(s, generate);
    if (n < 2) s = answer(s, -1);
  }
  expect(s.completionReason).toBe("diminishing_gain");
  expect(s.round).toBe(2);
});
it("filters repeated questions and terminates if none are useful", async () => {
  const s = answer({ ...initial(), phase: "knowledge", round: 1, questionCount: 1, history: [question(1)], questions: [question(1)] });
  const generate = jest.fn().mockImplementationOnce(() => result(decision)).mockImplementationOnce(() => result({ questions: [question(1)] }));
  const next = await advanceAssessment(s, generate);
  expect(next.completionReason).toBe("diminishing_gain");
  expect(next.questionCount).toBe(1);
  expect(redundantQuestion("Explain Python loops!", "explain python loops")).toBe(true);
});
it.each(["invalid", "failure", "timeout"])("keeps partial evidence after %s", async mode => {
  const s = answer({ ...initial(), phase: "knowledge", round: 1, questionCount: 1, history: [question(1)], questions: [question(1)] });
  const generate = jest.fn(() => mode === "invalid" ? result({ sufficient: "yes" }) : Promise.reject(mode === "timeout" ? new AssessmentTimeout() : new Error("provider down")));
  const next = await advanceAssessment(s, generate);
  expect(next.completionReason).toBe(mode === "timeout" ? "timeout" : "error");
  expect(next.history[0].answer).toBe(0);
  expect(next.profile?.observedStrengths).toEqual(["Concept 1"]);
  expect(next.profile?.uncertainties).not.toHaveLength(0);
});
it("skips without invoking the model and preserves partial answers", async () => {
  const generate = jest.fn();
  const s = await advanceAssessment({ ...initial(), completionReason: "skipped" }, generate);
  expect(generate).not.toHaveBeenCalled();
  expect(s.profile?.assessmentSkipped).toBe(true);
  expect(s.phase).toBe("summary");
});
it("rejects oversized question batches instead of exceeding per-round budgets", async () => {
  const generate = jest.fn().mockImplementationOnce(() => result(decision)).mockImplementationOnce(() => result({ questions: [1, 2, 3, 4].map(question) }));
  const s = await advanceAssessment(initial(), generate);
  expect(s.completionReason).toBe("error");
  expect(s.questionCount).toBe(0);
});
it("times out and cancels a hanging model call", async () => {
  const abort = jest.fn();
  await expect(withAssessmentTimeout(() => new Promise(() => {}), 5, abort)).rejects.toBeInstanceOf(AssessmentTimeout);
  expect(abort).toHaveBeenCalledTimes(1);
});
