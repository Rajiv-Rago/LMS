import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Course, Lesson, AIChatSession } from "@/lib/models";
import { authenticate } from "@/lib/auth";
import { getDefaultProvider, getProviderName } from "@/lib/ai";
import { AITutorService } from "@/lib/ai/services/tutor";

const createChatSchema = z.object({
  courseId: z.string(),
  lessonId: z.string().optional(),
  message: z.string().min(1).max(5000),
  sessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createChatSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { courseId, lessonId, message, sessionId } = validation.data;

    await dbConnect();

    const course = await Course.findById(courseId);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const isEnrolled = course.enrolledStudents.some(
      (s: { toString: () => string }) => s.toString() === user.userId
    );
    const isInstructor = course.instructor.toString() === user.userId;

    if (!isEnrolled && !isInstructor && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let lesson = null;
    if (lessonId) {
      lesson = await Lesson.findById(lessonId);
    }

    let session;
    if (sessionId) {
      session = await AIChatSession.findOne({
        _id: sessionId,
        user: user.userId,
        course: courseId,
      });

      if (!session) {
        return NextResponse.json(
          { error: "Chat session not found" },
          { status: 404 }
        );
      }
    } else {
      const providerName = getProviderName();
      session = await AIChatSession.create({
        user: user.userId,
        course: courseId,
        lesson: lessonId,
        title: message.slice(0, 50) + (message.length > 50 ? "..." : ""),
        messages: [],
        provider: providerName,
      });
    }

    session.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    const provider = getDefaultProvider();
    const tutorService = new AITutorService(provider);

    const conversationHistory = session.messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    const response = await tutorService.chat(conversationHistory, {
      courseName: course.title,
      lessonTitle: lesson?.title,
      lessonContent: lesson?.content,
      aiContext: lesson?.aiContext,
    });

    session.messages.push({
      role: "assistant",
      content: response.content,
      timestamp: new Date(),
    });

    await session.save();

    return NextResponse.json({
      sessionId: session._id,
      message: {
        role: "assistant",
        content: response.content,
      },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
