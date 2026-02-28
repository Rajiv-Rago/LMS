"use client";

import React from "react";

interface CheckboxProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}

export default function Checkbox({
  label,
  description,
  checked,
  onChange,
  id,
}: CheckboxProps) {
  const checkId = id || label.toLowerCase().replace(/\s+/g, "-");

  return (
    <label
      htmlFor={checkId}
      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
        checked
          ? "bg-yt-red/10 border border-yt-red/30"
          : "bg-yt-dark-3 border border-yt-dark-4 hover:border-yt-dark-4/80"
      }`}
    >
      <div className="flex items-center pt-0.5">
        <input
          type="checkbox"
          id={checkId}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
            checked
              ? "bg-yt-red border-yt-red"
              : "border-yt-dark-4 bg-transparent"
          }`}
        >
          {checked && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-white">{label}</span>
        {description && (
          <p className="text-xs text-yt-gray-2 mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
}
