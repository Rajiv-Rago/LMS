import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Module, Lesson } from "@/lib/models";
import { authenticate, requireCsrf } from "@/lib/auth";
import { captureException } from "@/lib/logger";
import { httpUrl } from "@/lib/validation/commonSchemas";

const createLessonSchema = z.object({
  title: z.string().min(1).max(200),
  contentType: z.enum(["text", "video", "file"]).optional(),
  content: z.string().optional(),
  videoUrl: httpUrl.optional(),
  fileUrl: httpUrl.optional(),
  duration: z.number().min(0).optional(),
  order: z.number().min(0).optional(),
  isPublished: z.boolean().optional(),
  aiContext: z.string().max(10000).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  try {
    const { id, moduleId } = await params;
    const user = await authenticate(request);

    await dbConnect();

    const course = await Course.findById(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const moduleDoc = await Module.findOne({ _id: moduleId, course: id });

    if (!moduleDoc) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const isInstructor = user && (course.instructor.toString() === user.userId || course.owner?.toString() === user.userId);
    const isAdmin = user?.role === "admin";

    const lessonQuery: Record<string, unknown> = { module: moduleId };
    if (!isInstructor && !isAdmin) {
      lessonQuery.isPublished = true;
    }

    const lessons = await Lesson.find(lessonQuery).sort({ order: 1 });

    return NextResponse.json({ lessons });
  } catch (error) {
    captureException(error, { operation: "Get lessons error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const { id, moduleId } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createLessonSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    await dbConnect();

    const course = await Course.findById(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const isAuthorized =
      course.instructor.toString() === user.userId ||
      course.owner?.toString() === user.userId ||
      user.role === "admin";
    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const moduleDoc = await Module.findOne({ _id: moduleId, course: id });

    if (!moduleDoc) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const lessonCount = await Lesson.countDocuments({ module: moduleId });
    const order = validation.data.order ?? lessonCount;

    const lesson = await Lesson.create({
      ...validation.data,
      module: moduleId,
      order,
    });

    moduleDoc.lessons.push(lesson._id);
    await moduleDoc.save();

    return NextResponse.json({ lesson }, { status: 201 });
  } catch (error) {
    captureException(error, { operation: "Create lesson error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
