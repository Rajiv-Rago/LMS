import mongoose from "mongoose";
import {
  connectTestDb,
  clearTestDb,
  disconnectTestDb,
} from "@/__tests__/helpers/db";
import Enrollment from "./Enrollment";

beforeAll(async () => {
  await connectTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

describe("Enrollment model", () => {
  const courseId = new mongoose.Types.ObjectId();
  const studentId = new mongoose.Types.ObjectId();

  it("creates an enrollment document with course and student refs", async () => {
    const enrollment = await Enrollment.create({
      course: courseId,
      student: studentId,
    });

    expect(enrollment.course.toString()).toBe(courseId.toString());
    expect(enrollment.student.toString()).toBe(studentId.toString());
    expect(enrollment.enrolledAt).toBeInstanceOf(Date);
  });

  it("has timestamps (createdAt, updatedAt)", async () => {
    const enrollment = await Enrollment.create({
      course: courseId,
      student: studentId,
    });

    expect(enrollment.createdAt).toBeInstanceOf(Date);
    expect(enrollment.updatedAt).toBeInstanceOf(Date);
  });

  it("defaults enrolledAt to approximately now", async () => {
    const before = Date.now();
    const enrollment = await Enrollment.create({
      course: courseId,
      student: studentId,
    });
    const after = Date.now();

    expect(enrollment.enrolledAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(enrollment.enrolledAt.getTime()).toBeLessThanOrEqual(after + 1000);
  });

  it("prevents duplicate enrollment with compound unique index", async () => {
    await Enrollment.create({ course: courseId, student: studentId });

    await expect(
      Enrollment.create({ course: courseId, student: studentId })
    ).rejects.toThrow(/E11000/);
  });

  it("allows same student in different courses", async () => {
    const courseId2 = new mongoose.Types.ObjectId();
    await Enrollment.create({ course: courseId, student: studentId });
    const enrollment2 = await Enrollment.create({
      course: courseId2,
      student: studentId,
    });
    expect(enrollment2.course.toString()).toBe(courseId2.toString());
  });

  it("allows different students in same course", async () => {
    const studentId2 = new mongoose.Types.ObjectId();
    await Enrollment.create({ course: courseId, student: studentId });
    const enrollment2 = await Enrollment.create({
      course: courseId,
      student: studentId2,
    });
    expect(enrollment2.student.toString()).toBe(studentId2.toString());
  });

  describe("isEnrolled static method", () => {
    it("returns true when student is enrolled", async () => {
      await Enrollment.create({ course: courseId, student: studentId });
      const result = await Enrollment.isEnrolled(courseId, studentId);
      expect(result).toBe(true);
    });

    it("returns false when student is not enrolled", async () => {
      const result = await Enrollment.isEnrolled(courseId, studentId);
      expect(result).toBe(false);
    });
  });

  describe("getEnrollmentCount static method", () => {
    it("returns the number of enrollments for a course", async () => {
      const student2 = new mongoose.Types.ObjectId();
      const student3 = new mongoose.Types.ObjectId();
      await Enrollment.create({ course: courseId, student: studentId });
      await Enrollment.create({ course: courseId, student: student2 });
      await Enrollment.create({ course: courseId, student: student3 });

      const count = await Enrollment.getEnrollmentCount(courseId);
      expect(count).toBe(3);
    });

    it("returns 0 for a course with no enrollments", async () => {
      const count = await Enrollment.getEnrollmentCount(courseId);
      expect(count).toBe(0);
    });
  });
});
