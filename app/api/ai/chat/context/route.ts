import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Course } from '@/lib/models';
import { authenticate } from '@/lib/auth';
import { getCoursePermissions } from '@/lib/auth/coursePermissions';
import { validateObjectId } from '@/lib/utils/validateObjectId';
import { pageContextSchema, resolveTutorContext, TutorContextError } from '@/lib/ai/services/tutorContext';
import { captureException } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const query = request.nextUrl.searchParams;
    const courseId = query.get('courseId') || '';
    const invalid = validateObjectId(courseId, 'Course ID');
    if (invalid) return invalid;
    const page = pageContextSchema.safeParse({ type: query.get('type') || 'overview', entityId: query.get('entityId') || undefined, label: query.get('label') || undefined });
    if (!page.success) return NextResponse.json({ error: 'Invalid page context' }, { status: 400 });
    await dbConnect();
    const course = await Course.findById(courseId);
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    const permissions = await getCoursePermissions(course, user);
    if (!permissions.canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const context = await resolveTutorContext(course, page.data, permissions.canEdit || permissions.isSharedWith);
    return NextResponse.json({ title: context.pageTitle });
  } catch (error) {
    if (error instanceof TutorContextError) return NextResponse.json({ error: error.message }, { status: error.status });
    captureException(error, { operation: 'Tutor focus' });
    return NextResponse.json({ error: 'Could not load page focus' }, { status: 500 });
  }
}
