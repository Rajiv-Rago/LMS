/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import LearningResources from './LearningResources';
it('shows legacy find action with credit cost and integrated citations', () => {
  const refresh = jest.fn();
  render(<LearningResources sources={[{ title: 'Citation', url: 'https://example.com' }]} canRefresh creditsRemaining={5} refreshing={false} onRefresh={refresh} />);
  fireEvent.click(screen.getByRole('button', { name: /Find resources/ }));
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Sources & resources')).toBeInTheDocument();
  expect(screen.getByText(/1 AI credit/)).toBeInTheDocument();
});
it('shows signup labels and disables duplicate requests', () => {
  render(<LearningResources resources={[{ title: 'Practice', url: 'https://example.com', description: 'Practice the topic.', type: 'exercise', requiresSignup: true }]} canRefresh creditsRemaining={5} refreshing onRefresh={jest.fn()} />);
  expect(screen.getByText('Free · signup required')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Finding/ })).toBeDisabled();
});
it('disables refresh when credits are exhausted', () => {
  render(<LearningResources canRefresh creditsRemaining={0} refreshing={false} onRefresh={jest.fn()} />);
  expect(screen.getByRole('button', { name: /Find resources/ })).toBeDisabled();
});
it('combines citations and recommendations in one list, merging duplicate URLs', () => {
  render(<LearningResources resources={[{ title: 'Practice', url: 'https://example.com', description: 'Practice the topic.', type: 'exercise', requiresSignup: false }]} sources={[{ title: 'Evidence', url: 'https://example.com' }, { title: 'Other evidence', url: 'https://example.com/other' }]} canRefresh={false} creditsRemaining={5} refreshing={false} onRefresh={jest.fn()} />);
  expect(screen.getAllByRole('list')).toHaveLength(1);
  expect(screen.getAllByRole('link')).toHaveLength(2);
  expect(screen.getByText('Source 1')).toBeInTheDocument();
  expect(screen.getByText('Source 2')).toBeInTheDocument();
});
