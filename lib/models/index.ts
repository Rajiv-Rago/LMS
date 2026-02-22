export { default as User } from "./User";
export type { IUser } from "./User";

export { default as Course } from "./Course";
export type { ICourse, CourseType, SyllabusStatus, AIPreferences } from "./Course";

export { default as Module } from "./Module";
export type { IModule, ModuleContentStatus, GenerationConfig } from "./Module";

export { default as Lesson } from "./Lesson";
export type { ILesson, LessonContentType, LessonGenerationStatus, LessonGenerationConfig } from "./Lesson";

export { default as Assignment } from "./Assignment";
export type {
  IAssignment,
  SubmissionType,
  AssignmentType,
  IQuizQuestion,
  IQuizSettings,
  IProjectSettings,
} from "./Assignment";

export { default as Submission } from "./Submission";
export type {
  ISubmission,
  SubmissionStatus,
  IQuizAnswer,
  IQuizAttempt,
  IUploadedFile,
} from "./Submission";

export { default as AIChatSession } from "./AIChatSession";
export type { IAIChatSession, AIMessage } from "./AIChatSession";

export { default as AIGeneratedContent } from "./AIGeneratedContent";
export type {
  IAIGeneratedContent,
  ContentType,
  ApprovalStatus,
  QuizQuestion,
} from "./AIGeneratedContent";

export { default as AIGenerationLog } from "./AIGenerationLog";
export type {
  IAIGenerationLog,
  GenerationType,
  GenerationStatus,
  TokenUsage,
} from "./AIGenerationLog";

export { default as AuditLog } from "./AuditLog";
export type { IAuditLog, AuditAction } from "./AuditLog";

export { default as Session } from "./Session";
export type { ISession } from "./Session";

export { default as Notification } from "./Notification";
export type { INotification } from "./Notification";

export { default as Job } from "./Job";
export type { IJob, JobStatus } from "./Job";

export { default as Migration } from "./Migration";
export type { IMigration } from "./Migration";

export { default as AIUsage } from "./AIUsage";
export type { IAIUsage, AIUsageCategory } from "./AIUsage";
