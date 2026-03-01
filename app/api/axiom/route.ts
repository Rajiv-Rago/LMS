import { createProxyRouteHandler } from "@axiomhq/nextjs";
import type { Logger } from "@axiomhq/logging";
import { getAxiomLogger } from "@/lib/axiom";

// getAxiomLogger() returns a real Logger instance at runtime;
// cast needed because lib/axiom uses a minimal interface to avoid static imports.
const axiomLogger = getAxiomLogger() as Logger | null;

export const POST = axiomLogger
  ? createProxyRouteHandler(axiomLogger)
  : async () => new Response("Axiom not configured", { status: 503 });
