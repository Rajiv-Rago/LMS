import { registerSchema } from "./authSchemas";

describe("registerSchema", () => {
  const validInput = {
    email: "user@example.com",
    name: "Test User",
    password: "Password1!",
  };

  it("rejects registration without acceptTerms", () => {
    const result = registerSchema.safeParse(validInput);
    expect(result.success).toBe(false);
  });

  it("rejects acceptTerms: false", () => {
    const result = registerSchema.safeParse({
      ...validInput,
      acceptTerms: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts registration with acceptTerms: true", () => {
    const result = registerSchema.safeParse({
      ...validInput,
      acceptTerms: true,
    });
    expect(result.success).toBe(true);
  });
});
