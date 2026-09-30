import { NextRequest } from 'next/server';
import { POST } from './route';
import { AIChatSession, Course } from '@/lib/models';
import { resolveTutorContext } from '@/lib/ai/services/tutorContext';
import { getCoursePermissions } from '@/lib/auth/coursePermissions';
jest.mock('@/lib/db', () => ({ dbConnect: jest.fn() }));
jest.mock('@/lib/models', () => ({ Course: { findById: jest.fn() }, AIChatSession: { findOne: jest.fn(), create: jest.fn(), updateMany: jest.fn() } }));
jest.mock('@/lib/auth', () => ({ authenticate: jest.fn().mockResolvedValue({ userId: 'user', subscriptionTier: 'free' }), requireCsrf: jest.fn(), requireVerifiedEmail: jest.fn() }));
jest.mock('@/lib/auth/coursePermissions', () => ({ getCoursePermissions: jest.fn() }));
jest.mock('@/lib/ai/rateLimit', () => ({ enforceAIRateLimit: jest.fn().mockResolvedValue({ blocked: false, result: {} }), addRateLimitHeaders: jest.fn() }));
jest.mock('@/lib/ai', () => ({ resolveProvider: () => ({ provider: 'openrouter', apiKey: 'test', model: 'test-model' }), createAIProvider: jest.fn() }));
jest.mock('@/lib/ai/utils/userPreferences', () => ({ getUserAIPreferences: jest.fn() }));
jest.mock('@/lib/ai/services/tutorContext', () => ({ ...jest.requireActual('@/lib/ai/services/tutorContext'), resolveTutorContext: jest.fn() }));
const mockChat = jest.fn();
jest.mock('@/lib/ai/services/tutor', () => ({ AITutorService: jest.fn().mockImplementation(() => ({ chat: mockChat })) }));
jest.mock('@/lib/logger', () => ({ captureException: jest.fn() }));
const courseId = '507f1f77bcf86cd799439011';
const sessionId = '507f1f77bcf86cd799439012';
const request = (extra = {}) => new NextRequest('http://localhost/api/ai/chat', { method: 'POST', body: JSON.stringify({ courseId, message: 'Explain this', ...extra }) });
let session: { _id: string; messages: { role: string; content: string }[]; save: jest.Mock };
beforeEach(() => {
  jest.clearAllMocks();
  session = { _id: sessionId, messages: [{ role: 'assistant', content: 'Earlier answer' }], save: jest.fn() };
  (Course.findById as jest.Mock).mockResolvedValue({ _id: courseId, title: 'Math' });
  (getCoursePermissions as jest.Mock).mockResolvedValue({ canView: true });
  (resolveTutorContext as jest.Mock).mockResolvedValue({ courseName: 'Math', pageTitle: 'Limits', pageContent: 'Fresh content' });
  (AIChatSession.findOne as jest.Mock).mockReturnValue({ sort: jest.fn().mockResolvedValue(session) });
  mockChat.mockResolvedValue({ content: 'New answer' });
});
it('resumes the active conversation with fresh authorized context and OpenRouter', async () => {
  expect((await POST(request({ pageContext: { type: 'lesson', entityId: sessionId } }))).status).toBe(200);
  expect(mockChat).toHaveBeenCalledWith(expect.arrayContaining([{ role: 'assistant', content: 'Earlier answer' }]), expect.objectContaining({ pageContent: 'Fresh content' }));
  expect(session).toEqual(expect.objectContaining({ provider: 'openrouter', aiModel: 'test-model' }));
});
it('retains lessonId compatibility', async () => {
  await POST(request({ lessonId: sessionId }));
  expect(resolveTutorContext).toHaveBeenCalledWith(expect.anything(), { type: 'lesson', entityId: sessionId }, undefined);
});
it('requires session ownership and matching course', async () => {
  (AIChatSession.findOne as jest.Mock).mockResolvedValue(null);
  expect((await POST(request({ sessionId }))).status).toBe(404);
  expect(AIChatSession.findOne).toHaveBeenCalledWith({ _id: sessionId, user: 'user', course: courseId });
  expect(mockChat).not.toHaveBeenCalled();
});
it('rejects an inaccessible course before resolving content', async () => {
  (getCoursePermissions as jest.Mock).mockResolvedValue({ canView: false });
  expect((await POST(request())).status).toBe(403);
  expect(resolveTutorContext).not.toHaveBeenCalled();
});
it('returns a recoverable error without saving a failed question', async () => {
  mockChat.mockRejectedValue(new Error('provider busy'));
  expect((await POST(request())).status).toBe(500);
  expect(session.save).not.toHaveBeenCalled();
});
