import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Module } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { captureException } from "@/lib/logger";
import { parsePagination, paginationMeta } from "@/lib/utils/pagination";

const createModuleSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  order: z.number().min(0).optional(),
  isPublished: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await authenticate(request);

    await dbConnect();

    const course = await Course.findById(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const isInstructor = user && course.instructor.toString() === user.userId;
    const isEnrolled =
      user &&
      course.enrolledStudents.some(
        (s: { toString: () => string }) => s.toString() === user.userId
      );
    const isAdmin = user?.role === "admin";

    if (!course.isPublished && !isInstructor && !isEnrolled && !isAdmin) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    let moduleQuery: Record<string, unknown> = { course: id };
    if (!isInstructor && !isAdmin) {
      moduleQuery.isPublished = true;
    }

    const { page, limit, skip } = parsePagination(request.nextUrl.searchParams, { limit: 50, maxLimit: 100 });

    const [modules, total] = await Promise.all([
      Module.find(moduleQuery)
        .populate("lessons")
        .sort({ order: 1 })
        .skip(skip)
        .limit(limit),
      Module.countDocuments(moduleQuery),
    ]);

    return NextResponse.json({ data: modules, pagination: paginationMeta(page, limit, total) });
  } catch (error) {
    captureException(error, { operation: "Get modules error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createModuleSchema.safeParse(body);

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

    const moduleCount = await Module.countDocuments({ course: id });
    const order = validation.data.order ?? moduleCount;

    const module = await Module.create({
      ...validation.data,
      course: id,
      order,
    });

    course.modules.push(module._id);
    await course.save();

    return NextResponse.json({ module }, { status: 201 });
  } catch (error) {
    captureException(error, { operation: "Create module error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
