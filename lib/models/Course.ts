import mongoose, { Document, Model } from "mongoose";

export interface ICourse extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  instructor: mongoose.Types.ObjectId;
  enrolledStudents: mongoose.Types.ObjectId[];
  modules: mongoose.Types.ObjectId[];
  coverImage?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type CourseModel = Model<ICourse>;

const courseSchema = new mongoose.Schema<ICourse, CourseModel>(
  {
    title: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Course description is required"],
      maxlength: [5000, "Description cannot exceed 5000 characters"],
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Instructor is required"],
    },
    enrolledStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    modules: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Module",
      },
    ],
    coverImage: {
      type: String,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

courseSchema.index({ instructor: 1 });
courseSchema.index({ enrolledStudents: 1 });
courseSchema.index({ isPublished: 1 });
courseSchema.index({ title: "text", description: "text" });

const Course =
  (mongoose.models.Course as CourseModel) ||
  mongoose.model<ICourse, CourseModel>("Course", courseSchema);

export default Course;
