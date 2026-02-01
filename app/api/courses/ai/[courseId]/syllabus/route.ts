import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";
import { Course, Module, Lesson } from "@/lib/models";
import { authenticate } from "@/lib/auth";

const updateModuleSchema = z.object({
  _id: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  order: z.number().min(0),
  lessons: z.array(
    z.object({
      _id: z.string().optional(),
      title: z.string().min(1).max(200),
      lessonOutline: z.string().max(2000),
      order: z.number().min(0),
    })
  ),
});

const updateSyllabusSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  modules: z.array(updateModuleSchema).optional(),
});

type UpdateSyllabusInput = z.infer<typeof updateSyllabusSchema>;
type UpdateModuleInput = z.infer<typeof updateModuleSchema>;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { courseId } = await params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
    }

    await dbConnect();

    const course = await Course.findOne({
      _id: courseId,
      courseType: "ai-generated",
      owner: user.userId,
    }).populate({
      path: "modules",
      populate: {
        path: "lessons",
        model: "Lesson",
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json({ course });
  } catch (error) {
    console.error("Get syllabus error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { courseId } = await params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
    }

    const body = await request.json();
    const validation = updateSyllabusSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    await dbConnect();

    const course = await Course.findOne({
      _id: courseId,
      courseType: "ai-generated",
      owner: user.userId,
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const updates = validation.data as UpdateSyllabusInput;

    if (updates.title) {
      course.title = updates.title;
    }

    if (updates.description) {
      course.description = updates.description;
    }

    if (updates.modules) {
      const existingModuleIds = new Set(
        updates.modules.filter((m) => m._id).map((m) => m._id)
      );

      const currentModules = await Module.find({ course: courseId });
      for (const existingModule of currentModules) {
        if (!existingModuleIds.has(existingModule._id.toString())) {
          await Lesson.deleteMany({ module: existingModule._id });
          await Module.findByIdAndDelete(existingModule._id);
        }
      }

      const moduleIds: mongoose.Types.ObjectId[] = [];

      for (const moduleData of updates.modules as UpdateModuleInput[]) {
        let courseModule;

        if (moduleData._id && mongoose.Types.ObjectId.isValid(moduleData._id)) {
          courseModule = await Module.findOne({
            _id: moduleData._id,
            course: courseId,
          });

          if (courseModule) {
            courseModule.title = moduleData.title;
            courseModule.description = moduleData.description;
            courseModule.order = moduleData.order;
            await courseModule.save();
          }
        }

        if (!courseModule) {
          courseModule = await Module.create({
            title: moduleData.title,
            description: moduleData.description,
            course: courseId,
            order: moduleData.order,
            contentStatus: "skeleton",
            isPublished: false,
          });
        }

        const existingLessonIds = new Set(
          moduleData.lessons.filter((l) => l._id).map((l) => l._id)
        );

        const currentLessons = await Lesson.find({ module: courseModule._id });
        for (const lesson of currentLessons) {
          if (!existingLessonIds.has(lesson._id.toString())) {
            await Lesson.findByIdAndDelete(lesson._id);
          }
        }

        const lessonIds: mongoose.Types.ObjectId[] = [];

        for (const lessonData of moduleData.lessons) {
          let lesson;

          if (lessonData._id && mongoose.Types.ObjectId.isValid(lessonData._id)) {
            lesson = await Lesson.findOne({
              _id: lessonData._id,
              module: courseModule._id,
            });

            if (lesson) {
              const outlineChanged = lesson.lessonOutline !== lessonData.lessonOutline;
              lesson.title = lessonData.title;
              lesson.lessonOutline = lessonData.lessonOutline;
              lesson.order = lessonData.order;

              if (outlineChanged && lesson.generationStatus === "completed") {
                lesson.generationStatus = "skeleton";
                lesson.content = "";
                lesson.keyTakeaways = [];
              }

              await lesson.save();
            }
          }

          if (!lesson) {
            lesson = await Lesson.create({
              title: lessonData.title,
              module: courseModule._id,
              contentType: "text",
              content: "",
              order: lessonData.order,
              generationStatus: "skeleton",
              lessonOutline: lessonData.lessonOutline,
              isPublished: false,
            });
          }

          lessonIds.push(lesson._id);
        }

        courseModule.lessons = lessonIds;
        await courseModule.save();

        const allLessonsCompleted = await Lesson.countDocuments({
          module: courseModule._id,
          generationStatus: { $ne: "completed" },
        }) === 0;

        courseModule.contentStatus = allLessonsCompleted ? "completed" : "skeleton";
        await courseModule.save();

        moduleIds.push(courseModule._id);
      }

      course.modules = moduleIds;
    }

    await course.save();

    const updatedCourse = await Course.findById(courseId).populate({
      path: "modules",
      populate: {
        path: "lessons",
        model: "Lesson",
      },
    });

    return NextResponse.json({ course: updatedCourse });
  } catch (error) {
    console.error("Update syllabus error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const user = await authenticate(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { courseId } = await params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return NextResponse.json({ error: "Invalid course ID" }, { status: 400 });
    }

    await dbConnect();

    const course = await Course.findOne({
      _id: courseId,
      courseType: "ai-generated",
      owner: user.userId,
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const modules = await Module.find({ course: courseId });
    for (const courseModule of modules) {
      await Lesson.deleteMany({ module: courseModule._id });
    }
    await Module.deleteMany({ course: courseId });

    await Course.findByIdAndDelete(courseId);

    return NextResponse.json({ message: "Course deleted successfully" });
  } catch (error) {
    console.error("Delete course error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
