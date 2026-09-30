'use client';
import type { LearningResource } from '@/lib/ai/services/learningResources';

export default function LearningResources({ resources = [], sources = [], canRefresh, creditsRemaining, refreshing, error, onRefresh }: {
  resources?: LearningResource[]; sources?: { title: string; url: string }[];
  canRefresh: boolean; creditsRemaining: number; refreshing: boolean; error?: string; onRefresh: () => void;
}) {
  if (!resources.length && !sources.length && !canRefresh) return null;
  const entries = [
    ...resources.map(resource => ({ ...resource, sourceNumbers: sources.flatMap((source, index) => source.url === resource.url ? [index + 1] : []) })),
    ...sources.flatMap((source, index) => resources.some(resource => resource.url === source.url) || sources.slice(0, index).some(previous => previous.url === source.url) ? [] : [{ ...source, description: undefined, type: undefined, requiresSignup: undefined, sourceNumbers: sources.flatMap((entry, number) => entry.url === source.url ? [number + 1] : []) }]),
  ];
  return <section className="mt-6 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50" aria-label="Learning resources">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Sources & resources</h3>
      {canRefresh && <button type="button" disabled={refreshing || creditsRemaining === 0} onClick={onRefresh} className="min-h-11 rounded px-2 text-sm text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30">{refreshing ? 'Finding resources…' : resources.length ? 'Refresh resources' : 'Find resources'} · 1 AI credit</button>}
    </div>
    <ul className="space-y-4">{entries.map(entry => <li key={entry.url} className="text-sm">
      <a href={entry.url} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">{entry.title}</a>
      <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
        {entry.sourceNumbers.map(number => <span key={number}>Source {number}</span>)}
        {entry.type && <><span className="capitalize">{entry.type}</span><span>{entry.requiresSignup ? 'Free · signup required' : 'Free'}</span></>}
      </p>
      {entry.description && <p className="mt-1 text-zinc-700 dark:text-zinc-300">{entry.description}</p>}
    </li>)}</ul>
    {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error} Use {resources.length ? 'Refresh resources' : 'Find resources'} to retry.</p>}
  </section>;
}
