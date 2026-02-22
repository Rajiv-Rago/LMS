export type JobHandler = (
  data: Record<string, unknown>
) => Promise<Record<string, unknown>>;

const handlers = new Map<string, JobHandler>();

export function registerHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

export function getHandler(type: string): JobHandler | undefined {
  return handlers.get(type);
}

// Auto-register AI generation handlers on import
import("./aiGeneration").catch(() => {
  // Silently fail if handlers can't be loaded
});
