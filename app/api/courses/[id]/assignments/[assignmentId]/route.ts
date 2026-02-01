import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Assignment, Submission } from "@/lib/models";
import { authenticate } from "@/lib/auth";

const quizQuestionSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  options: z.array(z.string()).min(2).max(6),
  correctAnswer: z.number().min(0),
  explanation: z.string().optional(),
  points: z.number().min(0).default(1),
});

const quizSettingsSchema = z.object({
  timeLimit: z.number().min(1).max(480).optional(),
  shuffleQuestions: z.boolean().optional(),
  showCorrectAnswers: z.boolean().optional(),
});

const projectSettingsSchema = z.object({
  maxFiles: z.number().min(1).max(20).optional(),
  maxFileSize: z.number().min(1).max(100 * 1024 * 1024).optional(),
  allowedFileTypes: z.array(z.string()).optional(),
});

const updateAssignmentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(10000).optional(),
  moduleId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional(),
  points: z.number().min(0).max(1000).optional(),
  submissionType: z.enum(["text", "file", "url"]).optional(),
  allowedFileTypes: z.array(z.string()).optional(),
  maxFileSize: z.number().min(0).optional(),
  isPublished: z.boolean().optional(),
  // Quiz and project fields
  assignmentType: z.enum(["standard", "quiz", "project"]).optional(),
  questions: z.array(quizQuestionSchema).optional(),
  quizSettings: quizSettingsSchema.optional(),
  instructions: z.string().max(50000).optional(),
  projectSettings: projectSettingsSchema.optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const { id, assignmentId } = await params;
    const user = await authenticate(request);

    await dbConnect();

    const course = await Course.findById(id);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const assignment = await Assignment.findOne({
      _id: assignmentId,
      course: id,
    }).populate("module", "title");

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    const isInstructor = user && course.instructor.toString() === user.userId;
    const isEnrolled =
      user &&
      course.enrolledStudents.some(
        (s: { toString: () => string }) => s.toString() === user.userId
      );
    const isAdmin = user?.role === "admin";

    if (!assignment.isPublished && !isInstructor && !isAdmin) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    if (!isInstructor && !isEnrolled && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let submission = null;
    if (user && !isInstructor) {
      submission = await Submission.findOne({
        assignment: assignmentId,
        student: user.userId,
      });
    }

    // Prepare assignment data for response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assignmentData: any = assignment.toObject();

    // For students viewing a quiz, strip correct answers from questions
    if (
      assignment.assignmentType === "quiz" &&
      !isInstructor &&
      !isAdmin &&
      assignment.questions
    ) {
      // Strip correctAnswer and explanation from questions for student view
      assignmentData.questions = assignment.questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        points: q.points,
      }));
    }

    return NextResponse.json({
      assignment: assignmentData,
      submission,
      permissions: {
        canEdit: isInstructor || isAdmin,
        canSubmit: isEnrolled && !isInstructor,
        canGrade: isInstructor || isAdmin,
      },
    });
  } catch (error) {
    console.error("Get assignment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const { id, assignmentId } = await params;
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateAssignmentSchema.safeParse(body);

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

    const assignment = await Assignment.findOne({
      _id: assignmentId,
      course: id,
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    const { moduleId, dueDate, ...updateData } = validation.data;

    if (moduleId !== undefined) {
      assignment.module = (moduleId || undefined) as typeof assignment.module;
    }
    if (dueDate) {
      assignment.dueDate = new Date(dueDate);
    }
    Object.assign(assignment, updateData);

    await assignment.save();

    return NextResponse.json({ assignment });
  } catch (error) {
    console.error("Update assignment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  try {
    const { id, assignmentId } = await params;
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

    const assignment = await Assignment.findOne({
      _id: assignmentId,
      course: id,
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    await Submission.deleteMany({ assignment: assignmentId });
    await assignment.deleteOne();

    return NextResponse.json({ message: "Assignment deleted successfully" });
  } catch (error) {
    console.error("Delete assignment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
