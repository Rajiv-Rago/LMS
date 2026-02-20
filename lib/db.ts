// lib/db.ts

import mongoose from "mongoose";
import { env } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var _mongoose:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
}

const cached = global._mongoose ?? { conn: null, promise: null };
global._mongoose = cached;

export class DatabaseConnectionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "DatabaseConnectionError";
  }
}

/**
 * Returns the current Mongoose connection readyState.
 * 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
 */
export function getConnectionStatus(): "connected" | "disconnected" | "connecting" {
  const state = mongoose.connection.readyState;
  switch (state) {
    case 1:
      return "connected";
    case 2:
      return "connecting";
    default:
      return "disconnected";
  }
}

export async function dbConnect() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(env.MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // Fail fast after 5 seconds
      connectTimeoutMS: 10000,
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    // Reset the cached promise so next attempt can retry
    cached.promise = null;
    cached.conn = null;

    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("whitelist") || message.includes("IP")) {
      throw new DatabaseConnectionError(
        "Database connection failed: IP address not whitelisted in MongoDB Atlas",
        error
      );
    }

    throw new DatabaseConnectionError(
      "Database connection failed. Please check your connection settings.",
      error
    );
  }
}
