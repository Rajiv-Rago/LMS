import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course } from "@/lib/models";
import { authenticate, JWTPayload } from "@/lib/auth";

const createCourseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  coverImage: z.string().url().optional(),
  isPublished: z.boolean().optional(),
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
          $or: [{ enrolledStudents: user.userId }, { isPublished: true }],
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

    const total = await Course.countDocuments(query);
    const courses = await Course.find(query)
      .populate("instructor", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return NextResponse.json({
      courses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get courses error:", error);
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

    if (user.role !== "teacher" && user.role !== "admin") {
      return NextResponse.json(
        { error: "Only teachers can create courses" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createCourseSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    await dbConnect();

    const course = await Course.create({
      ...validation.data,
      instructor: user.userId,
    });

    await course.populate("instructor", "name email");

    return NextResponse.json({ course }, { status: 201 });
  } catch (error) {
    console.error("Create course error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
