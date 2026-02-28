# 09 - Future Plans

## Status: DRAFT
## Last Updated: 2026-02-21

---

These features are NOT in scope for the production launch. They are documented here for future planning and to capture ideas discussed during the initial spec phase.

---

## 1. Path Sharing (Public Links)

### Concept
Users can share their learning paths via a public URL. Other users can view the path (read-only) and optionally clone/fork it into their own account.

### How It Would Work
- Each path gets a `isPublic: boolean` field and a `shareSlug: string` (short random ID)
- Public paths accessible at `/shared/:slug` (no auth required)
- Shared view shows modules, videos, and schedule — but no progress tracking
- "Clone this path" button for logged-in users → copies the path into their account
- Original creator gets a "Shared X times" counter

### Data Model Changes
```typescript
// Add to LearningPath schema:
isPublic: { type: Boolean, default: false },
shareSlug: { type: String, unique: true, sparse: true },
cloneCount: { type: Number, default: 0 },
originalPathId: { type: ObjectId, default: null }, // if this is a clone
```

### New Endpoints
- `POST /api/paths/:id/share` — generates `shareSlug`, sets `isPublic: true`
- `DELETE /api/paths/:id/share` — sets `isPublic: false`
- `GET /api/shared/:slug` — public, no auth, returns path data
- `POST /api/shared/:slug/clone` — auth required, copies path to user's account

### Tier Gating
- Free: 0 shared paths
- Pro: 5 shared paths
- Team: Unlimited shared paths

### Estimated Effort
~2-3 days for one dev

---

## 2. User Profiles

### Concept
Public profile pages showing a user's shared learning paths, completed paths, and learning stats.

### URL: `/u/:username`

### Profile Data
- Display name, avatar, bio (150 chars)
- Member since date
- Public learning paths
- Stats: paths completed, videos watched, total hours, longest streak
- Badges/achievements (optional)

### Data Model Changes
```typescript
// Add to User schema:
username: { type: String, unique: true, sparse: true, lowercase: true },
bio: { type: String, maxlength: 150, default: "" },
isProfilePublic: { type: Boolean, default: false },
```

### Estimated Effort
~3-4 days for one dev

---

## 3. Community Features

### 3a. Path Ratings & Reviews

- Users can rate shared paths (1-5 stars) and leave short reviews
- Average rating shown on shared path page
- "Top Rated Paths" discovery page

### 3b. Comments on Paths

- Threaded comments on shared paths
- Creator can pin/highlight helpful comments
- Report/moderation system needed

### 3c. Path Discovery / Explore Page

- Browse paths by topic, rating, popularity
- Search by topic keyword
- Filter by difficulty, duration, rating
- "Trending this week" section

### Data Model
```typescript
// New collection: reviews
{
  userId: ObjectId,
  pathId: ObjectId,
  rating: Number,       // 1-5
  review: String,       // max 500 chars
  createdAt: Date,
}

// New collection: comments
{
  userId: ObjectId,
  pathId: ObjectId,
  parentId: ObjectId | null,   // for threading
  content: String,             // max 1000 chars
  isPinned: Boolean,
  createdAt: Date,
}
```

### Estimated Effort
~1-2 weeks for one dev (significant feature set)

---

## 4. Path Collaboration (Team Feature)

### Concept
Team plan users can collaborate on paths:
- Assign team members to a shared path
- See each member's individual progress
- Team admin can curate/customize paths for the team
- Progress dashboard showing team-wide completion

### Data Model Changes
```typescript
// New collection: teams
{
  _id: ObjectId,
  name: String,
  ownerId: ObjectId,          // Team admin
  members: [{ userId: ObjectId, role: "admin" | "member" }],
  createdAt: Date,
}

// Add to LearningPath:
teamId: { type: ObjectId, default: null },

// PathProgress already has userId, so team progress =
// query all progress docs for a given pathId
```

### Estimated Effort
~1-2 weeks for one dev

---

## 5. Mobile App / PWA

### Concept
Make the app installable on mobile devices with offline support.

### PWA Approach (Cheaper)
- Add `manifest.json` for install prompt
- Service worker for offline caching of viewed paths
- Push notifications for study reminders
- Responsive design already exists

### Native App (Expensive)
- React Native or Expo
- Would share API layer but need separate UI
- Not recommended until significant user base

### Estimated Effort
- PWA: ~3-5 days
- Native: ~2-3 months

---

## 6. AI Enhancements

### 6a. Path Regeneration
- "Regenerate Module 3" — re-run AI for just one module
- "Find alternative for this video" — swap a single video

### 6b. Smart Recommendations
- After completing a path, suggest "What to learn next"
- Based on completed topics + trending topics

### 6c. Quiz Generation
- AI generates quiz questions from video content
- Multiple choice based on key takeaways
- Track quiz scores in progress

### 6d. Progress-Aware Scheduling
- Adjust schedule based on actual pace
- "You're 2 days behind — here's an updated schedule"
- Study reminders via email or push notification

---

## 7. Export Features

### Export Formats
- **PDF**: Formatted path overview with schedule
- **Markdown**: Copy-paste into Notion/Obsidian
- **CSV**: Video list with metadata for spreadsheets
- **iCal**: Study schedule as calendar events

### Tier Gating
- Free: No export
- Pro/Team: All export formats

---

## Priority Ranking

| # | Feature | Impact | Effort | Priority |
|---|---------|--------|--------|----------|
| 1 | Path Sharing | High (virality) | Low | **P1 — First post-launch** |
| 2 | Export (PDF/Markdown) | Medium (retention) | Low | **P1** |
| 3 | Path Discovery/Explore | High (growth) | Medium | **P2** |
| 4 | User Profiles | Medium (engagement) | Medium | **P2** |
| 5 | PWA | Medium (mobile) | Low | **P2** |
| 6 | AI Quiz Generation | High (engagement) | Medium | **P3** |
| 7 | Ratings & Reviews | Medium (trust) | Medium | **P3** |
| 8 | Comments | Low (moderation cost) | Medium | **P4** |
| 9 | Team Collaboration | Medium (revenue) | High | **P4** |
| 10 | Native App | Low (PWA sufficient) | Very High | **P5** |
