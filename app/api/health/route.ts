import { NextResponse } from "next/server";
import { dbConnect, getConnectionStatus } from "@/lib/db";
import { version } from "../../../package.json";

export async function GET() {
  // Eagerly attempt connection so we report real failures, not just lazy-init state
  try {
    await dbConnect();
  } catch {
    // Connection failed — getConnectionStatus() will reflect this
  }

  const db = getConnectionStatus();
  const isHealthy = db === "connected";

  return NextResponse.json(
    {
      status: isHealthy ? "ok" : "degraded",
      version,
      uptime: Math.floor(process.uptime()),
      db,
    },
    { status: isHealthy ? 200 : 503 }
  );
}
