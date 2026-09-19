import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { STUDIO_EMAIL, sharedStudioUserId } from "./functions";

/** Find-or-create the shared studio owner row. Called once on app load. */
export const ensure = mutation({
  args: {},
  handler: async ctx => {
    const existing = await sharedStudioUserId(ctx);
    if (existing) return existing;
    return await ctx.db.insert("users", {
      name: "Ace Studio",
      email: STUDIO_EMAIL,
    });
  },
});

export const sharedUserIdInternal = internalQuery({
  args: {},
  handler: async ctx => sharedStudioUserId(ctx),
});

/**
 * One-off: fold every job/storyboard created under a real login into the
 * shared studio so the no-login Library shows the whole history.
 * Run: `bunx convex run studio:adoptAll` (dev) — idempotent.
 */
export const adoptAll = internalMutation({
  args: {},
  handler: async ctx => {
    let shared = await sharedStudioUserId(ctx);
    if (!shared) {
      shared = await ctx.db.insert("users", {
        name: "Ace Studio",
        email: STUDIO_EMAIL,
      });
    }
    let moved = 0;
    for (const table of ["jobs", "storyboards"] as const) {
      for await (const row of ctx.db.query(table)) {
        if (row.userId !== shared) {
          await ctx.db.patch(row._id, { userId: shared });
          moved++;
        }
      }
    }
    return { moved, shared };
  },
});
