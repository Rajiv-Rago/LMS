import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      {/* Navigation */}
      <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <span className="text-xl font-bold text-zinc-900 dark:text-white">
                Kantigo
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="text-center">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white">
            What do you want to
            <span className="text-indigo-600"> learn today</span>?
          </h1>
          <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Kantigo turns any topic into a structured learning path — with
            curated videos, AI-generated lessons, and projects that actually
            teach you something.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 shadow-sm"
            >
              Start Learning
            </Link>
            <Link
              href="/explore"
              className="w-full sm:w-auto px-6 py-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950"
            >
              Browse Courses
            </Link>
          </div>
          <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-500">
            From curious to capable. At your own pace.
          </p>
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t border-zinc-200 dark:border-zinc-800">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">
            It&apos;s pretty simple
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mx-auto mb-4">
              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">1</span>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Pick a topic
            </h3>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Docker, system design, React, or anything you&apos;re curious
              about.
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mx-auto mb-4">
              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">2</span>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Get a real path
            </h3>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              AI structures a curriculum or curates YouTube into ordered
              modules.
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mx-auto mb-4">
              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">3</span>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Build stuff
            </h3>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Follow along, do projects, track progress. The fun kind of
              homework.
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 border-t border-zinc-200 dark:border-zinc-800">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">
            What makes Kantigo different
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              AI-Generated Paths
            </h3>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Tell us what you want to learn. We&apos;ll build a structured
              course with lessons, projects, and a clear finish line.
            </p>
          </div>

          <div className="p-6 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-red-500 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              YouTube, Organized
            </h3>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              The best tutorials are already on YouTube. We just put them in the
              right order for you.
            </p>
          </div>

          <div className="p-6 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-amber-500 dark:text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Start Anywhere
            </h3>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Total beginner? Kinda know stuff? Jump in wherever you are —
              paths adapt to your level.
            </p>
          </div>

          <div className="p-6 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-emerald-500 dark:text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Learn by Doing
            </h3>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Every path comes with hands-on projects. Because building &gt;
              watching.
            </p>
          </div>
        </div>
      </div>

      {/* Social Proof */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <p className="text-lg font-medium text-zinc-500 dark:text-zinc-400">
          Join learners building real skills
        </p>
      </div>

      {/* CTA Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-8 sm:p-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Curious about something?
          </h2>
          <p className="mt-4 text-indigo-100 max-w-xl mx-auto">
            Turn it into a learning path.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-block px-6 py-3 text-sm font-medium text-indigo-600 bg-white rounded-lg hover:bg-indigo-50"
          >
            Get Started Free
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                Kantigo
              </span>
              <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400">
                From curious to capable
              </span>
            </div>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              kantigo.dev
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
