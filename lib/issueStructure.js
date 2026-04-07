import { parse } from "node-html-parser";

function normalizeText(s) {
  if (!s) return "";
  return String(s).replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
}

function extractLinksFromHtml(html) {
  if (!html || !html.trim()) return [];
  const root = parse(`<div id="__lnk">${html}</div>`, {
    blockTextElements: { script: true, style: true },
  });
  const wrap = root.querySelector("#__lnk");
  if (!wrap) return [];
  const links = [];
  const seen = new Set();
  wrap.querySelectorAll("a[href]").forEach((a) => {
    let href = a.getAttribute("href") || "";
    href = href.trim();
    if (!href || href === "#" || href.toLowerCase().startsWith("javascript:")) return;
    const label = normalizeText(a.text);
    if (!label) return;
    const key = `${label}\0${href}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ label, url: href });
  });
  return links;
}

/** Top-level `<p>`, `<ul>`, `<ol>` outer HTML sequences inside `bodyHtml`. */
export function getBodyHtmlBlocks(bodyHtml) {
  if (!bodyHtml || !String(bodyHtml).trim()) return [];
  const root = parse(`<div id="__blk">${bodyHtml}</div>`, {
    blockTextElements: { script: true, style: true },
  });
  const wrap = root.querySelector("#__blk");
  if (!wrap) return [];
  const blocks = [];
  for (const child of wrap.childNodes) {
    if (child.nodeType !== 1) continue;
    const tag = child.rawTagName?.toLowerCase();
    if (tag === "p" || tag === "ul" || tag === "ol") {
      blocks.push(child.toString().trim());
    }
  }
  return blocks;
}

/** How many split points exist (split after block 0 .. length-2). */
export function splitPointCount(bodyHtml) {
  const n = getBodyHtmlBlocks(bodyHtml).length;
  return n >= 2 ? n - 1 : 0;
}

function buildItemFromBodyHtml(html) {
  const h = html && html.trim() ? html.trim() : "";
  const root = h ? parse(`<div id="__t">${h}</div>`) : null;
  const text = root ? normalizeText(root.querySelector("#__t")?.text || "") : "";
  const links = extractLinksFromHtml(h);
  return {
    type: "text",
    text,
    bodyHtml: h || null,
    links,
    date: null,
    time: null,
    location: null,
  };
}

export function mergeTwoItems(left, right) {
  const parts = [left.bodyHtml, right.bodyHtml].filter(Boolean);
  const bodyHtml = parts.join("") || null;
  const text = normalizeText(
    `${left.text || ""}\n\n${right.text || ""}`.replace(/\n{3,}/g, "\n\n"),
  );
  const linkMap = new Map();
  for (const l of [...(left.links || []), ...(right.links || []), ...extractLinksFromHtml(bodyHtml || "")]) {
    const k = `${l.label}\0${l.url}`;
    if (!linkMap.has(k)) linkMap.set(k, l);
  }
  const merged = {
    ...left,
    type: "text",
    text: text || normalizeText((left.text || "") + (right.text || "")),
    bodyHtml,
    links: [...linkMap.values()],
    date: left.date ?? null,
    time: left.time ?? null,
    location: left.location ?? null,
  };
  delete merged._adminHidden;
  return merged;
}

/**
 * @param {object} item
 * @param {number} afterBlockIndex split after this 0-based block (inclusive first chunk)
 * @returns {[object, object]|null}
 */
export function splitItemAtBlock(item, afterBlockIndex) {
  const blocks = getBodyHtmlBlocks(item.bodyHtml);
  if (blocks.length < 2) return null;
  if (afterBlockIndex < 0 || afterBlockIndex >= blocks.length - 1) return null;
  const first = blocks.slice(0, afterBlockIndex + 1).join("");
  const second = blocks.slice(afterBlockIndex + 1).join("");
  return [buildItemFromBodyHtml(first), buildItemFromBodyHtml(second)];
}

export function renumberAllItemIds(data) {
  const next = structuredClone(data);
  for (const sec of next.sections || []) {
    if (!Array.isArray(sec.items)) continue;
    sec.items = sec.items.map((it, i) => ({
      ...it,
      id: `${sec.id}i${i + 1}`,
    }));
  }
  return next;
}

export function mergeItemWithPrevious(data, sectionIndex, itemIndex) {
  if (itemIndex <= 0) return data;
  const next = structuredClone(data);
  const sec = next.sections[sectionIndex];
  if (!sec?.items?.[itemIndex]) return data;
  const left = sec.items[itemIndex - 1];
  const right = sec.items[itemIndex];
  sec.items.splice(itemIndex - 1, 2, mergeTwoItems(left, right));
  return renumberAllItemIds(next);
}

export function mergeItemWithNext(data, sectionIndex, itemIndex) {
  const next = structuredClone(data);
  const sec = next.sections[sectionIndex];
  if (!sec?.items?.[itemIndex + 1]) return data;
  const left = sec.items[itemIndex];
  const right = sec.items[itemIndex + 1];
  sec.items.splice(itemIndex, 2, mergeTwoItems(left, right));
  return renumberAllItemIds(next);
}

export function splitItemInSection(data, sectionIndex, itemIndex, afterBlockIndex) {
  const next = structuredClone(data);
  const sec = next.sections[sectionIndex];
  const item = sec?.items?.[itemIndex];
  if (!item) return data;
  const pair = splitItemAtBlock(item, afterBlockIndex);
  if (!pair) return data;
  sec.items.splice(itemIndex, 1, pair[0], pair[1]);
  return renumberAllItemIds(next);
}

/** Soft-hide an item from captain view; call again to restore. */
export function toggleItemHidden(data, sectionIndex, itemIndex) {
  const next = structuredClone(data);
  const item = next.sections[sectionIndex]?.items?.[itemIndex];
  if (!item) return data;
  if (item._adminHidden) {
    delete item._adminHidden;
  } else {
    item._adminHidden = true;
  }
  return next;
}
