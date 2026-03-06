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

export async function getCoursePermissions(
  course: ICourse,
  user: JWTPayload
): Promise<CoursePermissions> {
  const isInstructor = course.instructor.toString() === user.userId;
  const isOwner = course.owner?.toString() === user.userId;
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
