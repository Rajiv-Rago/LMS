import type mongoose from "mongoose";

export async function up(db: typeof mongoose) {
  const users = db.connection.collection("users");
  const aiusages = db.connection.collection("aiusages");

  // 1. Add subscriptionTier: "free" to all users that don't have it
  const defaultResult = await users.updateMany(
    { subscriptionTier: { $exists: false } },
    { $set: { subscriptionTier: "free" } }
  );
  console.log(`    users: set subscriptionTier=free on ${defaultResult.modifiedCount} documents`);

  // 2. Set admin users to subscriptionTier: "admin"
  const adminResult = await users.updateMany(
    { role: "admin" },
    { $set: { subscriptionTier: "admin" } }
  );
  console.log(`    users: set subscriptionTier=admin on ${adminResult.modifiedCount} admin documents`);

  // 3. Migrate AIUsage categories: chat → questions
  const chatResult = await aiusages.updateMany(
    { category: "chat" },
    { $set: { category: "questions" } }
  );
  console.log(`    aiusages: migrated ${chatResult.modifiedCount} "chat" → "questions"`);

  // 4. Migrate AIUsage categories: generate, course_generation → credits
  const genResult = await aiusages.updateMany(
    { category: { $in: ["generate", "course_generation"] } },
    { $set: { category: "credits" } }
  );
  console.log(`    aiusages: migrated ${genResult.modifiedCount} "generate"/"course_generation" → "credits"`);
}
