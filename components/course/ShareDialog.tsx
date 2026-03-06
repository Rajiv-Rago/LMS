"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type AccessLevel = "restricted" | "unlisted" | "published";

interface SharedUser {
  _id: string;
  name: string;
  email: string;
}

interface ShareDialogProps {
  courseId: string;
  courseTitle?: string;
  currentAccessLevel?: AccessLevel;
  open: boolean;
  onClose: () => void;
  onAccessLevelChange?: (level: AccessLevel) => void;
}

const ACCESS_OPTIONS: {
  value: AccessLevel;
  label: string;
  description: string;
  icon: "lock" | "link" | "globe";
}[] = [
  {
    value: "restricted",
    label: "Restricted",
    description: "Only people added below can access",
    icon: "lock",
  },
  {
    value: "unlisted",
    label: "Anyone with the link",
    description: "Anyone with the link can view and enroll",
    icon: "link",
  },
  {
    value: "published",
    label: "Published to catalog",
    description: "Listed publicly in Explore. Anyone can discover and enroll",
    icon: "globe",
  },
];

function AccessIcon({ type, className }: { type: "lock" | "link" | "globe"; className?: string }) {
  switch (type) {
    case "lock":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      );
    case "link":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      );
    case "globe":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
}

export default function ShareDialog({
  courseId,
  courseTitle,
  currentAccessLevel,
  open,
  onClose,
  onAccessLevelChange,
}: ShareDialogProps) {
  const [email, setEmail] = useState("");
  const [sharedWith, setSharedWith] = useState<SharedUser[]>([]);
  const [maxShares, setMaxShares] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(currentAccessLevel ?? "restricted");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      setLinkCopied(false);
      setAccessLevel(currentAccessLevel ?? "restricted");
      fetchShares();
    }
  }, [open, fetchShares, currentAccessLevel]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  const handleAccessLevelChange = async (level: AccessLevel) => {
    setDropdownOpen(false);
    if (level === accessLevel) return;

    setAccessLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ accessLevel: level }),
      });

      if (res.ok) {
        setAccessLevel(level);
        onAccessLevelChange?.(level);
      }
    } catch {
      /* ignore */
    } finally {
      setAccessLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/courses/${courseId}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

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

  const currentOption = ACCESS_OPTIONS.find((o) => o.value === accessLevel) ?? ACCESS_OPTIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white truncate pr-4">
            {courseTitle ? `Share "${courseTitle}"` : "Share Course"}
          </h2>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* General access section */}
          {currentAccessLevel !== undefined && (
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">General access</p>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  disabled={accessLoading}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  <AccessIcon type={currentOption.icon} className="w-5 h-5 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{currentOption.label}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{currentOption.description}</p>
                  </div>
                  <svg className={`w-4 h-4 text-zinc-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg">
                    {ACCESS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleAccessLevelChange(option.value)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 first:rounded-t-md last:rounded-b-md transition-colors ${
                          option.value === accessLevel ? "bg-indigo-50 dark:bg-indigo-900/30" : ""
                        }`}
                      >
                        <AccessIcon type={option.icon} className={`w-5 h-5 flex-shrink-0 ${option.value === accessLevel ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-500 dark:text-zinc-400"}`} />
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${option.value === accessLevel ? "text-indigo-700 dark:text-indigo-300" : "text-zinc-900 dark:text-white"}`}>{option.label}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{option.description}</p>
                        </div>
                        {option.value === accessLevel && (
                          <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Add people section */}
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Add people</p>
            <form onSubmit={handleShare} className="flex gap-2">
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
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
            )}
            {success && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2">{success}</p>
            )}

            {maxShares !== null && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                {sharedWith.length}/{maxShares} shares used
              </p>
            )}

            {sharedWith.length > 0 && (
              <div className="mt-3 space-y-2">
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

          {/* Copy link section */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-zinc-200 dark:border-zinc-800 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {linkCopied ? "Link copied!" : "Copy link"}
          </button>

          {/* Done button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
