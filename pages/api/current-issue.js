import { getSupabaseAdmin, CURRENT_ROW_ID } from "../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(503).json({ error: "Newsletter storage is not configured." });
  }

  const { data, error } = await supabase
    .from("newsletter_current")
    .select("payload, updated_at")
    .eq("id", CURRENT_ROW_ID)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  if (!data?.payload) {
    return res.status(404).json({ error: "No published issue yet." });
  }

  return res.status(200).json({
    data: data.payload,
    updatedAt: data.updated_at,
  });
}
