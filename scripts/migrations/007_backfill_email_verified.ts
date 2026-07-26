import type mongoose from "mongoose";

// Existing users predate the email-verification requirement; treat them as
// verified so launch doesn't lock them out of AI generation and publishing.
export async function up(db: typeof mongoose): Promise<void> {
  const users = db.connection.collection("users");
  const cutoff = new Date();

  const result = await users.updateMany(
    { emailVerifiedAt: { $exists: false } },
    [{ $set: { emailVerifiedAt: { $ifNull: ["$createdAt", cutoff] } } }]
  );
  console.log(`    users: backfilled emailVerifiedAt on ${result.modifiedCount} documents`);
}

export async function down(db: typeof mongoose): Promise<void> {
  const users = db.connection.collection("users");
  await users.updateMany({}, { $unset: { emailVerifiedAt: "" } });
}
