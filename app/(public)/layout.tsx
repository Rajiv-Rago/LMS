import Link from "next/link";
import { auth } from "@/auth";
import AppShell from "@/components/nav/AppShell";
import GuestActions from "@/components/nav/GuestActions";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Logged-in visitors keep the dashboard sidebar so /explore and /courses/[id]
  // don't swap chrome underneath them.
  if (session?.user) {
    return (
      <AppShell user={{ name: session.user.name, email: session.user.email }}>
        {children}
      </AppShell>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="text-xl font-bold text-zinc-900 dark:text-white"
              >
                Kantigo
              </Link>
              <Link
                href="/explore"
                className="text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
              >
                Explore
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <GuestActions />
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
