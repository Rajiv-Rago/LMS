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

// Eagerly start loading AI handlers; consumers must await this before calling getHandler()
export const handlersReady: Promise<void> = import("./aiGeneration")
  .then(() => {})
  .catch(() => {});
