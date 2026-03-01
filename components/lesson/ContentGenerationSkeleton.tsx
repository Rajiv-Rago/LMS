"use client";

/**
 * Animated skeleton shown while AI generates lesson content.
 * Mimics the shape of a real lesson (heading, paragraphs, code block, list)
 * with a shimmer animation to convey progress.
 */
export default function ContentGenerationSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Generating content">
      {/* Banner */}
      <div className="flex items-center gap-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 px-4 py-3">
        <div className="relative h-5 w-5 flex-shrink-0">
          <div className="absolute inset-0 rounded-full border-2 border-violet-300 dark:border-violet-600 border-t-violet-600 dark:border-t-violet-300 animate-spin" />
        </div>
        <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
          Generating content&hellip;
        </span>
      </div>

      {/* Fake heading */}
      <div className="h-7 w-2/5 rounded bg-zinc-200 dark:bg-zinc-700" />

      {/* Paragraph 1 */}
      <div className="space-y-2.5">
        <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-11/12 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>

      {/* Sub-heading */}
      <div className="h-6 w-1/3 rounded bg-zinc-200 dark:bg-zinc-700" />

      {/* Paragraph 2 */}
      <div className="space-y-2.5">
        <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-5/6 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>

      {/* Code block placeholder */}
      <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-4 space-y-2">
        <div className="h-3.5 w-1/2 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-3.5 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-3.5 w-2/3 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-3.5 w-1/3 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>

      {/* Paragraph 3 */}
      <div className="space-y-2.5">
        <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-4/5 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>

      {/* Bullet list placeholder */}
      <div className="space-y-2 pl-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600 flex-shrink-0" />
          <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600 flex-shrink-0" />
          <div className="h-4 w-2/3 rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600 flex-shrink-0" />
          <div className="h-4 w-4/5 rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
      </div>
    </div>
  );
}
