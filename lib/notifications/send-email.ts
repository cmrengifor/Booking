import "server-only";

/**
 * Stub email sender, per docs/ARCHITECTURE.md section G: the notifications
 * table + in-app UI ship now with zero external dependency; real sending is
 * wired in whenever a provider (Resend, Supabase SMTP) is configured. Mirrors
 * the WhatsApp-stub pattern from the prior build.
 *
 * Nothing in this codebase calls this yet — there is no background job
 * runner in this Next.js app. Wiring it in is a Phase 12 concern (e.g. a
 * Vercel Cron hitting a route that sweeps unemailed notifications).
 */
export async function sendNotificationEmail(notification: {
  recipientEmail: string;
  title: string;
  body: string | null;
}) {
  if (!process.env.EMAIL_PROVIDER_API_KEY) {
    console.log(
      `[email stub] would send to ${notification.recipientEmail}: ${notification.title} — ${notification.body ?? ""}`
    );
    return;
  }

  throw new Error("No email provider is wired up yet.");
}
