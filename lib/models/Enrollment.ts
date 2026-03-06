import mongoose, { Document, Model } from "mongoose";

export interface IEnrollment extends Document {
  course: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  enrolledAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface EnrollmentStatics extends Model<IEnrollment> {
  isEnrolled(
    courseId: mongoose.Types.ObjectId | string,
    studentId: mongoose.Types.ObjectId | string
  ): Promise<boolean>;
  getEnrollmentCount(
    courseId: mongoose.Types.ObjectId | string
  ): Promise<number>;
}

const enrollmentSchema = new mongoose.Schema<IEnrollment>(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

enrollmentSchema.index({ course: 1, student: 1 }, { unique: true });
enrollmentSchema.index({ student: 1, enrolledAt: -1 });

enrollmentSchema.statics.isEnrolled = async function (
  courseId: mongoose.Types.ObjectId | string,
  studentId: mongoose.Types.ObjectId | string
): Promise<boolean> {
  const result = await this.exists({ course: courseId, student: studentId });
  return result !== null;
};

enrollmentSchema.statics.getEnrollmentCount = async function (
  courseId: mongoose.Types.ObjectId | string
): Promise<number> {
  return this.countDocuments({ course: courseId });
};

const Enrollment =
  (mongoose.models.Enrollment as EnrollmentStatics) ||
  mongoose.model<IEnrollment, EnrollmentStatics>("Enrollment", enrollmentSchema);

export default Enrollment;
