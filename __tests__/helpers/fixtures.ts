import mongoose from "mongoose";
import User, { IUser } from "@/lib/models/User";
import Course, { ICourse } from "@/lib/models/Course";
import Module, { IModule } from "@/lib/models/Module";
import Assignment, { IAssignment } from "@/lib/models/Assignment";
import Enrollment, { IEnrollment } from "@/lib/models/Enrollment";
import { encodeAuthJsSessionToken } from "./authjsToken";
import AuthSession from "@/lib/models/AuthSession";
import crypto from "crypto";

interface TestUserResult {
  user: IUser;
  token: string;
}

interface TestCourseResult {
  course: ICourse;
}

interface TestModuleResult {
  module: IModule;
}

interface TestAssignmentResult {
  assignment: IAssignment;
}

interface TestEnrollmentResult {
  enrollment: IEnrollment;
}

let userCounter = 0;

/**
 * Create a test user with an Auth.js session token.
 */
export async function createTestUser(
  overrides: Partial<{
    email: string;
    name: string;
    password: string;
    role: "user" | "admin";
  }> = {}
): Promise<TestUserResult> {
  userCounter++;
  const defaults = {
    email: `testuser${userCounter}@example.com`,
    name: `Test User ${userCounter}`,
    password: "password123",
    role: "user" as const,
  };

  const data = { ...defaults, ...overrides };
  const user = await User.create(data);

  const sessionId = crypto.randomUUID();
  await AuthSession.create({
    sessionId,
    userId: user._id,
    ip: "127.0.0.1",
    userAgent: "jest",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  const token = await encodeAuthJsSessionToken({
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    subscriptionTier: user.subscriptionTier,
    sessionId,
  });

  return { user, token };
}

/**
 * Create a test course. Requires an instructor user ID.
 */
export async function createTestCourse(
  instructorId: string | mongoose.Types.ObjectId,
  overrides: Partial<{
    title: string;
    description: string;
    isPublished: boolean;
    accessLevel: "restricted" | "unlisted" | "published";
    owner: string | mongoose.Types.ObjectId;
  }> = {}
): Promise<TestCourseResult> {
  const { isPublished, ...rest } = overrides;
  const defaults: Record<string, unknown> = {
    title: "Test Course",
    description: "A test course description",
    instructor: instructorId,
  };

  if (rest.accessLevel) {
    defaults.accessLevel = rest.accessLevel;
  } else if (isPublished !== undefined) {
    defaults.accessLevel = isPublished ? "published" : "restricted";
  }

  const course = await Course.create({ ...defaults, ...rest });
  return { course };
}

/**
 * Create a test module within a course.
 */
export async function createTestModule(
  courseId: string | mongoose.Types.ObjectId,
  overrides: Partial<{
    title: string;
    description: string;
    order: number;
    isPublished: boolean;
  }> = {}
): Promise<TestModuleResult> {
  const defaults = {
    title: "Test Module",
    description: "A test module description",
    course: courseId,
    order: 0,
    isPublished: false,
  };

  const newModule = await Module.create({ ...defaults, ...overrides });

  // Add module to course's modules array
  await Course.findByIdAndUpdate(courseId, {
    $push: { modules: newModule._id },
  });

  return { module: newModule };
}

/**
 * Create a test assignment within a course.
 */
export async function createTestAssignment(
  courseId: string | mongoose.Types.ObjectId,
  overrides: Partial<{
    title: string;
    description: string;
    dueDate: Date;
    points: number;
    submissionType: "text" | "file" | "url";
    assignmentType: "standard" | "quiz" | "project";
    isPublished: boolean;
  }> = {}
): Promise<TestAssignmentResult> {
  const defaults = {
    title: "Test Assignment",
    description: "A test assignment description",
    course: courseId,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
    points: 100,
    submissionType: "text" as const,
    assignmentType: "standard" as const,
    isPublished: false,
  };

  const assignment = await Assignment.create({ ...defaults, ...overrides });
  return { assignment };
}

/**
 * Create a test enrollment linking a student to a course.
 */
export async function createTestEnrollment(
  courseId: string | mongoose.Types.ObjectId,
  studentId: string | mongoose.Types.ObjectId,
  overrides: Partial<{
    enrolledAt: Date;
  }> = {}
): Promise<TestEnrollmentResult> {
  const enrollment = await Enrollment.create({
    course: courseId,
    student: studentId,
    ...overrides,
  });
  return { enrollment };
}

/**
 * Create a quiz-type assignment with predictable question data.
 */
export async function createTestQuizAssignment(
  courseId: string | mongoose.Types.ObjectId,
  overrides: Partial<{
    title: string;
    description: string;
    dueDate: Date;
    points: number;
    isPublished: boolean;
    questions: Array<{
      id: string;
      question: string;
      options: string[];
      correctAnswer: number;
      points: number;
      explanation: string;
    }>;
    quizSettings: {
      timeLimit?: number;
      shuffleQuestions: boolean;
      showCorrectAnswers: boolean;
    };
  }> = {}
): Promise<TestAssignmentResult> {
  const defaultQuestions = [
    {
      id: "q1",
      question: "What is 2 + 2?",
      options: ["3", "4", "5", "6"],
      correctAnswer: 1,
      points: 10,
      explanation: "Basic addition: 2 + 2 = 4",
    },
    {
      id: "q2",
      question: "Which planet is closest to the Sun?",
      options: ["Venus", "Mercury", "Earth", "Mars"],
      correctAnswer: 1,
      points: 10,
      explanation: "Mercury is the closest planet to the Sun",
    },
    {
      id: "q3",
      question: "What color do you get mixing red and blue?",
      options: ["Green", "Orange", "Purple", "Yellow"],
      correctAnswer: 2,
      points: 10,
      explanation: "Red and blue make purple",
    },
  ];

  const defaults = {
    title: "Test Quiz",
    description: "A test quiz assignment",
    course: courseId,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    points: 30,
    submissionType: "text" as const,
    assignmentType: "quiz" as const,
    isPublished: true,
    questions: defaultQuestions,
    quizSettings: {
      timeLimit: 30,
      shuffleQuestions: false,
      showCorrectAnswers: true,
    },
  };

  const assignment = await Assignment.create({ ...defaults, ...overrides });
  return { assignment };
}

/**
 * Reset the user counter between test suites.
 */
export function resetFixtureCounters(): void {
  userCounter = 0;
}
