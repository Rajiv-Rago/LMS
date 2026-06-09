import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import AuthSession from "@/lib/models/AuthSession";
import { authenticate, requireCsrf } from "@/lib/auth";
import { logAuditEvent } from "@/lib/auth/auditLog";
import { captureException } from "@/lib/logger";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid session ID" },
        { status: 400 }
      );
    }

    await dbConnect();

    const session = await AuthSession.findOneAndDelete({
      _id: id,
      userId: user.userId,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    await logAuditEvent(request, {
      userId: user.userId,
      action: "session.revoked",
      resource: "session",
      resourceId: id,
    });

    return NextResponse.json({
      message: "Session revoked",
      revokedCurrent: session.sessionId === user.sessionId,
    });
  } catch (error) {
    captureException(error, { operation: "Revoke session error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
