"use client";

import { useEffect, useState } from "react";
import { ModelSelector, ModelSelectorValue } from "@/components/ai/ModelSelector";
import { useToast } from "@/lib/hooks/useToast";
import { Skeleton } from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import type { UserAIPreferences } from "@/lib/ai/types";
import { useConfirm } from "@/lib/hooks/useConfirm";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

interface ActiveSession {
  id: string;
  ip: string;
  userAgent: string;
  lastActiveAt: string;
  expiresAt: string;
  createdAt: string;
  isCurrent: boolean;
}

interface LinkedProvider {
  provider: string;
  displayName: string;
}

export default function SettingsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modelValue, setModelValue] = useState<ModelSelectorValue>({});
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionLoadError, setSessionLoadError] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [linkedProviders, setLinkedProviders] = useState<LinkedProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providerLoadError, setProviderLoadError] = useState(false);

  useEffect(() => {
    async function fetchPreferences() {
      try {
        const res = await fetch("/api/users/preferences");
        if (res.ok) {
          const data = await res.json();
          const prefs: UserAIPreferences = data.aiPreferences || {};
          if (prefs.defaultTier) {
            setModelValue({ tier: prefs.defaultTier });
          } else if (prefs.defaultProvider) {
            setModelValue({
              provider: prefs.defaultProvider,
              model: prefs.defaultModel,
            });
          }
        }
      } catch {
        // Handled by error boundary
      } finally {
        setLoading(false);
      }
    }
    fetchPreferences();
  }, []);

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await fetch("/api/auth/sessions");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSessions(data.data);
      } catch {
        setSessionLoadError(true);
      } finally {
        setLoadingSessions(false);
      }
    }

    fetchSessions();
  }, []);

  useEffect(() => {
    async function fetchLinkedProviders() {
      try {
        const res = await fetch("/api/auth/providers/linked");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setLinkedProviders(data.data);
      } catch {
        setProviderLoadError(true);
      } finally {
        setLoadingProviders(false);
      }
    }

    fetchLinkedProviders();
  }, []);

  const finishSignOut = async () => {
    await signOut({ redirect: false, redirectTo: "/login" });
    router.push("/login");
    router.refresh();
  };

  const revokeSession = async (session: ActiveSession) => {
    const confirmed = await confirm({
      title: session.isCurrent ? "Sign out this device?" : "Revoke session?",
      message: session.isCurrent
        ? "This will immediately sign you out of this device."
        : "This device will need to sign in again.",
      confirmLabel: session.isCurrent ? "Sign out" : "Revoke",
      destructive: true,
    });
    if (!confirmed) return;

    setRevokingSessionId(session.id);
    try {
      const res = await fetch(`/api/auth/sessions/${session.id}`, {
        method: "DELETE",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (!res.ok) throw new Error();

      if (session.isCurrent) {
        await finishSignOut();
        return;
      }

      setSessions((current) => current.filter((item) => item.id !== session.id));
      toast.success("Session revoked");
    } catch {
      toast.error("Failed to revoke session");
    } finally {
      setRevokingSessionId(null);
    }
  };

  const revokeAllSessions = async () => {
    const confirmed = await confirm({
      title: "Sign out everywhere?",
      message: "All devices, including this one, will need to sign in again.",
      confirmLabel: "Sign out everywhere",
      destructive: true,
    });
    if (!confirmed) return;

    setRevokingSessionId("all");
    try {
      const res = await fetch("/api/auth/sessions", {
        method: "DELETE",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (!res.ok) throw new Error();
      await finishSignOut();
    } catch {
      toast.error("Failed to sign out everywhere");
      setRevokingSessionId(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: Record<string, string | null> = {};

      if (modelValue.tier) {
        body.defaultTier = modelValue.tier;
        body.defaultProvider = null;
        body.defaultModel = null;
      } else if (modelValue.provider) {
        body.defaultTier = null;
        body.defaultProvider = modelValue.provider;
        body.defaultModel = modelValue.model || null;
      } else {
        body.defaultTier = null;
        body.defaultProvider = null;
        body.defaultModel = null;
      }

      const res = await fetch("/api/users/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success("AI preferences saved");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save preferences");
      }
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
          <div>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-24" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        Settings
      </h1>

      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
          AI Preferences
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Set your default AI model for content generation, AI tutor, and course
          creation. This can be overridden per action.
        </p>

        <ModelSelector value={modelValue} onChange={setModelValue} />

        <div className="mt-6 flex justify-end">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1">
          Connected Accounts
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          OAuth providers currently linked to your account.
        </p>

        {loadingProviders ? (
          <div className="space-y-2" aria-label="Loading connected accounts">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : providerLoadError ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load connected accounts.
          </p>
        ) : linkedProviders.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No connected accounts.
          </p>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {linkedProviders.map((provider) => (
              <div
                key={provider.provider}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between"
              >
                <span className="text-sm font-medium text-zinc-900 dark:text-white">
                  {provider.displayName}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Connected
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Active Sessions
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Review devices currently signed in to your account.
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={revokeAllSessions}
            disabled={loadingSessions || sessions.length === 0 || revokingSessionId !== null}
          >
            Sign out everywhere
          </Button>
        </div>

        {loadingSessions ? (
          <div className="space-y-3" aria-label="Loading active sessions">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : sessionLoadError ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load active sessions.
          </p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No active sessions found.
          </p>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                      {session.userAgent}
                    </p>
                    {session.isCurrent && (
                      <span className="rounded-full bg-green-100 dark:bg-green-900/50 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-200">
                        Current session
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {session.ip} · Last active{" "}
                    {new Date(session.lastActiveAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => revokeSession(session)}
                  disabled={revokingSessionId !== null}
                >
                  {session.isCurrent ? "Sign out" : "Revoke"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
