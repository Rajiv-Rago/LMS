"use client";

import { createContext, useContext, useEffect } from "react";

export type Crumb = { label: string; href?: string };

// Setter lives in AppShell, which renders the trail in its desktop top bar.
export const BreadcrumbContext = createContext<(items: Crumb[]) => void>(
  () => {}
);

// Pages publish their trail into the top bar with this hook, e.g.
// useBreadcrumbs([{ label: "Module", href: "/..." }, { label: "Lesson" }]).
export function useBreadcrumbs(items: Crumb[]) {
  const setCrumbs = useContext(BreadcrumbContext);
  const key = JSON.stringify(items);
  useEffect(() => {
    setCrumbs(JSON.parse(key));
    return () => setCrumbs([]);
  }, [key, setCrumbs]);
}
