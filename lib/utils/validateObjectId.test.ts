import mongoose from "mongoose";
import { validateObjectId } from "./validateObjectId";

describe("validateObjectId", () => {
  it("returns null for a valid 24-char hex ObjectId string", () => {
    const validId = new mongoose.Types.ObjectId().toString();
    const result = validateObjectId(validId);
    expect(result).toBeNull();
  });

  it("returns NextResponse with status 400 for 'not-an-id'", async () => {
    const result = validateObjectId("not-an-id");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
    const body = await result!.json();
    expect(body.error).toContain("Invalid");
  });

  it("returns NextResponse with status 400 for empty string", async () => {
    const result = validateObjectId("");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
  });

  it("uses custom label in error message", async () => {
    const result = validateObjectId("bad", "Course ID");
    expect(result).not.toBeNull();
    const body = await result!.json();
    expect(body.error).toBe("Invalid Course ID");
  });

  it("uses default label 'ID' when no label provided", async () => {
    const result = validateObjectId("bad");
    expect(result).not.toBeNull();
    const body = await result!.json();
    expect(body.error).toBe("Invalid ID");
  });
});
