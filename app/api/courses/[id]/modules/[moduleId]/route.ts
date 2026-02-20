import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Module } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { captureException } from "@/lib/logger";

const updateModuleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  order: z.number().min(0).optional(),
  isPublished: z.boolean().optional(),
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

    const module = await Module.findOne({
      _id: moduleId,
      course: id,
    }).populate("lessons");

    if (!module) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const isInstructor = user && course.instructor.toString() === user.userId;
    const isAdmin = user?.role === "admin";

    if (!module.isPublished && !isInstructor && !isAdmin) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    return NextResponse.json({
      module,
      permissions: {
        canEdit: isInstructor || isAdmin,
      },
    });
  } catch (error) {
    captureException(error, { operation: "Get module error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  try {
    const { id, moduleId } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateModuleSchema.safeParse(body);

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

    const module = await Module.findOne({ _id: moduleId, course: id });

    if (!module) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    Object.assign(module, validation.data);
    await module.save();

    return NextResponse.json({ module });
  } catch (error) {
    captureException(error, { operation: "Update module error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; moduleId: string }> }
) {
  try {
    const { id, moduleId } = await params;
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

    course.modules = course.modules.filter(
      (m: { toString: () => string }) => m.toString() !== moduleId
    );
    await course.save();

    await module.deleteOne();

    return NextResponse.json({ message: "Module deleted successfully" });
  } catch (error) {
    captureException(error, { operation: "Delete module error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
