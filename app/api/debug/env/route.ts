import { NextResponse } from "next/server";

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
  ];

  const status: Record<string, string> = {};
  for (const key of keys) {
    const val = process.env[key];
    if (!val) {
      status[key] = "NOT SET";
    } else {
      // Show first 4 chars + length, never the full value
      status[key] = `${val.slice(0, 4)}...  (${val.length} chars)`;
    }
  }

  return NextResponse.json({
    env: status,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
}
