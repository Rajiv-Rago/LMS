import type { YouTubePathFormData } from "./types";

export function buildYouTubePathPrompt(
  form: YouTubePathFormData,
  videoListJson: string
): string {
  const variant = form.pathVariant || "standard";

  return `You are an expert curriculum designer. Given a list of YouTube videos about "${form.topic}", organize them into a structured learning path for a ${form.skillLevel.replace(/_/g, " ")} learner.

Path variant: ${variant}
${form.teachingStyle ? `Preferred teaching style: ${form.teachingStyle}` : ""}

## Instructions

1. Select the best videos from the list below and organize them into logical modules.
2. Each module should have a clear title, description, and ordered list of videos.
3. For each video, explain why it's included and list 2-3 key takeaways.
4. Optionally add a practice project per module (small, hands-on).
5. Order modules from foundational to advanced.
6. For "fast_track", keep it lean (3-4 modules, best videos only). For "deep_dive", be comprehensive.

## Available Videos (JSON)

${videoListJson}

## Output Format

Return ONLY valid JSON matching this schema (no markdown, no comments):

{
  "courseTitle": "string",
  "courseDescription": "string",
  "modules": [
    {
      "title": "string",
      "description": "string",
      "order": 0,
      "videos": [
        {
          "videoId": "string",
          "title": "string",
          "channelName": "string",
          "channelId": "string",
          "thumbnailUrl": "string",
          "viewCount": 0,
          "publishedAt": "string",
          "duration": "string",
          "durationSeconds": 0,
          "whyIncluded": "string",
          "keyTakeaways": ["string"]
        }
      ],
      "practiceProject": {
        "title": "string",
        "description": "string",
        "difficulty": "beginner | intermediate | advanced",
        "estimatedHours": 0
      }
    }
  ]
}`;
}
