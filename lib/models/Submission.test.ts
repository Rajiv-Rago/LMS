import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../../__tests__/helpers/db";
import Submission from "./Submission";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

const assignmentId = new mongoose.Types.ObjectId();
const studentId = new mongoose.Types.ObjectId();

describe("Submission Model", () => {
  const validSubmission = {
    assignment: assignmentId,
    student: studentId,
    content: "My answer",
  };

  describe("creation", () => {
    it("creates a submission with defaults", async () => {
      const submission = await Submission.create(validSubmission);
      expect(submission.status).toBe("draft");
      expect(submission.content).toBe("My answer");
      expect(submission.grade).toBeUndefined();
      expect(submission.feedback).toBeUndefined();
    });

    it("creates a submitted submission with submittedAt", async () => {
      const submission = await Submission.create({
        ...validSubmission,
        status: "submitted",
        submittedAt: new Date(),
      });
      expect(submission.status).toBe("submitted");
      expect(submission.submittedAt).toBeDefined();
    });

    it("creates a graded submission", async () => {
      const graderId = new mongoose.Types.ObjectId();
      const submission = await Submission.create({
        ...validSubmission,
        status: "graded",
        grade: 85,
        feedback: "Good work",
        gradedAt: new Date(),
        gradedBy: graderId,
      });
      expect(submission.grade).toBe(85);
      expect(submission.feedback).toBe("Good work");
      expect(submission.gradedBy!.toString()).toBe(graderId.toString());
    });
  });

  describe("validation", () => {
    it("requires assignment", async () => {
      await expect(
        Submission.create({ student: studentId, content: "test" })
      ).rejects.toThrow("Assignment is required");
    });

    it("requires student", async () => {
      await expect(
        Submission.create({ assignment: assignmentId, content: "test" })
      ).rejects.toThrow("Student is required");
    });

    it("rejects invalid status", async () => {
      await expect(
        Submission.create({ ...validSubmission, status: "pending" })
      ).rejects.toThrow();
    });

    it("rejects negative grade", async () => {
      await expect(
        Submission.create({ ...validSubmission, grade: -1 })
      ).rejects.toThrow("cannot be negative");
    });

    it("rejects negative bestScore", async () => {
      await expect(
        Submission.create({ ...validSubmission, bestScore: -1 })
      ).rejects.toThrow("cannot be negative");
    });

    it("enforces content max length", async () => {
      await expect(
        Submission.create({ ...validSubmission, content: "A".repeat(50001) })
      ).rejects.toThrow("cannot exceed 50000");
    });

    it("enforces feedback max length", async () => {
      await expect(
        Submission.create({ ...validSubmission, feedback: "A".repeat(5001) })
      ).rejects.toThrow("cannot exceed 5000");
    });
  });

  describe("unique index", () => {
    it("enforces unique (assignment, student) pair", async () => {
      await Submission.create(validSubmission);
      await expect(
        Submission.create({
          assignment: assignmentId,
          student: studentId,
          content: "Another answer",
        })
      ).rejects.toThrow();
    });

    it("allows same student for different assignments", async () => {
      await Submission.create(validSubmission);
      const otherAssignment = new mongoose.Types.ObjectId();
      const submission = await Submission.create({
        assignment: otherAssignment,
        student: studentId,
        content: "Another answer",
      });
      expect(submission).toBeDefined();
    });
  });

  describe("quiz attempts", () => {
    it("stores quiz attempt data", async () => {
      const submission = await Submission.create({
        ...validSubmission,
        quizAttempts: [
          {
            attemptNumber: 1,
            answers: [
              {
                questionId: "q1",
                selectedAnswer: 1,
                isCorrect: true,
                pointsEarned: 10,
              },
            ],
            score: 10,
            startedAt: new Date(),
            completedAt: new Date(),
          },
        ],
        bestScore: 10,
      });

      expect(submission.quizAttempts).toHaveLength(1);
      expect(submission.quizAttempts![0].score).toBe(10);
      expect(submission.quizAttempts![0].answers[0].isCorrect).toBe(true);
      expect(submission.bestScore).toBe(10);
    });
  });

  describe("project files", () => {
    it("stores uploaded files data", async () => {
      const submission = await Submission.create({
        ...validSubmission,
        files: [
          {
            id: "file-1",
            filename: "abc123.pdf",
            originalName: "report.pdf",
            url: "/uploads/abc123.pdf",
            mimeType: "application/pdf",
            size: 1024,
            uploadedAt: new Date(),
          },
        ],
      });

      expect(submission.files).toHaveLength(1);
      expect(submission.files![0].originalName).toBe("report.pdf");
      expect(submission.files![0].size).toBe(1024);
    });
  });
});
