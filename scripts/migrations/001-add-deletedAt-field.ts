import type mongoose from "mongoose";

export async function up(db: typeof mongoose) {
  const collections = ["courses", "assignments", "submissions", "users"];

  for (const name of collections) {
    const collection = db.connection.collection(name);
    const result = await collection.updateMany(
      { deletedAt: { $exists: false } },
      { $set: { deletedAt: null } }
    );
    console.log(`    ${name}: updated ${result.modifiedCount} documents`);
  }
}
