import { isValidNewsletterAdminPassword } from "../../lib/newsletterAdminAuth";
import { getSupabaseAdmin, isSupabaseConfigured, CURRENT_ROW_ID } from "../../lib/supabaseAdmin";

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

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Newsletter storage is not configured (Supabase)." });
  }

  const payload = { ...data, _structureEditedAt: new Date().toISOString() };
  const supabase = getSupabaseAdmin();
  const row = {
    id: CURRENT_ROW_ID,
    payload,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("newsletter_current").upsert(row, { onConflict: "id" });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true, data: payload });
}
