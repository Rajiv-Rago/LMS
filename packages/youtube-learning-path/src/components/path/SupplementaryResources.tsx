"use client";

import React from "react";
import { SupplementaryResource } from "@/lib/types";

interface SupplementaryResourcesProps {
  resources: SupplementaryResource[];
}

const TYPE_ICONS: Record<string, string> = {
  documentation: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  platform: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  community: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  cheatsheet: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z",
  reading: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
};

export default function SupplementaryResources({
  resources,
}: SupplementaryResourcesProps) {
  if (!resources || resources.length === 0) return null;

  return (
    <div className="bg-yt-dark-2 rounded-xl border border-yt-dark-4 p-5">
      <h2 className="text-lg font-bold text-white mb-4">
        Supplementary Resources
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {resources.map((resource, i) => (
          <a
            key={i}
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 p-3 bg-yt-dark-3 rounded-lg border border-yt-dark-4 hover:border-yt-gray-3 transition-colors group"
          >
            <svg
              className="w-5 h-5 text-yt-gray-2 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={TYPE_ICONS[resource.type] || TYPE_ICONS.reading}
              />
            </svg>
            <div className="min-w-0">
              <div className="text-sm font-medium text-white group-hover:text-yt-red transition-colors">
                {resource.title}
              </div>
              <div className="text-xs text-yt-gray-2 mt-0.5">
                {resource.description}
              </div>
              <div className="text-xs text-yt-gray-3 capitalize mt-1">
                {resource.type}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
