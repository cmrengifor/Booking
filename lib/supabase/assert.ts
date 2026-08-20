import "server-only";

/**
 * Throws if any Supabase query result in the set carries an error, instead
 * of letting the caller silently fall through to `data ?? []` — which
 * renders identically to a genuinely empty result. Thrown here, a Server
 * Component's error is caught by the nearest error.tsx instead of
 * disappearing.
 */
export function assertNoQueryErrors(
  results: Array<{ error: { message: string } | null }>,
  context: string
): void {
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    throw new Error(`${context}: ${failed.error.message}`);
  }
}
