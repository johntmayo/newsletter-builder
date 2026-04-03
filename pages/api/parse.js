const SYSTEM_PROMPT = `You are a newsletter parser. Given a PDF newsletter (rendered as images), extract ALL content and return ONLY a valid JSON object with no markdown, no backticks, no preamble.

Return this exact structure:
{
  "title": "string - newsletter title",
  "date": "string - publication date",
  "nextIssue": "string - next issue date if present",
  "deadline": "string - content deadline if present",
  "submissionEmail": "string - email for submissions if present",
  "sections": [
    {
      "id": "unique_id",
      "heading": "Section heading text",
      "items": [
        {
          "id": "unique_item_id",
          "type": "text|event|deadline|link_item|sub_heading",
          "text": "Full item text, preserving all details",
          "links": [
            {"label": "link text", "url": "url if extractable or null"}
          ],
          "date": "event date if applicable",
          "time": "event time if applicable",
          "location": "event location if applicable"
        }
      ]
    }
  ]
}

Rules:
- Extract EVERY item, no matter how small
- Preserve ALL hyperlink text (even if URLs aren't in the PDF text)
- For events, extract date, time, location separately
- Group items under their correct section headings
- Sub-bullets belong to their parent item
- IDs should be short unique strings like "s1", "s1i1", etc.`;

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

  const { base64Data } = req.body;
  if (!base64Data) {
    return res.status(400).json({ error: "Missing base64Data" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured" });
  }

  let anthropicRes;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: "Parse this newsletter PDF and return the JSON structure described. Extract every section, every item, every hyperlink label.",
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    return res.status(502).json({ error: `Failed to reach Anthropic API: ${err.message}` });
  }

  if (!anthropicRes.ok) {
    const body = await anthropicRes.text();
    return res.status(anthropicRes.status).json({ error: `Anthropic API error: ${body}` });
  }

  const data = await anthropicRes.json();
  const raw = data.content.map((b) => b.text || "").join("");
  const clean = raw.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (err) {
    return res.status(422).json({ error: `Failed to parse Claude response as JSON: ${err.message}` });
  }

  return res.status(200).json(parsed);
}
