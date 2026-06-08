import { z } from "zod";

const envSchema = z.object({
  // Required
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters").optional(),

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

  // Storage provider
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),

  // Queue
  QUEUE_ENABLED: z.string().default("false").transform(v => v === "true"),
  REDIS_URL: z.string().optional(),

  // AI rate limiting
  AI_RATE_LIMIT_ENABLED: z.string().default("true").transform(v => v === "true"),

  // Email
  EMAIL_PROVIDER: z.enum(["console", "sendgrid", "ses", "resend"]).default("console"),
  EMAIL_FROM_ADDRESS: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),

  // App
  APP_URL: z.string().default("http://localhost:3000"),
  APP_NAME: z.string().default("Kantigo"),

  // YouTube
  YOUTUBE_API_KEY: z.string().optional(),

  // Axiom logging
  NEXT_PUBLIC_AXIOM_DATASET: z.string().optional(),
  NEXT_PUBLIC_AXIOM_TOKEN: z.string().optional(),

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
