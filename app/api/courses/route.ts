import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course } from "@/lib/models";
import { authenticate, requireCsrf } from "@/lib/auth";
import { captureException } from "@/lib/logger";
import * as cache from "@/lib/cache";
import { parsePagination, paginationMeta } from "@/lib/utils/pagination";
import { httpUrl } from "@/lib/validation/commonSchemas";

const createCourseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  coverImage: httpUrl.optional(),
  isPublished: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(request, { limit: 10 });
    const search = searchParams.get("search")?.slice(0, 200) || null;

    await dbConnect();

    let query: Record<string, unknown> = {};

    if (user) {
      if (user.role === "teacher") {
        const enrolled = searchParams.get("enrolled") === "true";
        if (enrolled) {
          query = { enrolledStudents: user.userId };
        } else {
          query = {
            $or: [
              { instructor: user.userId },
              { enrolledStudents: user.userId },
              { sharedWith: user.userId },
            ],
          };
        }
      } else if (user.role === "student") {
        query = {
          $or: [
            { enrolledStudents: user.userId },
            { isPublished: true, owner: { $exists: false } },
            { owner: user.userId },
            { sharedWith: user.userId },
          ],
        };
      } else if (user.role === "admin") {
        // Admin sees all courses
      }
    } else {
      query = { isPublished: true };
    }

    if (search) {
      query.$text = { $search: search };
    }

    // Cache unauthenticated published course listings
    const isPublicListing = !user && !search;
    const cacheKey = isPublicListing ? `courses:published:p${page}:l${limit}` : null;

    if (cacheKey) {
      const cached = cache.get<{ courses: unknown[]; pagination: unknown }>(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    const total = await Course.countDocuments(query);
    const courses = await Course.find(query)
      .populate("instructor", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const responseData = {
      courses,
      pagination: paginationMeta(total, page, limit),
    };

    if (cacheKey) {
      cache.set(cacheKey, responseData, 30);
    }

    return NextResponse.json(responseData);
  } catch (error) {
    captureException(error, { operation: "Get courses error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;

    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createCourseSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    if (user.role !== "teacher" && user.role !== "admin") {
      return NextResponse.json(
        { error: "Only teachers can create courses" },
        { status: 403 }
      );
    }

    await dbConnect();

    const courseData: Record<string, unknown> = {
      ...validation.data,
      instructor: user.userId,
    };

    const course = await Course.create(courseData);

    await course.populate("instructor", "name email");

    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    captureException(error, { operation: "Create course error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
