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
      stack: error.stack,
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
 * Phase 1: Wrapper around logger.error (no external service).
 * Phase 2: Integrate Sentry or similar when ready for production.
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
