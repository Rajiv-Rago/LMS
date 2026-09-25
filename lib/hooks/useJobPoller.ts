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
  /** Consecutive failed lookups per job before giving up (default 5). Prevents infinite 404 loops. */
  maxMisses?: number;
}

export function useJobPoller({
  onComplete,
  onFailed,
  interval = 3000,
  maxMisses = 5,
}: UseJobPollerOptions) {
  const jobsRef = useRef<Map<string, JobEntry>>(new Map());
  const missesRef = useRef<Map<string, number>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeCount, setActiveCount] = useState(0);

  // Keep callbacks in refs so the interval closure always sees the latest
  const onCompleteRef = useRef(onComplete);
  const onFailedRef = useRef(onFailed);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onFailedRef.current = onFailed;
  }, [onComplete, onFailed]);

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
        try {
          const res = await fetch(`/api/jobs/${job.jobId}`);
          if (!res.ok) return { job, data: null as unknown, missed: true };
          const data = await res.json();
          return { job, data, missed: false };
        } catch {
          return { job, data: null as unknown, missed: true };
        }
      })
    );

    let changed = false;

    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value) continue;

      const { job, data, missed } = result.value;

      if (missed || !data) {
        const misses = (missesRef.current.get(job.jobId) ?? 0) + 1;
        if (misses >= maxMisses) {
          jobsRef.current.delete(job.jobId);
          missesRef.current.delete(job.jobId);
          changed = true;
          onFailedRef.current({
            jobId: job.jobId,
            status: "failed",
            error: "Job not found — please try again",
            meta: job.meta,
          });
        } else {
          missesRef.current.set(job.jobId, misses);
        }
        continue;
      }

      missesRef.current.delete(job.jobId);
      const status = (data as { job?: { status?: string } }).job?.status;

      if (status === "completed" || status === "failed") {
        jobsRef.current.delete(job.jobId);
        changed = true;

        const jobResult: JobResult = {
          jobId: job.jobId,
          status,
          result: (data as { job?: { result?: unknown } }).job?.result,
          error: (data as { job?: { error?: string } }).job?.error,
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
  }, [stopPolling, maxMisses]);

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

  const removeJobs = useCallback((jobIds: string[]) => {
    for (const jobId of jobIds) {
      jobsRef.current.delete(jobId);
      missesRef.current.delete(jobId);
    }
    setActiveCount(jobsRef.current.size);
  }, []);

  return { addJobs, removeJobs, activeCount };
}
