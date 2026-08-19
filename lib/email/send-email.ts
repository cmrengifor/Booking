import "server-only";
import { Resend } from "resend";

/**
 * Real send via Resend, per docs/ARCHITECTURE.md section G ("wired in
 * whenever Carlos is ready"). Falls back to logging if RESEND_API_KEY isn't
 * set, so nothing breaks in an environment that hasn't configured it —
 * matches how every other stub in this app degrades.
 *
 * RESEND_FROM_EMAIL must be an address on a domain verified in the Resend
 * dashboard. Until one is verified, Resend's sandbox sender
 * (onboarding@resend.dev) only delivers to the Resend account's own email —
 * fine for smoke-testing this wiring, not for real customer-facing sends.
 */
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

export async function sendEmail(params: { to: string; subject: string; body: string }) {
  if (!resend) {
    console.log(`[email stub] to=${params.to} subject="${params.subject}"\n${params.body}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: params.to,
    subject: params.subject,
    text: params.body,
  });

  if (error) {
    // Logged, not thrown — every call site today fires this after its real
    // side effect already succeeded (decline reason saved, follow-up token
    // created, etc.); a bounced email shouldn't roll back or fail the
    // action that triggered it.
    console.error(`[email] Resend send failed to=${params.to}: ${error.message}`);
  }
}
