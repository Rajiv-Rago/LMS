import mongoose, { Document, Model } from "mongoose";

export type AuditAction =
  | "login.success"
  | "login.failure"
  | "logout"
  | "password.change"
  | "password.reset.request"
  | "password.reset.complete"
  | "role.change"
  | "account.locked"
  | "account.created"
  | "session.revoked"
  | "course.permission.change";

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  ip: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

type AuditLogModel = Model<IAuditLog>;

const auditLogSchema = new mongoose.Schema<IAuditLog, AuditLogModel>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    resource: {
      type: String,
      required: true,
    },
    resourceId: {
      type: String,
    },
    ip: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // TTL: 90 days

const AuditLog =
  (mongoose.models.AuditLog as AuditLogModel) ||
  mongoose.model<IAuditLog, AuditLogModel>("AuditLog", auditLogSchema);

export default AuditLog;
