"use client";

import { useEffect } from "react";
import { captureException } from "@/lib/logger";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { boundary: "dashboard" });
  }, [error]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
          <svg
            className="h-6 w-6 text-red-600 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M12 3l9.66 16.5H2.34L12 3z"
            />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          An error occurred while loading this page. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-500 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
