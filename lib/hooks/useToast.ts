"use client";

import { createContext, useContext, useCallback, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 5000;

export function useToastState() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string) => {
      const id = String(++nextId);
      setToasts((prev) => {
        const next = [...prev, { id, type, message }];
        return next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next;
      });
      setTimeout(() => removeToast(id), AUTO_DISMISS_MS);
    },
    [removeToast]
  );

  return { toasts, addToast, removeToast };
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return {
    success: (message: string) => ctx.addToast("success", message),
    error: (message: string) => ctx.addToast("error", message),
    warning: (message: string) => ctx.addToast("warning", message),
    info: (message: string) => ctx.addToast("info", message),
  };
}
