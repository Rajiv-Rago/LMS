import { NextRequest } from "next/server";
import { proxy } from "./proxy";

function buildRequest(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

describe("proxy auth redirects", () => {
  it("redirects protected pages to login with callbackUrl when no auth cookie exists", () => {
    const response = proxy(buildRequest("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?callbackUrl=%2Fdashboard"
    );
  });

  it("allows protected pages when an Auth.js session cookie exists", () => {
    const response = proxy(
      buildRequest("/dashboard", "authjs.session-token=encrypted-token")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
