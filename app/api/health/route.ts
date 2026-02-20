import { NextResponse } from "next/server";
import { getConnectionStatus } from "@/lib/db";

const startTime = Date.now();

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require("../../../package.json");

export async function GET() {
  const db = getConnectionStatus();

  return NextResponse.json({
    status: db === "connected" ? "ok" : "degraded",
    version,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    db,
  });
}
