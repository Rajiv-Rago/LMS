import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, requireCsrf } from "@/lib/auth";
import { resolveProvider } from "@/lib/ai/utils/providerResolver";
import { createAIProvider } from "@/lib/ai";
import { parseAIJsonResponse } from "@/lib/ai/utils/jsonParser";
import { env } from "@/lib/env";
import { captureException } from "@/lib/logger";

const mcqSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number(),
  topic: z.string().optional(),
  userAnswer: z.number().optional(),
});

const questionsSchema = z.object({
  action: z.literal("questions"),
  topic: z.string().min(1).max(500),
  complexity: z.string().max(50).optional(),
  additionalContext: z.string().max(5000).optional(),
  round: z.number().int().min(1).max(50).default(1),
  weakTopics: z.array(z.string().max(200)).max(10).optional(),
});

const evaluateSchema = z.object({
  action: z.literal("evaluate"),
  topic: z.string().min(1).max(500),
  mcqs: z.array(mcqSchema).min(1).max(10),
  essayPrompt: z.string().max(2000),
  essayResponse: z.string().max(8000),
  round: z.number().int().min(1).max(50).default(1),
});

export async function POST(request: NextRequest) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const action = (body as { action?: string })?.action;

    const resolved = resolveProvider({});
    if (!resolved) {
      return NextResponse.json(
        { error: "AI service is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }
    const provider = createAIProvider({
      provider: resolved.provider,
      apiKey: resolved.apiKey,
      model: resolved.model,
    });

    const maxIterations = env.DIAGNOSTIC_MAX_ITERATIONS;

    if (action === "questions") {
      const validation = questionsSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
      }
      const { topic, complexity, additionalContext, round, weakTopics } = validation.data;
      if (round > maxIterations) {
        return NextResponse.json({ error: "Diagnostic iteration limit reached", done: true }, { status: 400 });
      }

      const focus = weakTopics?.length
        ? `\nFocus especially on these observed gaps: ${weakTopics.join("; ")}.`
        : "";
      const prompt =
        `Create a diagnostic round for a learner who wants a course on "${topic}" (complexity: ${complexity ?? "standard"}, round ${round}).` +
        `${additionalContext ? `\nLearner context: ${additionalContext}` : ""}${focus}\n` +
        `Respond ONLY with JSON: {"mcqs":[{"question":"...","options":["a","b","c","d"],"correctIndex":0,"topic":"subtopic"}],"essayPrompt":"..."}` +
        `\nRules: exactly 3 MCQs with 4 options each, exactly 1 essay prompt (open-ended, gauges depth). MCQs should probe what the learner knows vs not; essay should require explanation, not recall.`;

      try {
        const res = await provider.generateText(prompt, {
          systemPrompt: "You are an expert adaptive assessor. Respond ONLY with valid JSON.",
          maxTokens: 1500,
          temperature: 0.7,
        });
        const parsed = parseAIJsonResponse(res.content, (p: unknown) => {
          const d = p as { mcqs?: unknown[]; essayPrompt?: string };
          if (!Array.isArray(d.mcqs) || typeof d.essayPrompt !== "string") {
            throw new Error("Invalid diagnostic question structure");
          }
          const mcqs = (d.mcqs as Record<string, unknown>[]).slice(0, 3).map((m) => ({
            question: String(m.question ?? ""),
            options: Array.isArray(m.options) ? (m.options as string[]).slice(0, 4).map(String) : [],
            correctIndex: typeof m.correctIndex === "number" ? m.correctIndex : 0,
            topic: typeof m.topic === "string" ? m.topic : undefined,
          }));
          return { mcqs, essayPrompt: d.essayPrompt };
        });
        return NextResponse.json({ ...parsed, round, done: round >= maxIterations });
      } catch (e) {
        captureException(e, { operation: "diagnostic-questions" });
        return NextResponse.json({ error: "Failed to generate diagnostic questions" }, { status: 500 });
      }
    }

    if (action === "evaluate") {
      const validation = evaluateSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
      }
      const { topic, mcqs, essayPrompt, essayResponse, round } = validation.data;

      const mcqScore = scoreMcqsFallback(mcqs);
      const weakTopics = deriveWeakTopicsFallback(mcqs);

      // Essay depth scoring via LLM (0-100)
      let essayDepthScore = 50;
      try {
        const res = await provider.generateText(
          `Score the depth of this learner response (0-100) as JSON {"depthScore": number}.\nTopic: ${topic}\nPrompt: ${essayPrompt}\nResponse: ${essayResponse}\nConsider correctness, depth of explanation, use of concepts, and misconceptions. Respond ONLY with JSON.`,
          {
            systemPrompt: "You are a strict but fair examiner. Respond ONLY with valid JSON.",
            maxTokens: 200,
            temperature: 0.3,
          }
        );
        essayDepthScore = parseAIJsonResponse(res.content, (p: unknown) => {
          const d = p as { depthScore?: unknown };
          const n = typeof d.depthScore === "number" ? d.depthScore : 50;
          return Math.max(0, Math.min(100, Math.round(n)));
        });
      } catch (e) {
        captureException(e, { operation: "diagnostic-essay-score" });
      }

      const essayScores = [essayDepthScore];
      const profile = buildProfileFallback(topic, mcqScore, essayScores, weakTopics);

      const done = round >= maxIterations;
      return NextResponse.json({
        mcqScore,
        essayDepthScore,
        weakTopics,
        knowledgeProfile: profile.summary,
        profile,
        done,
        nextRound: done ? null : round + 1,
      });
    }

    return NextResponse.json({ error: "Invalid action. Use 'questions' or 'evaluate'." }, { status: 400 });
  } catch (error) {
    captureException(error, { operation: "diagnostic error" });
    return NextResponse.json({ error: "Something went wrong. Please try again later." }, { status: 500 });
  }
}

function scoreMcqsFallback(mcqs: { userAnswer?: number; correctIndex: number }[]): number {
  const answered = mcqs.filter((m) => typeof m.userAnswer === "number");
  if (!answered.length) return 0;
  return Math.round((answered.filter((m) => m.userAnswer === m.correctIndex).length / answered.length) * 100);
}

function deriveWeakTopicsFallback(mcqs: { question: string; topic?: string; userAnswer?: number; correctIndex: number }[]): string[] {
  return mcqs
    .filter((m) => typeof m.userAnswer === "number" && m.userAnswer !== m.correctIndex)
    .map((m) => m.topic || m.question.slice(0, 80))
    .slice(0, 10);
}

function buildProfileFallback(topic: string, mcqScore: number, essayScores: number[], weakTopics: string[]) {
  const avg = essayScores.length ? essayScores.reduce((a, b) => a + b, 0) / essayScores.length : 0;
  const combined = Math.round(mcqScore * 0.6 + avg * 0.4);
  const depthLevel = combined >= 80 ? "deep" : combined >= 60 ? "solid" : combined >= 40 ? "developing" : "shallow";
  return {
    mcqScore,
    essayScores,
    weakTopics,
    strongTopics: [] as string[],
    depthLevel,
    summary: `Diagnostic for "${topic}": MCQ ${mcqScore}%, essay ${Math.round(avg)}% (${depthLevel}). Gaps: ${weakTopics.join("; ") || "none"}.`,
  };
}
