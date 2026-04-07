import { isValidNewsletterAdminPassword } from "../../lib/newsletterAdminAuth";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!isValidNewsletterAdminPassword(password)) {
    return res.status(401).json({ ok: false, error: "Incorrect password." });
  }

  return res.status(200).json({ ok: true });
}
