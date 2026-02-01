import { AIProvider, AIProviderName } from "../types";
import { createAIProvider } from "../index";
import { parseAIJsonResponse } from "../utils/jsonParser";
import { TargetLevel } from "../utils/promptUtils";

export type { TargetLevel } from "../utils/promptUtils";

export interface SyllabusRequest {
  topic: string;
  targetLevel: TargetLevel;
  estimatedDuration: string;
  additionalContext?: string;
}

export interface GeneratedLesson {
  title: string;
  outline: string;
  order: number;
}

export interface GeneratedModule {
  title: string;
  description: string;
  lessons: GeneratedLesson[];
  order: number;
}

export interface GeneratedSyllabus {
  courseTitle: string;
  courseDescription: string;
  modules: GeneratedModule[];
}

export interface SyllabusGeneratorConfig {
  provider: AIProviderName;
  apiKey: string;
  model?: string;
}

const SYLLABUS_SYSTEM_PROMPT = `You are an expert curriculum designer. Your task is to create a comprehensive course syllabus based on the provided topic and parameters.

IMPORTANT: You must respond ONLY with a valid JSON object. Do not include any markdown formatting, code blocks, or explanatory text.

The JSON must follow this exact structure:
{
  "courseTitle": "string",
  "courseDescription": "string (2-3 sentences)",
  "modules": [
    {
      "title": "string",
      "description": "string (1-2 sentences)",
      "order": number (starting from 0),
      "lessons": [
        {
          "title": "string",
          "outline": "string (1-2 sentences describing what will be covered)",
          "order": number (starting from 0)
        }
      ]
    }
  ]
}

Guidelines:
- Create 4-8 modules depending on the scope of the topic
- Each module should have 3-6 lessons
- Lessons should build upon each other logically
- Adjust complexity based on the target level (beginner/intermediate/advanced)
- The course description should explain what students will learn and prerequisites if any
- Module descriptions should summarize the key themes covered
- Lesson outlines should be specific enough to guide future content generation`;

export class SyllabusGeneratorService {
  private provider: AIProvider;

  constructor(config: SyllabusGeneratorConfig) {
    this.provider = createAIProvider({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
    });
  }

  async generateSyllabus(request: SyllabusRequest): Promise<{
    syllabus: GeneratedSyllabus;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  }> {
    const userPrompt = this.buildUserPrompt(request);

    const response = await this.provider.generateText(userPrompt, {
      systemPrompt: SYLLABUS_SYSTEM_PROMPT,
      maxTokens: 4096,
      temperature: 0.7,
    });

    const syllabus = this.parseResponse(response.content);

    return {
      syllabus,
      usage: response.usage,
    };
  }

  private buildUserPrompt(request: SyllabusRequest): string {
    let prompt = `Create a course syllabus for the following:

Topic: ${request.topic}
Target Level: ${request.targetLevel}
Estimated Duration: ${request.estimatedDuration}`;

    if (request.additionalContext) {
      prompt += `\n\nAdditional Context/Requirements:\n${request.additionalContext}`;
    }

    prompt += "\n\nRemember to respond with ONLY the JSON object, no other text.";

    return prompt;
  }

  private parseResponse(content: string): GeneratedSyllabus {
    return parseAIJsonResponse(content, (parsed: unknown) => {
      const data = parsed as Record<string, unknown>;

      if (!data.courseTitle || !data.courseDescription || !Array.isArray(data.modules)) {
        throw new Error("Invalid syllabus structure: missing required fields");
      }

      for (const courseModule of data.modules as Record<string, unknown>[]) {
        if (!courseModule.title || !Array.isArray(courseModule.lessons)) {
          throw new Error("Invalid module structure: missing title or lessons");
        }
        for (const lesson of courseModule.lessons as Record<string, unknown>[]) {
          if (!lesson.title || !lesson.outline) {
            throw new Error("Invalid lesson structure: missing title or outline");
          }
        }
      }

      return data as unknown as GeneratedSyllabus;
    });
  }
}
