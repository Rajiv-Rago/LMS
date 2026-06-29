import '@testing-library/jest-dom'

// Increase default timeout for integration tests (bcrypt hashing, DB setup)
jest.setTimeout(15000);

// Provide required env vars for tests — these must be set before any app modules
// are imported (lib/env.ts validates at import time).
process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-auth-secret-for-jest-runner-32';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lms-test';
process.env.MONGODB_URI_TEST = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/lms-test';
