import { parse } from "node-html-parser";

function normalizeText(s) {
  if (!s) return "";
  return s.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
}

function styleOf(el) {
  return (el.getAttribute?.("style") || "").toLowerCase();
}

function isGreenDateH2(el) {
  const s = styleOf(el);
  return s.includes("#168930") || s.includes("168930");
}

function isOrangeSectionH2(el) {
  const s = styleOf(el);
  return s.includes("#d35400") || s.includes("d35400");
}

function headingText(el) {
  return normalizeText(el.text);
}

function normalizeSectionKey(h) {
  return normalizeText(h)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Headings that are real newsletter sections (not one-off promos after Links). */
function isKnownMailerLiteSection(heading) {
  const k = normalizeSectionKey(heading);
  if (!k) return false;
  const known = new Set([
    "recovery updates",
    "upcoming deadlines",
    "events",
    "surveys",
    "community & financial support",
    "ongoing support",
    "case management",
    "in-person locations & resources",
    "additional community calendars",
    "links",
  ]);
  if (known.has(k)) return true;
  if (k.includes("in-person") && k.includes("locations") && k.includes("resources")) return true;
  if (k.includes("community") && k.includes("financial") && k.includes("support")) return true;
  return false;
}

function isAdditionalCalendarsHeading(heading) {
  return normalizeSectionKey(heading) === "additional community calendars";
}

function extractLinks(el) {
  const links = [];
  const seen = new Set();
  el.querySelectorAll?.("a[href]").forEach((a) => {
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

function parseMetaFromParagraph(text, into) {
  const next = text.match(/Next Issue:\s*([^•\n]+?)(?=\s*•|\s*Content|\s*$)/i);
  if (next) into.nextIssue = next[1].trim();
  const ded = text.match(/Content Deadline:\s*([^\n•]+?)(?=\s*$|\s*•)/i);
  if (ded) into.deadline = ded[1].trim();
  const em = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (em) into.submissionEmail = em[1];
}

function walkBlockElements(node, acc) {
  const tag = node.rawTagName?.toLowerCase();
  if (!tag) return;

  if (tag === "html" || tag === "body" || tag === "head") {
    for (const child of node.childNodes) {
      if (child.nodeType !== 1) continue;
      walkBlockElements(child, acc);
    }
    return;
  }

  if (["h1", "h2", "h3", "h4", "p", "ul", "ol"].includes(tag)) {
    acc.push({ tag, el: node });
    return;
  }

  for (const child of node.childNodes) {
    if (child.nodeType !== 1) continue;
    walkBlockElements(child, acc);
  }
}

function itemFromParagraph(el, id) {
  const text = normalizeText(el.text);
  const links = extractLinks(el);
  if (!text && links.length === 0) return null;
  return {
    id,
    type: "text",
    text,
    links,
    date: null,
    time: null,
    location: null,
  };
}

function itemFromMerged(ps, ulEl, id) {
  const parts = [];
  for (const p of ps) {
    const t = normalizeText(p.text);
    if (t) parts.push(t);
  }
  if (ulEl) {
    const t = normalizeText(ulEl.text);
    if (t) parts.push(t);
  }
  const text = parts.join("\n\n");
  let links = [];
  for (const p of ps) links = links.concat(extractLinks(p));
  if (ulEl) links = links.concat(extractLinks(ulEl));
  const dedup = [];
  const seen = new Set();
  for (const l of links) {
    const k = `${l.label}\0${l.url}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(l);
  }
  if (!text && dedup.length === 0) return null;
  return {
    id,
    type: "text",
    text,
    links: dedup,
    date: null,
    time: null,
    location: null,
  };
}

function itemsFromListAlone(ulEl) {
  const items = [];
  for (const child of ulEl.childNodes) {
    if (child.nodeType !== 1) continue;
    if (child.rawTagName?.toLowerCase() !== "li") continue;
    const text = normalizeText(child.text);
    const links = extractLinks(child);
    if (!text && links.length === 0) continue;
    items.push({
      type: "text",
      text,
      links,
      date: null,
      time: null,
      location: null,
    });
  }
  return items;
}

function isTextBlockTag(tag) {
  return tag === "p" || tag === "h3" || tag === "h4";
}

function sectionToItems(contentBlocks, sectionId) {
  const elements = contentBlocks.filter((b) =>
    ["p", "h3", "h4", "ul", "ol"].includes(b.tag),
  );
  const items = [];
  let itemSeq = 0;
  const nextId = () => {
    itemSeq += 1;
    return `${sectionId}i${itemSeq}`;
  };

  let i = 0;
  while (i < elements.length) {
    const cur = elements[i];
    if (cur.tag === "ul" || cur.tag === "ol") {
      for (const raw of itemsFromListAlone(cur.el)) {
        itemSeq += 1;
        items.push({ ...raw, id: `${sectionId}i${itemSeq}` });
      }
      i += 1;
      continue;
    }

    if (!isTextBlockTag(cur.tag)) {
      i += 1;
      continue;
    }

    const ps = [];
    while (i < elements.length && isTextBlockTag(elements[i].tag)) {
      ps.push(elements[i].el);
      i += 1;
    }

    if (i < elements.length && (elements[i].tag === "ul" || elements[i].tag === "ol")) {
      const ulEl = elements[i].el;
      const substantivePs = ps.filter((p) => normalizeText(p.text) || extractLinks(p).length > 0);
      if (substantivePs.length === 0) {
        for (const raw of itemsFromListAlone(ulEl)) {
          itemSeq += 1;
          items.push({ ...raw, id: `${sectionId}i${itemSeq}` });
        }
      } else {
        const merged = itemFromMerged(ps, ulEl, nextId());
        if (merged) items.push(merged);
      }
      i += 1;
    } else {
      for (const p of ps) {
        const it = itemFromParagraph(p, nextId());
        if (it) items.push(it);
      }
    }
  }

  return items;
}

function parseHeader(blocks) {
  const meta = {
    title: "",
    date: "",
    nextIssue: "",
    deadline: "",
    submissionEmail: "",
  };
  let idx = 0;
  while (idx < blocks.length) {
    const { tag, el } = blocks[idx];
    if (tag === "h2" && isOrangeSectionH2(el) && headingText(el)) {
      break;
    }
    if (tag === "h1") {
      meta.title = headingText(el);
    } else if (tag === "h2" && isGreenDateH2(el)) {
      meta.date = headingText(el);
    } else if (tag === "p") {
      parseMetaFromParagraph(normalizeText(el.text), meta);
    }
    idx += 1;
  }
  if (!meta.title) meta.title = "Neighborhood Captain Newsletter";
  return { meta, firstSectionIdx: idx };
}

function appendFooterItems(section, contentBlocks) {
  const n0 = section.items.length;
  const extra = sectionToItems(contentBlocks, section.id);
  extra.forEach((it, j) => {
    section.items.push({ ...it, id: `${section.id}i${n0 + j + 1}` });
  });
}

function parseSections(blocks, startIdx) {
  const sections = [];
  let idx = startIdx;
  let s = 0;

  while (idx < blocks.length) {
    const b = blocks[idx];

    if (b.tag === "h4") {
      const h4Heading = headingText(b.el);
      if (isAdditionalCalendarsHeading(h4Heading)) {
        idx += 1;
        s += 1;
        const sectionId = `s${s}`;
        const content = [];
        while (idx < blocks.length) {
          const b2 = blocks[idx];
          if (b2.tag === "h2" && isOrangeSectionH2(b2.el) && headingText(b2.el)) break;
          if (
            b2.tag === "h4" &&
            isAdditionalCalendarsHeading(headingText(b2.el))
          ) {
            break;
          }
          if (["p", "ul", "ol"].includes(b2.tag)) content.push(b2);
          idx += 1;
        }
        sections.push({
          id: sectionId,
          heading: h4Heading,
          items: sectionToItems(content, sectionId),
        });
        continue;
      }
      idx += 1;
      continue;
    }

    if (b.tag !== "h2") {
      idx += 1;
      continue;
    }
    if (isGreenDateH2(b.el)) {
      idx += 1;
      continue;
    }
    if (!isOrangeSectionH2(b.el)) {
      idx += 1;
      continue;
    }

    const heading = headingText(b.el);
    idx += 1;
    if (!heading) continue;

    const last = sections[sections.length - 1];
    if (last?.heading === "Links" && !isKnownMailerLiteSection(heading)) {
      const content = [];
      while (idx < blocks.length) {
        const b2 = blocks[idx];
        if (b2.tag === "h2" && isOrangeSectionH2(b2.el)) {
          const h = headingText(b2.el);
          if (h && isKnownMailerLiteSection(h)) break;
          if (h) {
            content.push({ tag: "p", el: b2.el });
            idx += 1;
            continue;
          }
          idx += 1;
          continue;
        }
        if (["p", "ul", "ol", "h3", "h4"].includes(b2.tag)) {
          content.push(b2);
        }
        idx += 1;
      }
      const bannerBlocks = [{ tag: "p", el: b.el }];
      appendFooterItems(last, bannerBlocks);
      appendFooterItems(last, content);
      continue;
    }

    s += 1;
    const sectionId = `s${s}`;
    const content = [];

    while (idx < blocks.length) {
      const b2 = blocks[idx];
      if (b2.tag === "h2") {
        if (isGreenDateH2(b2.el)) {
          idx += 1;
          continue;
        }
        if (isOrangeSectionH2(b2.el)) {
          const h = headingText(b2.el);
          if (h) break;
          idx += 1;
          continue;
        }
        idx += 1;
        continue;
      }
      if (
        b2.tag === "h4" &&
        isAdditionalCalendarsHeading(headingText(b2.el))
      ) {
        break;
      }
      if (b2.tag === "p" || b2.tag === "ul" || b2.tag === "ol") {
        content.push(b2);
      }
      idx += 1;
    }

    const items = sectionToItems(content, sectionId);
    sections.push({ id: sectionId, heading, items });
  }

  return sections;
}

export function parseNewsletterHtml(html) {
  const root = parse(html, { blockTextElements: { script: true, style: true } });
  const body = root.querySelector("body") || root;
  const blocks = [];
  walkBlockElements(body, blocks);

  const { meta, firstSectionIdx } = parseHeader(blocks);
  const sections = parseSections(blocks, firstSectionIdx);

  return {
    title: meta.title,
    date: meta.date,
    nextIssue: meta.nextIssue || null,
    deadline: meta.deadline || null,
    submissionEmail: meta.submissionEmail || null,
    sections,
  };
}
