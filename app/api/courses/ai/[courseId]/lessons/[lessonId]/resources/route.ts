import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import { Course, Module, Lesson } from '@/lib/models';
import { authenticate, requireCsrf, requireVerifiedEmail } from '@/lib/auth';
import { getCoursePermissions } from '@/lib/auth/coursePermissions';
import { createAIProvider, resolveProvider } from '@/lib/ai';
import { getUserAIPreferences } from '@/lib/ai/utils/userPreferences';
import { extractTargetLevel } from '@/lib/ai/utils/promptUtils';
import { selectLearningResources } from '@/lib/ai/services/learningResources';
import { enforceAIRateLimit, addRateLimitHeaders } from '@/lib/ai/rateLimit';
import { captureException } from '@/lib/logger';

export const maxDuration = 120;

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  let claim: { _id: string; resourceRefreshStartedAt: Date } | undefined;
  try {
    const csrfError = requireCsrf(request);
    if (csrfError) return csrfError;
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const verificationError = requireVerifiedEmail(user);
    if (verificationError) return verificationError;
    const { courseId, lessonId } = await params;
    if (![courseId, lessonId].every(id => mongoose.Types.ObjectId.isValid(id))) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    await dbConnect();
    const course = await Course.findById(courseId);
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    const permissions = await getCoursePermissions(course, user);
    if (!permissions.canEdit && !permissions.isSharedWith) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const lesson = await Lesson.findById(lessonId);
    if (!lesson || !await Module.findOne({ _id: lesson.module, course: courseId })) return NextResponse.json({ error: 'Lesson does not belong to this course' }, { status: 404 });
    const resolved = resolveProvider({ coursePreferences: course.aiPreferences, userPreferences: await getUserAIPreferences(user.userId) });
    if (!resolved) return NextResponse.json({ error: 'AI service unavailable' }, { status: 503 });
    const startedAt = new Date();
    const claimed = await Lesson.findOneAndUpdate({
      _id: lessonId, generationStatus: { $ne: 'generating' },
      $or: [{ resourceRefreshStartedAt: null }, { resourceRefreshStartedAt: { $lt: new Date(Date.now() - 120000) } }],
    }, { $set: { resourceRefreshStartedAt: startedAt } }, { new: true });
    if (!claimed) return NextResponse.json({ error: 'This lesson is busy. Please try again shortly.' }, { status: 409 });
    claim = { _id: lessonId, resourceRefreshStartedAt: startedAt };
    const rate = await enforceAIRateLimit(user.userId, user.role === 'admin' ? 'admin' : user.subscriptionTier, 'credits', 1);
    if (rate.blocked) return rate.response;
    const resources = await selectLearningResources(createAIProvider(resolved), {
      courseTitle: course.title, lessonTitle: lesson.title, lessonOutline: lesson.lessonOutline || lesson.content.slice(0, 2000), targetLevel: course.youtubeMetadata?.skillLevel || extractTargetLevel(course.syllabusPrompt),
    });
    if (!resources.length) {
      const response = NextResponse.json({ error: 'No verified free resources were found. Please try again later.' }, { status: 503 });
      addRateLimitHeaders(response, rate.result);
      return response;
    }
    await Lesson.updateOne(claim, { $set: { learningResources: resources } });
    const response = NextResponse.json({ learningResources: resources });
    addRateLimitHeaders(response, rate.result);
    return response;
  } catch (error) {
    captureException(error, { operation: 'Refresh learning resources' });
    return NextResponse.json({ error: 'Resource search is unavailable. Please try again later.' }, { status: 503 });
  } finally {
    if (claim) await Lesson.updateOne(claim, { $unset: { resourceRefreshStartedAt: 1 } }).catch(error => captureException(error, { operation: 'Release resource refresh' }));
  }
}
