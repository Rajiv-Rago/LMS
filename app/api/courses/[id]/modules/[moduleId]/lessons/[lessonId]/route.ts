import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Module, Lesson } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { captureException } from "@/lib/logger";

const updateLessonSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  contentType: z.enum(["text", "video", "file"]).optional(),
  content: z.string().optional(),
  videoUrl: z.string().url().optional().nullable(),
  fileUrl: z.string().url().optional().nullable(),
  duration: z.number().min(0).optional().nullable(),
  order: z.number().min(0).optional(),
  isPublished: z.boolean().optional(),
  aiContext: z.string().max(10000).optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string; lessonId: string }> }
) {
  try {
    const { id, moduleId, lessonId } = await params;
    const user = await authenticate(request);

    await dbConnect();

    const course = await Course.findById(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const lesson = await Lesson.findOne({
      _id: lessonId,
      module: moduleId,
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const isInstructor = user && course.instructor.toString() === user.userId;
    const isAdmin = user?.role === "admin";

    if (!lesson.isPublished && !isInstructor && !isAdmin) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    return NextResponse.json({
      lesson,
      permissions: {
        canEdit: isInstructor || isAdmin,
      },
    });
  } catch (error) {
    captureException(error, { operation: "Get lesson error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string; lessonId: string }> }
) {
  try {
    const { id, moduleId, lessonId } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateLessonSchema.safeParse(body);

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

    if (course.instructor.toString() !== user.userId && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const lesson = await Lesson.findOne({ _id: lessonId, module: moduleId });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    Object.assign(lesson, validation.data);
    await lesson.save();

    return NextResponse.json({ lesson });
  } catch (error) {
    captureException(error, { operation: "Update lesson error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string; lessonId: string }> }
) {
  try {
    const { id, moduleId, lessonId } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const course = await Course.findById(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.instructor.toString() !== user.userId && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const module = await Module.findOne({ _id: moduleId, course: id });

    if (!module) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const lesson = await Lesson.findOne({ _id: lessonId, module: moduleId });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    module.lessons = module.lessons.filter(
      (l: { toString: () => string }) => l.toString() !== lessonId
    );
    await module.save();

    await lesson.deleteOne();

    return NextResponse.json({ message: "Lesson deleted successfully" });
  } catch (error) {
    captureException(error, { operation: "Delete lesson error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
