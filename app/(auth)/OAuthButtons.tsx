"use client";

import { signIn } from "next-auth/react";
import Button from "@/components/ui/Button";

interface OAuthButtonsProps {
  redirectTo: string;
}

const providers = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
] as const;

export default function OAuthButtons({ redirectTo }: OAuthButtonsProps) {
  return (
    <div className="mt-8 space-y-3">
      {providers.map((provider) => (
        <Button
          key={provider.id}
          type="button"
          variant="secondary"
          className="w-full justify-center py-2.5"
          onClick={() => signIn(provider.id, { redirectTo })}
        >
          Continue with {provider.label}
        </Button>
      ))}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-zinc-50 dark:bg-zinc-950 px-2 text-xs text-zinc-500 dark:text-zinc-400">
            or
          </span>
        </div>
      </div>
    </div>
  );
}
