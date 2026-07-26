"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type SendState = "idle" | "sending" | "sent" | "error";

export default function VerifyEmailBanner() {
  const [dismissed, setDismissed] = useState(true);
  const [sendState, setSendState] = useState<SendState>("idle");

  // sessionStorage isn't available during SSR — resolve dismissal after mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(sessionStorage.getItem("verify-banner-dismissed") === "1");
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    sessionStorage.setItem("verify-banner-dismissed", "1");
    setDismissed(true);
  };

  const resend = async () => {
    setSendState("sending");
    try {
      const res = await fetch("/api/auth/verify-email/resend", {
        method: "POST",
        headers: { "x-requested-with": "XMLHttpRequest" },
      });
      setSendState(res.ok ? "sent" : "error");
    } catch {
      setSendState("error");
    }
  };

  return (
    <div className="mx-4 mt-4 lg:mx-6 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <p className="flex-1">
        Please verify your email address to unlock AI generation and course
        publishing.{" "}
        {sendState === "sent" ? (
          <span className="font-medium">Verification email sent.</span>
        ) : sendState === "error" ? (
          <span className="font-medium">Failed to send — try again later.</span>
        ) : (
          <button
            onClick={resend}
            disabled={sendState === "sending"}
            className="font-medium underline hover:no-underline disabled:opacity-50"
          >
            {sendState === "sending" ? "Sending…" : "Resend email"}
          </button>
        )}
      </p>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
