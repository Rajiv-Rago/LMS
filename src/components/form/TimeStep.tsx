"use client";

import React from "react";
import Select from "@/components/ui/Select";
import { PathFormData, HoursPerWeek, Timeline } from "@/lib/types";

interface TimeStepProps {
  data: PathFormData;
  onChange: (updates: Partial<PathFormData>) => void;
}

const HOURS_OPTIONS = [
  { value: "2-3", label: "2-3 hours per week" },
  { value: "3-5", label: "3-5 hours per week" },
  { value: "5-10", label: "5-10 hours per week" },
  { value: "10+", label: "10+ hours per week" },
];

const TIMELINE_OPTIONS = [
  { value: "1_week", label: "1 week (intensive)" },
  { value: "2_weeks", label: "2 weeks" },
  { value: "1_month", label: "1 month" },
  { value: "2-3_months", label: "2-3 months" },
  { value: "no_rush", label: "No rush - learn at my pace" },
];

export default function TimeStep({ data, onChange }: TimeStepProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Time commitment</h2>
        <p className="text-yt-gray-2 text-sm">
          How much time can you dedicate? We&apos;ll build a schedule that fits.
        </p>
      </div>

      <Select
        label="How much time per week?"
        options={HOURS_OPTIONS}
        value={data.hoursPerWeek}
        onChange={(e) =>
          onChange({ hoursPerWeek: e.target.value as HoursPerWeek })
        }
      />

      <Select
        label="Timeline to complete"
        options={TIMELINE_OPTIONS}
        value={data.timeline}
        onChange={(e) => onChange({ timeline: e.target.value as Timeline })}
      />

      {/* Visual time summary */}
      <div className="bg-yt-dark-3 rounded-xl p-5 border border-yt-dark-4">
        <h3 className="text-sm font-medium text-yt-gray-1 mb-3">
          Your schedule at a glance
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-yt-red">
              {data.hoursPerWeek === "10+" ? "10+" : data.hoursPerWeek.split("-")[1] || data.hoursPerWeek}
            </div>
            <div className="text-xs text-yt-gray-2 mt-1">hours / week</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-white">
              {data.timeline === "no_rush"
                ? "Flex"
                : data.timeline.replace("_", " ").replace("2-3 months", "2-3mo")}
            </div>
            <div className="text-xs text-yt-gray-2 mt-1">target timeline</div>
          </div>
        </div>
      </div>
    </div>
  );
}
