import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-node",
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/"],
  forceExit: true,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^next-auth/jwt$": "<rootDir>/__tests__/helpers/nextAuthJwt.ts",
    "^@auth/core/errors$": "<rootDir>/__tests__/helpers/authCoreErrors.ts",
    "^@youtube-core/(.*)$": "<rootDir>/packages/youtube-learning-path/src/core/$1",
  },
  testMatch: [
    "<rootDir>/**/*.test.ts",
    "<rootDir>/**/*.test.tsx",
    "<rootDir>/__tests__/**/*.test.ts",
    "<rootDir>/__tests__/**/*.test.tsx",
  ],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },
  collectCoverageFrom: [
    "lib/**/*.ts",
    "app/api/**/*.ts",
    "!lib/**/*.test.ts",
    "!lib/models/index.ts",
    "!**/node_modules/**",
  ],
};

export default createJestConfig(customJestConfig);
