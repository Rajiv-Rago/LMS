import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";
import {
  learnerProfileSchema,
  MAX_INTAKE_QUESTIONS,
  MAX_INTAKE_ROUNDS,
} from "./profile";

export const questionSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  options: z
    .array(z.string().trim().min(1).max(500))
    .length(4)
    .refine(
      (options) => new Set(options).size === 4,
      "Options must be distinct",
    ),
  correctIndex: z.number().int().min(0).max(3),
  topic: z.string().trim().min(1).max(200),
});
const sessionSchema = z.object({
  userId: z.string(),
  expiresAt: z.number(),
  topic: z.string().max(500),
  context: z.string().max(5000),
  round: z.number().int().min(1).max(MAX_INTAKE_ROUNDS),
  questionCount: z.number().int().min(2).max(MAX_INTAKE_QUESTIONS),
  goalOptions: z.array(z.string().max(300)).max(6),
  profile: learnerProfileSchema.optional(),
  observations: z
    .array(
      z.object({ topic: z.string().max(200), correct: z.boolean().nullable() }),
    )
    .max(5),
  questions: z.array(questionSchema).max(3),
});
export type IntakeSession = z.infer<typeof sessionSchema>;
const sign = (value: string) =>
  createHmac("sha256", env.AUTH_SECRET)
    .update(`course-intake:${value}`)
    .digest();

// Signed state keeps counters and answer keys server-controlled without a new DB
// collection. Bind to the authenticated learner and expire after an hour.
export function encodeSession(session: IntakeSession): string {
  const payload = Buffer.from(
    JSON.stringify(sessionSchema.parse(session)),
  ).toString("base64url");
  return `${payload}.${sign(payload).toString("base64url")}`;
}
export function decodeSession(token: string, userId: string): IntakeSession {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra)
    throw new Error("Invalid intake session");
  const expected = sign(payload),
    received = Buffer.from(signature, "base64url");
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    throw new Error("Invalid intake session");
  const session = sessionSchema.parse(
    JSON.parse(Buffer.from(payload, "base64url").toString()),
  );
  if (session.userId !== userId || session.expiresAt < Date.now())
    throw new Error("Intake session expired. Please start again.");
  return session;
}
