"use client";

import { useEffect, useState } from "react";

type AITier = "fast" | "balanced" | "powerful";

interface TierDetail {
  tier: AITier;
  label: string;
  description: string;
  available: boolean;
  resolvedProvider: string | null;
  resolvedModel: string | null;
}

interface AIConfig {
  tiers: TierDetail[];
  configuredProviders: string[];
}

export interface ModelSelectorValue {
  tier?: AITier;
  provider?: string;
  model?: string;
}

interface ModelSelectorProps {
  value: ModelSelectorValue;
  onChange: (value: ModelSelectorValue) => void;
  disabled?: boolean;
  className?: string;
}

let cachedConfig: AIConfig | null = null;

export function ModelSelector({
  value,
  onChange,
  disabled,
  className = "",
}: ModelSelectorProps) {
  const [config, setConfig] = useState<AIConfig | null>(cachedConfig);
  const [loading, setLoading] = useState(!cachedConfig);
  const [showAdvanced, setShowAdvanced] = useState(
    !!(value.provider && !value.tier)
  );

  useEffect(() => {
    if (cachedConfig) return;

    async function fetchConfig() {
      try {
        const res = await fetch("/api/ai/config");
        if (res.ok) {
          const data = await res.json();
          cachedConfig = data;
          setConfig(data);
        }
      } catch {
        // Silently fail — tiers just won't show
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
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
      onChange({ provider: value.provider, model: value.model });
    } else {
      onChange({ tier: value.tier });
    }
  };

  const resolvedInfo = config?.tiers.find((t) => t.tier === value.tier);

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
              disabled={disabled || !t.available}
              onClick={() => handleTierSelect(t.tier)}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                isSelected
                  ? "bg-blue-50 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200"
                  : t.available
                  ? "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  : "border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={t.description}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Resolved model info */}
      {value.tier && !showAdvanced && resolvedInfo?.resolvedModel && (
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          Using {resolvedInfo.resolvedModel} via{" "}
          {resolvedInfo.resolvedProvider}
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
                  provider: e.target.value || undefined,
                  model: value.model,
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
            <input
              type="text"
              disabled={disabled}
              value={value.model || ""}
              onChange={(e) =>
                onChange({
                  provider: value.provider,
                  model: e.target.value || undefined,
                })
              }
              placeholder="e.g., gpt-4o, claude-3-opus"
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 disabled:opacity-50"
            />
          </div>
        </div>
      )}
    </div>
  );
}
