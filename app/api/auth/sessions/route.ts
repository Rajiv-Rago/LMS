import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import AuthSession from "@/lib/models/AuthSession";
import { authenticate, requireCsrf } from "@/lib/auth";
import { captureException } from "@/lib/logger";
import { parsePagination, paginationMeta } from "@/lib/utils/pagination";
import { logAuditEvent } from "@/lib/auth/auditLog";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const { page, limit, skip } = parsePagination(request);

    const query = {
      userId: user.userId,
      expiresAt: { $gt: new Date() },
    };

    const [sessions, total] = await Promise.all([
      AuthSession.find(query)
        .select("ip userAgent lastActiveAt expiresAt createdAt sessionId")
        .sort({ lastActiveAt: -1 })
        .skip(skip)
        .limit(limit),
      AuthSession.countDocuments(query),
    ]);

    return NextResponse.json({
      data: sessions.map((s) => ({
        id: s._id,
        ip: s.ip,
        userAgent: s.userAgent,
        lastActiveAt: s.lastActiveAt,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
        isCurrent: s.sessionId === user.sessionId,
      })),
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    captureException(error, { operation: "List sessions error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    await AuthSession.deleteMany({ userId: user.userId });

    await logAuditEvent(request, {
      userId: user.userId,
      action: "session.revoked",
      resource: "session",
      metadata: { all: true },
    });

    return NextResponse.json({ message: "All sessions revoked" });
  } catch (error) {
    captureException(error, { operation: "Revoke all sessions error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
