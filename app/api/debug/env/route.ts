import { NextResponse } from "next/server";
import { createAIProvider } from "@/lib/ai";

// Temporary diagnostic endpoint — DELETE after debugging
export async function GET() {
  const keys = [
    "GROQ_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "CEREBRAS_API_KEY",
    "AI_PROVIDER",
    "AI_MODEL",
    "YOUTUBE_API_KEY",
    "QUEUE_ENABLED",
  ];

  const status: Record<string, string> = {};
  for (const key of keys) {
    const val = process.env[key];
    if (!val) {
      status[key] = "NOT SET";
    } else {
      status[key] = `${val.slice(0, 4)}...  (${val.length} chars)`;
    }
  }

  // Test Groq API call
  let groqTest = "SKIPPED";
  if (process.env.GROQ_API_KEY) {
    try {
      const provider = createAIProvider({
        provider: "groq",
        apiKey: process.env.GROQ_API_KEY,
        model: "llama-3.3-70b-versatile",
      });
      const response = await provider.generateText("Say hello in one word.");
      groqTest = `OK — response: ${response.content.slice(0, 50)}`;
    } catch (err) {
      groqTest = `FAILED — ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return NextResponse.json({
    env: status,
    groqTest,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}
