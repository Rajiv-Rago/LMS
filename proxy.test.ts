import { NextRequest } from "next/server";
import { proxy } from "./proxy";

let mockAuthSession: unknown = null;

jest.mock("./auth", () => ({
  auth: jest.fn((handler) => (request: NextRequest) => {
    Object.defineProperty(request, "auth", {
      configurable: true,
      value: mockAuthSession,
    });
    return handler(request);
  }),
}));

function buildRequest(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

describe("proxy auth redirects", () => {
  beforeEach(() => {
    mockAuthSession = null;
  });

  it("redirects protected pages to login with callbackUrl when no auth cookie exists", () => {
    const response = proxy(buildRequest("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?callbackUrl=%2Fdashboard"
    );
  });

  it("allows protected pages when an Auth.js session exists", () => {
    mockAuthSession = { user: { id: "user-id" } };

    const response = proxy(
      buildRequest("/dashboard", "authjs.session-token=encrypted-token")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects protected pages when only a stale Auth.js cookie exists", () => {
    const response = proxy(
      buildRequest("/dashboard", "authjs.session-token=stale-token")
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?callbackUrl=%2Fdashboard"
    );
  });

  it("protects settings pages", () => {
    const response = proxy(buildRequest("/settings"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?callbackUrl=%2Fsettings"
    );
  });
});
