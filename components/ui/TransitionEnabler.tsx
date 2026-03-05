"use client";

import { useEffect } from "react";

export function TransitionEnabler() {
  useEffect(() => {
    document.body.classList.add("transition-colors", "duration-200");
  }, []);

  return null;
}
