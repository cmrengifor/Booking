import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Best-effort caller identity for rate limiting a public Server Action —
 * there's no real request object to read from in a Server Action the way
 * a Route Handler gets one, so this comes from the x-forwarded-for header
 * Vercel sets. Falls back to a shared bucket if it's ever missing (e.g.
 * local dev without a proxy in front), which just means local dev shares
 * one limit across all callers — acceptable since this only matters in
 * production.
 */
async function callerKey() {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

/**
 * Checks and records one call against a fixed-window rate limit backed by
 * the check_rate_limit() Postgres function (see the rate_limiting
 * migration). `scope` namespaces the limit (e.g. "careers", "newsletter")
 * so different actions don't share a bucket for the same caller.
 */
export async function checkRateLimit(
  scope: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  const key = `${scope}:${await callerKey()}`;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_key: key,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    // Fail open — a broken rate limiter shouldn't take down the feature it
    // was added to protect.
    console.error(`[rate-limit] check failed for scope=${scope}: ${error.message}`);
    return true;
  }
  return data;
}
