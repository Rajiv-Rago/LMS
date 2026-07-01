import type mongoose from "mongoose";

// Collapse the vestigial student/teacher split into a single "user" role.
// "admin" is preserved; course-level relationships (instructor/owner/
// enrolled/sharedWith) now carry all teaching-vs-learning meaning.
export async function up(db: typeof mongoose): Promise<void> {
  const users = db.connection.collection("users");

  const result = await users.updateMany(
    { role: { $in: ["student", "teacher"] } },
    { $set: { role: "user" } }
  );
  console.log(`    users: mapped role student|teacher→user on ${result.modifiedCount} documents`);
}

export async function down(db: typeof mongoose): Promise<void> {
  const users = db.connection.collection("users");

  // Irreversible split; restore everyone non-admin to the old default.
  await users.updateMany(
    { role: "user" },
    { $set: { role: "student" } }
  );
}
