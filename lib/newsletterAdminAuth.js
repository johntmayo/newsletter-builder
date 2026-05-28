/** Server-only: must match what admins enter in the Admin tab. Set NEWSLETTER_ADMIN_PASSWORD on Vercel for production. */
export function isNewsletterAdminPasswordBypassed() {
  return false;
}

export function newsletterAdminPassword() {
  if (process.env.NEWSLETTER_ADMIN_PASSWORD) return process.env.NEWSLETTER_ADMIN_PASSWORD;
  return process.env.NODE_ENV === "production" ? "" : "altagether2025";
}

export function isValidNewsletterAdminPassword(password) {
  if (isNewsletterAdminPasswordBypassed()) return true;
  const expected = newsletterAdminPassword();
  if (typeof password !== "string" || !password) return false;
  return password === expected;
}
