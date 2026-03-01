import type mongoose from "mongoose";

export async function up(db: typeof mongoose): Promise<void> {
  const users = db.connection.collection("users");

  const fastResult = await users.updateMany(
    { "aiPreferences.defaultTier": "fast" },
    { $set: { "aiPreferences.defaultTier": "concise" } }
  );
  console.log(`    users: renamed tier fast→concise on ${fastResult.modifiedCount} documents`);

  const powerfulResult = await users.updateMany(
    { "aiPreferences.defaultTier": "powerful" },
    { $set: { "aiPreferences.defaultTier": "thorough" } }
  );
  console.log(`    users: renamed tier powerful→thorough on ${powerfulResult.modifiedCount} documents`);
}

export async function down(db: typeof mongoose): Promise<void> {
  const users = db.connection.collection("users");

  await users.updateMany(
    { "aiPreferences.defaultTier": "concise" },
    { $set: { "aiPreferences.defaultTier": "fast" } }
  );

  await users.updateMany(
    { "aiPreferences.defaultTier": "thorough" },
    { $set: { "aiPreferences.defaultTier": "powerful" } }
  );
}
