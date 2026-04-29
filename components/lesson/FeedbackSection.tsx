"use client";

import { useState } from "react";

interface FeedbackSectionProps {
  onSubmit: (feedback: string) => void;
  creditsRemaining: number;
  disabled: boolean;
  generating: boolean;
}

const SUGGESTION_CHIPS = [
  "Too advanced",
  "Too basic",
  "Outdated info",
  "Unclear explanation",
];

export default function FeedbackSection({
  onSubmit,
  creditsRemaining,
  disabled,
  generating,
}: FeedbackSectionProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [chipSelected, setChipSelected] = useState(false);
  const [validationError, setValidationError] = useState("");

  const handleChipClick = (chip: string) => {
    setText(chip);
    setChipSelected(true);
    setValidationError("");
  };

  const handleTextChange = (value: string) => {
    setText(value);
    setChipSelected(false);
    setValidationError("");
  };

  const handleSubmit = () => {
    if (!chipSelected && text.trim().length < 10) {
      setValidationError("Please provide at least 10 characters of feedback");
      return;
    }
    onSubmit(text);
    setText("");
    setChipSelected(false);
    setValidationError("");
  };

  const noCredits = creditsRemaining === 0;
  const isDisabled = disabled || noCredits;

  const buttonText = noCredits
    ? "No credits left -- resets tomorrow"
    : `Improve with AI (${creditsRemaining} left today)`;

  return (
    <div className="mt-6 rounded-lg border border-zinc-200 dark:border-zinc-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Something wrong with this lesson?
        </h3>
        <svg
          className={`w-4 h-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className={`px-4 pb-4 space-y-3 ${
            generating ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <div className="flex flex-wrap gap-2">
            {SUGGESTION_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleChipClick(chip)}
                disabled={isDisabled}
                className={`rounded-full px-3 py-1 text-sm border transition-colors ${
                  text === chip && chipSelected
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "border-indigo-300 dark:border-indigo-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {chip}
              </button>
            ))}
          </div>

          <div>
            <textarea
              rows={3}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              disabled={isDisabled}
              maxLength={500}
              placeholder="Describe what's wrong or how this lesson could be improved..."
              className="block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <div className="flex items-center justify-between mt-1">
              {validationError ? (
                <span className="text-xs text-red-600 dark:text-red-400">
                  {validationError}
                </span>
              ) : (
                <span />
              )}
              <span className="text-xs text-zinc-400">{text.length}/500</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isDisabled || !text.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-md hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {buttonText}
          </button>
        </div>
      )}
    </div>
  );
}
