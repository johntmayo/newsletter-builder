/**
 * Serialize MailerLite HTML to a small safe subset for dangerouslySetInnerHTML.
 * Strips scripts, event handlers, and disallowed tags (unwraps their children).
 */

const ALLOWED = new Set([
  "a",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "br",
  "p",
  "ul",
  "ol",
  "li",
  "span",
]);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function textFromTextNode(node) {
  if (node.rawText != null) return node.rawText;
  if (node.text != null) return node.text;
  return "";
}

export function serializeMailerLiteNode(node) {
  if (!node) return "";
  if (node.nodeType === 3) {
    return escapeHtml(textFromTextNode(node));
  }
  if (node.nodeType !== 1) return "";

  const tag = node.rawTagName?.toLowerCase();
  if (!tag) return "";

  if (tag === "br") {
    return "<br />";
  }

  if (tag === "ul" || tag === "ol") {
    const inner = Array.from(node.childNodes || [])
      .filter((c) => c.nodeType === 1 && c.rawTagName?.toLowerCase() === "li")
      .map((li) => `<li>${serializeMailerLiteChildren(li)}</li>`)
      .join("");
    return `<${tag}>${inner}</${tag}>`;
  }

  if (tag === "a") {
    let href = node.getAttribute?.("href") || "";
    href = href.trim();
    if (!href || /^javascript:/i.test(href)) {
      return serializeMailerLiteChildren(node);
    }
    const inner = serializeMailerLiteChildren(node);
    return `<a href="${escapeAttr(href)}" rel="noopener noreferrer">${inner}</a>`;
  }

  if (!ALLOWED.has(tag)) {
    return serializeMailerLiteChildren(node);
  }

  const inner = serializeMailerLiteChildren(node);
  return `<${tag}>${inner}</${tag}>`;
}

export function serializeMailerLiteChildren(parent) {
  if (!parent?.childNodes) return "";
  return Array.from(parent.childNodes).map((c) => serializeMailerLiteNode(c)).join("");
}

/** Full inner HTML of a <li> (nested lists preserved). */
export function serializeListItemInner(li) {
  return serializeMailerLiteChildren(li);
}

/** Wrap block fragments for event-style merged items. */
export function serializeParagraphInner(p) {
  return serializeMailerLiteChildren(p);
}
