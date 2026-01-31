import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Lesson, AIGeneratedContent } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { getDefaultProvider, getProviderName } from "@/lib/ai";
import { AIContentGenerator } from "@/lib/ai/services/generator";

const generateSchema = z.object({
  courseId: z.string(),
  lessonId: z.string().optional(),
  contentType: z.enum(["quiz", "summary", "practice", "flashcards"]),
  options: z
    .object({
      numQuestions: z.number().min(1).max(20).optional(),
      numProblems: z.number().min(1).max(10).optional(),
      numCards: z.number().min(1).max(30).optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "teacher" && user.role !== "admin") {
      return NextResponse.json(
        { error: "Only teachers can generate content" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = generateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { courseId, lessonId, contentType, options } = validation.data;

    await dbConnect();

    const course = await Course.findById(courseId);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.instructor.toString() !== user.userId && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let lesson = null;
    if (lessonId) {
      lesson = await Lesson.findById(lessonId);
      if (!lesson) {
        return NextResponse.json(
          { error: "Lesson not found" },
          { status: 404 }
        );
      }
    }

    const provider = getDefaultProvider();
    const generator = new AIContentGenerator(provider);

    const context = {
      courseName: course.title,
      lessonTitle: lesson?.title,
      lessonContent: lesson?.content,
      aiContext: lesson?.aiContext,
    };

    let result;
    switch (contentType) {
      case "quiz":
        result = await generator.generateQuiz(context, options?.numQuestions || 5);
        break;
      case "summary":
        result = await generator.generateSummary(context);
        break;
      case "practice":
        result = await generator.generatePracticeProblems(
          context,
          options?.numProblems || 5
        );
        break;
      case "flashcards":
        result = await generator.generateFlashcards(context, options?.numCards || 10);
        break;
    }

    const providerName = getProviderName();

    const generatedContent = await AIGeneratedContent.create({
      course: courseId,
      lesson: lessonId,
      generatedBy: user.userId,
      contentType,
      title: result.title,
      content: result.content,
      quizQuestions: result.type === "quiz" ? result.questions : undefined,
      provider: providerName,
      approvalStatus: "pending",
    });

    return NextResponse.json({ content: generatedContent }, { status: 201 });
  } catch (error) {
    console.error("AI generate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    const status = searchParams.get("status");
    const contentType = searchParams.get("contentType");

    await dbConnect();

    const query: Record<string, unknown> = {};

    if (courseId) {
      const course = await Course.findById(courseId);
      if (!course) {
        return NextResponse.json(
          { error: "Course not found" },
          { status: 404 }
        );
      }

      const isInstructor = course.instructor.toString() === user.userId;
      const isEnrolled = course.enrolledStudents.some(
        (s: { toString: () => string }) => s.toString() === user.userId
      );

      if (!isInstructor && !isEnrolled && user.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      query.course = courseId;

      if (!isInstructor && user.role !== "admin") {
        query.approvalStatus = "approved";
      }
    } else if (user.role === "teacher") {
      const courses = await Course.find({ instructor: user.userId });
      query.course = { $in: courses.map((c) => c._id) };
    } else if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (status) {
      query.approvalStatus = status;
    }

    if (contentType) {
      query.contentType = contentType;
    }

    const contents = await AIGeneratedContent.find(query)
      .populate("course", "title")
      .populate("lesson", "title")
      .populate("generatedBy", "name")
      .sort({ createdAt: -1 });

    return NextResponse.json({ contents });
  } catch (error) {
    console.error("Get generated content error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
