import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { makeFunctionReference } from "convex/server";
import type { DataModel, Id } from "./_generated/dataModel";
import { passphraseMatches } from "./studioPassphrase";

// Plain references (not `internal.*`) so this module stays importable from the
// auth config tests, which mock ./_generated/api.
const getSecret = makeFunctionReference<
  "query",
  { name: string },
  string | null
>("studio:getSecret");
const ensureStudioOwner = makeFunctionReference<
  "mutation",
  Record<string, never>,
  Id<"users">
>("studio:ensureInternal");

declare const process: { env: Record<string, string | undefined> };

/**
 * "studio_passphrase" sign-in for the no-login studio. One team passphrase
 * (env STUDIO_PASSPHRASE, or the runtime `secrets` row of the same name set via
 * POST /admin/secret) exchanges for a real Convex Auth session as the shared
 * studio owner. Everyone still works in one shared studio, but anonymous
 * internet callers no longer can. Fails closed when no passphrase is set.
 */
const provider = ConvexCredentials<DataModel>({
  id: "studio_passphrase",
  authorize: async (params, ctx) => {
    const expected =
      process.env.STUDIO_PASSPHRASE ||
      (await ctx.runQuery(getSecret, { name: "STUDIO_PASSPHRASE" }));
    if (!(await passphraseMatches(params.passphrase, expected))) {
      throw new Error("Wrong studio passphrase");
    }
    const userId = await ctx.runMutation(ensureStudioOwner, {});
    return { userId };
  },
});

// Same top-level id trick as SpaceSessionCredentials (see spaceSessionAuth.ts).
export const StudioPassphraseCredentials = {
  ...provider,
  id: "studio_passphrase",
};
