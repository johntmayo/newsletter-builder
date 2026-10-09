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

  const data = req.body?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return res.status(400).json({ error: "Missing issue data object." });
  }
  if (!Array.isArray(data.sections)) {
    return res.status(400).json({ error: "Issue data must include a sections array." });
  }

  if (!isNewsletterStorageConfigured()) {
    return res.status(503).json({ error: "Newsletter storage is not configured." });
  }

  const payload = { ...data, _structureEditedAt: new Date().toISOString() };

  try {
    await saveCurrentIssue(payload);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true, data: payload });
}
