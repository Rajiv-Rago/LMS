"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({
  label,
  error,
  className = "",
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-yt-gray-1 mb-1.5"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full bg-yt-dark-3 border border-yt-dark-4 rounded-lg px-4 py-2.5 text-white placeholder-yt-gray-2 focus:outline-none focus:border-yt-red focus:ring-1 focus:ring-yt-red transition-colors ${
          error ? "border-red-500" : ""
        } ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}
