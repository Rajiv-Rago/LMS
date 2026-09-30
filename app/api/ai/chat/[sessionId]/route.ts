import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { AIChatSession, Course } from "@/lib/models";
import { authenticate, requireCsrf } from "@/lib/auth";
import { getCoursePermissions } from "@/lib/auth/coursePermissions";
import { validateObjectId } from "@/lib/utils/validateObjectId";
import { captureException } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const invalid = validateObjectId(sessionId, "Session ID");
    if (invalid) return invalid;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const session = await AIChatSession.findOne({
      _id: sessionId,
      user: user.userId,
    })
      .populate("course", "title")
      .populate("lesson", "title");

    if (!session) {
      return NextResponse.json(
        { error: "Chat session not found" },
        { status: 404 }
      );
    }

    const course = await Course.findById(session.course._id);
    if (!course || !(await getCoursePermissions(course, user)).canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ session });
  } catch (error) {
    captureException(error, { operation: "Get chat session error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const { sessionId } = await params;
    const invalid = validateObjectId(sessionId, "Session ID");
    if (invalid) return invalid;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const session = await AIChatSession.findOne({
      _id: sessionId,
      user: user.userId,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Chat session not found" },
        { status: 404 }
      );
    }

    await session.deleteOne();

    return NextResponse.json({ message: "Session deleted successfully" });
  } catch (error) {
    captureException(error, { operation: "Delete chat session error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
