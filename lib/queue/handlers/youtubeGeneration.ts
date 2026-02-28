import { dbConnect } from "@/lib/db";
import { Course, Module, Lesson, Assignment } from "@/lib/models";
import { AIProviderName, AITier } from "@/lib/ai/types";
import { resolveProvider } from "@/lib/ai/utils/providerResolver";
import { getUserAIPreferences } from "@/lib/ai/utils/userPreferences";
import { YouTubePathService } from "@/lib/youtube";
import type { YouTubePathFormData } from "@/lib/youtube";
import { logAIGeneration } from "@/lib/utils/aiGenerationLogger";
import { sendNotification } from "@/lib/notifications";
import { captureException } from "@/lib/logger";
import { env } from "@/lib/env";
import { registerHandler } from "./index";

registerHandler(
  "ai.generate-youtube-path",
  async (data: Record<string, unknown>) => {
    const startTime = Date.now();
    const {
      topic,
      skillLevel,
      teachingStyle,
      videoLengthPreference,
      pathVariant,
      tier,
      provider,
      model,
      userId,
    } = data as {
      topic: string;
      skillLevel: string;
      teachingStyle?: string;
      videoLengthPreference?: string;
      pathVariant?: string;
      tier?: string;
      provider?: string;
      model?: string;
      userId: string;
    };

    const youtubeApiKey = env.YOUTUBE_API_KEY;
    if (!youtubeApiKey) {
      throw new Error("YOUTUBE_API_KEY is not configured");
    }

    const userPreferences =
      tier || provider ? undefined : await getUserAIPreferences(userId);

    const resolved = resolveProvider({
      requestProvider: provider as AIProviderName,
      requestModel: model,
      requestTier: tier as AITier,
      userPreferences,
    });

    if (!resolved) {
      captureException(new Error(`Provider not configured: ${provider || process.env.AI_PROVIDER || "openai"}`), {
        operation: "resolve-provider",
        jobType: "ai.generate-youtube-path",
      });
      throw new Error("AI service is temporarily unavailable");
    }

    await dbConnect();

    const service = new YouTubePathService({
      provider: resolved.provider,
      apiKey: resolved.apiKey,
      model: resolved.model,
      youtubeApiKey,
    });

    const form: YouTubePathFormData = {
      topic,
      skillLevel: skillLevel as YouTubePathFormData["skillLevel"],
      teachingStyle,
      videoLengthPreference: videoLengthPreference as YouTubePathFormData["videoLengthPreference"],
      pathVariant: pathVariant as YouTubePathFormData["pathVariant"],
    };

    const path = await service.generatePath(form);

    // Create Course
    const course = await Course.create({
      title: path.courseTitle,
      description: path.courseDescription,
      instructor: userId,
      owner: userId,
      syllabusStatus: "completed",
      syllabusPrompt: `YouTube Path: ${topic}\nSkill Level: ${skillLevel}${teachingStyle ? `\nStyle: ${teachingStyle}` : ""}`,
      aiPreferences: {
        defaultProvider: resolved.provider,
        defaultModel: resolved.model,
      },
      youtubeMetadata: {
        skillLevel,
        teachingStyle,
        pathVariant,
        generatedAt: new Date(),
      },
      isPublished: false,
    });

    // Create Modules, Lessons, and Assignments
    const moduleIds = [];

    for (const modData of path.modules) {
      const courseModule = await Module.create({
        title: modData.title,
        description: modData.description,
        course: course._id,
        order: modData.order,
        contentStatus: "completed",
        isPublished: false,
      });

      const lessonIds = [];

      for (let i = 0; i < modData.videos.length; i++) {
        const video = modData.videos[i];
        const lesson = await Lesson.create({
          title: video.title,
          module: courseModule._id,
          contentType: "video",
          content: video.whyIncluded,
          videoUrl: `https://www.youtube.com/embed/${video.videoId}`,
          duration: video.durationSeconds,
          order: i,
          isPublished: false,
          generationStatus: "completed",
          keyTakeaways: video.keyTakeaways,
          youtubeMetadata: {
            videoId: video.videoId,
            channelName: video.channelName,
            channelId: video.channelId,
            thumbnailUrl: video.thumbnailUrl,
            viewCount: video.viewCount,
            publishedAt: video.publishedAt ? new Date(video.publishedAt) : undefined,
            videoDuration: video.duration,
          },
        });
        lessonIds.push(lesson._id);
      }

      courseModule.lessons = lessonIds;
      await courseModule.save();

      // Create practice project as an assignment if present
      if (modData.practiceProject) {
        await Assignment.create({
          title: modData.practiceProject.title,
          description: modData.practiceProject.description,
          course: course._id,
          module: courseModule._id,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          points: 100,
          submissionType: "text",
          assignmentType: "project",
          isPublished: false,
        });
      }

      moduleIds.push(courseModule._id);
    }

    course.modules = moduleIds;
    await course.save();

    await logAIGeneration({
      user: userId,
      course: course._id.toString(),
      generationType: "syllabus",
      provider: resolved.provider,
      model: resolved.model || "default",
      prompt: `YouTube Path: ${topic} (${skillLevel})`,
      response: JSON.stringify(path).slice(0, 5000),
      status: "completed",
      durationMs: Date.now() - startTime,
    });

    await sendNotification({
      userId,
      type: "ai.generation.completed",
      title: "YouTube path generated",
      message: `Course "${path.courseTitle}" has been generated from YouTube`,
      link: `/courses/${course._id}`,
    });

    return { courseId: course._id.toString() };
  }
);
