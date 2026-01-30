# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LMS (Learning Management System) - A full-stack web application built with Next.js 16 (App Router) and React 19, using MongoDB with Mongoose for data persistence.

## Commands

```bash
# Development
npm run dev              # Start dev server at http://localhost:3000

# Production
npm run build            # Build for production
npm start                # Start production server

# Testing
npm test                 # Run Jest tests
npm test -- path/to/file.test.ts   # Run a single test file
npm run test:watch       # Run Jest in watch mode
npm run test:coverage    # Run tests with coverage

# Linting
npm run lint             # Run ESLint
```

## Environment Setup

Required environment variable:
- `MONGODB_URI` - MongoDB connection string (set in `.env` file)

## Architecture

```
app/                    # Next.js App Router
├── api/                # API route handlers (REST endpoints)
│   └── [resource]/route.ts
├── layout.tsx          # Root layout with Geist fonts
├── page.tsx            # Home page
└── globals.css         # Tailwind CSS with theme variables

lib/                    # Shared utilities and business logic
├── db.ts               # MongoDB connection (cached singleton via global._mongoose)
└── models/             # Mongoose schema definitions
    └── User.ts
```

**Database Connection Pattern**: The `dbConnect()` function in `lib/db.ts` caches the Mongoose connection at global scope to prevent connection exhaustion across API requests. Always use this function rather than calling `mongoose.connect()` directly.

**API Routes**: Follow Next.js Route Handler pattern - export named functions (GET, POST, etc.) from `route.ts` files. Use `@/lib/db` import alias for database connection.

**Models**: Use the `mongoose.models.X || mongoose.model()` pattern to prevent model recompilation errors in development.

**Path Aliases**: Use `@/*` to import from project root (e.g., `import { dbConnect } from "@/lib/db"`). Configured in `tsconfig.json`.

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI**: React 19, Tailwind CSS 4
- **Database**: MongoDB with Mongoose 8
- **Testing**: Jest 30
- **Language**: TypeScript 5 (strict mode)
