// Axiom logger — lazy-initialized, server-only.
// Uses conditional require() to prevent @axiomhq packages from being
// bundled into the client (they depend on Node.js AsyncLocalStorage).

interface AxiomLog {
  info(message: string, args?: Record<string, unknown>): void;
  warn(message: string, args?: Record<string, unknown>): void;
  error(message: string, args?: Record<string, unknown>): void;
  flush(): Promise<void>;
}

let _resolved = false;
let _logger: AxiomLog | null = null;

function resolve(): AxiomLog | null {
  if (_resolved) return _logger;
  _resolved = true;

  if (typeof window !== "undefined") return null;

  const token = process.env.NEXT_PUBLIC_AXIOM_TOKEN;
  const dataset = process.env.NEXT_PUBLIC_AXIOM_DATASET;
  if (!token || !dataset) return null;

  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { AxiomWithoutBatching } = require("@axiomhq/js");
    const { Logger, AxiomJSTransport } = require("@axiomhq/logging");
    const { nextJsFormatters } = require("@axiomhq/nextjs");
    /* eslint-enable @typescript-eslint/no-require-imports */

    // AxiomWithoutBatching sends each ingest immediately — no batch timer
    // that could be killed when Vercel terminates the serverless function.
    const axiom = new AxiomWithoutBatching({ token });
    const transport = new AxiomJSTransport({ axiom, dataset });
    _logger = new Logger({
      transports: [transport],
      formatters: nextJsFormatters,
    });
  } catch {
    _logger = null;
  }

  return _logger;
}

export function getAxiomLogger(): AxiomLog | null {
  return resolve();
}

export async function flushAxiom(): Promise<void> {
  const logger = resolve();
  if (logger) await logger.flush();
}
