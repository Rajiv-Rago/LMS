"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export interface JobEntry {
  jobId: string;
  meta: Record<string, string>;
}

export interface JobResult {
  jobId: string;
  status: "completed" | "failed";
  result?: unknown;
  error?: string;
  meta: Record<string, string>;
}

interface UseJobPollerOptions {
  onComplete: (r: JobResult) => void;
  onFailed: (r: JobResult) => void;
  interval?: number;
}

export function useJobPoller({
  onComplete,
  onFailed,
  interval = 3000,
}: UseJobPollerOptions) {
  const jobsRef = useRef<Map<string, JobEntry>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeCount, setActiveCount] = useState(0);

  // Keep callbacks in refs so the interval closure always sees the latest
  const onCompleteRef = useRef(onComplete);
  const onFailedRef = useRef(onFailed);
  onCompleteRef.current = onComplete;
  onFailedRef.current = onFailed;

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    const jobs = Array.from(jobsRef.current.values());
    if (jobs.length === 0) return;

    const results = await Promise.allSettled(
      jobs.map(async (job) => {
        const res = await fetch(`/api/jobs/${job.jobId}`);
        if (!res.ok) return null;
        const data = await res.json();
        return { job, data };
      })
    );

    let changed = false;

    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value) continue;

      const { job, data } = result.value;
      const status = data.job?.status;

      if (status === "completed" || status === "failed") {
        jobsRef.current.delete(job.jobId);
        changed = true;

        const jobResult: JobResult = {
          jobId: job.jobId,
          status,
          result: data.job?.result,
          error: data.job?.error,
          meta: job.meta,
        };

        if (status === "completed") {
          onCompleteRef.current(jobResult);
        } else {
          onFailedRef.current(jobResult);
        }
      }
    }

    if (changed) {
      setActiveCount(jobsRef.current.size);
      if (jobsRef.current.size === 0) {
        stopPolling();
      }
    }
  }, [stopPolling]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(poll, interval);
    // Fire an immediate poll
    poll();
  }, [poll, interval]);

  const addJobs = useCallback(
    (jobs: JobEntry[]) => {
      for (const job of jobs) {
        jobsRef.current.set(job.jobId, job);
      }
      setActiveCount(jobsRef.current.size);
      if (jobs.length > 0) {
        startPolling();
      }
    },
    [startPolling]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return { addJobs, activeCount };
}
