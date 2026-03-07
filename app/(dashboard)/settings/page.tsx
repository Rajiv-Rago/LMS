"use client";

import { useEffect, useState } from "react";
import { ModelSelector, ModelSelectorValue } from "@/components/ai/ModelSelector";
import { useToast } from "@/lib/hooks/useToast";
import { Skeleton } from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import type { UserAIPreferences } from "@/lib/ai/types";

export default function SettingsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modelValue, setModelValue] = useState<ModelSelectorValue>({});

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
    </div>
  );
}
