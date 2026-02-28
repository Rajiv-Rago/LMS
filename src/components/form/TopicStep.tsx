"use client";

import React from "react";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { PathFormData, SkillLevel } from "@/lib/types";

interface TopicStepProps {
  data: PathFormData;
  onChange: (updates: Partial<PathFormData>) => void;
  errors: Record<string, string>;
}

const SKILL_OPTIONS = [
  { value: "complete_beginner", label: "Complete Beginner" },
  { value: "some_basics", label: "Some Basics" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced (filling gaps)" },
];

const GOAL_EXAMPLES = [
  "Build a personal website",
  "Have basic conversations in Spanish",
  "Produce electronic music",
  "Pass the AWS certification exam",
  "Create a mobile app from scratch",
];

export default function TopicStep({ data, onChange, errors }: TopicStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">
          What do you want to learn?
        </h2>
        <p className="text-yt-gray-2 text-sm">
          Tell us about your learning goals and we&apos;ll build a personalized
          YouTube learning path.
        </p>
      </div>

      <Input
        label="Topic"
        placeholder='e.g., "React", "Spanish", "Digital Marketing", "Piano"'
        value={data.topic}
        onChange={(e) => onChange({ topic: e.target.value })}
        error={errors.topic}
      />

      <Select
        label="Current skill level"
        options={SKILL_OPTIONS}
        value={data.skillLevel}
        onChange={(e) =>
          onChange({ skillLevel: e.target.value as SkillLevel })
        }
      />

      <div>
        <Textarea
          label="Learning goal"
          placeholder="Why are you learning this? What do you want to be able to do?"
          value={data.learningGoal}
          onChange={(e) => onChange({ learningGoal: e.target.value })}
          error={errors.learningGoal}
          rows={3}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {GOAL_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onChange({ learningGoal: example })}
              className="text-xs px-3 py-1 rounded-full bg-yt-dark-3 text-yt-gray-1 hover:bg-yt-dark-4 hover:text-white transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
