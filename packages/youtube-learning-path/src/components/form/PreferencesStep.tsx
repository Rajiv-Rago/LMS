"use client";

import React from "react";
import Checkbox from "@/components/ui/Checkbox";
import {
  PathFormData,
  VideoLength,
  TeachingStyle,
  CreatorType,
} from "@/lib/types";

interface PreferencesStepProps {
  data: PathFormData;
  onChange: (updates: Partial<PathFormData>) => void;
}

const VIDEO_LENGTHS: { value: VideoLength; label: string; desc: string }[] = [
  { value: "short", label: "Short (5-15 min)", desc: "Quick concepts" },
  { value: "medium", label: "Medium (15-45 min)", desc: "Standard tutorials" },
  { value: "long", label: "Long (45+ min)", desc: "Deep dives & full courses" },
  { value: "any", label: "Any length", desc: "No preference" },
];

const TEACHING_STYLES: { value: TeachingStyle; label: string; desc: string }[] = [
  { value: "straight_to_point", label: "Straight to the point", desc: "No fluff, just information" },
  { value: "detailed", label: "Detailed explanations", desc: "Thorough walkthroughs" },
  { value: "project_based", label: "Project-based", desc: "Build along with instructor" },
  { value: "theory_focused", label: "Theory-focused", desc: "Understand the why" },
  { value: "visual_animated", label: "Visual / animated", desc: "Diagrams and animations" },
  { value: "code_along", label: "Code-along / hands-on", desc: "Type along in real time" },
];

const CREATOR_TYPES: { value: CreatorType; label: string; desc: string }[] = [
  { value: "professional", label: "Professional instructors", desc: "Polished, structured content" },
  { value: "self_taught", label: "Self-taught creators", desc: "Relatable, practical approach" },
  { value: "university", label: "University lectures", desc: "Academic depth" },
  { value: "any_credible", label: "Any credible source", desc: "No preference" },
];

function toggleArray<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

export default function PreferencesStep({ data, onChange }: PreferencesStepProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">
          Learning preferences
        </h2>
        <p className="text-yt-gray-2 text-sm">
          Help us find videos that match your learning style.
        </p>
      </div>

      {/* Video length */}
      <div>
        <h3 className="text-sm font-medium text-yt-gray-1 mb-3">
          Video length preference
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {VIDEO_LENGTHS.map((opt) => (
            <Checkbox
              key={opt.value}
              label={opt.label}
              description={opt.desc}
              checked={data.videoLengths.includes(opt.value)}
              onChange={() =>
                onChange({
                  videoLengths: toggleArray(data.videoLengths, opt.value),
                })
              }
            />
          ))}
        </div>
      </div>

      {/* Teaching style */}
      <div>
        <h3 className="text-sm font-medium text-yt-gray-1 mb-3">
          Teaching style preference
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TEACHING_STYLES.map((opt) => (
            <Checkbox
              key={opt.value}
              label={opt.label}
              description={opt.desc}
              checked={data.teachingStyles.includes(opt.value)}
              onChange={() =>
                onChange({
                  teachingStyles: toggleArray(data.teachingStyles, opt.value),
                })
              }
            />
          ))}
        </div>
      </div>

      {/* Creator type */}
      <div>
        <h3 className="text-sm font-medium text-yt-gray-1 mb-3">
          Creator preference
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CREATOR_TYPES.map((opt) => (
            <Checkbox
              key={opt.value}
              label={opt.label}
              description={opt.desc}
              checked={data.creatorTypes.includes(opt.value)}
              onChange={() =>
                onChange({
                  creatorTypes: toggleArray(data.creatorTypes, opt.value),
                })
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
