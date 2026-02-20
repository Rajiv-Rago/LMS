import mongoose from "mongoose";
import User, { IUser } from "@/lib/models/User";
import Course, { ICourse } from "@/lib/models/Course";
import Module, { IModule } from "@/lib/models/Module";
import Assignment, { IAssignment } from "@/lib/models/Assignment";
import { signToken } from "@/lib/auth/jwt";

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

let userCounter = 0;

/**
 * Create a test user with a JWT token.
 */
export async function createTestUser(
  overrides: Partial<{
    email: string;
    name: string;
    password: string;
    role: "student" | "teacher" | "admin";
  }> = {}
): Promise<TestUserResult> {
  userCounter++;
  const defaults = {
    email: `testuser${userCounter}@example.com`,
    name: `Test User ${userCounter}`,
    password: "password123",
    role: "student" as const,
  };

  const data = { ...defaults, ...overrides };
  const user = await User.create(data);

  const token = signToken(user);

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
    courseType: "standard" | "ai-generated";
    owner: string | mongoose.Types.ObjectId;
  }> = {}
): Promise<TestCourseResult> {
  const defaults = {
    title: "Test Course",
    description: "A test course description",
    instructor: instructorId,
    isPublished: false,
  };

  const course = await Course.create({ ...defaults, ...overrides });
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

  const module = await Module.create({ ...defaults, ...overrides });

  // Add module to course's modules array
  await Course.findByIdAndUpdate(courseId, {
    $push: { modules: module._id },
  });

  return { module };
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
 * Reset the user counter between test suites.
 */
export function resetFixtureCounters(): void {
  userCounter = 0;
}
