export { default as User } from "./User";
export type { IUser } from "./User";

export { default as Course } from "./Course";
export type { ICourse } from "./Course";

export { default as Module } from "./Module";
export type { IModule } from "./Module";

export { default as Lesson } from "./Lesson";
export type { ILesson, LessonContentType } from "./Lesson";

export { default as Assignment } from "./Assignment";
export type { IAssignment, SubmissionType } from "./Assignment";

export { default as Submission } from "./Submission";
export type { ISubmission, SubmissionStatus } from "./Submission";

export { default as AIChatSession } from "./AIChatSession";
export type { IAIChatSession, AIMessage } from "./AIChatSession";

export { default as AIGeneratedContent } from "./AIGeneratedContent";
export type {
  IAIGeneratedContent,
  ContentType,
  ApprovalStatus,
  QuizQuestion,
} from "./AIGeneratedContent";
