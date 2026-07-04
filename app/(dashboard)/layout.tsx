"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/nav/AppShell";
import { Skeleton } from "@/components/ui/Skeleton";

interface User {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  aiPreferences?: {
    defaultTier?: "concise" | "balanced" | "thorough";
    defaultProvider?: string;
    defaultModel?: string;
  };
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        setUser(data.user);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950" aria-busy="true">
        <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
          <div className="h-16 border-b border-zinc-200 dark:border-zinc-800 px-4 flex items-center">
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="px-4 py-4 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </aside>
        <div className="lg:pl-64 pt-14 lg:pt-0 p-4 lg:p-6">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return <AppShell user={user}>{children}</AppShell>;
}
