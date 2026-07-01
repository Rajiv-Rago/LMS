import {
  connectTestDb,
  clearTestDb,
  disconnectTestDb,
} from "@/__tests__/helpers/db";
import { createTestUser, createTestCourse } from "@/__tests__/helpers/fixtures";
import Enrollment from "@/lib/models/Enrollment";
import { JWTPayload } from "@/lib/auth/types";
import { getCoursePermissions } from "./coursePermissions";

beforeAll(async () => {
  await connectTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

function makePayload(userId: string, role: "user" | "admin" = "user"): JWTPayload {
  return {
    userId,
    email: "test@example.com",
    role,
    subscriptionTier: role === "admin" ? "admin" : "free",
  };
}

describe("getCoursePermissions", () => {
  it("returns isInstructor, canEdit, canView true for the course instructor", async () => {
    const { user: instructor } = await createTestUser({ role: "user" });
    const { course } = await createTestCourse(instructor._id);
    const payload = makePayload(instructor._id.toString(), "user");

    const perms = await getCoursePermissions(course, payload);

    expect(perms.isInstructor).toBe(true);
    expect(perms.canEdit).toBe(true);
    expect(perms.canView).toBe(true);
    expect(perms.isOwner).toBe(false);
    expect(perms.isEnrolled).toBe(false);
    expect(perms.isAdmin).toBe(false);
    expect(perms.isSharedWith).toBe(false);
  });

  it("returns isOwner, canEdit, canView true for the course owner", async () => {
    const { user: teacher } = await createTestUser({ role: "user" });
    const { user: owner } = await createTestUser({ role: "user" });
    const { course } = await createTestCourse(teacher._id, {
      owner: owner._id,
    });
    const payload = makePayload(owner._id.toString(), "user");

    const perms = await getCoursePermissions(course, payload);

    expect(perms.isOwner).toBe(true);
    expect(perms.canEdit).toBe(true);
    expect(perms.canView).toBe(true);
    expect(perms.isInstructor).toBe(false);
  });

  it("returns isEnrolled, canView true, canEdit false for enrolled student", async () => {
    const { user: teacher } = await createTestUser({ role: "user" });
    const { user: student } = await createTestUser({ role: "user" });
    const { course } = await createTestCourse(teacher._id);

    await Enrollment.create({ course: course._id, student: student._id });

    const payload = makePayload(student._id.toString(), "user");
    const perms = await getCoursePermissions(course, payload);

    expect(perms.isEnrolled).toBe(true);
    expect(perms.canView).toBe(true);
    expect(perms.canEdit).toBe(false);
    expect(perms.isInstructor).toBe(false);
    expect(perms.isOwner).toBe(false);
  });

  it("returns isAdmin, canEdit, canView true for admin users", async () => {
    const { user: teacher } = await createTestUser({ role: "user" });
    const { user: admin } = await createTestUser({ role: "admin" });
    const { course } = await createTestCourse(teacher._id);

    const payload = makePayload(admin._id.toString(), "admin");
    const perms = await getCoursePermissions(course, payload);

    expect(perms.isAdmin).toBe(true);
    expect(perms.canEdit).toBe(true);
    expect(perms.canView).toBe(true);
  });

  it("returns isSharedWith, canView true, canEdit false for shared users", async () => {
    const { user: teacher } = await createTestUser({ role: "user" });
    const { user: sharedUser } = await createTestUser({ role: "user" });
    const { course } = await createTestCourse(teacher._id);

    // Add user to sharedWith array
    course.sharedWith.push(sharedUser._id);
    await course.save();

    const payload = makePayload(sharedUser._id.toString(), "user");
    const perms = await getCoursePermissions(course, payload);

    expect(perms.isSharedWith).toBe(true);
    expect(perms.canView).toBe(true);
    expect(perms.canEdit).toBe(false);
    expect(perms.isInstructor).toBe(false);
    expect(perms.isEnrolled).toBe(false);
  });

  it("returns all false flags for an outsider", async () => {
    const { user: teacher } = await createTestUser({ role: "user" });
    const { user: outsider } = await createTestUser({ role: "user" });
    const { course } = await createTestCourse(teacher._id);

    const payload = makePayload(outsider._id.toString(), "user");
    const perms = await getCoursePermissions(course, payload);

    expect(perms.isInstructor).toBe(false);
    expect(perms.isOwner).toBe(false);
    expect(perms.isEnrolled).toBe(false);
    expect(perms.isAdmin).toBe(false);
    expect(perms.isSharedWith).toBe(false);
    expect(perms.canEdit).toBe(false);
    expect(perms.canView).toBe(false);
  });

  it("uses Enrollment collection for isEnrolled, not course.enrolledStudents array", async () => {
    const { user: teacher } = await createTestUser({ role: "user" });
    const { user: student } = await createTestUser({ role: "user" });
    const { course } = await createTestCourse(teacher._id);

    // Add student to enrolledStudents array but NOT to Enrollment collection
    course.enrolledStudents.push(student._id);
    await course.save();

    const payload = makePayload(student._id.toString(), "user");
    const perms = await getCoursePermissions(course, payload);

    // Should NOT be enrolled because Enrollment collection is the source of truth
    expect(perms.isEnrolled).toBe(false);
  });

  it("canEdit is true when isInstructor OR isOwner OR isAdmin", async () => {
    const { user: teacher } = await createTestUser({ role: "user" });
    const { course } = await createTestCourse(teacher._id);

    // Instructor
    const instrPerms = await getCoursePermissions(
      course,
      makePayload(teacher._id.toString(), "user")
    );
    expect(instrPerms.canEdit).toBe(true);

    // Admin
    const { user: admin } = await createTestUser({ role: "admin" });
    const adminPerms = await getCoursePermissions(
      course,
      makePayload(admin._id.toString(), "admin")
    );
    expect(adminPerms.canEdit).toBe(true);
  });
});
