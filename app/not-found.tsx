import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <span className="text-xl font-bold text-zinc-400 dark:text-zinc-500">?</span>
        </div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
          Page not found
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-500 transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
