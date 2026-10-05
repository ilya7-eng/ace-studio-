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
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { action, mutation, query } from "./_generated/server";

/**
 * Ace Studio has no personal accounts (Eli, 2026-09-19): everyone works in one
 * shared studio owned by a single synthetic "studio" user row. Since the
 * Cloudflare audit (2026-10-04, C1) a caller must hold a real Convex Auth
 * session: either the shared-passphrase sign-in (studioPassphraseAuth.ts,
 * which signs in AS the shared owner) or, in authenticated mode, their own
 * Viktor login. Anonymous callers are rejected; there is no fallback anymore.
 */
export const STUDIO_EMAIL = "studio@ace-studio.local";
// Same message as the Viktor Spaces template contract (scripts/convex-auth-contract.test.ts).
export const SIGN_IN_REQUIRED = "Not authenticated";

export async function sharedStudioUserId(ctx: QueryCtx | MutationCtx) {
  const shared = await ctx.db
    .query("users")
    .withIndex("email", q => q.eq("email", STUDIO_EMAIL))
    .unique();
  return shared?._id ?? null;
}

export async function studioContext(
  ctx: Pick<QueryCtx, "auth">,
): Promise<{ userId: Id<"users"> }> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error(SIGN_IN_REQUIRED);
  return { userId };
}

/** Public Convex functions scoped to the (shared) studio owner. */
export const authenticatedQuery = customQuery(query, customCtx(studioContext));

export const authenticatedMutation = customMutation(
  mutation,
  customCtx(studioContext),
);

export const authenticatedAction = customAction(
  action,
  customCtx(studioContext),
);
