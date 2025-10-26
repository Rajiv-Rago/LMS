// lib/db.ts

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;
if (!MONGODB_URI) throw new Error("Please set MONGODB_URI in .env");

declare global {
    // eslint-disable-next-line no-var
    var _mongoose: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> |null } | undefined;
}

let cached = global._mongoose ?? {conn: null, promise: null};
global._mongoose = cached;


export async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      // You can add options here if needed
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}