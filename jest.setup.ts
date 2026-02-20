import '@testing-library/jest-dom'

// Provide required env vars for tests — these must be set before any app modules
// are imported (lib/env.ts validates at import time).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-jest';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';
process.env.MONGODB_URI_TEST = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/lms-test';
