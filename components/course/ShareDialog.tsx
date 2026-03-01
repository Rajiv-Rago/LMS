"use client";

import { useState, useEffect, useCallback } from "react";

interface SharedUser {
  _id: string;
  name: string;
  email: string;
}

interface ShareDialogProps {
  courseId: string;
  open: boolean;
  onClose: () => void;
}

export default function ShareDialog({
  courseId,
  open,
  onClose,
}: ShareDialogProps) {
  const [email, setEmail] = useState("");
  const [sharedWith, setSharedWith] = useState<SharedUser[]>([]);
  const [maxShares, setMaxShares] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchShares = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/share`);
      if (res.ok) {
        const data = await res.json();
        setSharedWith(data.sharedWith || []);
        setMaxShares(data.maxShares);
      }
    } catch {
      /* ignore */
    }
  }, [courseId]);

  useEffect(() => {
    if (open) {
      setError("");
      setSuccess("");
      fetchShares();
    }
  }, [open, fetchShares]);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch(`/api/courses/${courseId}/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setSuccess(`Shared with ${data.sharedUser.name}`);
        setEmail("");
        setSharedWith((prev) => [...prev, data.sharedUser]);
      }
    } catch {
      setError("Failed to share course");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      const res = await fetch(
        `/api/courses/${courseId}/share?userId=${userId}`,
        {
          method: "DELETE",
          headers: { "X-Requested-With": "XMLHttpRequest" },
        }
      );

      if (res.ok) {
        setSharedWith((prev) => prev.filter((u) => u._id !== userId));
      }
    } catch {
      /* ignore */
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Share Course
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleShare} className="flex gap-2 mb-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter email address"
            className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Share
          </button>
        </form>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-3">
            {success}
          </p>
        )}

        {maxShares !== null && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
            {sharedWith.length}/{maxShares} shares used
          </p>
        )}

        {sharedWith.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Shared with
            </h3>
            {sharedWith.map((user) => (
              <div
                key={user._id}
                className="flex items-center justify-between py-2 px-3 rounded-md bg-zinc-50 dark:bg-zinc-800/50"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    {user.name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {user.email}
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(user._id)}
                  className="text-xs text-red-600 hover:text-red-500 font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
