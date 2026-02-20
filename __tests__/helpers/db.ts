import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer: MongoMemoryServer | null = null;

/**
 * Connect to an in-memory test database.
 * Patches the global mongoose cache used by lib/db.ts's dbConnect(),
 * so route handlers that call dbConnect() reuse the test connection.
 */
export async function connectTestDb(): Promise<void> {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  // Point env vars to the in-memory URI
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_URI_TEST = uri;

  await mongoose.connect(uri);

  // IMPORTANT: Mutate the existing global._mongoose object in place,
  // because lib/db.ts captures a local reference to it at import time.
  // Creating a new object would leave the old reference stale.
  if (!global._mongoose) {
    global._mongoose = { conn: null, promise: null };
  }
  global._mongoose.conn = mongoose;
  global._mongoose.promise = Promise.resolve(mongoose);
}

/**
 * Drop all collections between tests to ensure isolation.
 */
export async function clearTestDb(): Promise<void> {
  if (mongoose.connection.readyState !== 1) return;

  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

/**
 * Close the mongoose connection and stop the in-memory server.
 */
export async function disconnectTestDb(): Promise<void> {
  // Reset the cached connection from lib/db.ts
  if (global._mongoose) {
    global._mongoose.conn = null;
    global._mongoose.promise = null;
  }

  await mongoose.disconnect();

  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}
