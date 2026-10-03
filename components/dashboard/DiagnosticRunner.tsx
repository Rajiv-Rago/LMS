"use client";

import { useRef, useState } from "react";
import type { CourseConfig } from "./CourseConfigModal";
import {
  BROAD_GOAL,
  buildLearnerProfile,
  EXPERIENCE_OPTIONS,
  type LearnerProfile,
} from "@/lib/ai/intake/profile";

interface IntakeResponse {
  phase: "goals" | "knowledge" | "summary";
  token?: string;
  goalOptions?: string[];
  questions?: { question: string; options: string[]; topic: string }[];
  round: number;
  maxRounds?: number;
  profile?: LearnerProfile;
}
interface DiagnosticRunnerProps {
  config: CourseConfig;
  onBack: () => void;
  onComplete: (profile: LearnerProfile) => void;
}
const fieldClass =
  "block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white";
const buttonClass =
  "px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-md disabled:opacity-50";
const EXPERIENCE_LABELS = {
  beginner: "New to this topic",
  intermediate: "Some practical experience",
  advanced: "Comfortable with advanced work",
  unsure: "Not sure yet",
};

export default function DiagnosticRunner({
  config,
  onBack,
  onComplete,
}: DiagnosticRunnerProps) {
  const [intake, setIntake] = useState<IntakeResponse | null>(null);
  const [goalIndex, setGoalIndex] = useState<number | null>(null);
  const [customGoal, setCustomGoal] = useState("");
  const [experience, setExperience] =
    useState<LearnerProfile["selfReportedLevel"]>("unsure");
  const [answers, setAnswers] = useState<number[]>([]);
  const [explanation, setExplanation] = useState("");
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  async function request(body: Record<string, unknown>) {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/courses/diagnostic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Unable to prepare your course plan");
      setIntake(data);
      if (data.profile) setProfile(data.profile);
      setAnswers(new Array(data.questions?.length ?? 0).fill(-2));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to prepare your course plan",
      );
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }
  function skip() {
    if (!intake) {
      setProfile(
        buildLearnerProfile(
          [
            config.additionalContext
              ? "Use the goals and requirements I already provided"
              : BROAD_GOAL,
          ],
          experience,
        ),
      );
      setIntake({ phase: "summary", round: 1 });
    } else {
      void request({
        action: "skip",
        token: intake.token,
        ...(intake.phase === "goals"
          ? {
              goalIndex: goalIndex ?? undefined,
              customGoal: customGoal || undefined,
              experience,
            }
          : {}),
      });
    }
  }
  function submit() {
    if (!intake) return;
    if (intake.phase === "goals")
      void request({
        action: "goals",
        token: intake.token,
        goalIndex: goalIndex ?? intake.goalOptions?.indexOf(BROAD_GOAL),
        customGoal: customGoal || undefined,
        experience,
      });
    else
      void request({
        action: "evaluate",
        token: intake.token,
        answers,
        explanation: explanation || undefined,
      });
  }
  const goalChosen = goalIndex !== null || !!customGoal.trim();
  const incomplete =
    intake?.phase === "goals" ? !goalChosen : answers.some((a) => a === -2);

  return (
    <section
      aria-labelledby="intake-title"
      aria-busy={loading}
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          id="intake-title"
          className="text-base font-semibold text-zinc-900 dark:text-white"
        >
          {!intake
            ? `Plan your course: ${config.topic}`
            : intake.phase === "summary"
              ? "Review your course plan"
              : intake.phase === "goals"
                ? "What would you like to learn?"
                : `Knowledge check — round ${intake.round} of at most ${intake.maxRounds ?? 3}`}
        </h3>
        {intake?.phase !== "summary" && (
          <button
            type="button"
            onClick={skip}
            disabled={loading}
            className="text-sm text-zinc-500 disabled:opacity-50"
          >
            Skip to course plan
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {!intake && (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Choose a learning direction, then answer a short knowledge check. At
            most 3 rounds and 8 questions, with no required written answers. You
            can skip at any time.
          </p>
          <button
            type="button"
            disabled={loading}
            className={buttonClass}
            onClick={() =>
              request({
                action: "start",
                topic: config.topic,
                additionalContext: config.additionalContext || undefined,
              })
            }
          >
            {loading ? "Preparing..." : "Plan my course"}
          </button>
        </>
      )}
      {intake?.phase === "goals" && (
        <>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-2">
              Choose an outcome for {config.topic}
            </legend>
            {intake.goalOptions?.map((goal, index) => (
              <label
                key={goal}
                className="flex gap-2 items-start text-sm text-zinc-700 dark:text-zinc-300"
              >
                <input
                  type="radio"
                  name="learning-goal"
                  checked={goalIndex === index}
                  onChange={() => {
                    setGoalIndex(index);
                    setCustomGoal("");
                  }}
                  disabled={loading}
                />
                {goal}
              </label>
            ))}
          </fieldset>
          <label className="block text-sm space-y-2">
            Or describe your own goal
            <textarea
              className={fieldClass}
              maxLength={500}
              rows={2}
              value={customGoal}
              disabled={loading}
              onChange={(e) => {
                setCustomGoal(e.target.value);
                setGoalIndex(null);
              }}
              placeholder="What would you like to be able to do?"
            />
          </label>
          <label className="block text-sm space-y-2">
            How familiar are you with this topic?
            <select
              className={fieldClass}
              value={experience}
              disabled={loading}
              onChange={(e) =>
                setExperience(e.target.value as typeof experience)
              }
            >
              {EXPERIENCE_OPTIONS.map((level) => (
                <option key={level} value={level}>
                  {EXPERIENCE_LABELS[level]}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {intake?.phase === "knowledge" && (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {intake.round === 3
              ? "One final check to choose the right prerequisite coverage."
              : "These questions estimate a starting point for your chosen goal. “I don’t know yet” is a useful answer."}
          </p>
          {intake.questions?.map((q, qi) => (
            <fieldset key={`${intake.round}-${qi}`} className="space-y-2">
              <legend className="text-sm font-medium">
                {qi + 1}. {q.question}
              </legend>
              {[...q.options, "I don’t know yet"].map((option, oi) => {
                const answer = oi === q.options.length ? -1 : oi;
                return (
                  <label
                    key={oi}
                    className="flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm"
                  >
                    <input
                      type="radio"
                      name={`question-${qi}`}
                      checked={answers[qi] === answer}
                      disabled={loading}
                      onChange={() =>
                        setAnswers((prev) =>
                          prev.map((a, i) => (i === qi ? answer : a)),
                        )
                      }
                    />
                    {option}
                  </label>
                );
              })}
            </fieldset>
          ))}
          {intake.round === 2 && (
            <label className="block text-sm space-y-2">
              Anything you’ve tried or want us to know? (Optional)
              <textarea
                className={fieldClass}
                rows={2}
                maxLength={1000}
                value={explanation}
                disabled={loading}
                onChange={(e) => setExplanation(e.target.value)}
              />
            </label>
          )}
        </>
      )}
      {intake?.phase === "summary" && profile && (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            We’ll build a {config.complexity} course on {config.topic}, starting
            at {profile.startingLevel} level. Adjust the goal or starting point
            below.
          </p>
          <label className="block text-sm space-y-2">
            Learning goal
            <textarea
              className={fieldClass}
              rows={3}
              maxLength={500}
              value={profile.goals.join("; ")}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  goals: [e.target.value],
                  assumptions: [
                    ...profile.assumptions.filter(
                      (a) =>
                        !a.startsWith("Use a balanced introduction") &&
                        !a.startsWith("Learning goal adjusted"),
                    ),
                    "Learning goal adjusted by the learner; knowledge evidence reflects the original focus.",
                  ],
                })
              }
            />
          </label>
          <label className="block text-sm space-y-2">
            Starting level
            <select
              className={fieldClass}
              value={profile.startingLevel}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  startingLevel: e.target
                    .value as LearnerProfile["startingLevel"],
                  assumptions: [
                    ...profile.assumptions.filter(
                      (a) => !a.startsWith("Starting level adjusted"),
                    ),
                    "Starting level adjusted by the learner; prioritize this choice.",
                  ],
                })
              }
            >
              {["beginner", "intermediate", "advanced"].map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <dl className="text-sm text-zinc-600 dark:text-zinc-400 space-y-2">
            <div>
              <dt className="font-medium">Possible strengths</dt>
              <dd>
                {profile.observedStrengths.join(", ") || "Not established"}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Topics to reinforce</dt>
              <dd>{profile.observedGaps.join(", ") || "Not established"}</dd>
            </div>
            <div>
              <dt className="font-medium">Planning assumptions</dt>
              <dd>{profile.assumptions.join(" ")}</dd>
            </div>
          </dl>
          <button
            type="button"
            disabled={!profile.goals[0]?.trim()}
            className={buttonClass}
            onClick={() =>
              onComplete({
                ...profile,
                goals: profile.goals.map((g) => g.trim()),
              })
            }
          >
            Generate course
          </button>
        </>
      )}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          disabled={loading}
          onClick={onBack}
          className="px-4 py-2 text-sm rounded-md bg-zinc-100 dark:bg-zinc-800"
        >
          Back
        </button>
        {intake && intake.phase !== "summary" && (
          <button
            type="button"
            disabled={loading || incomplete}
            onClick={submit}
            className={buttonClass}
          >
            {loading
              ? "Preparing..."
              : intake.phase === "goals"
                ? "Continue to knowledge check"
                : "Continue"}
          </button>
        )}
      </div>
    </section>
  );
}
