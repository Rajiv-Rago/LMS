"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type AssignmentType = "standard" | "quiz" | "project";

interface Assignment {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  points: number;
  isPublished: boolean;
  assignmentType?: AssignmentType;
  module?: { title: string };
}

interface User {
  id: string;
  role: "student" | "teacher" | "admin";
}

export default function AssignmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<"all" | AssignmentType>("all");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    dueDate: "",
    points: 100,
    submissionType: "text" as "text" | "file" | "url",
    assignmentType: "standard" as AssignmentType,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [userRes, assignmentsRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch(`/api/courses/${id}/assignments`),
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.user);
        }

        if (!assignmentsRes.ok) {
          router.push(`/courses/${id}`);
          return;
        }

        const assignmentsData = await assignmentsRes.json();
        setAssignments(assignmentsData.assignments);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/courses/${id}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          dueDate: new Date(formData.dueDate).toISOString(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAssignments([...assignments, data.assignment]);
        setShowNew(false);
        setFormData({
          title: "",
          description: "",
          dueDate: "",
          points: 100,
          submissionType: "text",
          assignmentType: "standard",
        });
      }
    } catch (error) {
      console.error("Error creating assignment:", error);
    }
  };

  const isTeacher = user?.role === "teacher" || user?.role === "admin";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <Link
          href={`/courses/${id}`}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to course
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Assignments
        </h1>
        {isTeacher && (
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500"
          >
            New Assignment
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg w-fit">
        {[
          { value: "all", label: "All" },
          { value: "standard", label: "Standard" },
          { value: "quiz", label: "Quizzes" },
          { value: "project", label: "Projects" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value as typeof filter)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === tab.value
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {showNew && (
        <form
          onSubmit={handleCreate}
          className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Create Assignment
          </h2>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Title
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Description
            </label>
            <textarea
              rows={3}
              required
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Due Date
              </label>
              <input
                type="datetime-local"
                required
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Points
              </label>
              <input
                type="number"
                required
                min={0}
                max={1000}
                value={formData.points}
                onChange={(e) =>
                  setFormData({ ...formData, points: parseInt(e.target.value) })
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Assignment Type
              </label>
              <select
                value={formData.assignmentType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    assignmentType: e.target.value as AssignmentType,
                  })
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              >
                <option value="standard">Standard Assignment</option>
                <option value="quiz">Quiz</option>
                <option value="project">Project</option>
              </select>
            </div>

            {formData.assignmentType === "standard" && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Submission Type
                </label>
                <select
                  value={formData.submissionType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      submissionType: e.target.value as "text" | "file" | "url",
                    })
                  }
                  className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                >
                  <option value="text">Text</option>
                  <option value="file">File Upload</option>
                  <option value="url">URL</option>
                </select>
              </div>
            )}
          </div>

          {formData.assignmentType === "quiz" && (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm text-purple-700 dark:text-purple-300">
                After creating, edit the assignment to add quiz questions.
              </p>
            </div>
          )}

          {formData.assignmentType === "project" && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-300">
                After creating, edit the assignment to add project instructions and file settings.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-500"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {(() => {
        const filteredAssignments = assignments.filter((a) => {
          if (filter === "all") return true;
          return (a.assignmentType || "standard") === filter;
        });

        if (filteredAssignments.length === 0) {
          return (
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
              <p className="text-zinc-500 dark:text-zinc-400">
                {filter === "all"
                  ? "No assignments yet."
                  : `No ${filter === "standard" ? "standard assignments" : filter + "s"} yet.`}
              </p>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            {filteredAssignments.map((assignment) => {
              const isPastDue = new Date(assignment.dueDate) < new Date();
              const assignmentType = assignment.assignmentType || "standard";

              return (
                <Link
                  key={assignment._id}
                  href={`/courses/${id}/assignments/${assignment._id}`}
                  className="block bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 hover:border-blue-500 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-zinc-900 dark:text-white">
                          {assignment.title}
                        </h3>
                        {assignmentType === "quiz" && (
                          <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded">
                            Quiz
                          </span>
                        )}
                        {assignmentType === "project" && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">
                            Project
                          </span>
                        )}
                        {!assignment.isPublished && (
                          <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded">
                            Draft
                          </span>
                        )}
                        {isPastDue && assignment.isPublished && (
                          <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded">
                            Past Due
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">
                        {assignment.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-zinc-900 dark:text-white">
                        {assignment.points} pts
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Due {new Date(assignment.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
