/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import LessonActions from './LessonActions';
it('supports arrow navigation, Escape and focus restoration', () => {
  render(<LessonActions actions={[{ label: 'Improve this lesson', onSelect: jest.fn() }, { label: 'Replace with YouTube video', onSelect: jest.fn() }]} />);
  const trigger = screen.getByRole('button', { name: 'Lesson actions' });
  fireEvent.click(trigger);
  expect(screen.getByRole('menuitem', { name: 'Improve this lesson' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
  expect(screen.getByRole('menuitem', { name: 'Replace with YouTube video' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
it('renders only authorized actions and dismisses outside', () => {
  render(<LessonActions actions={[{ label: 'Improve this lesson', onSelect: jest.fn() }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Lesson actions' }));
  expect(screen.queryByText('Replace with YouTube video')).not.toBeInTheDocument();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
