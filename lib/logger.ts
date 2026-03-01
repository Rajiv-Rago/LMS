import { getAxiomLogger, flushAxiom } from "./axiom";

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
}

const isProduction = process.env.NODE_ENV === "production";

interface ErrorDetails {
  errorName: string;
  errorMessage: string;
  stack?: string;
}

function formatError(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      ...(!isProduction && { stack: error.stack }),
    };
  }
  return { errorName: "UnknownError", errorMessage: String(error) };
}

function serialize(entry: LogEntry): string {
  if (isProduction) {
    return JSON.stringify(entry);
  }

  const ts = entry.timestamp.split("T")[1]?.replace("Z", "") ?? entry.timestamp;
  const prefix = `[${ts}] ${entry.level.toUpperCase()}`;
  const ctx = entry.context
    ? `\n  ${JSON.stringify(entry.context, null, 2).replace(/\n/g, "\n  ")}`
    : "";
  return `${prefix}: ${entry.message}${ctx}`;
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context && { context }),
  };

  // Console output (always — for Vercel real-time logs + local dev)
  const output = serialize(entry);
  switch (level) {
    case "error":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    default:
      console.log(output);
  }

  // Axiom transport (when configured)
  const axiom = getAxiomLogger();
  if (axiom) {
    axiom[level](message, context);
  }
}

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    log("info", message, context);
  },
  warn(message: string, context?: Record<string, unknown>) {
    log("warn", message, context);
  },
  error(message: string, context?: Record<string, unknown>) {
    log("error", message, context);
  },
};

/**
 * Contract 6: Error Tracking Interface
 *
 * Structured error logging to console + Axiom.
 * Falls back to console-only when Axiom is not configured.
 */
export function captureException(
  error: Error | unknown,
  context?: Record<string, unknown>
) {
  const details = formatError(error);
  logger.error(details.errorMessage, {
    ...details,
    ...context,
  });
}

/**
 * Flush Axiom logs. Call before serverless functions terminate
 * to ensure buffered logs are sent.
 */
export { flushAxiom };
