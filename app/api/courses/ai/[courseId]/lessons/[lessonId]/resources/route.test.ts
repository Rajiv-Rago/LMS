import { NextRequest } from 'next/server';
import { POST } from './route';
import { Course, Module, Lesson } from '@/lib/models';
import { authenticate, requireCsrf, requireVerifiedEmail } from '@/lib/auth';
import { getCoursePermissions } from '@/lib/auth/coursePermissions';
import { enforceAIRateLimit } from '@/lib/ai/rateLimit';
import { selectLearningResources } from '@/lib/ai/services/learningResources';
jest.mock('@/lib/db', () => ({ dbConnect: jest.fn() }));
jest.mock('@/lib/models', () => ({ Course: { findById: jest.fn() }, Module: { findOne: jest.fn() }, Lesson: { findById: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() } }));
jest.mock('@/lib/auth', () => ({ authenticate: jest.fn(), requireCsrf: jest.fn(), requireVerifiedEmail: jest.fn() }));
jest.mock('@/lib/auth/coursePermissions', () => ({ getCoursePermissions: jest.fn() }));
jest.mock('@/lib/ai/rateLimit', () => ({ enforceAIRateLimit: jest.fn(), addRateLimitHeaders: jest.fn() }));
jest.mock('@/lib/ai', () => ({ createAIProvider: jest.fn(), resolveProvider: () => ({ provider: 'openrouter', apiKey: 'key' }) }));
jest.mock('@/lib/ai/utils/userPreferences', () => ({ getUserAIPreferences: jest.fn() }));
jest.mock('@/lib/ai/services/learningResources', () => ({ selectLearningResources: jest.fn() }));
jest.mock('@/lib/logger', () => ({ captureException: jest.fn() }));
const courseId = '507f1f77bcf86cd799439011';
const lessonId = '507f1f77bcf86cd799439012';
const params = { params: Promise.resolve({ courseId, lessonId }) };
const post = () => POST(new NextRequest(`http://localhost/api/courses/ai/${courseId}/lessons/${lessonId}/resources`, { method: 'POST' }), params);
beforeEach(() => {
  jest.resetAllMocks();
  (authenticate as jest.Mock).mockResolvedValue({ userId: 'user', subscriptionTier: 'free' });
  (getCoursePermissions as jest.Mock).mockResolvedValue({ isSharedWith: true });
  (Course.findById as jest.Mock).mockResolvedValue({ title: 'Math' });
  (Lesson.findById as jest.Mock).mockResolvedValue({ title: 'Limits', module: 'module', content: 'Original', learningResources: [{ title: 'Existing' }] });
  (Module.findOne as jest.Mock).mockResolvedValue({ title: 'Module' });
  (Lesson.findOneAndUpdate as jest.Mock).mockResolvedValue({});
  (Lesson.updateOne as jest.Mock).mockResolvedValue({});
  (enforceAIRateLimit as jest.Mock).mockResolvedValue({ blocked: false, result: { remaining: 4 } });
  (selectLearningResources as jest.Mock).mockResolvedValue([{ title: 'Practice' }]);
});
it('permits shared users, charges one credit and changes only resources', async () => {
  expect((await post()).status).toBe(200);
  expect(enforceAIRateLimit).toHaveBeenCalledWith('user', 'free', 'credits', 1);
  expect(Lesson.updateOne).toHaveBeenCalledWith(expect.anything(), { $set: { learningResources: [{ title: 'Practice' }] } });
});
it('rejects cross-course lessons before charging', async () => {
  (Module.findOne as jest.Mock).mockResolvedValue(null);
  expect((await post()).status).toBe(404);
  expect(enforceAIRateLimit).not.toHaveBeenCalled();
});
it('prevents concurrent requests before charging', async () => {
  (Lesson.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
  expect((await post()).status).toBe(409);
  expect(enforceAIRateLimit).not.toHaveBeenCalled();
});
it('enforces credits and releases the refresh claim', async () => {
  (enforceAIRateLimit as jest.Mock).mockResolvedValue({ blocked: true, response: new Response('{}', { status: 429 }) });
  expect((await post()).status).toBe(429);
  expect(selectLearningResources).not.toHaveBeenCalled();
  expect(Lesson.updateOne).toHaveBeenCalledWith(expect.anything(), { $unset: { resourceRefreshStartedAt: 1 } });
});
it('preserves recommendations on search failure or no verified results', async () => {
  (selectLearningResources as jest.Mock).mockRejectedValue(new Error('search unavailable'));
  expect((await post()).status).toBe(503);
  expect(Lesson.updateOne).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ $set: expect.anything() }));
  (selectLearningResources as jest.Mock).mockResolvedValue([]);
  expect((await post()).status).toBe(503);
});
it('rejects viewers and applies verification and CSRF checks', async () => {
  (getCoursePermissions as jest.Mock).mockResolvedValue({ canEdit: false, isSharedWith: false });
  expect((await post()).status).toBe(403);
  (requireCsrf as jest.Mock).mockReturnValue(new Response('{}', { status: 403 }));
  expect((await post()).status).toBe(403);
  expect(requireVerifiedEmail).toHaveBeenCalled();
});
