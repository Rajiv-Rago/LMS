import { generateCorrelationId, getCorrelationId, CORRELATION_HEADER } from "./correlationId";
import { NextRequest } from "next/server";

describe("correlationId", () => {
  describe("CORRELATION_HEADER", () => {
    it("is x-correlation-id", () => {
      expect(CORRELATION_HEADER).toBe("x-correlation-id");
    });
  });

  describe("generateCorrelationId", () => {
    it("returns a UUID v4 string", () => {
      const id = generateCorrelationId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it("returns unique values on each call", () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateCorrelationId()));
      expect(ids.size).toBe(100);
    });
  });

  describe("getCorrelationId", () => {
    it("returns the header value when present", () => {
      const request = new NextRequest("http://localhost/test", {
        headers: { [CORRELATION_HEADER]: "existing-id-123" },
      });
      expect(getCorrelationId(request)).toBe("existing-id-123");
    });

    it("generates a new UUID when header is absent", () => {
      const request = new NextRequest("http://localhost/test");
      const id = getCorrelationId(request);
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });
  });
});
