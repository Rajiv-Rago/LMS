import { z } from "zod";

const envSchema = z.object({
  // Required
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),

  // Optional with defaults
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  AI_PROVIDER: z.string().default("openai"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // Optional AI keys (no default)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  CEREBRAS_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),

  // Optional storage vars (no default)
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  // Optional queue vars (no default)
  REDIS_URL: z.string().optional(),

  // Optional test DB
  MONGODB_URI_TEST: z.string().optional(),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Environment validation failed:\n${formatted}\n\nCheck your .env file.`
    );
  }

  return result.data;
}

export const env = validateEnv();

export type Env = z.infer<typeof envSchema>;
