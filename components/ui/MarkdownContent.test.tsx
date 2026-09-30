/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import MarkdownContent from './MarkdownContent';
it('links legacy citations to saved sources as superscript without changing code', () => {
  render(<MarkdownContent content={'Claim [1]. Unknown [9]. `code [1]`'} sources={[{ title: 'Evidence', url: 'https://example.com/evidence' }]} />);
  const link = screen.getByRole('link', { name: 'Source 1' });
  expect(link).toHaveAttribute('href', 'https://example.com/evidence');
  expect(link.parentElement?.tagName).toBe('SUP');
  expect(screen.getByText('code [1]')).toBeInTheDocument();
  expect(screen.getByText(/Unknown \[9\]/)).toBeInTheDocument();
});
it('renders existing Markdown citation links as superscript while preserving ordinary links', () => {
  render(<MarkdownContent content={'Claim [1](https://example.com). Read [guide](https://example.com/guide).'} />);
  expect(screen.getByRole('link', { name: 'Source 1' }).parentElement?.tagName).toBe('SUP');
  expect(screen.getByRole('link', { name: 'guide' }).parentElement?.tagName).not.toBe('SUP');
});
