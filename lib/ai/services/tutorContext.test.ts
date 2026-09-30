import { resolveTutorContext } from './tutorContext';
import { Lesson, Module, Assignment } from '@/lib/models';
jest.mock('@/lib/models', () => ({ Lesson: { findById: jest.fn() }, Module: { findOne: jest.fn(), find: jest.fn() }, Assignment: { findOne: jest.fn() } }));
const course = { _id: 'course', title: 'Course', description: 'Overview' };
beforeEach(() => jest.resetAllMocks());
it('rejects lessons from another course', async () => {
  (Lesson.findById as jest.Mock).mockResolvedValue({ module: 'elsewhere' });
  (Module.findOne as jest.Mock).mockResolvedValue(null);
  await expect(resolveTutorContext(course as never, { type: 'lesson', entityId: '507f1f77bcf86cd799439011' })).rejects.toThrow('does not belong');
});
it('reads fresh lesson content, takeaways and resources on each request', async () => {
  (Module.findOne as jest.Mock).mockResolvedValue({ title: 'Module' });
  (Lesson.findById as jest.Mock).mockResolvedValue({ title: 'Lesson', content: 'Updated content', keyTakeaways: ['Remember'], learningResources: [{ title: 'Practice', url: 'https://example.com' }] });
  const context = await resolveTutorContext(course as never, { type: 'lesson', entityId: '507f1f77bcf86cd799439011' });
  expect(context.pageContent).toContain('Updated content');
  expect(context.pageContent).toContain('Practice');
});
it('includes assignment instructions without answer keys or submissions', async () => {
  (Assignment.findOne as jest.Mock).mockResolvedValue({ title: 'Quiz', description: 'Topic', instructions: 'Instructions', questions: [{ correctAnswer: 'SECRET' }], submissions: ['PRIVATE'] });
  const context = await resolveTutorContext(course as never, { type: 'assignment', entityId: '507f1f77bcf86cd799439011' });
  expect(context.pageContent).toContain('Instructions');
  expect(JSON.stringify(context)).not.toMatch(/SECRET|PRIVATE/);
});
