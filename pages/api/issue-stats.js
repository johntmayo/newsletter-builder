import { getCurrentIssue, getUsageStatsSince, isNewsletterStorageConfigured } from "../../lib/newsletterStorage";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isNewsletterStorageConfigured()) {
    return res.status(503).json({ error: "Newsletter storage is not configured." });
  }

  try {
    const issue = await getCurrentIssue();
    const uploadedAt = issue?.payload?._uploadedAt || null;
    const sinceMs = Date.parse(uploadedAt || issue?.updated_at || "");
    if (!Number.isFinite(sinceMs)) {
      return res.status(404).json({ error: "No published issue yet." });
    }
    const stats = await getUsageStatsSince(sinceMs);
    if (!stats) {
      return res.status(503).json({ error: "Newsletter storage is not configured." });
    }
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json({ ...stats, uploadedAt });
  } catch {
    return res.status(500).json({ error: "Could not load issue stats." });
  }
}
