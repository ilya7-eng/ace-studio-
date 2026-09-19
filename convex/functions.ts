// PHI console redaction (active only on PHI deployments) — imported first
// so any module using these builders gets the shim before handlers run.
import "./phiLogging";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  customAction,
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Ace Studio runs with NO login (Eli, 2026-09-19): every visitor works in
 * one shared studio owned by a single synthetic "studio" user row. If a real
 * Convex Auth session happens to exist we still honour it, otherwise we fall
 * back to the shared owner. `studio.ensure` creates the row on first load.
 */
export const STUDIO_EMAIL = "studio@ace-studio.local";

export async function sharedStudioUserId(ctx: QueryCtx | MutationCtx) {
  const shared = await ctx.db
    .query("users")
    .withIndex("email", q => q.eq("email", STUDIO_EMAIL))
    .unique();
  return shared?._id ?? null;
}

async function studioContext(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId) return { userId };
  const shared = await sharedStudioUserId(ctx);
  if (!shared) {
    throw new Error("Studio not initialized yet, reload in a second");
  }
  return { userId: shared };
}

/** Public Convex functions scoped to the (shared) studio owner. */
export const authenticatedQuery = customQuery(query, customCtx(studioContext));

export const authenticatedMutation = customMutation(
  mutation,
  customCtx(studioContext),
);

export const authenticatedAction = customAction(
  action,
  customCtx(async (ctx): Promise<{ userId: Id<"users"> }> => {
    const userId = await getAuthUserId(ctx);
    if (userId) return { userId };
    const shared: Id<"users"> | null = await ctx.runQuery(
      internal.studio.sharedUserIdInternal,
      {},
    );
    if (!shared) throw new Error("Studio not initialized yet");
    return { userId: shared };
  }),
);
