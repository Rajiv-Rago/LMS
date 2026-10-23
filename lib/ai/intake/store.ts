import { randomUUID } from "node:crypto";
import mongoose, { Schema } from "mongoose";
import { dbConnect } from "@/lib/db";
import { sessionSchema, type IntakeSession } from "./session";

const schema = new Schema({
  _id: { type: String, required: true },
  userId: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revision: { type: Number, required: true },
  state: { type: Schema.Types.Mixed, required: true },
}, { versionKey: false });
const Assessment = mongoose.models.LearnerAssessment || mongoose.model("LearnerAssessment", schema);
export interface StoredAssessment { token: string; revision: number; state: IntakeSession }
// BSON can turn explicit undefined values in Mixed updates into null. Omit them
// before persistence so optional fields retain the same meaning after resume.
function validatedJsonState(state: IntakeSession): IntakeSession {
  return JSON.parse(JSON.stringify(sessionSchema.parse(state))) as IntakeSession;
}

export async function createAssessment(state: IntakeSession): Promise<StoredAssessment> {
  await dbConnect();
  const token = randomUUID();
  const validated = validatedJsonState(state);
  await Assessment.create({ _id: token, userId: state.userId, expiresAt: new Date(state.expiresAt), revision: 0, state: validated });
  return { token, revision: 0, state: validated };
}
export async function loadAssessment(token: string, userId: string): Promise<StoredAssessment | null> {
  await dbConnect();
  const row = await Assessment.findOne({ _id: token, userId, expiresAt: { $gt: new Date() } }).lean();
  if (!row) return null;
  const data = row as unknown as { revision: number; state: unknown };
  return { token, revision: data.revision, state: sessionSchema.parse(data.state) };
}
// A stale or concurrent submission cannot advance counters or replace newer answers.
export async function saveAssessment(previous: StoredAssessment, state: IntakeSession): Promise<StoredAssessment | null> {
  await dbConnect();
  const validated = validatedJsonState(state);
  const result = await Assessment.updateOne({ _id: previous.token, userId: state.userId, revision: previous.revision, expiresAt: { $gt: new Date() } }, {
    $set: { state: validated }, $inc: { revision: 1 },
  });
  return result.modifiedCount === 1 ? { token: previous.token, revision: previous.revision + 1, state: validated } : null;
}
