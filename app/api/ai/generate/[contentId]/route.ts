import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, AIGeneratedContent } from "@/lib/models";
import Enrollment from "@/lib/models/Enrollment";
import { authenticate, requireCsrf } from "@/lib/auth";
import { captureException } from "@/lib/logger";

const approvalSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  rejectionReason: z.string().max(1000).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const { contentId } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const content = await AIGeneratedContent.findById(contentId)
      .populate("course", "title")
      .populate("lesson", "title")
      .populate("generatedBy", "name")
      .populate("approvedBy", "name");

    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const course = await Course.findById(content.course._id);
    const isInstructor = course && course.instructor.toString() === user.userId;
    const isEnrolled = course ? await Enrollment.isEnrolled(course._id, user.userId) : false;

    if (!isInstructor && !isEnrolled && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (content.approvalStatus !== "approved" && !isInstructor && user.role !== "admin") {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    return NextResponse.json({
      content,
      permissions: {
        canApprove: isInstructor || user.role === "admin",
        canDelete: isInstructor || user.role === "admin",
      },
    });
  } catch (error) {
    captureException(error, { operation: "Get generated content error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const { contentId } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = approvalSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    await dbConnect();

    const content = await AIGeneratedContent.findById(contentId);

    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const course = await Course.findById(content.course);
    const isInstructor = course && course.instructor.toString() === user.userId;

    if (!isInstructor && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    content.approvalStatus = validation.data.status;
    if (validation.data.status === "approved") {
      content.approvedBy = user.userId as unknown as typeof content.approvedBy;
      content.approvedAt = new Date();
    } else if (validation.data.status === "rejected") {
      content.rejectionReason = validation.data.rejectionReason;
    }

    await content.save();

    return NextResponse.json({ content });
  } catch (error) {
    captureException(error, { operation: "Update generated content error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contentId: string }> }
) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const { contentId } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const content = await AIGeneratedContent.findById(contentId);

    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const course = await Course.findById(content.course);
    const isInstructor = course && course.instructor.toString() === user.userId;

    if (!isInstructor && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await content.deleteOne();

    return NextResponse.json({ message: "Content deleted successfully" });
  } catch (error) {
    captureException(error, { operation: "Delete generated content error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
