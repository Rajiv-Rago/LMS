import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("enables Auth.js host trust for the production app container", () => {
  const compose = readFileSync(resolve(process.cwd(), "docker-compose.yml"), "utf8");

  expect(compose).toMatch(/^\s+- AUTH_TRUST_HOST=true\s*$/m);
});
