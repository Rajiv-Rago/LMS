"use client";

import { useState } from "react";

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  points: number;
}

interface QuestionBuilderProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export default function QuestionBuilder({
  questions,
  onChange,
}: QuestionBuilderProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newQuestion, setNewQuestion] = useState<Question>({
    id: "",
    question: "",
    options: ["", ""],
    correctAnswer: 0,
    explanation: "",
    points: 1,
  });

  const addQuestion = () => {
    if (!newQuestion.question.trim()) return;
    if (newQuestion.options.some((opt) => !opt.trim())) return;

    const questionToAdd = {
      ...newQuestion,
      id: generateId(),
      options: newQuestion.options.filter((opt) => opt.trim()),
    };

    onChange([...questions, questionToAdd]);
    setNewQuestion({
      id: "",
      question: "",
      options: ["", ""],
      correctAnswer: 0,
      explanation: "",
      points: 1,
    });
  };

  const updateQuestion = (index: number, updated: Question) => {
    const newQuestions = [...questions];
    newQuestions[index] = updated;
    onChange(newQuestions);
    setEditingIndex(null);
  };

  const removeQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index));
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === questions.length - 1)
    ) {
      return;
    }

    const newQuestions = [...questions];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    [newQuestions[index], newQuestions[newIndex]] = [
      newQuestions[newIndex],
      newQuestions[index],
    ];
    onChange(newQuestions);
  };

  const addOption = () => {
    if (newQuestion.options.length < 6) {
      setNewQuestion({
        ...newQuestion,
        options: [...newQuestion.options, ""],
      });
    }
  };

  const removeOption = (index: number) => {
    if (newQuestion.options.length > 2) {
      const newOptions = newQuestion.options.filter((_, i) => i !== index);
      setNewQuestion({
        ...newQuestion,
        options: newOptions,
        correctAnswer:
          newQuestion.correctAnswer >= newOptions.length
            ? 0
            : newQuestion.correctAnswer,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Existing Questions */}
      {questions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Questions ({questions.length})
          </h3>
          {questions.map((q, index) => (
            <div
              key={q.id}
              className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4"
            >
              {editingIndex === index ? (
                <QuestionEditForm
                  question={q}
                  onSave={(updated) => updateQuestion(index, updated)}
                  onCancel={() => setEditingIndex(null)}
                />
              ) : (
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-zinc-900 dark:text-white">
                        {index + 1}. {q.question}
                      </p>
                      <div className="mt-2 space-y-1">
                        {q.options.map((opt, optIndex) => (
                          <p
                            key={optIndex}
                            className={`text-sm ${
                              optIndex === q.correctAnswer
                                ? "text-green-600 dark:text-green-400 font-medium"
                                : "text-zinc-600 dark:text-zinc-400"
                            }`}
                          >
                            {String.fromCharCode(65 + optIndex)}. {opt}
                            {optIndex === q.correctAnswer && " (Correct)"}
                          </p>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">
                        {q.points} {q.points === 1 ? "point" : "points"}
                        {q.explanation && " | Has explanation"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, "up")}
                        disabled={index === 0}
                        className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(index, "down")}
                        disabled={index === questions.length - 1}
                        className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingIndex(index)}
                        className="p-1 text-zinc-400 hover:text-indigo-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(index)}
                        className="p-1 text-zinc-400 hover:text-red-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add New Question Form */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">
          Add New Question
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Question
            </label>
            <textarea
              rows={2}
              value={newQuestion.question}
              onChange={(e) =>
                setNewQuestion({ ...newQuestion, question: e.target.value })
              }
              placeholder="Enter your question..."
              className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Options
            </label>
            {newQuestion.options.map((option, index) => (
              <div key={index} className="flex items-center gap-2 mb-2">
                <input
                  type="radio"
                  name="correctAnswer"
                  checked={newQuestion.correctAnswer === index}
                  onChange={() =>
                    setNewQuestion({ ...newQuestion, correctAnswer: index })
                  }
                  className="text-indigo-600"
                />
                <span className="w-6 text-sm text-zinc-500">
                  {String.fromCharCode(65 + index)}.
                </span>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...newQuestion.options];
                    newOptions[index] = e.target.value;
                    setNewQuestion({ ...newQuestion, options: newOptions });
                  }}
                  placeholder={`Option ${String.fromCharCode(65 + index)}`}
                  className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
                />
                {newQuestion.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="text-zinc-400 hover:text-red-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            {newQuestion.options.length < 6 && (
              <button
                type="button"
                onClick={addOption}
                className="mt-1 text-sm text-indigo-600 hover:text-indigo-500"
              >
                + Add option
              </button>
            )}
            <p className="mt-1 text-xs text-zinc-500">
              Select the radio button next to the correct answer
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Points
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={newQuestion.points}
                onChange={(e) =>
                  setNewQuestion({
                    ...newQuestion,
                    points: parseInt(e.target.value) || 1,
                  })
                }
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Explanation (optional)
              </label>
              <input
                type="text"
                value={newQuestion.explanation || ""}
                onChange={(e) =>
                  setNewQuestion({
                    ...newQuestion,
                    explanation: e.target.value,
                  })
                }
                placeholder="Explain the correct answer..."
                className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={addQuestion}
            disabled={
              !newQuestion.question.trim() ||
              newQuestion.options.some((opt) => !opt.trim())
            }
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Question
          </button>
        </div>
      </div>
    </div>
  );
}

// Edit form for existing questions
function QuestionEditForm({
  question,
  onSave,
  onCancel,
}: {
  question: Question;
  onSave: (q: Question) => void;
  onCancel: () => void;
}) {
  const [edited, setEdited] = useState<Question>({ ...question });

  const addOption = () => {
    if (edited.options.length < 6) {
      setEdited({ ...edited, options: [...edited.options, ""] });
    }
  };

  const removeOption = (index: number) => {
    if (edited.options.length > 2) {
      const newOptions = edited.options.filter((_, i) => i !== index);
      setEdited({
        ...edited,
        options: newOptions,
        correctAnswer:
          edited.correctAnswer >= newOptions.length ? 0 : edited.correctAnswer,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Question
        </label>
        <textarea
          rows={2}
          value={edited.question}
          onChange={(e) => setEdited({ ...edited, question: e.target.value })}
          className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Options
        </label>
        {edited.options.map((option, index) => (
          <div key={index} className="flex items-center gap-2 mb-2">
            <input
              type="radio"
              name={`edit-correctAnswer-${question.id}`}
              checked={edited.correctAnswer === index}
              onChange={() => setEdited({ ...edited, correctAnswer: index })}
              className="text-indigo-600"
            />
            <span className="w-6 text-sm text-zinc-500">
              {String.fromCharCode(65 + index)}.
            </span>
            <input
              type="text"
              value={option}
              onChange={(e) => {
                const newOptions = [...edited.options];
                newOptions[index] = e.target.value;
                setEdited({ ...edited, options: newOptions });
              }}
              className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm"
            />
            {edited.options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(index)}
                className="text-zinc-400 hover:text-red-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
        {edited.options.length < 6 && (
          <button
            type="button"
            onClick={addOption}
            className="mt-1 text-sm text-indigo-600 hover:text-indigo-500"
          >
            + Add option
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Points
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={edited.points}
            onChange={(e) =>
              setEdited({ ...edited, points: parseInt(e.target.value) || 1 })
            }
            className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Explanation
          </label>
          <input
            type="text"
            value={edited.explanation || ""}
            onChange={(e) => setEdited({ ...edited, explanation: e.target.value })}
            className="mt-1 block w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(edited)}
          className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-500"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
