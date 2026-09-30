import mongoose from 'mongoose';
import { z } from 'zod';
import { Assignment, Lesson, Module } from '@/lib/models';
import type { ICourse } from '@/lib/models/Course';
import type { TutorContext } from './tutor';

export const pageContextSchema = z.object({
  type: z.enum(['lesson', 'module', 'overview', 'assignment', 'page']),
  entityId: z.string().optional(),
  label: z.string().max(100).optional(),
});
export type PageContext = z.infer<typeof pageContextSchema>;

export class TutorContextError extends Error {
  constructor(message: string, public status = 404) { super(message); }
}

export async function resolveTutorContext(course: ICourse, page: PageContext = { type: 'overview' }, canViewDrafts = false): Promise<TutorContext> {
  const context: TutorContext = {
    courseName: course.title,
    courseSummary: course.description,
    pageTitle: page.type === 'overview' ? course.title : page.label || 'Course page',
  };
  if (['lesson', 'module', 'assignment'].includes(page.type) && (!page.entityId || !mongoose.Types.ObjectId.isValid(page.entityId))) {
    throw new TutorContextError('Invalid page entity ID', 400);
  }
  if (page.type === 'lesson') {
    const lesson = await Lesson.findById(page.entityId);
    if (!lesson || !await Module.findOne({ _id: lesson.module, course: course._id })) {
      throw new TutorContextError('Lesson does not belong to this course');
    }
    if (lesson.isPublished === false && !canViewDrafts) throw new TutorContextError('Lesson not found');
    context.pageTitle = lesson.title;
    context.pageContent = JSON.stringify({
      contentType: lesson.contentType,
      savedContent: lesson.content,
      outline: lesson.lessonOutline,
      takeaways: lesson.keyTakeaways,
      sources: lesson.sources,
      learningResources: lesson.learningResources,
      videoUrl: lesson.videoUrl,
      fileUrl: lesson.fileUrl,
      duration: lesson.duration,
      videoMetadata: lesson.youtubeMetadata,
    });
    context.aiContext = lesson.aiContext;
  } else if (page.type === 'module') {
    const courseModule = await Module.findOne({ _id: page.entityId, course: course._id });
    if (!courseModule) throw new TutorContextError('Module does not belong to this course');
    const lessons = await Lesson.find({ module: courseModule._id, ...(canViewDrafts ? {} : { isPublished: true }) }).select('title lessonOutline contentType').sort({ order: 1 });
    context.pageTitle = courseModule.title;
    context.pageContent = JSON.stringify({ description: courseModule.description, lessons });
  } else if (page.type === 'assignment') {
    const assignment = await Assignment.findOne({ _id: page.entityId, course: course._id, deletedAt: null });
    if (!assignment) throw new TutorContextError('Assignment does not belong to this course');
    if (assignment.isPublished === false && !canViewDrafts) throw new TutorContextError('Assignment not found');
    context.pageTitle = assignment.title;
    context.pageContent = JSON.stringify({ description: assignment.description, instructions: assignment.instructions });
  }
  return context;
}
