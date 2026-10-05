import { describe, expect, test } from "bun:test";
import { SIGN_IN_REQUIRED, studioContext } from "../convex/functions";
import {
  MIN_PASSPHRASE_LENGTH,
  passphraseMatches,
} from "../convex/studioPassphrase";

// Cloudflare audit 2026-10-04, C1: anonymous callers acted as the shared
// studio owner. They must now be rejected; only a real Convex Auth session
// (passphrase sign-in or Viktor login) gets a userId.

const anonymous = { auth: { getUserIdentity: async () => null } };
const signedIn = (subject: string) => ({
  auth: {
    getUserIdentity: async () => ({
      subject,
      issuer: "https://example.convex.site",
      tokenIdentifier: `x|${subject}`,
    }),
  },
});

describe("studioContext", () => {
  test("rejects anonymous callers (no shared-owner fallback)", async () => {
    await expect(studioContext(anonymous as any)).rejects.toThrow(
      SIGN_IN_REQUIRED,
    );
  });

  test("passes the signed-in user through", async () => {
    const r = await studioContext(signedIn("user123|session456") as any);
    expect(r.userId as string).toBe("user123");
  });
});

describe("passphraseMatches", () => {
  const good = "correct horse battery staple";
  test("accepts the exact passphrase", async () => {
    expect(await passphraseMatches(good, good)).toBe(true);
  });
  test("rejects wrong, empty, non-string and prefix guesses", async () => {
    expect(await passphraseMatches("correct horse battery stapl", good)).toBe(
      false,
    );
    expect(await passphraseMatches("", good)).toBe(false);
    expect(await passphraseMatches(undefined, good)).toBe(false);
    expect(await passphraseMatches(123, good)).toBe(false);
  });
  test("fails closed when no (or a weak) passphrase is configured", async () => {
    expect(await passphraseMatches("", "")).toBe(false);
    expect(await passphraseMatches(undefined, undefined)).toBe(false);
    expect(await passphraseMatches("short", "short")).toBe(false);
    const weak = "x".repeat(MIN_PASSPHRASE_LENGTH - 1);
    expect(await passphraseMatches(weak, weak)).toBe(false);
  });
});
