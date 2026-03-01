import { Axiom } from "@axiomhq/js";
import { Logger, AxiomJSTransport } from "@axiomhq/logging";
import { nextJsFormatters } from "@axiomhq/nextjs";

// Read directly from process.env to avoid coupling with lib/env.ts
// (logger.ts is imported very early, before env validation in some contexts)
const token = process.env.NEXT_PUBLIC_AXIOM_TOKEN;
const dataset = process.env.NEXT_PUBLIC_AXIOM_DATASET;

export let axiomLogger: Logger | null = null;

if (token && dataset) {
  const axiom = new Axiom({ token });
  const transport = new AxiomJSTransport({ axiom, dataset });
  axiomLogger = new Logger({
    transports: [transport],
    formatters: nextJsFormatters,
  });
}

export async function flushAxiom(): Promise<void> {
  if (axiomLogger) {
    await axiomLogger.flush();
  }
}
