import { AIProvider, AIMessage, AICompletionOptions } from "../types";

export interface TutorContext {
  courseName: string;
  lessonTitle?: string;
  lessonContent?: string;
  aiContext?: string;
}

export class AITutorService {
  private provider: AIProvider;

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  private buildSystemPrompt(context: TutorContext): string {
    let prompt = `You are an AI tutor helping students learn in the course "${context.courseName}".

Your role is to:
- Answer questions clearly and accurately
- Guide students to understanding rather than just giving answers
- Use the Socratic method when appropriate
- Provide examples and analogies to explain concepts
- Be encouraging and patient
- If you don't know something, admit it honestly

`;

    if (context.lessonTitle) {
      prompt += `Current lesson: ${context.lessonTitle}\n\n`;
    }

    if (context.lessonContent) {
      prompt += `Lesson content for reference:\n${context.lessonContent}\n\n`;
    }

    if (context.aiContext) {
      prompt += `Additional context from the instructor:\n${context.aiContext}\n\n`;
    }

    prompt += `Remember to stay focused on the course material and be helpful to the student.`;

    return prompt;
  }

  async chat(
    messages: AIMessage[],
    context: TutorContext,
    options?: Omit<AICompletionOptions, "systemPrompt">
  ) {
    const systemPrompt = this.buildSystemPrompt(context);

    return this.provider.chat(messages, {
      ...options,
      systemPrompt,
      temperature: options?.temperature ?? 0.7,
    });
  }

  async askQuestion(
    question: string,
    context: TutorContext,
    conversationHistory: AIMessage[] = []
  ) {
    const messages: AIMessage[] = [
      ...conversationHistory,
      { role: "user", content: question },
    ];

    return this.chat(messages, context);
  }
}
