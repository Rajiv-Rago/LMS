"use client";

import React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export default function Select({
  label,
  options,
  className = "",
  id,
  ...props
}: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-yt-gray-1 mb-1.5"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full bg-yt-dark-3 border border-yt-dark-4 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-yt-red focus:ring-1 focus:ring-yt-red transition-colors appearance-none cursor-pointer ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
