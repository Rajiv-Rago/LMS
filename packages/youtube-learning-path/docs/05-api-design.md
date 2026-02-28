# 05 - API Design

## Status: DRAFT
## Last Updated: 2026-02-21

---

## Conventions

- All endpoints return JSON
- All authenticated endpoints require a valid NextAuth session (JWT cookie)
- All POST/PATCH endpoints validate input with Zod
- Error responses follow: `{ "error": "Human-readable message", "code": "MACHINE_CODE" }`
- Success responses return the resource directly (no wrapping)
- HTTP status codes used correctly (200, 201, 400, 401, 403, 404, 409, 429, 500)

---

## Auth Endpoints

### `POST /api/auth/signup`

Creates a new account with email/password.

**Auth:** None (public)
**Rate Limit:** 3/hour per IP

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass1"
}
```

**Response (201):**
```json
{
  "message": "Account created. Please sign in."
}
```

**Errors:**
| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid input (details in error message) |
| 409 | `EMAIL_EXISTS` | Email already registered |
| 429 | `RATE_LIMITED` | Too many signup attempts |

---

### `POST /api/auth/forgot-password`

Sends a password reset email.

**Auth:** None (public)
**Rate Limit:** 3/hour per IP

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Response (200):** Always returns success (don't reveal if email exists)
```json
{
  "message": "If an account exists, a reset email has been sent."
}
```

---

### `POST /api/auth/reset-password`

Resets password using a token from the email link.

**Auth:** None (public)
**Rate Limit:** 5/15min per IP

**Request:**
```json
{
  "token": "abc123...",
  "password": "NewSecurePass1"
}
```

**Response (200):**
```json
{
  "message": "Password updated. Please sign in."
}
```

**Errors:**
| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid password format |
| 400 | `INVALID_TOKEN` | Token expired or invalid |

---

## Path Endpoints

### `GET /api/paths`

Returns all learning paths for the authenticated user.

**Auth:** Required
**Rate Limit:** 100/min

**Query Params:** None

**Response (200):**
```json
[
  {
    "_id": "665a1b2c3d4e5f6a7b8c9d0e",
    "summary": {
      "topic": "React",
      "totalVideos": 14,
      "totalVideoHours": 8.5,
      "totalPracticeHours": 12.75,
      "totalHours": 21.25,
      "completionWeeks": 6,
      "startDate": "2026-02-21",
      "finishDate": "2026-04-04"
    },
    "createdAt": "2026-02-21T10:30:00.000Z",
    "updatedAt": "2026-02-21T10:30:00.000Z"
  }
]
```

Note: This returns a summary-only list. Use `GET /api/paths/:id` for full data.

---

### `GET /api/paths/:id`

Returns a single learning path with all modules, videos, and variants.

**Auth:** Required (must own the path)
**Rate Limit:** 100/min

**Response (200):** Full `LearningPath` document (see `01-database.md` schema)

**Errors:**
| Status | Code | When |
|--------|------|------|
| 404 | `NOT_FOUND` | Path doesn't exist or not owned by user |

---

### `POST /api/generate`

Generates a new learning path from form input.

**Auth:** Required
**Rate Limit:** 10/hour per user

**Request:** See `generatePathSchema` in `04-security.md` for exact fields.

```json
{
  "topic": "React",
  "skillLevel": "some_basics",
  "learningGoal": "Build production-ready React apps",
  "videoLengths": ["medium", "long"],
  "teachingStyles": ["project_based", "code_along"],
  "creatorTypes": ["professional", "self_taught"],
  "hoursPerWeek": "5-10",
  "timeline": "1_month",
  "excludeFilters": ["outdated"],
  "includeFilters": ["projects", "exercises"]
}
```

**Response (201):** Full `LearningPath` document (saved to DB)

**Errors:**
| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid form data |
| 403 | `PATH_LIMIT` | Free tier path limit reached |
| 403 | `GENERATION_LIMIT` | Monthly generation limit reached |
| 404 | `NO_VIDEOS` | No YouTube videos found for topic |
| 429 | `RATE_LIMITED` | Too many generation requests |
| 500 | `AI_ERROR` | Groq API failed |
| 500 | `YOUTUBE_ERROR` | YouTube API failed |

---

### `DELETE /api/paths/:id`

Deletes a learning path and its associated progress.

**Auth:** Required (must own the path)
**Rate Limit:** 30/min

**Response (200):**
```json
{
  "message": "Path deleted"
}
```

**Errors:**
| Status | Code | When |
|--------|------|------|
| 404 | `NOT_FOUND` | Path doesn't exist or not owned by user |

---

## Progress Endpoints

### `GET /api/paths/:id/progress`

Returns progress data for a specific path.

**Auth:** Required (must own the path)
**Rate Limit:** 100/min

**Response (200):** Full `PathProgress` document

**Errors:**
| Status | Code | When |
|--------|------|------|
| 404 | `NOT_FOUND` | Path or progress not found |

---

### `PATCH /api/paths/:id/progress`

Updates progress on a path. Supports multiple update types via `action` field.

**Auth:** Required (must own the path)
**Rate Limit:** 30/min

**Request (mark video status):**
```json
{
  "action": "video_status",
  "videoId": "dQw4w9WgXcQ",
  "status": "watched"
}
```

**Request (update notes):**
```json
{
  "action": "update_notes",
  "videoId": "dQw4w9WgXcQ",
  "notes": "Great explanation of hooks at 12:30"
}
```

**Request (add timestamp):**
```json
{
  "action": "add_timestamp",
  "videoId": "dQw4w9WgXcQ",
  "time": "12:30",
  "note": "useEffect cleanup explained"
}
```

**Request (toggle module check):**
```json
{
  "action": "toggle_check",
  "moduleId": "mod_1",
  "index": 2
}
```

**Request (complete project):**
```json
{
  "action": "complete_project",
  "projectTitle": "Todo App with React"
}
```

**Request (switch variant):**
```json
{
  "action": "switch_variant",
  "variant": "deep_dive"
}
```

**Response (200):** Updated `PathProgress` document

**Errors:**
| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid action or missing fields |
| 403 | `TIER_RESTRICTED` | Variant not available on current tier |
| 404 | `NOT_FOUND` | Path not found |

---

## User Endpoints

### `GET /api/user`

Returns the authenticated user's profile.

**Auth:** Required
**Rate Limit:** 100/min

**Response (200):**
```json
{
  "_id": "665a1b2c3d4e5f6a7b8c9d0e",
  "name": "John Doe",
  "email": "john@example.com",
  "image": "https://lh3.googleusercontent.com/...",
  "tier": "pro",
  "pathsGeneratedThisMonth": 5,
  "createdAt": "2026-01-15T10:00:00.000Z",
  "lastLoginAt": "2026-02-21T08:00:00.000Z"
}
```

Note: `hashedPassword` is NEVER included.

---

### `PATCH /api/user`

Updates user profile fields.

**Auth:** Required
**Rate Limit:** 30/min

**Request:**
```json
{
  "name": "Jane Doe"
}
```

**Updatable fields:** `name` only. Email changes not supported (too complex for MVP — requires re-verification).

**Response (200):** Updated user object (without `hashedPassword`)

---

### `GET /api/user/usage`

Returns current usage stats for the billing page.

**Auth:** Required
**Rate Limit:** 100/min

**Response (200):**
```json
{
  "tier": "pro",
  "pathCount": 7,
  "pathLimit": null,
  "generationsThisMonth": 5,
  "generationLimit": 30,
  "usagePeriodStart": "2026-02-01T00:00:00.000Z",
  "usagePeriodEnd": "2026-03-01T00:00:00.000Z"
}
```

`null` for `pathLimit` means unlimited.

---

## Billing Endpoints

### `POST /api/billing/checkout`

Creates a Stripe Checkout session.

**Auth:** Required
**Rate Limit:** 5/min

**Request:**
```json
{
  "priceId": "price_xxx",
  "seats": 1
}
```

**Response (200):**
```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

Client redirects to this URL.

---

### `POST /api/billing/portal`

Creates a Stripe Customer Portal session.

**Auth:** Required
**Rate Limit:** 5/min

**Request:** Empty body

**Response (200):**
```json
{
  "url": "https://billing.stripe.com/p/session/..."
}
```

---

### `POST /api/webhooks/stripe`

Stripe webhook receiver.

**Auth:** None (verified by Stripe signature)
**Rate Limit:** None (Stripe sends events)

**Request:** Raw Stripe event payload

**Response:** `200 OK` or `400 Invalid signature`

---

## Endpoint Summary Table

| Method | Path | Auth | Rate Limit | Purpose |
|--------|------|------|------------|---------|
| POST | `/api/auth/signup` | No | 3/hr/IP | Create account |
| POST | `/api/auth/forgot-password` | No | 3/hr/IP | Request password reset |
| POST | `/api/auth/reset-password` | No | 5/15min/IP | Reset password with token |
| GET | `/api/paths` | Yes | 100/min | List user's paths |
| POST | `/api/generate` | Yes | 10/hr | Generate new path |
| GET | `/api/paths/:id` | Yes | 100/min | Get full path data |
| DELETE | `/api/paths/:id` | Yes | 30/min | Delete path |
| GET | `/api/paths/:id/progress` | Yes | 100/min | Get path progress |
| PATCH | `/api/paths/:id/progress` | Yes | 30/min | Update progress |
| GET | `/api/user` | Yes | 100/min | Get user profile |
| PATCH | `/api/user` | Yes | 30/min | Update profile |
| GET | `/api/user/usage` | Yes | 100/min | Get usage stats |
| POST | `/api/billing/checkout` | Yes | 5/min | Create checkout |
| POST | `/api/billing/portal` | Yes | 5/min | Open billing portal |
| POST | `/api/webhooks/stripe` | No* | None | Stripe events |

\* Verified by Stripe webhook signature, not session auth.
