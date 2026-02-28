# YouTube Learning Path Builder - Project Specification (SUPERSEDED)

> **This document is outdated.** It was written for the initial MVP and references OpenAI/GPT-4. See `docs/00-overview.md` through `docs/09-future-plans.md` for the current production specs.

---

# Original Specification (for reference only)

## Overview
A web application that creates structured, AI-powered learning paths from YouTube videos. Users describe what they want to learn, their preferences, and time commitment. The app searches YouTube, curates videos using GPT-4, and presents a structured curriculum with progress tracking.

## Core User Flow

1. **Input Phase** - User fills out learning preferences form
2. **Search Phase** - App queries YouTube Data API for relevant videos
3. **AI Curation Phase** - GPT-4 organizes videos into a structured curriculum
4. **Learning Phase** - User follows the path, watches videos, tracks progress
5. **Completion Phase** - User completes path, gets summary/certificate

## Form Inputs

### What Do You Want to Learn?
| Field | Type | Options/Details |
|-------|------|-----------------|
| Topic | Text input | e.g., "React", "Spanish", "Piano" |
| Current Skill Level | Dropdown | Complete Beginner, Some Basics, Intermediate, Advanced (filling gaps) |
| Learning Goal | Textarea | Why learning, what to achieve |

### Learning Preferences
| Field | Type | Options |
|-------|------|---------|
| Video Length | Checkboxes | Short (5-15m), Medium (15-45m), Long (45+m), Any length |
| Teaching Style | Checkboxes | Straight to the point, Detailed explanations, Project-based, Theory-focused, Visual/animated, Code-along/hands-on |
| Creator Preference | Checkboxes | Professional instructors, Self-taught creators, University lectures, Any credible source |

### Time Commitment
| Field | Type | Options |
|-------|------|---------|
| Hours per Week | Dropdown | 2-3 hours, 3-5 hours, 5-10 hours, 10+ hours |
| Timeline | Dropdown | 1 week, 2 weeks, 1 month, 2-3 months, No rush |

### Content Filters
| Field | Type | Options |
|-------|------|---------|
| Exclude | Checkboxes | Outdated (>X years), Clickbait, Low production quality, Non-English |
| Include | Checkboxes | Practice exercises, Project tutorials, Quizzes/assessments, Downloadable resources |

## AI Curriculum Structure

### Module Organization
- **Module 1: Fundamentals** - Core prerequisite concepts
- **Module 2: Building Skills** - Intermediate concepts
- **Module 3: Practical Application** - Projects, real-world use
- **Module 4: Advanced Topics** - Optional deeper content

### Per-Video Metadata
- Title, Channel, Duration, Views, Upload date
- Why included (AI justification)
- Key takeaways
- Prerequisites
- Suggested watch date
- Practice suggestion

### Path Variants
- **Fast Track** - Core videos only
- **Standard** - Full recommended path
- **Deep Dive** - Extended with advanced/supplementary content

## Results Display

### Summary Header
- Topic, total videos, total time, timeline, start/finish dates

### Visual Roadmap
- Module cards in sequence (MODULE 1 -> 2 -> 3 -> 4)
- Per-module: video count, hours, completion %

### Module Detail (Expandable)
- Video cards with thumbnails, metadata, AI reasoning
- Actions: Watch Now, Mark Watched, Skip, Find Alternative
- Module completion checklist

### Progress Tracking
- Videos completed / total (progress bar)
- Hours invested
- Current streak
- On track / Behind / Ahead indicator

### Study Schedule
- Week-by-week calendar breakdown
- Upcoming videos highlighted
- Overdue flagged

### Practice Projects
- Per-module project suggestions
- Difficulty level, estimated time, tutorial links

### Notes
- Per-video note-taking
- Timestamp bookmarks
- Markdown export

### Additional Features
- Path customization (swap videos, skip known content, add topics)
- Alternative video suggestions
- Save/share paths
- Multiple concurrent paths
- Supplementary resources (docs, platforms, communities)

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **State**: React Context + localStorage persistence
- **APIs**: YouTube Data API v3, OpenAI GPT-4 API
- **Design**: YouTube-inspired (reds, blacks, whites)

## Design Tokens
- Primary Red: #FF0000 (YouTube red)
- Dark BG: #0F0F0F
- Card BG: #272727
- Text Primary: #FFFFFF
- Text Secondary: #AAAAAA
- Accent Hover: #CC0000
