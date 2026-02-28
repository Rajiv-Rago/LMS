import { PathFormData, YouTubeVideo, LearningPath, LearningModule, PathVariant, WeekSchedule, SupplementaryResource } from "./types";

const LABEL_MAP = {
  skillLevel: {
    complete_beginner: "Complete Beginner",
    some_basics: "Some Basics",
    intermediate: "Intermediate",
    advanced: "Advanced (filling gaps)",
  },
  videoLengths: {
    short: "Short (5-15 min)",
    medium: "Medium (15-45 min)",
    long: "Long (45+ min)",
    any: "Any length",
  },
  teachingStyles: {
    straight_to_point: "Straight to the point",
    detailed: "Detailed explanations",
    project_based: "Project-based (build along)",
    theory_focused: "Theory-focused",
    visual_animated: "Visual/animated",
    code_along: "Code-along / hands-on",
  },
  creatorTypes: {
    professional: "Professional instructors",
    self_taught: "Self-taught creators",
    university: "University lectures",
    any_credible: "Any credible source",
  },
  hoursPerWeek: {
    "2-3": "2-3 hours",
    "3-5": "3-5 hours",
    "5-10": "5-10 hours",
    "10+": "10+ hours",
  },
  timeline: {
    "1_week": "1 week",
    "2_weeks": "2 weeks",
    "1_month": "1 month",
    "2-3_months": "2-3 months",
    no_rush: "No rush",
  },
  excludeFilters: {
    outdated: "Videos over 2 years old",
    clickbait: "Clickbait titles",
    low_quality: "Low production quality",
    non_english: "Non-English content",
  },
  includeFilters: {
    exercises: "Practice exercises/assignments",
    projects: "Project tutorials",
    quizzes: "Quizzes/assessments",
    resources: "Downloadable resources",
  },
} as const;

function mapLabels<T extends string>(
  values: T[],
  map: Record<string, string>
): string {
  return values.map((v) => map[v] || v).join(", ") || "None specified";
}

function buildPrompt(formData: PathFormData, videos: YouTubeVideo[]): string {
  const videoList = videos
    .map(
      (v, i) =>
        `${i + 1}. "${v.title}" | Channel: ${v.channelName} | Duration: ${v.duration} (${v.durationSeconds}s) | Views: ${v.viewCount.toLocaleString()} | Likes: ${v.likeCount.toLocaleString()} | Published: ${v.publishedAt.split("T")[0]} | ID: ${v.videoId}\n   Description: ${v.description.slice(0, 200)}`
    )
    .join("\n\n");

  return `You are a curriculum designer creating a structured learning path from YouTube videos.

LEARNING REQUEST:
- Topic: ${formData.topic}
- Current level: ${LABEL_MAP.skillLevel[formData.skillLevel]}
- Goal: ${formData.learningGoal}
- Time available: ${LABEL_MAP.hoursPerWeek[formData.hoursPerWeek]} per week
- Timeline: ${LABEL_MAP.timeline[formData.timeline]}

VIDEO PREFERENCES:
- Length: ${mapLabels(formData.videoLengths, LABEL_MAP.videoLengths)}
- Style: ${mapLabels(formData.teachingStyles, LABEL_MAP.teachingStyles)}
- Creator type: ${mapLabels(formData.creatorTypes, LABEL_MAP.creatorTypes)}
- Exclude: ${mapLabels(formData.excludeFilters, LABEL_MAP.excludeFilters)}
- Include: ${mapLabels(formData.includeFilters, LABEL_MAP.includeFilters)}

AVAILABLE YOUTUBE VIDEOS (${videos.length} results):

${videoList}

CREATE A STRUCTURED LEARNING PATH following these rules:

1. Organize into 2-4 modules with logical learning progression
2. Select the best 8-20 videos total (no redundancy)
3. Use 3-5 different creators minimum for diverse perspectives
4. Each video must build on previous knowledge
5. Match the user's time commitment and timeline
6. Include practice suggestions after key videos
7. Provide module completion checklists
8. Create 3 path variants: Fast Track, Standard, Deep Dive
9. Suggest 1-2 practice projects
10. Include supplementary resources

Respond with ONLY valid JSON matching this exact schema (no markdown, no code fences):

{
  "modules": [
    {
      "id": "mod_1",
      "number": 1,
      "name": "Module Name",
      "description": "What this module covers",
      "estimatedHours": 3.5,
      "estimatedWeeks": 1,
      "videos": [
        {
          "videoId": "exact_youtube_id_from_list",
          "title": "Exact title from list",
          "channelName": "Channel name",
          "duration": "45:00",
          "durationSeconds": 2700,
          "thumbnailUrl": "",
          "viewCount": 1200000,
          "whyIncluded": "Why this video is in this position",
          "keyTakeaways": ["Takeaway 1", "Takeaway 2"],
          "prerequisites": ["mod_1_vid_0"],
          "practiceSuggestion": "Try building X after watching"
        }
      ],
      "moduleCheck": {
        "description": "Before moving on, can you:",
        "items": ["Skill check 1", "Skill check 2"]
      },
      "practiceProject": {
        "title": "Project name",
        "description": "What to build",
        "whyThisProject": "What it reinforces",
        "difficulty": "beginner",
        "estimatedHours": 2
      }
    }
  ],
  "variants": [
    {
      "name": "fast_track",
      "label": "Fast Track",
      "description": "Core essentials only",
      "totalVideos": 6,
      "totalHours": 4,
      "moduleIds": ["mod_1", "mod_2"]
    },
    {
      "name": "standard",
      "label": "Standard",
      "description": "Full recommended path",
      "totalVideos": 12,
      "totalHours": 10,
      "moduleIds": ["mod_1", "mod_2", "mod_3"]
    },
    {
      "name": "deep_dive",
      "label": "Deep Dive",
      "description": "Extended with advanced topics",
      "totalVideos": 18,
      "totalHours": 16,
      "moduleIds": ["mod_1", "mod_2", "mod_3", "mod_4"]
    }
  ],
  "schedule": [
    {
      "week": 1,
      "videoIds": ["id1", "id2"],
      "totalHours": 3.5
    }
  ],
  "supplementaryResources": [
    {
      "title": "Resource name",
      "url": "https://example.com",
      "type": "documentation",
      "description": "Why useful"
    }
  ]
}

CRITICAL: Use ONLY video IDs from the provided list. Do not invent video IDs.`;
}

export async function generateLearningPath(
  apiKey: string,
  formData: PathFormData,
  videos: YouTubeVideo[]
): Promise<LearningPath> {
  const prompt = buildPrompt(formData, videos);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a curriculum designer. Output only valid JSON. No markdown fences, no explanation text.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Groq API error: ${err.error?.message || res.statusText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";

  // Strip any accidental markdown fences
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: {
    modules: LearningModule[];
    variants: PathVariant[];
    schedule: WeekSchedule[];
    supplementaryResources: SupplementaryResource[];
  };

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Failed to parse AI response as JSON. Please try again.");
  }

  // Build video thumbnail map from original videos
  const videoMap = new Map(videos.map((v) => [v.videoId, v]));
  for (const mod of parsed.modules) {
    for (const vid of mod.videos) {
      const original = videoMap.get(vid.videoId);
      if (original) {
        vid.thumbnailUrl = original.thumbnailUrl;
        vid.viewCount = original.viewCount;
      }
    }
  }

  // Calculate summary
  const allVideos = parsed.modules.flatMap((m) => m.videos);
  const totalVideoSeconds = allVideos.reduce((s, v) => s + v.durationSeconds, 0);
  const totalVideoHours = Math.round((totalVideoSeconds / 3600) * 10) / 10;
  const totalPracticeHours = Math.round(totalVideoHours * 1.5 * 10) / 10;
  const totalHours = Math.round((totalVideoHours + totalPracticeHours) * 10) / 10;

  const hoursPerWeekNum =
    { "2-3": 2.5, "3-5": 4, "5-10": 7.5, "10+": 12 }[formData.hoursPerWeek] || 4;
  const completionWeeks = Math.ceil(totalHours / hoursPerWeekNum);

  const startDate = new Date().toISOString().split("T")[0];
  const finishDate = new Date(
    Date.now() + completionWeeks * 7 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  const pathId = `path_${Date.now()}`;

  return {
    id: pathId,
    createdAt: new Date().toISOString(),
    formData,
    summary: {
      topic: formData.topic,
      totalVideos: allVideos.length,
      totalVideoHours,
      totalPracticeHours,
      totalHours,
      completionWeeks,
      startDate,
      finishDate,
    },
    modules: parsed.modules,
    variants: parsed.variants,
    schedule: parsed.schedule,
    supplementaryResources: parsed.supplementaryResources,
  };
}
