import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Module } from "@/lib/models";
import { authenticate, requireCsrf } from "@/lib/auth";
import { getCoursePermissions } from "@/lib/auth/coursePermissions";
import { validateObjectId } from "@/lib/utils/validateObjectId";
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
    const invalidId = validateObjectId(id, "Course ID");
    if (invalidId) return invalidId;

    const user = await authenticate(request);

    await dbConnect();

    const course = await Course.findById(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const perms = user ? await getCoursePermissions(course, user) : null;

    if (!course.isPublished && (!perms || !perms.canView)) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const moduleQuery: Record<string, unknown> = { course: id };
    if (!perms?.canEdit) {
      moduleQuery.isPublished = true;
    }

    const { page, limit, skip } = parsePagination(request, { limit: 50 });

    const [modules, total] = await Promise.all([
      Module.find(moduleQuery)
        .populate("lessons")
        .sort({ order: 1 })
        .skip(skip)
        .limit(limit),
      Module.countDocuments(moduleQuery),
    ]);

    return NextResponse.json({
      modules,
      pagination: paginationMeta(total, page, limit),
    });
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
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const { id } = await params;
    const invalidId = validateObjectId(id, "Course ID");
    if (invalidId) return invalidId;

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

    const perms = await getCoursePermissions(course, user);

    if (!perms.canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const moduleCount = await Module.countDocuments({ course: id });
    const order = validation.data.order ?? moduleCount;

    const newModule = await Module.create({
      ...validation.data,
      course: id,
      order,
    });

    course.modules.push(newModule._id);
    await course.save();

    return NextResponse.json({ module: newModule }, { status: 201 });
  } catch (error) {
    captureException(error, { operation: "Create module error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
