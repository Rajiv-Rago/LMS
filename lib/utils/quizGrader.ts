import { IQuizQuestion, IQuizAnswer, IQuizAttempt } from "@/lib/models";

interface GradeQuizResult {
  answers: IQuizAnswer[];
  score: number;
  totalPoints: number;
  percentage: number;
}

/**
 * Grade a quiz attempt by comparing student answers to correct answers
 * @param questions - The quiz questions with correct answers
 * @param studentAnswers - Map of questionId to selected answer index
 * @returns Graded answers with score breakdown
 */
export function gradeQuiz(
  questions: IQuizQuestion[],
  studentAnswers: Record<string, number>
): GradeQuizResult {
  const gradedAnswers: IQuizAnswer[] = [];
  let totalScore = 0;
  let totalPoints = 0;

  for (const question of questions) {
    const selectedAnswer = studentAnswers[question.id];
    const isCorrect = selectedAnswer === question.correctAnswer;
    const pointsEarned = isCorrect ? question.points : 0;

    gradedAnswers.push({
      questionId: question.id,
      selectedAnswer: selectedAnswer ?? -1,
      isCorrect,
      pointsEarned,
    });

    totalScore += pointsEarned;
    totalPoints += question.points;
  }

  return {
    answers: gradedAnswers,
    score: totalScore,
    totalPoints,
    percentage: totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0,
  };
}

/**
 * Calculate the best score from multiple quiz attempts
 * @param attempts - Array of quiz attempts
 * @returns The highest score achieved
 */
export function getBestScore(attempts: IQuizAttempt[]): number {
  if (attempts.length === 0) return 0;
  return Math.max(...attempts.map((a) => a.score));
}

/**
 * Check if an attempt is still within the time limit
 * @param startedAt - When the attempt started
 * @param timeLimitMinutes - Time limit in minutes (optional)
 * @returns Whether the attempt is still valid
 */
export function isAttemptValid(
  startedAt: Date,
  timeLimitMinutes?: number
): boolean {
  if (!timeLimitMinutes) return true;

  const now = new Date();
  const startTime = new Date(startedAt);
  const elapsedMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);

  return elapsedMinutes <= timeLimitMinutes;
}

/**
 * Get remaining time for an attempt in seconds
 * @param startedAt - When the attempt started
 * @param timeLimitMinutes - Time limit in minutes
 * @returns Remaining time in seconds, or null if no time limit
 */
export function getRemainingTime(
  startedAt: Date,
  timeLimitMinutes?: number
): number | null {
  if (!timeLimitMinutes) return null;

  const now = new Date();
  const startTime = new Date(startedAt);
  const elapsedSeconds = (now.getTime() - startTime.getTime()) / 1000;
  const totalSeconds = timeLimitMinutes * 60;

  return Math.max(0, Math.floor(totalSeconds - elapsedSeconds));
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 * Used for shuffling questions when quizSettings.shuffleQuestions is true
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
