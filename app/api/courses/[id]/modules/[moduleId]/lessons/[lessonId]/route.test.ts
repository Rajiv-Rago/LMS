import { NextRequest } from 'next/server';
import { GET, PATCH } from './route';
import { Lesson } from '@/lib/models';
jest.mock('@/lib/db', () => ({ dbConnect: jest.fn() }));
jest.mock('@/lib/models', () => ({ Course: { findById: jest.fn().mockResolvedValue({}) }, Module: { findOne: jest.fn().mockResolvedValue({}) }, Lesson: { findOne: jest.fn() } }));
jest.mock('@/lib/auth', () => ({ authenticate: jest.fn().mockResolvedValue({ userId: 'user' }), requireCsrf: jest.fn() }));
jest.mock('@/lib/auth/coursePermissions', () => ({ getCoursePermissions: jest.fn().mockResolvedValue({ canEdit: true }) }));
jest.mock('@/lib/logger', () => ({ captureException: jest.fn() }));
const params = { params: Promise.resolve({ id: '507f1f77bcf86cd799439011', moduleId: '507f1f77bcf86cd799439012', lessonId: '507f1f77bcf86cd799439013' }) };
const request = () => new NextRequest('http://localhost/api/lesson', { method: 'PATCH', body: JSON.stringify({ contentType: 'video', content: 'Video description', videoUrl: 'https://www.youtube.com/embed/video' }) });
it.each([{ generationStatus: 'generating' }, { resourceRefreshStartedAt: new Date() }])('prevents replacing a busy lesson: %j', async state => {
  const lesson = { ...state, save: jest.fn() };
  (Lesson.findOne as jest.Mock).mockResolvedValue(lesson);
  expect((await PATCH(request(), params)).status).toBe(409);
  expect(lesson.save).not.toHaveBeenCalled();
});
it('clears recommendations and citations tied to the previous lesson format', async () => {
  const lesson = { contentType: 'text', sources: [{ title: 'Old' }], learningResources: [{ title: 'Old' }], keyTakeaways: ['Old'], save: jest.fn() };
  (Lesson.findOne as jest.Mock).mockResolvedValue(lesson);
  expect((await PATCH(request(), params)).status).toBe(200);
  expect(lesson).toEqual(expect.objectContaining({ sources: [], learningResources: [], keyTakeaways: [] }));
});
it('reports an expired generation as failed without modifying its content', async () => {
  const stored = { isPublished: true, generationStatus: 'generating', content: 'Previous content', updatedAt: new Date(Date.now() - 240000) };
  (Lesson.findOne as jest.Mock).mockResolvedValue({ ...stored, toObject: () => stored });
  const response = await GET(new NextRequest('http://localhost/api/lesson'), params);
  expect((await response.json()).lesson).toEqual(expect.objectContaining({ generationStatus: 'failed', content: 'Previous content' }));
});
it('allows an editor to replace a lesson after a generation lease expires', async () => {
  const lesson = { contentType: 'text', generationStatus: 'generating', updatedAt: new Date(Date.now() - 240000), save: jest.fn() };
  (Lesson.findOne as jest.Mock).mockResolvedValue(lesson);
  expect((await PATCH(request(), params)).status).toBe(200);
  expect(lesson.save).toHaveBeenCalled();
  expect(lesson.generationStatus).toBe('failed');
});
