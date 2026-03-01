import { createProxyRouteHandler } from "@axiomhq/nextjs";
import { axiomLogger } from "@/lib/axiom";

export const POST = axiomLogger
  ? createProxyRouteHandler(axiomLogger)
  : async () => new Response("Axiom not configured", { status: 503 });
