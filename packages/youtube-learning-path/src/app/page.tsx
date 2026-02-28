"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import FormProgress from "@/components/form/FormProgress";
import TopicStep from "@/components/form/TopicStep";
import PreferencesStep from "@/components/form/PreferencesStep";
import TimeStep from "@/components/form/TimeStep";
import FiltersStep from "@/components/form/FiltersStep";
import Button from "@/components/ui/Button";
import { usePathContext } from "@/context/PathContext";
import { PathFormData } from "@/lib/types";

const STEPS = ["Topic", "Preferences", "Time", "Filters"];

const DEFAULT_FORM: PathFormData = {
  topic: "",
  skillLevel: "complete_beginner",
  learningGoal: "",
  videoLengths: [],
  teachingStyles: [],
  creatorTypes: [],
  hoursPerWeek: "3-5",
  timeline: "1_month",
  excludeFilters: [],
  includeFilters: [],
};

export default function HomePage() {
  const router = useRouter();
  const { generatePath, isGenerating, generationError, paths } =
    usePathContext();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<PathFormData>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateForm = (updates: Partial<PathFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    // Clear related errors
    const keys = Object.keys(updates);
    if (keys.some((k) => errors[k])) {
      setErrors((prev) => {
        const next = { ...prev };
        keys.forEach((k) => delete next[k]);
        return next;
      });
    }
  };

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 0) {
      if (!formData.topic.trim()) newErrors.topic = "Please enter a topic";
      if (!formData.learningGoal.trim())
        newErrors.learningGoal = "Please describe your learning goal";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const next = () => {
    if (validateStep()) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const handleGenerate = async () => {
    if (!validateStep()) return;
    try {
      await generatePath(formData);
      router.push("/path");
    } catch {
      // error is set in context
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-white mb-3">
          Build Your YouTube
          <span className="text-yt-red"> Learning Path</span>
        </h1>
        <p className="text-yt-gray-2 text-lg max-w-lg mx-auto">
          Tell us what you want to learn. We&apos;ll search YouTube, curate the
          best videos, and build a structured curriculum just for you.
        </p>
      </div>

      {/* Existing paths */}
      {paths.length > 0 && (
        <div className="mb-8 p-4 bg-yt-dark-2 rounded-xl border border-yt-dark-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-yt-gray-1">
              Your learning paths
            </h3>
            <a
              href="/path"
              className="text-xs text-yt-red hover:text-yt-red-hover transition-colors"
            >
              View all
            </a>
          </div>
          <div className="space-y-2">
            {paths.slice(0, 3).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  router.push(`/path?id=${p.id}`);
                }}
                className="w-full text-left p-3 bg-yt-dark-3 rounded-lg hover:bg-yt-dark-4 transition-colors flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-medium text-white">
                    {p.summary.topic}
                  </span>
                  <span className="text-xs text-yt-gray-2 ml-2">
                    {p.summary.totalVideos} videos | {p.summary.totalHours}h
                  </span>
                </div>
                <svg
                  className="w-4 h-4 text-yt-gray-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form progress */}
      <FormProgress currentStep={step} totalSteps={STEPS.length} steps={STEPS} />

      {/* Form card */}
      <div className="bg-yt-dark-2 rounded-2xl border border-yt-dark-4 p-6">
        {step === 0 && (
          <TopicStep data={formData} onChange={updateForm} errors={errors} />
        )}
        {step === 1 && (
          <PreferencesStep data={formData} onChange={updateForm} />
        )}
        {step === 2 && <TimeStep data={formData} onChange={updateForm} />}
        {step === 3 && <FiltersStep data={formData} onChange={updateForm} />}

        {/* Error display */}
        {generationError && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{generationError}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-5 border-t border-yt-dark-4">
          <Button
            variant="ghost"
            onClick={prev}
            disabled={step === 0}
            className={step === 0 ? "invisible" : ""}
          >
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={next}>
              Continue
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={handleGenerate}
              loading={isGenerating}
            >
              {isGenerating
                ? "Building your path..."
                : "Generate Learning Path"}
            </Button>
          )}
        </div>
      </div>

      {/* Generation loading overlay */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-yt-dark-2 rounded-2xl border border-yt-dark-4 p-8 max-w-md mx-4 text-center animate-pulse-glow">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="absolute inset-0 rounded-full border-4 border-yt-dark-4" />
              <div className="absolute inset-0 rounded-full border-4 border-yt-red border-t-transparent animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Building Your Learning Path
            </h3>
            <div className="space-y-2 text-sm text-yt-gray-2">
              <p>Searching YouTube for the best videos...</p>
              <p>Analyzing content quality and relevance...</p>
              <p>Organizing into a structured curriculum...</p>
            </div>
            <p className="text-xs text-yt-gray-3 mt-4">
              This may take 15-30 seconds
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
