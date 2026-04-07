/** Server-only: must match what admins enter in the Admin tab. Set NEWSLETTER_ADMIN_PASSWORD on Vercel for production. */
export function newsletterAdminPassword() {
  return process.env.NEWSLETTER_ADMIN_PASSWORD || "altagether2025";
}

export function isValidNewsletterAdminPassword(password) {
  const expected = newsletterAdminPassword();
  if (typeof password !== "string" || !password) return false;
  return password === expected;
}
