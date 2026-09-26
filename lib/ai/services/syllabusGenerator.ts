import { AIProvider, AIProviderName } from "../types";
import { createAIProvider } from "../index";
import { parseAIJsonResponse } from "../utils/jsonParser";
import { Complexity, TargetLevel, complexityToLevel } from "../utils/promptUtils";
import { researchTopic, type WebSource } from "./webResearch";

export type { Complexity, TargetLevel } from "../utils/promptUtils";

export interface SyllabusRequest {
  topic: string;
  targetLevel: TargetLevel;
  /** Complexity label (alias for target level). When provided, takes precedence. */
  complexity?: Complexity | TargetLevel;
  estimatedDuration: string;
  additionalContext?: string;
  includeVideos?: boolean;
  passingScore?: number;
  /** Adaptive diagnostic summary (what the learner already knows / gaps). */
  knowledgeProfile?: string;
}

export interface GeneratedLesson {
  title: string;
  outline: string;
  order: number;
  contentType?: "text" | "video";
  videoSearchQuery?: string;
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
  syllabusReferencesReady?: boolean;
  references?: WebSource[];
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
- Foundations complexity: 3-4 modules, 3 lessons each, concise text lessons for newcomers
- Standard complexity: 4-6 modules, 3-5 lessons each, balanced depth
- Deep complexity: 6-8 modules, 4-6 lessons each, thorough text lessons with theory, edge cases and pitfalls
- Each module should have 3-6 lessons
- Lessons should build upon each other logically
- Adjust complexity based on the target level (beginner/intermediate/advanced, aliased as foundations/standard/deep)
- The course description should explain what students will learn and prerequisites if any
- Module descriptions should summarize the key themes covered
- Lesson outlines should be specific enough to guide future content generation
- Each module ends with a test; keep module scope testable against the course passing score`;

const VIDEO_SYSTEM_PROMPT_ADDENDUM = `

ADDITIONAL INSTRUCTIONS FOR HYBRID COURSES (text + YouTube video):
Each lesson must include a "contentType" field: either "text" or "video".
For video lessons, also include a "videoSearchQuery" field with a specific YouTube search term.

Decision guide:
- Use "video" for: demonstrations, visual tutorials, coding walkthroughs, tool overviews, real-world examples
- Use "text" for: theory, step-by-step guides, reference material, detailed explanations, exercises
- Aim for approximately 30-50% video lessons
- The videoSearchQuery should be specific enough to find a relevant tutorial (e.g. "React useEffect hook tutorial for beginners" not just "React")

Updated lesson structure:
{
  "title": "string",
  "outline": "string",
  "order": number,
  "contentType": "text" | "video",
  "videoSearchQuery": "string (only for video lessons)"
}`;

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
    const systemPrompt = request.includeVideos
      ? SYLLABUS_SYSTEM_PROMPT + VIDEO_SYSTEM_PROMPT_ADDENDUM
      : SYLLABUS_SYSTEM_PROMPT;

    const response = await this.provider.generateText(userPrompt, {
      systemPrompt,
      maxTokens: 4096,
      temperature: 0.7,
    });

    const syllabus = this.parseResponse(response.content);

    try {
      // Research after the syllabus is generated so the query can use its actual title.
      syllabus.references = await researchTopic(`${syllabus.courseTitle} ${request.topic}`);
      syllabus.syllabusReferencesReady = syllabus.references.length > 0;
    } catch {
      // Search outages must not prevent a learner from creating a course.
      syllabus.references = [];
      syllabus.syllabusReferencesReady = false;
    }

    return {
      syllabus,
      usage: response.usage,
    };
  }

  private buildUserPrompt(request: SyllabusRequest): string {
    const effectiveLevel: TargetLevel = request.complexity
      ? complexityToLevel(request.complexity)
      : request.targetLevel;
    let prompt = `Create a course syllabus for the following:

Topic: ${request.topic}
Target Level: ${effectiveLevel}
Estimated Duration: ${request.estimatedDuration}`;

    if (request.passingScore !== undefined) {
      prompt += `\nPassing Score: ${request.passingScore}% (each module ends with a test; scope modules so they are testable at this bar)`;
    }

    if (request.additionalContext) {
      prompt += `\n\nAdditional Context/Requirements:\n${request.additionalContext}`;
    }

    if (request.knowledgeProfile) {
      prompt += `\n\nLearner Knowledge Profile (from diagnostic assessment — skip what they already know, emphasize gaps):\n${request.knowledgeProfile}`;
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
