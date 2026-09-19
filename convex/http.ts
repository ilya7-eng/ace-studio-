// PHI console redaction (active only on PHI deployments).
import "./phiLogging";
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

declare const process: { env: Record<string, string | undefined> };

const http = httpRouter();
// Registers Convex Auth's routes, including the OAuth endpoints used by
// "Sign in with Viktor": /api/auth/signin/viktor and /api/auth/callback/viktor.
auth.addHttpRoutes(http);


// Admin: store a runtime secret (e.g. HF_TOKEN) on deployments whose env vars
// the sandbox cannot set. Gated by the platform-issued project secret.
http.route({
  path: "/admin/secret",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const expected = process.env.VIKTOR_SPACES_PROJECT_SECRET;
    const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!expected || !got || got !== expected) {
      return new Response("forbidden", { status: 403 });
    }
    const { name, value } = (await req.json()) as { name?: string; value?: string };
    if (!name || !value || !/^[A-Z0-9_]+$/.test(name)) {
      return new Response("bad request", { status: 400 });
    }
    await ctx.runMutation(internal.studio.setSecret, { name, value });
    return new Response("ok", { status: 200 });
  }),
});

export default http;
