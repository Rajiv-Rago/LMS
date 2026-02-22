import "dotenv/config";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  // Ensure migrations collection exists
  const Migration =
    mongoose.models.Migration ||
    mongoose.model(
      "Migration",
      new mongoose.Schema({
        name: { type: String, required: true, unique: true },
        executedAt: { type: Date, default: Date.now },
      })
    );

  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) {
    console.log("No migrations directory found. Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".js"))
    .sort();

  if (files.length === 0) {
    console.log("No migration files found.");
    await mongoose.disconnect();
    return;
  }

  const executed = await Migration.find({}).lean();
  const executedNames = new Set(executed.map((m: Record<string, unknown>) => m.name as string));

  let ranCount = 0;
  for (const file of files) {
    const name = path.basename(file, path.extname(file));
    if (executedNames.has(name)) {
      console.log(`  SKIP: ${name} (already executed)`);
      continue;
    }

    console.log(`  RUN:  ${name}`);
    const migration = await import(path.join(migrationsDir, file));
    await migration.up(mongoose);
    await Migration.create({ name });
    ranCount++;
  }

  console.log(`\nDone. ${ranCount} migration(s) executed.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
