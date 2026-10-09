import { isValidNewsletterAdminPassword } from "../../lib/newsletterAdminAuth";
import { isNewsletterStorageConfigured, saveCurrentIssue } from "../../lib/newsletterStorage";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!isValidNewsletterAdminPassword(password)) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  const parsed = req.body?.parsed;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return res.status(400).json({ error: "Missing parsed newsletter object." });
  }

  if (!isNewsletterStorageConfigured()) {
    return res.status(503).json({ error: "Newsletter storage is not configured." });
  }

  try {
    await saveCurrentIssue(parsed);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
