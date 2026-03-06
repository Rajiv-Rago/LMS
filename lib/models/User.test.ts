import { connectTestDb, clearTestDb, disconnectTestDb } from "../../__tests__/helpers/db";
import User from "./User";

beforeAll(async () => {
  await connectTestDb();
}, 30000);

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
}, 30000);

describe("User Model", () => {
  const validUser = {
    email: "test@example.com",
    name: "Test User",
    password: "password123",
  };

  describe("creation", () => {
    it("creates a user with valid data", async () => {
      const user = await User.create(validUser);
      expect(user.email).toBe("test@example.com");
      expect(user.name).toBe("Test User");
      expect(user.role).toBe("student"); // default
      expect(user.failedLoginAttempts).toBe(0);
    });

    it("lowercases and trims email", async () => {
      const user = await User.create({
        ...validUser,
        email: "  TEST@Example.COM  ",
      });
      expect(user.email).toBe("test@example.com");
    });

    it("trims name", async () => {
      const user = await User.create({
        ...validUser,
        name: "  John Doe  ",
      });
      expect(user.name).toBe("John Doe");
    });

    it("sets timestamps", async () => {
      const user = await User.create(validUser);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });
  });

  describe("password hashing", () => {
    it("hashes the password on save", async () => {
      const user = await User.create(validUser);
      // Need to select password explicitly since select: false
      const userWithPassword = await User.findById(user._id).select("+password");
      expect(userWithPassword!.password).not.toBe("password123");
      expect(userWithPassword!.password).toMatch(/^\$2[aby]\$/); // bcrypt hash
    });

    it("comparePassword returns true for correct password", async () => {
      await User.create(validUser);
      const user = await User.findOne({ email: validUser.email }).select("+password");
      const isMatch = await user!.comparePassword("password123");
      expect(isMatch).toBe(true);
    });

    it("comparePassword returns false for wrong password", async () => {
      await User.create(validUser);
      const user = await User.findOne({ email: validUser.email }).select("+password");
      const isMatch = await user!.comparePassword("wrongpassword");
      expect(isMatch).toBe(false);
    });
  });

  describe("validation", () => {
    it("requires email", async () => {
      await expect(
        User.create({ name: "Test", password: "password123" })
      ).rejects.toThrow("Email is required");
    });

    it("requires valid email format", async () => {
      await expect(
        User.create({ ...validUser, email: "not-an-email" })
      ).rejects.toThrow("valid email");
    });

    it("requires unique email", async () => {
      await User.create(validUser);
      await expect(User.create(validUser)).rejects.toThrow();
    });

    it("requires name", async () => {
      await expect(
        User.create({ email: "t@t.com", password: "password123" })
      ).rejects.toThrow("Name is required");
    });

    it("requires name min 2 characters", async () => {
      await expect(
        User.create({ ...validUser, name: "A" })
      ).rejects.toThrow("at least 2 characters");
    });

    it("requires password", async () => {
      await expect(
        User.create({ email: "t@t.com", name: "Test" })
      ).rejects.toThrow("Password is required");
    });

    it("requires password min 8 characters", async () => {
      await expect(
        User.create({ ...validUser, password: "short" })
      ).rejects.toThrow("at least 8 characters");
    });

    it("rejects invalid role", async () => {
      await expect(
        User.create({ ...validUser, role: "superadmin" })
      ).rejects.toThrow();
    });

    it("accepts valid roles", async () => {
      for (const role of ["student", "teacher", "admin"]) {
        const user = await User.create({
          ...validUser,
          email: `${role}@test.com`,
          role,
        });
        expect(user.role).toBe(role);
      }
    });
  });

  describe("isLocked", () => {
    it("returns false when lockUntil is not set", async () => {
      const user = await User.create(validUser);
      expect(user.isLocked()).toBe(false);
    });

    it("returns true when lockUntil is in the future", async () => {
      const user = await User.create({
        ...validUser,
        lockUntil: new Date(Date.now() + 60000),
      });
      expect(user.isLocked()).toBe(true);
    });

    it("returns false when lockUntil is in the past", async () => {
      const user = await User.create({
        ...validUser,
        lockUntil: new Date(Date.now() - 60000),
      });
      expect(user.isLocked()).toBe(false);
    });
  });

  describe("soft-delete", () => {
    it("excludes soft-deleted users from find()", async () => {
      const user = await User.create(validUser);
      user.deletedAt = new Date();
      await user.save();

      const results = await User.find({});
      expect(results).toHaveLength(0);
    });

    it("excludes soft-deleted users from findOne()", async () => {
      const user = await User.create(validUser);
      user.deletedAt = new Date();
      await user.save();

      const found = await User.findOne({ email: validUser.email });
      expect(found).toBeNull();
    });

    it("excludes soft-deleted users from findById()", async () => {
      const user = await User.create(validUser);
      user.deletedAt = new Date();
      await user.save();

      const found = await User.findById(user._id);
      expect(found).toBeNull();
    });

    it("returns soft-deleted users with includeSoftDeleted option", async () => {
      const user = await User.create(validUser);
      user.deletedAt = new Date();
      await user.save();

      const found = await User.findById(user._id, null, { includeSoftDeleted: true });
      expect(found).not.toBeNull();
      expect(found!.email).toBe(validUser.email);
    });

    it("returns non-deleted users normally", async () => {
      await User.create(validUser);

      const results = await User.find({});
      expect(results).toHaveLength(1);
    });
  });
});
