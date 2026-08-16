import "server-only";

/**
 * Stubbed until a real provider (Resend) is configured — logs instead of
 * sending, same pattern as every other transactional email in this app
 * (see docs/ARCHITECTURE.md section G). Swap the body for a real provider
 * call once a key exists; call sites don't need to change.
 */
export async function sendEmail(params: { to: string; subject: string; body: string }) {
  console.log(`[email stub] to=${params.to} subject="${params.subject}"\n${params.body}`);
}
