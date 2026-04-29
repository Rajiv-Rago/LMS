import { AIProvider, AIProviderName, AISource, AIStreamResult, AITier } from "../types";
import { createAIProvider } from "../index";
import { parseAIJsonResponse } from "../utils/jsonParser";
import { TargetLevel } from "../utils/promptUtils";

export interface LessonContentRequest {
  courseTitle: string;
  courseDescription: string;
  moduleTitle: string;
  lessonTitle: string;
  lessonOutline: string;
  previousLessonsSummary?: string;
  targetLevel: TargetLevel;
  feedback?: string;
  previousContent?: string;
  tier?: AITier;
}

export interface GeneratedLessonContent {
  content: string;
  keyTakeaways: string[];
  sources: AISource[];
}

export interface LessonContentGeneratorConfig {
  provider: AIProviderName;
  apiKey: string;
  model?: string;
}

const LESSON_SYSTEM_PROMPT = `You are an expert educational content writer. Your task is to create comprehensive lesson content based on the provided course context and lesson outline.

IMPORTANT: You must respond ONLY with a valid JSON object. Do not include any markdown formatting, code blocks, or explanatory text outside the JSON.

The JSON must follow this exact structure:
{
  "content": "string (the full lesson content in markdown format)",
  "keyTakeaways": ["string", "string", ...] (3-5 key points students should remember),
  "sources": [{"title": "string", "url": "string"}, ...] (3-8 references used)
}

Guidelines for the content:
- Write in a clear, educational style appropriate for the target level
- Use markdown formatting for structure (headings, lists, code blocks where appropriate)
- Include practical examples where relevant
- Break complex concepts into digestible sections
- If code examples are relevant, include them with proper formatting
- Build upon previously covered material when provided
- Follow the content depth instructions provided in the user prompt
- Weave inline hyperlinks into the content where they add value (e.g. linking to official docs, Wikipedia, or authoritative references)

Guidelines for key takeaways:
- Summarize the most important concepts
- Keep each takeaway concise (1-2 sentences)
- Make them actionable where possible

Guidelines for sources:
- Include 3-8 real, authoritative references related to the lesson topic
- Prefer official documentation, reputable educational sites, Wikipedia, and well-known publications
- Each source should be genuinely relevant to the lesson content
- Use the actual title of the page or article`;

const LESSON_STREAMING_SYSTEM_PROMPT = `You are an expert educational content writer. Your task is to create comprehensive lesson content based on the provided course context and lesson outline.

Write the lesson directly in markdown format. Do NOT wrap your response in JSON or code blocks.

Guidelines for the content:
- Do NOT begin with a top-level `#` heading repeating the lesson title — the title is already displayed above the content
- Write in a clear, educational style appropriate for the target level
- Use markdown formatting for structure (##/### headings, lists, code blocks where appropriate)
- Include practical examples where relevant
- Break complex concepts into digestible sections
- If code examples are relevant, include them with proper formatting
- Build upon previously covered material when provided
- Follow the content depth instructions provided in the user prompt
- Weave inline hyperlinks into the content where they add value (e.g. linking to official docs, Wikipedia, or authoritative references)

At the very end of your response, include a section:

## Key Takeaways
- (3-5 concise, actionable bullet points summarizing the most important concepts)

Do NOT include a sources section — sources are provided separately.`;

export interface StreamChunkEvent {
  type: "chunk";
  text: string;
}

export interface StreamCompleteEvent {
  type: "complete";
  content: string;
  keyTakeaways: string[];
  sources: AISource[];
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export type StreamEvent = StreamChunkEvent | StreamCompleteEvent;

export class LessonContentGeneratorService {
  private provider: AIProvider;

  constructor(config: LessonContentGeneratorConfig) {
    this.provider = createAIProvider({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
    });
  }

  async generateLessonContent(request: LessonContentRequest): Promise<{
    content: GeneratedLessonContent;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  }> {
    const userPrompt = this.buildUserPrompt(request);
    const useGoogleSearch = this.provider.name === "gemini";

    const response = await this.provider.generateText(userPrompt, {
      systemPrompt: LESSON_SYSTEM_PROMPT,
      maxTokens: 4096,
      temperature: 0.7,
      googleSearch: useGoogleSearch,
    });

    const content = this.parseResponse(response.content);

    // Merge prompt-based sources with grounding sources from the provider
    if (response.sources?.length) {
      const existingUrls = new Set(content.sources.map((s) => s.url));
      for (const gs of response.sources) {
        if (!existingUrls.has(gs.url)) {
          content.sources.push(gs);
          existingUrls.add(gs.url);
        }
      }
    }

    return {
      content,
      usage: response.usage,
    };
  }

  private getTierInstructions(tier?: AITier): string {
    switch (tier) {
      case "concise":
        return `\n\nContent Depth: CONCISE
- Aim for 400-800 words
- Cover essential concepts only — no tangents
- Prefer bullet points and short paragraphs
- Include at most one code example if relevant
- Get to the point quickly`;
      case "thorough":
        return `\n\nContent Depth: THOROUGH
- Aim for 1500-2500 words
- Cover theory and underlying principles, not just how-to
- Include multiple code examples showing variations and edge cases
- Add real-world applications and use cases
- Explain common pitfalls and misconceptions
- Provide deeper context for why things work the way they do`;
      default:
        return `\n\nContent Depth: BALANCED
- Aim for 800-1500 words
- Include practical examples where relevant
- Break complex concepts into digestible sections`;
    }
  }

  private buildUserPrompt(request: LessonContentRequest, forJson = true): string {
    let prompt = `Create lesson content for the following:

Course: ${request.courseTitle}
Course Description: ${request.courseDescription}

Module: ${request.moduleTitle}
Lesson Title: ${request.lessonTitle}
Lesson Outline: ${request.lessonOutline}

Target Level: ${request.targetLevel}`;

    prompt += this.getTierInstructions(request.tier);

    if (request.previousLessonsSummary) {
      prompt += `\n\nContext from previous lessons:\n${request.previousLessonsSummary}`;
    }

    if (request.feedback && request.previousContent) {
      prompt += `\n\n--- REVISION REQUEST ---
The following content was previously generated for this lesson:

${request.previousContent}

The user has requested the following changes:
${request.feedback}

Please regenerate the lesson content addressing this feedback while maintaining the overall structure and quality.`;
    }

    if (forJson) {
      prompt += "\n\nRemember to respond with ONLY the JSON object, no other text.";
    }

    return prompt;
  }

  async *streamLessonContent(request: LessonContentRequest): AsyncGenerator<StreamEvent> {
    const userPrompt = this.buildUserPrompt(request, false);
    const useGoogleSearch = this.provider.name === "gemini";

    if (!this.provider.chatStream) {
      const response = await this.provider.generateText(userPrompt, {
        systemPrompt: LESSON_STREAMING_SYSTEM_PROMPT,
        maxTokens: 4096,
        temperature: 0.7,
        googleSearch: useGoogleSearch,
      });

      const { content, keyTakeaways } = parseStreamedContent(response.content);
      yield { type: "chunk", text: response.content };
      yield {
        type: "complete",
        content,
        keyTakeaways,
        sources: response.sources || [],
        usage: response.usage,
      };
      return;
    }

    const messages: import("../types").AIMessage[] = [{ role: "user", content: userPrompt }];
    const streamResult: AIStreamResult = await this.provider.chatStream(messages, {
      systemPrompt: LESSON_STREAMING_SYSTEM_PROMPT,
      maxTokens: 4096,
      temperature: 0.7,
      googleSearch: useGoogleSearch,
    });

    let fullText = "";
    for await (const chunk of streamResult.stream) {
      fullText += chunk;
      yield { type: "chunk", text: chunk };
    }

    const { sources, usage } = await streamResult.response;
    const { content, keyTakeaways } = parseStreamedContent(fullText);

    yield {
      type: "complete",
      content,
      keyTakeaways,
      sources,
      usage,
    };
  }

  private parseResponse(content: string): GeneratedLessonContent {
    return parseAIJsonResponse(content, (parsed: unknown) => {
      const data = parsed as Record<string, unknown>;

      if (!data.content || !Array.isArray(data.keyTakeaways)) {
        throw new Error("Invalid lesson content structure: missing required fields");
      }

      const sources: AISource[] = [];
      if (Array.isArray(data.sources)) {
        for (const s of data.sources) {
          const src = s as Record<string, unknown>;
          if (typeof src.title === "string" && typeof src.url === "string" && src.url.startsWith("http")) {
            sources.push({ title: src.title, url: src.url });
          }
        }
      }

      return {
        content: data.content as string,
        keyTakeaways: data.keyTakeaways as string[],
        sources,
      };
    });
  }
}

export function parseStreamedContent(text: string): { content: string; keyTakeaways: string[] } {
  const headingPattern = /^#{1,3}\s*key\s*takeaways?\s*$/im;
  const boldPattern = /^\*{2}\s*key\s*takeaways?\s*\*{2}\s*$/im;

  const match = text.match(headingPattern) || text.match(boldPattern);
  if (!match || match.index === undefined) {
    return { content: text.trim(), keyTakeaways: [] };
  }

  const content = text.slice(0, match.index).trim();
  const takeawaysSection = text.slice(match.index + match[0].length);

  const keyTakeaways = takeawaysSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);

  return { content, keyTakeaways };
}
