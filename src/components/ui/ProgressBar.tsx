"use client";

import React from "react";

interface ProgressBarProps {
  value: number; // 0-100
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  color?: "red" | "green" | "blue";
}

export default function ProgressBar({
  value,
  size = "md",
  showLabel = true,
  color = "red",
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  const heights = { sm: "h-1.5", md: "h-2.5", lg: "h-4" };
  const colors = {
    red: "bg-yt-red",
    green: "bg-green-500",
    blue: "bg-blue-500",
  };

  return (
    <div className="w-full">
      <div className={`w-full bg-yt-dark-4 rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`${colors[color]} ${heights[size]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-yt-gray-2 mt-1">{Math.round(clamped)}% complete</p>
      )}
    </div>
  );
}
