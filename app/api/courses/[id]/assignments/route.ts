import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Assignment } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { captureException } from "@/lib/logger";
import { parsePagination, paginationMeta } from "@/lib/utils/pagination";

const quizQuestionSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  options: z.array(z.string()).min(2).max(6),
  correctAnswer: z.number().min(0),
  explanation: z.string().optional(),
  points: z.number().min(0).default(1),
});

const quizSettingsSchema = z.object({
  timeLimit: z.number().min(1).max(480).optional(), // max 8 hours
  shuffleQuestions: z.boolean().default(false),
  showCorrectAnswers: z.boolean().default(true),
});

const projectSettingsSchema = z.object({
  maxFiles: z.number().min(1).max(20).default(5),
  maxFileSize: z.number().min(1).max(100 * 1024 * 1024).default(10 * 1024 * 1024), // max 100MB
  allowedFileTypes: z.array(z.string()).optional(),
});

const createAssignmentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(10000),
  moduleId: z.string().optional(),
  dueDate: z.string().datetime(),
  points: z.number().min(0).max(1000),
  submissionType: z.enum(["text", "file", "url"]).optional(),
  allowedFileTypes: z.array(z.string()).optional(),
  maxFileSize: z.number().min(0).optional(),
  isPublished: z.boolean().optional(),
  // New fields for quizzes and projects
  assignmentType: z.enum(["standard", "quiz", "project"]).default("standard"),
  questions: z.array(quizQuestionSchema).optional(),
  quizSettings: quizSettingsSchema.optional(),
  instructions: z.string().max(50000).optional(),
  projectSettings: projectSettingsSchema.optional(),
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

    if (!isInstructor && !isEnrolled && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let assignmentQuery: Record<string, unknown> = { course: id };
    if (!isInstructor && !isAdmin) {
      assignmentQuery.isPublished = true;
    }

    const { page, limit, skip } = parsePagination(request);

    const [assignments, total] = await Promise.all([
      Assignment.find(assignmentQuery)
        .populate("module", "title")
        .sort({ dueDate: 1 })
        .skip(skip)
        .limit(limit),
      Assignment.countDocuments(assignmentQuery),
    ]);

    return NextResponse.json({
      assignments,
      pagination: paginationMeta(total, page, limit),
    });
  } catch (error) {
    captureException(error, { operation: "Get assignments error" });
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
    const validation = createAssignmentSchema.safeParse(body);

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

    const { moduleId, ...assignmentData } = validation.data;

    const assignment = await Assignment.create({
      ...assignmentData,
      course: id,
      module: moduleId || undefined,
      dueDate: new Date(assignmentData.dueDate),
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (error) {
    captureException(error, { operation: "Create assignment error" });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
