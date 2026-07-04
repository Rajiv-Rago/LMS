import Link from "next/link";

// The "you're a visitor" buttons in the public top bar.
export default function GuestActions() {
  return (
    <>
      <Link
        href="/login"
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
      >
        Sign in
      </Link>
      <Link
        href="/register"
        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500"
      >
        Get Started
      </Link>
    </>
  );
}
