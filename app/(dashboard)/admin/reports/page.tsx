"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/lib/hooks/useToast";
import { Skeleton } from "@/components/ui/Skeleton";

interface ReportRow {
  _id: string;
  reason: string;
  details?: string;
  status: string;
  createdAt: string;
  course: {
    _id: string;
    title: string;
    accessLevel: string;
    moderationRemovedAt?: string | null;
  } | null;
  reporter: { name: string; email: string } | null;
}

const REASON_STYLES: Record<string, string> = {
  spam: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
  copyright: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300",
  inappropriate: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300",
  other: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
};

export default function AdminReportsPage() {
  const toast = useToast();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [status, setStatus] = useState("open");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/reports?status=${status}`, {
        cache: "no-store",
      });
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  async function patch(url: string, body: object, successMsg: string) {
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(successMsg);
        fetchReports();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Action failed");
      }
    } catch {
      toast.error("Action failed");
    }
  }

  if (forbidden) {
    return (
      <div className="py-24 text-center">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Forbidden</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          You don&apos;t have access to this page.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Reports</h1>
        <select
          value={status}
          onChange={(e) => {
            setLoading(true);
            setStatus(e.target.value);
          }}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
        >
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No {status} reports.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const removed = !!report.course?.moderationRemovedAt;
            return (
              <div
                key={report._id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {report.course ? (
                    <Link
                      href={`/courses/${report.course._id}`}
                      className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {report.course.title}
                    </Link>
                  ) : (
                    <span className="text-sm text-zinc-500 italic">deleted course</span>
                  )}
                  <span
                    className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${
                      REASON_STYLES[report.reason] ?? REASON_STYLES.other
                    }`}
                  >
                    {report.reason}
                  </span>
                  {removed && (
                    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                      unpublished
                    </span>
                  )}
                  <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {report.details && (
                  <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                    {report.details}
                  </p>
                )}

                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Reported by {report.reporter ? `${report.reporter.name} (${report.reporter.email})` : "deleted user"}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {report.course && (
                    <button
                      onClick={() =>
                        patch(
                          `/api/admin/courses/${report.course!._id}/moderation`,
                          { removed: !removed },
                          removed ? "Course restored" : "Course unpublished"
                        )
                      }
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {removed ? "Restore" : "Unpublish"}
                    </button>
                  )}
                  {report.status === "open" && (
                    <>
                      <button
                        onClick={() =>
                          patch(
                            `/api/admin/reports/${report._id}`,
                            { status: "resolved" },
                            "Report resolved"
                          )
                        }
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-500"
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() =>
                          patch(
                            `/api/admin/reports/${report._id}`,
                            { status: "dismissed" },
                            "Report dismissed"
                          )
                        }
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
