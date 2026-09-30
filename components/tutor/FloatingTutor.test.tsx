/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { CourseTutorProvider, useQuizTutorVisibility } from './FloatingTutor';
let mockPath = '/courses/course/modules/module/lessons/one';
jest.mock('next/navigation', () => ({ usePathname: () => mockPath }));
jest.mock('@/lib/hooks/useUserAIDefaults', () => { const defaults = { value: { tier: 'balanced' }, loading: false }; return { useUserAIDefaults: () => defaults }; });
jest.mock('@/components/ai/ModelSelector', () => ({ ModelSelector: () => <div>Model settings</div> }));
jest.mock('@/components/ui/MarkdownContent', () => ({ __esModule: true, default: ({ content }: { content: string }) => <div>{content}</div> }));
const response = (data: unknown, ok = true) => ({ ok, json: async () => data });
beforeEach(() => {
  localStorage.clear();
  mockPath = '/courses/course/modules/module/lessons/one';
  global.fetch = jest.fn(async (url) => {
    if (String(url).startsWith('/api/ai/chat/context')) return response({ title: mockPath.endsWith('one') ? 'First lesson' : 'Second lesson' });
    if (String(url).startsWith('/api/ai/chat/sessions')) return response({ userId: 'user', sessions: [] });
    return response({ sessionId: 'session', message: { content: 'Answer' } });
  }) as jest.Mock;
});
const renderTutor = () => render(<CourseTutorProvider courseId="course"><div>Page</div></CourseTutorProvider>);
it('preserves messages and open state on navigation, capturing focus at send', async () => {
  let finish!: (value: unknown) => void;
  const original = (global.fetch as jest.Mock).getMockImplementation()!;
  (global.fetch as jest.Mock).mockImplementation((url, init) => url === '/api/ai/chat' ? new Promise(resolve => { finish = resolve; }) : original(url, init));
  const view = renderTutor();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Open AI tutor' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Open AI tutor' }));
  await screen.findByText('Focused on: First lesson');
  fireEvent.change(screen.getByRole('textbox', { name: 'Message the tutor' }), { target: { value: 'Explain this' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(global.fetch).toHaveBeenCalledWith('/api/ai/chat', expect.objectContaining({ body: expect.stringContaining('"entityId":"one"') }));
  mockPath = '/courses/course/modules/module/lessons/two';
  view.rerender(<CourseTutorProvider courseId="course"><div>Next page</div></CourseTutorProvider>);
  await screen.findByText('Focused on: Second lesson');
  expect(screen.getByText('Explain this')).toBeInTheDocument();
  await act(async () => finish(response({ sessionId: 'session', message: { content: 'Answer' } })));
  expect(screen.getByText('Answer')).toBeInTheDocument();
});
it('resumes the active conversation after reload and places mobile sheet above navigation', async () => {
  localStorage.setItem('course-tutor:user:course:open', 'true');
  (global.fetch as jest.Mock).mockImplementation(async url => String(url).startsWith('/api/ai/chat/sessions') ? response({ userId: 'user', sessions: [{ _id: 'session' }] }) : url === '/api/ai/chat/session' ? response({ session: { course: { _id: 'course' }, messages: [{ role: 'assistant', content: 'Earlier answer' }] } }) : response({ title: 'Lesson' }));
  renderTutor();
  expect(await screen.findByText('Earlier answer')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'AI tutor' }).className).toContain('bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)]');
});
it('allows recovery after a failed question', async () => {
  const original = (global.fetch as jest.Mock).getMockImplementation()!;
  (global.fetch as jest.Mock).mockImplementation((url, init) => url === '/api/ai/chat' ? Promise.resolve(response({ error: 'Try again' }, false)) : original(url, init));
  renderTutor();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Open AI tutor' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Open AI tutor' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Message the tutor' }), { target: { value: 'Question' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
  expect(screen.getByRole('textbox', { name: 'Message the tutor' })).toHaveValue('Question');
  expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
});
function QuizState({ loading, active }: { loading: boolean; active: boolean }) {
  useQuizTutorVisibility(loading || active);
  return <div>Quiz</div>;
}
it('hides during quiz loading and attempts, returning after completion', async () => {
  mockPath = '/courses/course/assignments/quiz/quiz';
  const view = render(<CourseTutorProvider courseId="course"><QuizState loading active={false} /></CourseTutorProvider>);
  expect(screen.queryByRole('button', { name: 'Open AI tutor' })).not.toBeInTheDocument();
  view.rerender(<CourseTutorProvider courseId="course"><QuizState loading={false} active={false} /></CourseTutorProvider>);
  expect(await screen.findByRole('button', { name: 'Open AI tutor' })).toBeInTheDocument();
  view.rerender(<CourseTutorProvider courseId="course"><QuizState loading={false} active /></CourseTutorProvider>);
  expect(screen.queryByRole('button', { name: 'Open AI tutor' })).not.toBeInTheDocument();
  view.rerender(<CourseTutorProvider courseId="course"><QuizState loading={false} active={false} /></CourseTutorProvider>);
  expect(await screen.findByRole('button', { name: 'Open AI tutor' })).toBeInTheDocument();
});
it('suppresses the floating launcher on the full-page tutor', async () => {
  mockPath = '/courses/course/ai/tutor';
  renderTutor();
  await act(async () => {});
  expect(screen.queryByRole('button', { name: 'Open AI tutor' })).not.toBeInTheDocument();
});

it('starts a new chat without losing historical sessions and restores launcher focus', async () => {
  renderTutor();
  const launcher = await screen.findByRole('button', { name: 'Open AI tutor' });
  await waitFor(() => expect(launcher).toBeEnabled());
  fireEvent.click(launcher);
  fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/ai/chat/sessions', expect.objectContaining({ method: 'POST', body: JSON.stringify({ courseId: 'course' }) })));
  fireEvent.click(screen.getByRole('button', { name: 'Close AI tutor' }));
  expect(screen.getByRole('button', { name: 'Open AI tutor' })).toHaveFocus();
});
