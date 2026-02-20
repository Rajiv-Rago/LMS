"use client";

import React from "react";
import { ToastContext, useToastState, type Toast as ToastItem } from "@/lib/hooks/useToast";

const icons: Record<ToastItem["type"], string> = {
  success: "M5 13l4 4L19 7",
  error: "M6 18L18 6M6 6l12 12",
  warning: "M12 9v2m0 4h.01M12 3l9.66 16.5H2.34L12 3z",
  info: "M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20 10 10 0 010-20z",
};

const styles: Record<ToastItem["type"], string> = {
  success:
    "bg-green-50 dark:bg-green-900/50 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800",
  error:
    "bg-red-50 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800",
  warning:
    "bg-yellow-50 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800",
  info: "bg-blue-50 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      role="alert"
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-in slide-in-from-right ${styles[toast.type]}`}
    >
      <svg
        className="h-5 w-5 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={icons[toast.type]} />
      </svg>
      <p className="text-sm font-medium flex-1">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 ml-2 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss notification"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const state = useToastState();

  return (
    <ToastContext value={state}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80"
      >
        {state.toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={state.removeToast} />
        ))}
      </div>
    </ToastContext>
  );
}
