// Older notices share a type with module generation, so also check their title.
export const COURSE_CREATION_NOTIFICATION_FILTER = {
  type: "ai.generation.completed",
  title: "Course generated",
};

export function isCourseCreationNotification(notification: { type: string; title: string }) {
  return notification.type === COURSE_CREATION_NOTIFICATION_FILTER.type &&
    notification.title === COURSE_CREATION_NOTIFICATION_FILTER.title;
}
