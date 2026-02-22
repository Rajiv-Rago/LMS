import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course } from "@/lib/models";
import { authenticate, JWTPayload } from "@/lib/auth";
import { captureException } from "@/lib/logger";
import * as cache from "@/lib/cache";

const createCourseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  coverImage: z.string().url().optional(),
  isPublished: z.boolean().optional(),
  courseType: z.enum(["standard", "ai-generated"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search");

    await dbConnect();

    let query: Record<string, unknown> = {};

    if (user) {
      if (user.role === "teacher") {
        const enrolled = searchParams.get("enrolled") === "true";
        if (enrolled) {
          query = { enrolledStudents: user.userId };
        } else {
          query = {
            $or: [{ instructor: user.userId }, { enrolledStudents: user.userId }],
          };
        }
      } else if (user.role === "student") {
        query = {
          $or: [
            { enrolledStudents: user.userId },
            { isPublished: true, courseType: { $ne: "ai-generated" } },
            { courseType: "ai-generated", owner: user.userId },
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
      .skip((page - 1) * limit)
      .limit(limit);

    const responseData = {
      courses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
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

    const isAICourse = validation.data.courseType === "ai-generated";

    if (!isAICourse && user.role !== "teacher" && user.role !== "admin") {
      return NextResponse.json(
        { error: "Only teachers can create standard courses" },
        { status: 403 }
      );
    }

    await dbConnect();

    const courseData: Record<string, unknown> = {
      ...validation.data,
      instructor: user.userId,
    };

    if (isAICourse) {
      courseData.owner = user.userId;
    }

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
