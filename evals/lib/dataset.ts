import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { TopicsDataset } from "./types";

const TopicSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  targetLevel: z.enum(["beginner", "intermediate", "advanced"]),
  estimatedDuration: z.string().min(1),
  domain: z.enum(["technical", "stem", "humanities", "practical"]),
  mustCoverTopics: z.array(z.string().min(1)).min(1),
});

const TopicsDatasetSchema = z.object({
  version: z.string().min(1),
  topics: z.array(TopicSchema).min(1),
});

export function loadDataset(path: string): TopicsDataset {
  const abs = resolve(process.cwd(), path);
  const raw = readFileSync(abs, "utf-8");
  const json = JSON.parse(raw);
  const parsed = TopicsDatasetSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Invalid topics dataset at ${abs}:\n${JSON.stringify(parsed.error.format(), null, 2)}`
    );
  }
  const ids = parsed.data.topics.map((t) => t.id);
  const dupes = ids.filter((id, idx) => ids.indexOf(id) !== idx);
  if (dupes.length > 0) {
    throw new Error(`Duplicate topic ids in dataset: ${dupes.join(", ")}`);
  }
  return parsed.data;
}
