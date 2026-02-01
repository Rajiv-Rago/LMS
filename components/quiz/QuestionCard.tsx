"use client";

interface QuestionCardProps {
  questionNumber: number;
  question: string;
  options: string[];
  points: number;
  selectedAnswer: number | null;
  onAnswerSelect: (answerIndex: number) => void;
  disabled?: boolean;
  // For results view
  showResults?: boolean;
  correctAnswer?: number;
  isCorrect?: boolean;
  explanation?: string;
}

export default function QuestionCard({
  questionNumber,
  question,
  options,
  points,
  selectedAnswer,
  onAnswerSelect,
  disabled = false,
  showResults = false,
  correctAnswer,
  isCorrect,
  explanation,
}: QuestionCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-white">
          <span className="text-zinc-500 dark:text-zinc-400 mr-2">
            Q{questionNumber}.
          </span>
          {question}
        </h3>
        <span className="text-sm text-zinc-500 dark:text-zinc-400 whitespace-nowrap ml-4">
          {points} {points === 1 ? "pt" : "pts"}
        </span>
      </div>

      <div className="space-y-2">
        {options.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrectOption = showResults && correctAnswer === index;
          const isWrongSelection =
            showResults && isSelected && correctAnswer !== index;

          let optionClasses =
            "w-full text-left px-4 py-3 rounded-lg border transition-colors ";

          if (showResults) {
            if (isCorrectOption) {
              optionClasses +=
                "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300";
            } else if (isWrongSelection) {
              optionClasses +=
                "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300";
            } else {
              optionClasses +=
                "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400";
            }
          } else if (isSelected) {
            optionClasses +=
              "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300";
          } else {
            optionClasses +=
              "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-700 dark:text-zinc-300";
          }

          if (disabled) {
            optionClasses += " cursor-not-allowed opacity-60";
          } else if (!showResults) {
            optionClasses += " cursor-pointer";
          }

          return (
            <button
              key={index}
              onClick={() => !disabled && !showResults && onAnswerSelect(index)}
              disabled={disabled || showResults}
              className={optionClasses}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-sm font-medium ${
                    isSelected && !showResults
                      ? "border-blue-500 bg-blue-500 text-white"
                      : isCorrectOption
                        ? "border-green-500 bg-green-500 text-white"
                        : isWrongSelection
                          ? "border-red-500 bg-red-500 text-white"
                          : "border-zinc-300 dark:border-zinc-600"
                  }`}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{option}</span>
              </span>
            </button>
          );
        })}
      </div>

      {showResults && (
        <div className="mt-4">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              isCorrect
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
            }`}
          >
            {isCorrect ? (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Correct! +{points} pts
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
                Incorrect
              </>
            )}
          </div>

          {explanation && (
            <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                <span className="font-medium">Explanation:</span> {explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
