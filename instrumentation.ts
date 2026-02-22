export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.QUEUE_ENABLED === "true"
  ) {
    const { startWorker } = await import("./lib/queue/worker");
    await startWorker();
  }
}
