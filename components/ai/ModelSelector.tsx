"use client";

import { useEffect, useState, useRef } from "react";
import type { AITier, AIProviderName } from "@/lib/ai/types";

interface TierDetail {
  tier: AITier;
  label: string;
  description: string;
  available: boolean;
  resolvedProvider: string | null;
  resolvedModel: string | null;
  resolvedDisplayName: string | null;
  resolvedProviderDisplayName: string | null;
}

interface AvailableModel {
  id: string;
  displayName: string;
  provider: AIProviderName;
  providerDisplayName: string;
}

interface AIConfig {
  tiers: TierDetail[];
  configuredProviders: string[];
  availableModels: AvailableModel[];
}

export interface ModelSelectorValue {
  tier?: AITier;
  provider?: AIProviderName;
  model?: string;
}

interface ModelSelectorProps {
  value: ModelSelectorValue;
  onChange: (value: ModelSelectorValue) => void;
  disabled?: boolean;
  className?: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedConfig: AIConfig | null = null;
let cachedAt = 0;

function getCachedConfig(): AIConfig | null {
  if (cachedConfig && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedConfig;
  }
  cachedConfig = null;
  return null;
}

function setCachedConfig(config: AIConfig) {
  cachedConfig = config;
  cachedAt = Date.now();
}

export function ModelSelector({
  value,
  onChange,
  disabled,
  className = "",
}: ModelSelectorProps) {
  const cached = getCachedConfig();
  const [config, setConfig] = useState<AIConfig | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [showAdvanced, setShowAdvanced] = useState(
    !!(value.provider && !value.tier)
  );
  const lastTierRef = useRef<AITier | undefined>(value.tier);

  // Track the last selected tier so we can restore it when toggling back from advanced
  useEffect(() => {
    if (value.tier) {
      lastTierRef.current = value.tier;
    }
  }, [value.tier]);

  useEffect(() => {
    if (getCachedConfig()) return;

    let cancelled = false;
    async function fetchConfig() {
      try {
        const res = await fetch("/api/ai/config");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setCachedConfig(data);
          setConfig(data);
        }
      } catch {
        // Silently fail — tiers just won't show
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchConfig();
    return () => { cancelled = true; };
  }, []);

  const handleTierSelect = (tier: AITier) => {
    if (disabled) return;
    setShowAdvanced(false);
    onChange({ tier });
  };

  const handleAdvancedToggle = () => {
    if (disabled) return;
    const next = !showAdvanced;
    setShowAdvanced(next);
    if (next) {
      // Entering advanced mode — clear tier, keep provider/model
      onChange({ provider: value.provider, model: value.model });
    } else {
      // Leaving advanced mode — restore last selected tier
      onChange({ tier: lastTierRef.current || "balanced" });
    }
  };

  const resolvedInfo = config?.tiers.find((t) => t.tier === value.tier);

  // Filter available models by selected provider in advanced mode
  const filteredModels = config?.availableModels.filter(
    (m) => !value.provider || m.provider === value.provider
  ) ?? [];

  if (loading) {
    return (
      <div className={`animate-pulse space-y-3 ${className}`}>
        <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-700 rounded" />
        <div className="flex gap-2">
          <div className="h-10 flex-1 bg-zinc-200 dark:bg-zinc-700 rounded-md" />
          <div className="h-10 flex-1 bg-zinc-200 dark:bg-zinc-700 rounded-md" />
          <div className="h-10 flex-1 bg-zinc-200 dark:bg-zinc-700 rounded-md" />
        </div>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
        AI Model
      </label>

      {/* Tier Buttons */}
      <div className="flex gap-2">
        {config.tiers.map((t) => {
          const isSelected = value.tier === t.tier && !showAdvanced;
          return (
            <button
              key={t.tier}
              type="button"
              disabled={disabled}
              onClick={() => handleTierSelect(t.tier)}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                isSelected
                  ? "bg-indigo-50 dark:bg-indigo-900/50 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-200"
                  : "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={t.description}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Resolved model info — display names */}
      {value.tier && !showAdvanced && (
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {resolvedInfo?.resolvedDisplayName
            ? `Using ${resolvedInfo.resolvedDisplayName} via ${resolvedInfo.resolvedProviderDisplayName}`
            : "Using your default model"}
        </p>
      )}

      {/* Advanced Toggle */}
      <button
        type="button"
        onClick={handleAdvancedToggle}
        disabled={disabled}
        className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50"
      >
        <svg
          className={`w-3 h-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        Advanced
      </button>

      {/* Advanced Fields */}
      {showAdvanced && (
        <div className="mt-2 space-y-3 pl-4 border-l-2 border-zinc-200 dark:border-zinc-700">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Provider
            </label>
            <select
              disabled={disabled}
              value={value.provider || ""}
              onChange={(e) =>
                onChange({
                  provider: (e.target.value || undefined) as AIProviderName | undefined,
                  model: undefined, // Reset model when provider changes
                })
              }
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white disabled:opacity-50"
            >
              <option value="">Use default</option>
              {config.configuredProviders.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Model
            </label>
            <select
              disabled={disabled}
              value={value.model || ""}
              onChange={(e) =>
                onChange({
                  provider: value.provider,
                  model: e.target.value || undefined,
                })
              }
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white disabled:opacity-50"
            >
              <option value="">Use default</option>
              {filteredModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName} ({m.providerDisplayName})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
