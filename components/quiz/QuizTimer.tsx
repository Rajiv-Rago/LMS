"use client";

import { useEffect, useState, useCallback } from "react";

interface QuizTimerProps {
  initialSeconds: number;
  onTimeUp: () => void;
  isPaused?: boolean;
}

export default function QuizTimer({
  initialSeconds,
  onTimeUp,
  isPaused = false,
}: QuizTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  const formatTime = useCallback((totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    if (isPaused || seconds <= 0) return;

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, seconds, onTimeUp]);

  // Determine urgency level for styling
  const isUrgent = seconds <= 60; // Last minute
  const isWarning = seconds <= 300 && seconds > 60; // Last 5 minutes

  let containerClasses =
    "fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 font-mono text-lg ";

  if (isUrgent) {
    containerClasses +=
      "bg-red-600 text-white animate-pulse";
  } else if (isWarning) {
    containerClasses +=
      "bg-yellow-500 text-yellow-900";
  } else {
    containerClasses +=
      "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700";
  }

  return (
    <div className={containerClasses}>
      <svg
        className={`w-5 h-5 ${isUrgent ? "animate-spin" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="font-semibold">{formatTime(seconds)}</span>
      {isUrgent && (
        <span className="text-sm ml-2">Time almost up!</span>
      )}
    </div>
  );
}
