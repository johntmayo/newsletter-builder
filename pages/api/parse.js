import { parseNewsletterHtml } from "../../lib/parseNewsletterHtml";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const html = typeof req.body?.html === "string" ? req.body.html : null;
  if (!html || !html.trim()) {
    return res.status(400).json({ error: "Missing html (string body field)" });
  }

  try {
    const parsed = parseNewsletterHtml(html);
    if (!parsed.sections?.length) {
      return res.status(422).json({
        error:
          "Could not find any sections. Expected MailerLite-style orange section headings (<h2>).",
      });
    }
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(422).json({ error: `Failed to parse HTML: ${err.message}` });
  }
}
