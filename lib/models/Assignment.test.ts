import mongoose from "mongoose";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../../__tests__/helpers/db";
import Assignment from "./Assignment";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

const courseId = new mongoose.Types.ObjectId();

describe("Assignment Model", () => {
  const validAssignment = {
    title: "Test Assignment",
    description: "A test assignment",
    course: courseId,
    dueDate: new Date(Date.now() + 86400000),
    points: 100,
  };

  describe("creation", () => {
    it("creates a standard assignment with defaults", async () => {
      const assignment = await Assignment.create(validAssignment);
      expect(assignment.title).toBe("Test Assignment");
      expect(assignment.assignmentType).toBe("standard");
      expect(assignment.submissionType).toBe("text");
      expect(assignment.isPublished).toBe(false);
      expect(assignment.points).toBe(100);
    });

    it("creates a quiz assignment with questions", async () => {
      const assignment = await Assignment.create({
        ...validAssignment,
        assignmentType: "quiz",
        questions: [
          {
            id: "q1",
            question: "What is 2+2?",
            options: ["3", "4", "5"],
            correctAnswer: 1,
            points: 10,
          },
        ],
        quizSettings: {
          timeLimit: 30,
          shuffleQuestions: true,
          showCorrectAnswers: false,
        },
      });

      expect(assignment.assignmentType).toBe("quiz");
      expect(assignment.questions).toHaveLength(1);
      expect(assignment.questions![0].correctAnswer).toBe(1);
      expect(assignment.quizSettings!.timeLimit).toBe(30);
      expect(assignment.quizSettings!.shuffleQuestions).toBe(true);
    });

    it("creates a project assignment with settings", async () => {
      const assignment = await Assignment.create({
        ...validAssignment,
        assignmentType: "project",
        instructions: "Build a TODO app",
        projectSettings: {
          maxFiles: 10,
          maxFileSize: 5 * 1024 * 1024,
          allowedFileTypes: [".zip", ".pdf"],
        },
      });

      expect(assignment.assignmentType).toBe("project");
      expect(assignment.instructions).toBe("Build a TODO app");
      expect(assignment.projectSettings!.maxFiles).toBe(10);
    });
  });

  describe("validation", () => {
    it("requires title", async () => {
      await expect(
        Assignment.create({ ...validAssignment, title: undefined })
      ).rejects.toThrow("title is required");
    });

    it("requires description", async () => {
      await expect(
        Assignment.create({ ...validAssignment, description: undefined })
      ).rejects.toThrow("description is required");
    });

    it("requires course", async () => {
      await expect(
        Assignment.create({ ...validAssignment, course: undefined })
      ).rejects.toThrow("Course is required");
    });

    it("requires dueDate", async () => {
      await expect(
        Assignment.create({ ...validAssignment, dueDate: undefined })
      ).rejects.toThrow("Due date is required");
    });

    it("requires points", async () => {
      await expect(
        Assignment.create({ ...validAssignment, points: undefined })
      ).rejects.toThrow("Points value is required");
    });

    it("rejects negative points", async () => {
      await expect(
        Assignment.create({ ...validAssignment, points: -1 })
      ).rejects.toThrow("cannot be negative");
    });

    it("rejects points over 1000", async () => {
      await expect(
        Assignment.create({ ...validAssignment, points: 1001 })
      ).rejects.toThrow("cannot exceed 1000");
    });

    it("enforces title max length", async () => {
      await expect(
        Assignment.create({ ...validAssignment, title: "A".repeat(201) })
      ).rejects.toThrow("cannot exceed 200");
    });

    it("rejects invalid assignmentType", async () => {
      await expect(
        Assignment.create({ ...validAssignment, assignmentType: "essay" })
      ).rejects.toThrow();
    });

    it("rejects invalid submissionType", async () => {
      await expect(
        Assignment.create({ ...validAssignment, submissionType: "video" })
      ).rejects.toThrow();
    });
  });

  describe("defaults", () => {
    it("defaults assignmentType to standard", async () => {
      const a = await Assignment.create(validAssignment);
      expect(a.assignmentType).toBe("standard");
    });

    it("defaults submissionType to text", async () => {
      const a = await Assignment.create(validAssignment);
      expect(a.submissionType).toBe("text");
    });

    it("defaults isPublished to false", async () => {
      const a = await Assignment.create(validAssignment);
      expect(a.isPublished).toBe(false);
    });

    it("defaults quizSettings shuffleQuestions to false", async () => {
      const a = await Assignment.create({
        ...validAssignment,
        assignmentType: "quiz",
        quizSettings: {},
      });
      expect(a.quizSettings!.shuffleQuestions).toBe(false);
      expect(a.quizSettings!.showCorrectAnswers).toBe(true);
    });

    it("defaults projectSettings maxFiles to 5", async () => {
      const a = await Assignment.create({
        ...validAssignment,
        assignmentType: "project",
        projectSettings: {},
      });
      expect(a.projectSettings!.maxFiles).toBe(5);
    });
  });
});
