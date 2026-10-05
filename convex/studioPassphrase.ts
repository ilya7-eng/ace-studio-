/**
 * Shared-passphrase gate for the no-login studio (Cloudflare audit
 * 2026-10-04, C1). Pure helpers live here so they can be unit-tested without a
 * Convex runtime; the provider itself is in studioPassphraseAuth.ts.
 */

/** Below this length a passphrase is treated as "not configured" (fail closed). */
export const MIN_PASSPHRASE_LENGTH = 16;

async function sha256(text: string): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return new Uint8Array(buf);
}

/**
 * Constant-time check of a typed passphrase against the configured one.
 * Hashing first makes both sides the same length, so neither the length nor
 * the first differing byte leaks through timing. Returns false (never throws)
 * when nothing usable is configured.
 */
export async function passphraseMatches(
  given: unknown,
  expected: string | null | undefined,
): Promise<boolean> {
  if (typeof given !== "string" || given.length === 0) return false;
  if (!expected || expected.length < MIN_PASSPHRASE_LENGTH) return false;
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
