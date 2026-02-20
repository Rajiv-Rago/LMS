import {
  gradeQuiz,
  getBestScore,
  isAttemptValid,
  getRemainingTime,
  shuffleArray,
} from "./quizGrader";

// Minimal types matching the interfaces used by quizGrader
interface MockQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  points: number;
  explanation?: string;
}

function makeQuestion(overrides: Partial<MockQuestion> = {}): MockQuestion {
  return {
    id: overrides.id || "q1",
    question: overrides.question || "What is 1+1?",
    options: overrides.options || ["1", "2", "3"],
    correctAnswer: overrides.correctAnswer ?? 1,
    points: overrides.points ?? 10,
    explanation: overrides.explanation,
  };
}

describe("quizGrader", () => {
  describe("gradeQuiz", () => {
    it("grades all correct answers", () => {
      const questions = [
        makeQuestion({ id: "q1", correctAnswer: 0, points: 10 }),
        makeQuestion({ id: "q2", correctAnswer: 2, points: 20 }),
      ];
      const answers = { q1: 0, q2: 2 };

      const result = gradeQuiz(questions as any, answers);

      expect(result.score).toBe(30);
      expect(result.totalPoints).toBe(30);
      expect(result.percentage).toBe(100);
      expect(result.answers).toHaveLength(2);
      expect(result.answers[0].isCorrect).toBe(true);
      expect(result.answers[1].isCorrect).toBe(true);
    });

    it("grades all wrong answers", () => {
      const questions = [
        makeQuestion({ id: "q1", correctAnswer: 0, points: 10 }),
        makeQuestion({ id: "q2", correctAnswer: 2, points: 20 }),
      ];
      const answers = { q1: 1, q2: 0 };

      const result = gradeQuiz(questions as any, answers);

      expect(result.score).toBe(0);
      expect(result.totalPoints).toBe(30);
      expect(result.percentage).toBe(0);
      expect(result.answers[0].isCorrect).toBe(false);
      expect(result.answers[0].pointsEarned).toBe(0);
    });

    it("grades mixed correct and wrong answers", () => {
      const questions = [
        makeQuestion({ id: "q1", correctAnswer: 1, points: 10 }),
        makeQuestion({ id: "q2", correctAnswer: 0, points: 10 }),
        makeQuestion({ id: "q3", correctAnswer: 2, points: 10 }),
      ];
      const answers = { q1: 1, q2: 1, q3: 2 };

      const result = gradeQuiz(questions as any, answers);

      expect(result.score).toBe(20);
      expect(result.totalPoints).toBe(30);
      expect(result.percentage).toBe(67); // Math.round(20/30 * 100)
    });

    it("handles unanswered questions (missing from answers map)", () => {
      const questions = [
        makeQuestion({ id: "q1", correctAnswer: 1, points: 10 }),
        makeQuestion({ id: "q2", correctAnswer: 0, points: 10 }),
      ];
      const answers = { q1: 1 }; // q2 not answered

      const result = gradeQuiz(questions as any, answers);

      expect(result.answers[1].selectedAnswer).toBe(-1);
      expect(result.answers[1].isCorrect).toBe(false);
      expect(result.score).toBe(10);
    });

    it("handles empty questions array", () => {
      const result = gradeQuiz([], {});

      expect(result.score).toBe(0);
      expect(result.totalPoints).toBe(0);
      expect(result.percentage).toBe(0);
      expect(result.answers).toHaveLength(0);
    });

    it("records correct pointsEarned per answer", () => {
      const questions = [
        makeQuestion({ id: "q1", correctAnswer: 0, points: 5 }),
        makeQuestion({ id: "q2", correctAnswer: 1, points: 15 }),
      ];
      const answers = { q1: 0, q2: 0 };

      const result = gradeQuiz(questions as any, answers);

      expect(result.answers[0].pointsEarned).toBe(5);
      expect(result.answers[1].pointsEarned).toBe(0);
    });
  });

  describe("getBestScore", () => {
    it("returns the highest score from multiple attempts", () => {
      const attempts = [
        { score: 70 },
        { score: 90 },
        { score: 80 },
      ] as any;

      expect(getBestScore(attempts)).toBe(90);
    });

    it("returns 0 for empty attempts array", () => {
      expect(getBestScore([])).toBe(0);
    });

    it("returns the score for a single attempt", () => {
      expect(getBestScore([{ score: 55 }] as any)).toBe(55);
    });
  });

  describe("isAttemptValid", () => {
    it("returns true when no time limit is set", () => {
      const startedAt = new Date(Date.now() - 999999999);
      expect(isAttemptValid(startedAt)).toBe(true);
    });

    it("returns true when time limit is 0", () => {
      const startedAt = new Date(Date.now() - 999999999);
      expect(isAttemptValid(startedAt, 0)).toBe(true);
    });

    it("returns true when within time limit", () => {
      const startedAt = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      expect(isAttemptValid(startedAt, 10)).toBe(true); // 10 minute limit
    });

    it("returns false when past time limit", () => {
      const startedAt = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
      expect(isAttemptValid(startedAt, 10)).toBe(false); // 10 minute limit
    });

    it("returns true exactly at the limit boundary", () => {
      const startedAt = new Date(Date.now() - 10 * 60 * 1000); // exactly 10 minutes ago
      expect(isAttemptValid(startedAt, 10)).toBe(true); // <= comparison
    });
  });

  describe("getRemainingTime", () => {
    it("returns null when no time limit is set", () => {
      expect(getRemainingTime(new Date())).toBeNull();
    });

    it("returns null when time limit is 0", () => {
      expect(getRemainingTime(new Date(), 0)).toBeNull();
    });

    it("returns remaining seconds when within limit", () => {
      const startedAt = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const remaining = getRemainingTime(startedAt, 10); // 10 minute limit

      expect(remaining).not.toBeNull();
      // Should be approximately 300 seconds (5 minutes remaining)
      expect(remaining!).toBeGreaterThanOrEqual(298);
      expect(remaining!).toBeLessThanOrEqual(301);
    });

    it("returns 0 when past the time limit", () => {
      const startedAt = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago
      const remaining = getRemainingTime(startedAt, 10);

      expect(remaining).toBe(0);
    });
  });

  describe("shuffleArray", () => {
    it("returns a new array (not the same reference)", () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(original);

      expect(shuffled).not.toBe(original);
    });

    it("preserves all elements", () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(original);

      expect(shuffled.sort()).toEqual(original.sort());
    });

    it("does not modify the original array", () => {
      const original = [1, 2, 3, 4, 5];
      const copy = [...original];
      shuffleArray(original);

      expect(original).toEqual(copy);
    });

    it("handles empty array", () => {
      expect(shuffleArray([])).toEqual([]);
    });

    it("handles single element array", () => {
      expect(shuffleArray([42])).toEqual([42]);
    });
  });
});
