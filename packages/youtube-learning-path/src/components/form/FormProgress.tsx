"use client";

import React from "react";

interface FormProgressProps {
  currentStep: number;
  totalSteps: number;
  steps: string[];
}

export default function FormProgress({
  currentStep,
  totalSteps,
  steps,
}: FormProgressProps) {
  return (
    <div className="w-full mb-8">
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-3">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  i < currentStep
                    ? "bg-yt-red text-white"
                    : i === currentStep
                    ? "bg-yt-red text-white ring-2 ring-yt-red/40 ring-offset-2 ring-offset-yt-black"
                    : "bg-yt-dark-4 text-yt-gray-2"
                }`}
              >
                {i < currentStep ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs mt-1.5 text-center ${
                  i <= currentStep ? "text-white" : "text-yt-gray-2"
                }`}
              >
                {step}
              </span>
            </div>
            {i < totalSteps - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 mb-5 transition-colors ${
                  i < currentStep ? "bg-yt-red" : "bg-yt-dark-4"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
