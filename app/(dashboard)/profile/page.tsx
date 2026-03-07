"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";

interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "teacher" | "admin";
  createdAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch {
        // Handled by error boundary
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/users/me/export");
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `user-data-export.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      // Silently fail
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/users/me/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (res.ok) {
        router.push("/login");
      } else {
        const data = await res.json();
        setDeleteError(data.error || "Failed to delete account");
      }
    } catch {
      setDeleteError("Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-24" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        Profile
      </h1>

      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
            <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-200">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {user.name}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{user.email}</p>
          </div>
        </div>

        <dl className="space-y-4">
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">
              Account Type
            </dt>
            <dd className="mt-1 text-sm text-zinc-900 dark:text-white capitalize">
              {user.role}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">
              Member Since
            </dt>
            <dd className="mt-1 text-sm text-zinc-900 dark:text-white">
              {new Date(user.createdAt).toLocaleDateString()}
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
          Data & Privacy
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                Export my data
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Download all your personal data as a JSON file.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? "Exporting..." : "Export"}
            </Button>
          </div>

          <hr className="border-zinc-200 dark:border-zinc-800" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">
                Delete my account
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Permanently delete your account and anonymize your data.
              </p>
            </div>
            <Button
              variant="danger"
              onClick={() => setShowDeleteDialog(true)}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
              Delete Account
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              This action is permanent. Your account will be anonymized and your
              data removed. Enter your password to confirm.
            </p>

            {deleteError && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/50 p-3 mb-4">
                <p className="text-sm text-red-700 dark:text-red-200">{deleteError}</p>
              </div>
            )}

            <form onSubmit={handleDeleteAccount}>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white mb-4"
              />
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setDeletePassword("");
                    setDeleteError("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete Account"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
