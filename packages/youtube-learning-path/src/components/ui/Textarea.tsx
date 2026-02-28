"use client";

import React from "react";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export default function Textarea({
  label,
  error,
  className = "",
  id,
  ...props
}: TextareaProps) {
  const textId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={textId}
          className="block text-sm font-medium text-yt-gray-1 mb-1.5"
        >
          {label}
        </label>
      )}
      <textarea
        id={textId}
        className={`w-full bg-yt-dark-3 border border-yt-dark-4 rounded-lg px-4 py-2.5 text-white placeholder-yt-gray-2 focus:outline-none focus:border-yt-red focus:ring-1 focus:ring-yt-red transition-colors resize-vertical min-h-[80px] ${
          error ? "border-red-500" : ""
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
