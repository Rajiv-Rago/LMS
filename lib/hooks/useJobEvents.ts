"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { JobEntry, JobResult } from "./useJobPoller";

interface UseJobEventsOptions {
  onComplete: (r: JobResult) => void;
  onFailed: (r: JobResult) => void;
}

const FALLBACK_POLL_MS = 3000;
const FALLBACK_MAX_MISSES = 5;

/**
 * Push-based job tracker. Opens one EventSource per job to
 * GET /api/jobs/:id/stream and resolves via onComplete/onFailed.
 * Falls back to GET polling when EventSource is unavailable (or errors
 * before the first event), so jsdom/tests and old browsers keep working.
 */
export function useJobEvents({ onComplete, onFailed }: UseJobEventsOptions) {
  const [activeCount, setActiveCount] = useState(0);
  const sourcesRef = useRef<Map<string, { entry: JobEntry; source: EventSource | null }>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const onCompleteRef = useRef(onComplete);
  const onFailedRef = useRef(onFailed);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onFailedRef.current = onFailed;
  }, [onComplete, onFailed]);

  const finish = useCallback((jobId: string, status: "completed" | "failed", result?: unknown, error?: string) => {
    const tracked = sourcesRef.current.get(jobId);
    if (!tracked) return;
    try {
      tracked.source?.close();
    } catch {
      // Ignore close errors
    }
    const timer = timersRef.current.get(jobId);
    if (timer) {
      clearInterval(timer);
      timersRef.current.delete(jobId);
    }
    sourcesRef.current.delete(jobId);
    setActiveCount(sourcesRef.current.size);

    const jobResult: JobResult = { jobId, status, result, error, meta: tracked.entry.meta };
    if (status === "completed") onCompleteRef.current(jobResult);
    else onFailedRef.current(jobResult);
  }, []);

  const startFallbackPolling = useCallback(
    (jobId: string) => {
      if (timersRef.current.has(jobId)) return;
      let misses = 0;
      const pollOnce = async () => {
        if (!sourcesRef.current.has(jobId)) return;
        try {
          const res = await fetch(`/api/jobs/${jobId}`);
          if (!res.ok) {
            misses += 1;
            if (misses >= FALLBACK_MAX_MISSES) {
              finish(jobId, "failed", undefined, "Job not found — please try again");
            }
            return;
          }
          misses = 0;
          const data = await res.json();
          const status = data.job?.status;
          if (status === "completed" || status === "failed") {
            finish(jobId, status, data.job?.result, data.job?.error);
          }
        } catch {
          misses += 1;
          if (misses >= FALLBACK_MAX_MISSES) {
            finish(jobId, "failed", undefined, "Job tracking failed — please try again");
          }
        }
      };
      pollOnce();
      timersRef.current.set(jobId, setInterval(pollOnce, FALLBACK_POLL_MS));
    },
    [finish]
  );

  const trackJob = useCallback(
    (entry: JobEntry) => {
      if (sourcesRef.current.has(entry.jobId)) return;
      sourcesRef.current.set(entry.jobId, { entry, source: null });
      setActiveCount(sourcesRef.current.size);

      if (typeof EventSource === "undefined") {
        startFallbackPolling(entry.jobId);
        return;
      }

      try {
        const source = new EventSource(`/api/jobs/${entry.jobId}/stream`);
        sourcesRef.current.set(entry.jobId, { entry, source });
        let gotEvent = false;

        source.addEventListener("status", (e) => {
          gotEvent = true;
          try {
            const data = JSON.parse((e as MessageEvent).data);
            if (data.status === "completed" || data.status === "failed") {
              finish(entry.jobId, data.status, data.result, data.error);
            }
          } catch {
            // Malformed event — keep waiting
          }
        });

        source.addEventListener("error", () => {
          // Stream-level error (e.g. 404/401 or network drop). If we never got
          // an event, the stream endpoint is unreachable — fall back to polling.
          if (!gotEvent) {
            try {
              source.close();
            } catch {
              // Ignore
            }
            const tracked = sourcesRef.current.get(entry.jobId);
            if (tracked) sourcesRef.current.set(entry.jobId, { entry, source: null });
            startFallbackPolling(entry.jobId);
          } else {
            finish(entry.jobId, "failed", undefined, "Lost connection to job — please try again");
          }
        });
      } catch {
        startFallbackPolling(entry.jobId);
      }
    },
    [finish, startFallbackPolling]
  );

  const addJobs = useCallback(
    (jobs: JobEntry[]) => {
      for (const job of jobs) trackJob(job);
    },
    [trackJob]
  );

  const removeJobs = useCallback((jobIds: string[]) => {
    for (const jobId of jobIds) {
      const tracked = sourcesRef.current.get(jobId);
      if (!tracked) continue;
      try {
        tracked.source?.close();
      } catch {
        // Ignore
      }
      const timer = timersRef.current.get(jobId);
      if (timer) {
        clearInterval(timer);
        timersRef.current.delete(jobId);
      }
      sourcesRef.current.delete(jobId);
    }
    setActiveCount(sourcesRef.current.size);
  }, []);

  useEffect(() => {
    const sources = sourcesRef.current;
    const timers = timersRef.current;
    return () => {
      for (const { source } of sources.values()) {
        try {
          source?.close();
        } catch {
          // Ignore
        }
      }
      for (const timer of timers.values()) clearInterval(timer);
      sources.clear();
      timers.clear();
    };
  }, []);

  return { addJobs, removeJobs, activeCount };
}
