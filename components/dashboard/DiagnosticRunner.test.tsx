/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DiagnosticRunner from "./DiagnosticRunner";
import { BROAD_GOAL, buildLearnerProfile } from "@/lib/ai/intake/profile";

const config = {
  topic: "Python",
  complexity: "deep" as const,
  passingScore: 70,
  additionalContext: "",
};
const complete = jest.fn();
const goals = {
  phase: "goals",
  token: "goals-token",
  round: 0,
  revision: 0,
  goalOptions: ["Automate files", BROAD_GOAL],
};
const knowledge = {
  phase: "knowledge",
  token: "knowledge-token",
  round: 1,
  revision: 1,
  maxRounds: 5,
  questions: [
    {
      question: "What is a loop?",
      options: ["A", "B", "C", "D"],
      topic: "Loops",
    },
  ],
};
const profile = buildLearnerProfile(["Automate files"], "unsure", [
  { topic: "Loops", correct: null },
]);
const summary = { phase: "summary", round: 2, profile };
function response(data: object) {
  return Promise.resolve({ ok: true, json: async () => data });
}
beforeEach(() => {
  localStorage.clear();
  complete.mockReset();
  global.fetch = jest.fn().mockImplementation(() => response(goals));
});
function renderIntake() {
  render(
    <DiagnosticRunner
      config={config}
      onBack={jest.fn()}
      onComplete={complete}
    />,
  );
}
async function chooseGoal() {
  fireEvent.click(screen.getByRole("button", { name: "Plan my course" }));
  fireEvent.click(await screen.findByLabelText("Automate files"));
  (global.fetch as jest.Mock).mockImplementationOnce(() => response(knowledge));
  fireEvent.click(
    screen.getByRole("button", { name: "Continue to knowledge check" }),
  );
  await screen.findByText(/What is a loop/);
}
it("allows unknown answers and an empty explanation, then reviews before generating", async () => {
  renderIntake();
  await chooseGoal();
  fireEvent.click(screen.getByLabelText("I don’t know yet"));
  (global.fetch as jest.Mock).mockImplementationOnce(() => response(summary));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByText("Review your course plan");
  expect(complete).not.toHaveBeenCalled();
  expect(screen.getByText(/deep course.*beginner/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Learning goal"), {
    target: { value: "Automate payroll" },
  });
  fireEvent.change(screen.getByLabelText("Starting level"), {
    target: { value: "intermediate" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Generate course" }));
  expect(complete).toHaveBeenCalledWith(
    expect.objectContaining({
      goals: ["Automate payroll"],
      startingLevel: "intermediate",
    }),
  );
});
it("skips before loading suggestions without calling AI", () => {
  renderIntake();
  fireEvent.click(screen.getByRole("button", { name: "Skip to course plan" }));
  expect(global.fetch).not.toHaveBeenCalled();
  expect(screen.getByText("Review your course plan")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Generate course" }));
  expect(complete).toHaveBeenCalledWith(
    expect.objectContaining({
      assessmentSkipped: true,
      startingLevel: "beginner",
    }),
  );
});
it("keeps a custom goal when skipping the knowledge check", async () => {
  renderIntake();
  fireEvent.click(screen.getByRole("button", { name: "Plan my course" }));
  await screen.findByText("What would you like to learn?");
  fireEvent.change(screen.getByLabelText("Or describe your own goal"), {
    target: { value: "Build a CLI" },
  });
  (global.fetch as jest.Mock).mockImplementationOnce(() => response(summary));
  fireEvent.click(screen.getByRole("button", { name: "Skip to course plan" }));
  await screen.findByText("Review your course plan");
  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
  expect(body.customGoal).toBe("Build a CLI");
  expect(body.action).toBe("skip");
});
it("keeps retryable errors visible and permits skipping", async () => {
  renderIntake();
  await chooseGoal();
  fireEvent.click(screen.getByLabelText("A"));
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    json: async () => ({ error: "Try again" }),
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
  (global.fetch as jest.Mock).mockImplementationOnce(() => response(summary));
  fireEvent.click(screen.getByRole("button", { name: "Skip to course plan" }));
  await waitFor(() =>
    expect(screen.getByText("Review your course plan")).toBeInTheDocument(),
  );
});
it("blocks empty edited goals", () => {
  renderIntake();
  fireEvent.click(screen.getByRole("button", { name: "Skip to course plan" }));
  fireEvent.change(screen.getByLabelText("Learning goal"), {
    target: { value: "  " },
  });
  expect(
    screen.getByRole("button", { name: "Generate course" }),
  ).toBeDisabled();
});

it("restores a saved pending session after a refresh", async () => {
  localStorage.setItem(`kantigo-assessment:${config.topic}`, JSON.stringify({ token: "persisted-token", fingerprint: JSON.stringify(config) }));
  (global.fetch as jest.Mock).mockImplementationOnce(() => response(knowledge));
  renderIntake();
  await screen.findByText(/What is a loop/);
  expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual({ action: "resume", token: "persisted-token" });
});

it("can start a fresh assessment from a saved summary", async () => {
  localStorage.setItem(`kantigo-assessment:${config.topic}`, JSON.stringify({ token: "old-summary", fingerprint: JSON.stringify(config) }));
  (global.fetch as jest.Mock).mockImplementationOnce(() => response(summary));
  renderIntake();
  await screen.findByText("Review your course plan");
  fireEvent.click(screen.getByRole("button", { name: "Retake knowledge check" }));
  await screen.findByText("What would you like to learn?");
  expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)).toMatchObject({ action: "start", topic: "Python" });
});
