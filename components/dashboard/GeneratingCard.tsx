"use client";

interface GeneratingCardProps {
  topic: string;
  onCancel?: () => void;
}

export default function GeneratingCard({ topic, onCancel }: GeneratingCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/50 dark:to-violet-950/50 p-6">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-200 dark:border-indigo-800 border-t-indigo-600 dark:border-t-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            Generating your course on &apos;{topic}&apos;...
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            This usually takes 15-30 seconds
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
