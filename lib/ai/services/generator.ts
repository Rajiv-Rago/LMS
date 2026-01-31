import { AIProvider, AICompletionOptions } from "../types";
import { QuizQuestion } from "@/lib/models/AIGeneratedContent";

export interface GeneratorContext {
  courseName: string;
  lessonTitle?: string;
  lessonContent?: string;
  aiContext?: string;
}

export type GenerationResult =
  | {
      type: "quiz";
      title: string;
      content: string;
      questions: QuizQuestion[];
    }
  | {
      type: "summary";
      title: string;
      content: string;
    }
  | {
      type: "practice";
      title: string;
      content: string;
    }
  | {
      type: "flashcards";
      title: string;
      content: string;
    };

export class AIContentGenerator {
  private provider: AIProvider;

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  async generateQuiz(
    context: GeneratorContext,
    numQuestions: number = 5,
    options?: AICompletionOptions
  ): Promise<GenerationResult> {
    const prompt = `Based on the following course content, generate ${numQuestions} multiple-choice quiz questions.

Course: ${context.courseName}
${context.lessonTitle ? `Lesson: ${context.lessonTitle}` : ""}

Content:
${context.lessonContent || "No specific content provided"}

${context.aiContext ? `Additional context: ${context.aiContext}` : ""}

Generate the quiz in the following JSON format:
{
  "title": "Quiz title",
  "questions": [
    {
      "question": "The question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Explanation for why this is correct"
    }
  ]
}

Return ONLY valid JSON, no markdown or additional text.`;

    const response = await this.provider.generateText(prompt, {
      ...options,
      temperature: 0.7,
      maxTokens: 2000,
    });

    try {
      const parsed = JSON.parse(response.content);
      return {
        type: "quiz",
        title: parsed.title || `Quiz for ${context.lessonTitle || context.courseName}`,
        content: response.content,
        questions: parsed.questions || [],
      };
    } catch {
      return {
        type: "quiz",
        title: `Quiz for ${context.lessonTitle || context.courseName}`,
        content: response.content,
        questions: [],
      };
    }
  }

  async generateSummary(
    context: GeneratorContext,
    options?: AICompletionOptions
  ): Promise<GenerationResult> {
    const prompt = `Create a comprehensive yet concise summary of the following course content.

Course: ${context.courseName}
${context.lessonTitle ? `Lesson: ${context.lessonTitle}` : ""}

Content:
${context.lessonContent || "No specific content provided"}

${context.aiContext ? `Additional context: ${context.aiContext}` : ""}

Please provide:
1. A brief overview (2-3 sentences)
2. Key concepts and definitions
3. Important points to remember
4. Connections to broader course themes if applicable

Format the response in clear, readable markdown.`;

    const response = await this.provider.generateText(prompt, {
      ...options,
      temperature: 0.5,
      maxTokens: 1500,
    });

    return {
      type: "summary",
      title: `Summary: ${context.lessonTitle || context.courseName}`,
      content: response.content,
    };
  }

  async generatePracticeProblems(
    context: GeneratorContext,
    numProblems: number = 5,
    options?: AICompletionOptions
  ): Promise<GenerationResult> {
    const prompt = `Create ${numProblems} practice problems based on the following course content.

Course: ${context.courseName}
${context.lessonTitle ? `Lesson: ${context.lessonTitle}` : ""}

Content:
${context.lessonContent || "No specific content provided"}

${context.aiContext ? `Additional context: ${context.aiContext}` : ""}

For each problem:
1. State the problem clearly
2. Provide hints or guidance (collapsible if possible)
3. Include the solution with step-by-step explanation

Format the response in clear, readable markdown with clear separation between problems.`;

    const response = await this.provider.generateText(prompt, {
      ...options,
      temperature: 0.7,
      maxTokens: 2500,
    });

    return {
      type: "practice",
      title: `Practice Problems: ${context.lessonTitle || context.courseName}`,
      content: response.content,
    };
  }

  async generateFlashcards(
    context: GeneratorContext,
    numCards: number = 10,
    options?: AICompletionOptions
  ): Promise<GenerationResult> {
    const prompt = `Create ${numCards} flashcards based on the following course content.

Course: ${context.courseName}
${context.lessonTitle ? `Lesson: ${context.lessonTitle}` : ""}

Content:
${context.lessonContent || "No specific content provided"}

${context.aiContext ? `Additional context: ${context.aiContext}` : ""}

Generate flashcards in the following JSON format:
{
  "title": "Flashcard set title",
  "cards": [
    {
      "front": "Question or term",
      "back": "Answer or definition"
    }
  ]
}

Return ONLY valid JSON, no markdown or additional text.`;

    const response = await this.provider.generateText(prompt, {
      ...options,
      temperature: 0.6,
      maxTokens: 1500,
    });

    return {
      type: "flashcards",
      title: `Flashcards: ${context.lessonTitle || context.courseName}`,
      content: response.content,
    };
  }
}
