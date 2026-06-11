import { getSupabaseAdmin, isSupabaseConfigured } from "../../lib/supabaseAdmin";

const ALLOWED_EVENTS = new Set(["copy_for_email", "print_newsletter"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { event, zone, itemsSelected, zoneUpdates, stylePreset } = req.body || {};
  if (!ALLOWED_EVENTS.has(event)) {
    return res.status(400).json({ error: "Unknown event." });
  }

  if (!isSupabaseConfigured()) {
    // Logging is best-effort; don't surface storage problems to captains.
    return res.status(200).json({ ok: false });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("builder_usage_events").insert({
    event,
    zone: typeof zone === "string" ? zone.slice(0, 200) : null,
    items_selected: Number.isFinite(itemsSelected) ? itemsSelected : null,
    zone_updates: Number.isFinite(zoneUpdates) ? zoneUpdates : null,
    style_preset: typeof stylePreset === "string" ? stylePreset.slice(0, 100) : null,
  });

  if (error) {
    return res.status(200).json({ ok: false });
  }
  return res.status(200).json({ ok: true });
}
