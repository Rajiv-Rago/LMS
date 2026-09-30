import { connectTestDb, clearTestDb, disconnectTestDb } from '../../helpers/db';
import { createTestUser, createTestCourse, createTestModule } from '../../helpers/fixtures';
import { buildRequest } from '../../helpers/api';
import { AIChatSession, Lesson } from '@/lib/models';
import { POST as chat } from '@/app/api/ai/chat/route';
import { POST as newChat, GET as listChats } from '@/app/api/ai/chat/sessions/route';
import { GET as getChat } from '@/app/api/ai/chat/[sessionId]/route';

const mockChat = jest.fn().mockResolvedValue({ content: '**Answer**' });
jest.mock('@/lib/ai', () => ({ createAIProvider: jest.fn(), resolveProvider: () => ({ provider: 'openrouter', apiKey: 'key', model: 'test' }) }));
jest.mock('@/lib/ai/services/tutor', () => ({ AITutorService: jest.fn().mockImplementation(() => ({ chat: mockChat })) }));
jest.mock('@/lib/ai/utils/userPreferences', () => ({ getUserAIPreferences: jest.fn() }));
jest.mock('@/lib/ai/rateLimit', () => ({ enforceAIRateLimit: jest.fn().mockResolvedValue({ blocked: false, result: {} }), addRateLimitHeaders: jest.fn() }));
jest.mock('@/lib/logger', () => ({ captureException: jest.fn() }));
beforeAll(connectTestDb, 30000);
afterEach(async () => { await clearTestDb(); jest.clearAllMocks(); });
afterAll(disconnectTestDb, 30000);
async function fixture() {
  const { user, token } = await createTestUser();
  const { course } = await createTestCourse(user._id.toString(), { owner: user._id });
  const { module } = await createTestModule(course._id);
  const lesson = await Lesson.create({ title: 'Limits', module: module._id, content: 'Initial content', isPublished: true });
  return { user, token, courseId: course._id.toString(), lesson };
}
it('keeps a conversation across focus changes and resumes only the active chat', async () => {
  const { user, token, courseId, lesson } = await fixture();
  const first = await chat(buildRequest('POST', '/api/ai/chat', { token, body: { courseId, lessonId: lesson._id.toString(), message: 'First question' } }));
  expect(first.status).toBe(200);
  const { sessionId } = await first.json();
  const second = await chat(buildRequest('POST', '/api/ai/chat', { token, body: { courseId, pageContext: { type: 'overview' }, message: 'Second question' } }));
  expect((await second.json()).sessionId).toBe(sessionId);
  expect((await AIChatSession.findById(sessionId))?.messages).toHaveLength(4);
  const reset = await newChat(buildRequest('POST', '/api/ai/chat/sessions', { token, body: { courseId } }));
  expect(reset.status).toBe(200);
  expect((await AIChatSession.findById(sessionId))?.isActive).toBe(false);
  const third = await chat(buildRequest('POST', '/api/ai/chat', { token, body: { courseId, message: 'New question' } }));
  expect((await third.json()).sessionId).not.toBe(sessionId);
  const active = await listChats(buildRequest('GET', `/api/ai/chat/sessions?courseId=${courseId}&active=true`, { token }));
  expect((await active.json()).sessions).toHaveLength(1);
  expect(await AIChatSession.countDocuments({ user: user._id, course: courseId })).toBe(2);
});
it('resolves updated lesson content and rejects cross-course focus', async () => {
  const { token, courseId, lesson } = await fixture();
  await Lesson.findByIdAndUpdate(lesson._id, { content: 'Updated content', keyTakeaways: ['Fresh takeaway'] });
  const response = await chat(buildRequest('POST', '/api/ai/chat', { token, body: { courseId, lessonId: lesson._id.toString(), message: 'Explain' } }));
  expect(response.status).toBe(200);
  expect(mockChat).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ pageContent: expect.stringContaining('Updated content') }));
  const other = await fixture();
  const foreign = await chat(buildRequest('POST', '/api/ai/chat', { token, body: { courseId, lessonId: other.lesson._id.toString(), message: 'Explain' } }));
  expect(foreign.status).toBe(404);
});
it('rejects session access by another user and session reuse in another course', async () => {
  const first = await fixture();
  const second = await fixture();
  const session = await AIChatSession.create({ user: first.user._id, course: first.courseId, provider: 'openrouter', messages: [] });
  const denied = await getChat(buildRequest('GET', `/api/ai/chat/${session._id}`, { token: second.token }), { params: Promise.resolve({ sessionId: session._id.toString() }) });
  expect(denied.status).toBe(404);
  const deniedReuse = await chat(buildRequest('POST', '/api/ai/chat', { token: second.token, body: { courseId: second.courseId, sessionId: session._id.toString(), message: 'Explain' } }));
  expect(deniedReuse.status).toBe(404);
});
it.each(['openai', 'anthropic', 'cerebras', 'gemini', 'openrouter'])('validates chat sessions for %s', async provider => {
  const { user, courseId } = await fixture();
  const session = await AIChatSession.create({ user: user._id, course: courseId, provider, messages: [] });
  expect(session.provider).toBe(provider);
});
