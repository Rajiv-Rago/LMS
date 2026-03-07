"use client";

import type { LucideIcon } from "lucide-react";
import Button from "./Button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Icon
        className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mb-4"
        strokeWidth={1.5}
      />
      <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm text-center">
          {description}
        </p>
      )}
      {action && (
        <Button
          variant="primary"
          size="sm"
          className="mt-4"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
