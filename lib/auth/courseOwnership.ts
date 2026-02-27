import mongoose from "mongoose";
import { Course } from "@/lib/models";
import { JWTPayload } from "./jwt";

export interface CourseOwnershipResult {
  isOwner: boolean;
  isInstructor: boolean;
  isEnrolled: boolean;
  isAdmin: boolean;
  course: typeof Course.prototype | null;
}

export async function checkCourseOwnership(
  courseId: string,
  user: JWTPayload
): Promise<CourseOwnershipResult> {
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    return {
      isOwner: false,
      isInstructor: false,
      isEnrolled: false,
      isAdmin: false,
      course: null,
    };
  }

  const course = await Course.findById(courseId);

  if (!course) {
    return {
      isOwner: false,
      isInstructor: false,
      isEnrolled: false,
      isAdmin: false,
      course: null,
    };
  }

  const isAdmin = user.role === "admin";
  const isInstructor = course.instructor.toString() === user.userId;
  const isOwner = course.owner?.toString() === user.userId;
  const isEnrolled = course.enrolledStudents.some(
    (studentId: mongoose.Types.ObjectId) => studentId.toString() === user.userId
  );

  return {
    isOwner,
    isInstructor,
    isEnrolled,
    isAdmin,
    course,
  };
}

export async function canModifyOwnedCourse(
  courseId: string,
  user: JWTPayload
): Promise<{ allowed: boolean; reason?: string; course?: typeof Course.prototype }> {
  const ownership = await checkCourseOwnership(courseId, user);

  if (!ownership.course) {
    return { allowed: false, reason: "Course not found" };
  }

  if (!ownership.course.owner) {
    return { allowed: false, reason: "Not a user-owned course" };
  }

  if (ownership.isAdmin || ownership.isOwner) {
    return { allowed: true, course: ownership.course };
  }

  return { allowed: false, reason: "Not authorized to modify this course" };
}

export async function canAccessOwnedCourse(
  courseId: string,
  user: JWTPayload
): Promise<{ allowed: boolean; reason?: string; course?: typeof Course.prototype }> {
  const ownership = await checkCourseOwnership(courseId, user);

  if (!ownership.course) {
    return { allowed: false, reason: "Course not found" };
  }

  if (!ownership.course.owner) {
    return { allowed: false, reason: "Not a user-owned course" };
  }

  if (ownership.isAdmin || ownership.isOwner) {
    return { allowed: true, course: ownership.course };
  }

  return { allowed: false, reason: "Not authorized to access this course" };
}

// Backward-compatible aliases
export const canModifyAICourse = canModifyOwnedCourse;
export const canAccessAICourse = canAccessOwnedCourse;
