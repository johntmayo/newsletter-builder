import { getCurrentIssue, isNewsletterStorageConfigured } from "../../lib/newsletterStorage";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isNewsletterStorageConfigured()) {
    return res.status(503).json({ error: "Newsletter storage is not configured." });
  }

  let data;
  try {
    data = await getCurrentIssue();
  } catch (error) {
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
