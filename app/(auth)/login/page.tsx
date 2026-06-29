"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import OAuthButtons from "../OAuthButtons";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const enrollCourseId = searchParams.get("enroll");
  const requestedRedirect = searchParams.get("callbackUrl") || searchParams.get("redirect");
  const oauthError = getOAuthErrorMessage(searchParams.get("error"));

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const redirectTo = enrollCourseId
    ? `/courses/${enrollCourseId}`
    : getSafeRedirect(requestedRedirect);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        ...formData,
        redirect: false,
        redirectTo,
      });

      if (!result?.ok) {
        throw new Error("Invalid email or password");
      }

      if (enrollCourseId) {
        try {
          await fetch(`/api/courses/${enrollCourseId}/enroll`, {
            method: "POST",
            headers: { "X-Requested-With": "XMLHttpRequest" },
          });
        } catch {
          // Enrollment failure is non-blocking
        }
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Or{" "}
          <Link
            href={enrollCourseId ? `/register?enroll=${enrollCourseId}` : "/register"}
            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            create a new account
          </Link>
        </p>
      </div>

      <OAuthButtons redirectTo={redirectTo} />

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {enrollCourseId && (
          <div className="rounded-md bg-indigo-50 dark:bg-indigo-900/50 p-3">
            <p className="text-sm text-indigo-700 dark:text-indigo-200">
              Sign in to enroll in this course
            </p>
          </div>
        )}

        {(error || oauthError) && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/50 p-4">
            <p className="text-sm text-red-700 dark:text-red-200">
              {error || oauthError}
            </p>
          </div>
        )}

        <div className="space-y-4 rounded-md">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="mt-1 block w-full h-11 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="mt-1 block w-full h-11 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Enter your password"
            />
          </div>
        </div>

        {/* TODO: Re-enable when email provider is configured */}

        <Button
          type="submit"
          variant="primary"
          disabled={loading}
          className="w-full justify-center py-2.5"
        >
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </>
  );
}

function getSafeRedirect(redirect: string | null): string {
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
    return "/dashboard";
  }

  return redirect;
}

function getOAuthErrorMessage(error: string | null): string {
  if (!error) return "";
  if (error === "AccessDenied") {
    return "We couldn't sign you in with that provider. If you already have an account, sign in first, then connect it from Settings.";
  }
  return "Sign in failed. Please try again.";
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
