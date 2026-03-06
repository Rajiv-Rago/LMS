import Enrollment from "@/lib/models/Enrollment";
import { JWTPayload } from "./jwt";
import { ICourse } from "@/lib/models/Course";

export interface CoursePermissions {
  isInstructor: boolean;
  isEnrolled: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isSharedWith: boolean;
  canEdit: boolean;
  canView: boolean;
}

function resolveId(field: unknown): string {
  if (field && typeof field === "object" && "_id" in field) {
    return (field as { _id: { toString(): string } })._id.toString();
  }
  return String(field);
}

export async function getCoursePermissions(
  course: ICourse,
  user: JWTPayload
): Promise<CoursePermissions> {
  const isInstructor = resolveId(course.instructor) === user.userId;
  const isOwner = course.owner ? resolveId(course.owner) === user.userId : false;
  const isAdmin = user.role === "admin";
  const isSharedWith =
    course.sharedWith?.some((id) => id.toString() === user.userId) ?? false;
  const isEnrolled = await Enrollment.isEnrolled(course._id, user.userId);

  const canEdit = isInstructor || isOwner || isAdmin;
  const canView = canEdit || isEnrolled || isSharedWith;

  return {
    isInstructor,
    isEnrolled,
    isOwner,
    isAdmin,
    isSharedWith,
    canEdit,
    canView,
  };
}
