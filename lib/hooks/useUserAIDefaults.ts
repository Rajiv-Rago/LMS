"use client";

import { useEffect, useState } from "react";
import type { ModelSelectorValue } from "@/components/ai/ModelSelector";

const DEFAULT_VALUE: ModelSelectorValue = { tier: "balanced" };

/**
 * Fetches the user's saved AI preferences and returns a ModelSelectorValue.
 * Falls back to { tier: "balanced" } if no preferences are saved.
 */
export function useUserAIDefaults(): { value: ModelSelectorValue; loading: boolean } {
  const [value, setValue] = useState<ModelSelectorValue>(DEFAULT_VALUE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchPrefs() {
      try {
        const res = await fetch("/api/users/preferences");
        if (res.ok && !cancelled) {
          const data = await res.json();
          const prefs = data.aiPreferences;
          if (prefs?.defaultTier) {
            setValue({ tier: prefs.defaultTier });
          } else if (prefs?.defaultProvider) {
            setValue({ provider: prefs.defaultProvider, model: prefs.defaultModel });
          }
          // If no prefs saved, keep the default
        }
      } catch {
        // Keep default on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPrefs();
    return () => { cancelled = true; };
  }, []);

  return { value, loading };
}
