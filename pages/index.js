import { useState, useEffect, useRef } from "react";
import AdminReviewStructure from "../components/AdminReviewStructure";
import { repairLegacyAmpDoubling } from "../lib/sanitizeMailerLiteHtml";

// ── Design tokens (CSS vars — see styles/globals.css & altagether-subpage-style.md)
const STORAGE_KEY = "altagether_newsletter_data";
const CAPTAIN_CONFIG_STORAGE_KEY = "altagether_captain_config";
const CUSTOM_ENTRIES_STORAGE_KEY = "altagether_custom_entries";
const SELECTED_IDS_STORAGE_KEY = "altagether_selected_ids";
const BUILDER_STATE_STORAGE_KEY = "altagether_builder_state";
const FULL_NEWSLETTER_URL = "https://altagether.org/newsletter";

const DEFAULT_CAPTAIN_CONFIG = {
  name: "",
  tagline: "",
  issueDate: formatDisplayDate(new Date()),
  zone: "",
  captains: [{ id: "c1", name: "", contact: "" }],
  zoneLinks: "",
  stylePreset: "editorial",
};

const V = {
  paper: "var(--bg-paper)",
  card: "var(--bg-card)",
  ink: "var(--text-primary)",
  muted: "var(--text-secondary)",
  border: "var(--border-color)",
  navy: "var(--brand-primary-dark)",
  green: "var(--accent-green)",
  gold: "var(--accent-gold)",
  clay: "var(--accent-clay)",
  white: "#ffffff",
  cardShadow: "var(--nl-card-shadow)",
  fontDisplay: 'var(--font-chivo), system-ui, sans-serif',
  fontBody: 'var(--font-merriweather), Georgia, serif',
  inputBg: "var(--bg-card)",
  greenTint08: "rgba(40, 54, 24, 0.08)",
  greenTint15: "rgba(40, 54, 24, 0.15)",
  clayTint: "rgba(188, 88, 56, 0.12)",
};

const NEWSLETTER_STYLE_PRESETS = {
  editorial: {
    id: "editorial",
    label: "Newsprint",
    shortLabel: "Newsprint",
    description: "Serif font. A more traditional newsletter look.",
    bodyFont: V.fontBody,
    emailFontFamily: "Merriweather, Georgia, serif",
    header: "band",
    item: "rule",
  },
  clean: {
    id: "clean",
    label: "Modern",
    shortLabel: "Modern",
    description: "Sans serif font. A slightly more compact, modern look.",
    bodyFont: V.fontDisplay,
    emailFontFamily: "Chivo, Arial, sans-serif",
    header: "paper",
    item: "card",
  },
};

function getNewsletterStylePreset(id) {
  return NEWSLETTER_STYLE_PRESETS[id] || NEWSLETTER_STYLE_PRESETS.editorial;
}

function issueDraftStorageSuffix(newsletterData) {
  const raw = [
    newsletterData?._uploadedAt,
    newsletterData?.date,
    newsletterData?.title,
  ].filter(Boolean).join("__");
  return raw
    ? raw.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 96)
    : "current";
}

function selectedIdsStorageKey(newsletterData) {
  return `${SELECTED_IDS_STORAGE_KEY}_${issueDraftStorageSuffix(newsletterData)}`;
}

/** Section rail colors — distinct hues for scanability (not all from core tokens). */
const SECTION_COLORS = {
  "Recovery Updates": "#283618",
  "Upcoming Deadlines": "#bc5838",
  Events: "#5B4A8A",
  Surveys: "#1A6B8A",
  "Community & Financial Support": "#8A4A1A",
  "Ongoing Support": "#8A4A1A",
  "Case Management": "#4A6B1A",
  "In-Person Locations & Resources": "#6B1A4A",
  "Additional Community Calendars": "#3D5A6C",
  Links: "#4A5568",
  Other: "#6b7280",
};

async function parseNewsletterHtmlUpload(html) {
  const response = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(err.error || `Server error: ${response.status}`);
  }

  return response.json();
}

function fileToUtf8Text(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(typeof r.result === "string" ? r.result : "");
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsText(file, "UTF-8");
  });
}

function getSectionColor(heading) {
  for (const [key, color] of Object.entries(SECTION_COLORS)) {
    if (heading?.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return SECTION_COLORS.Other;
}

function formatDisplayDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function metadataText(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    for (const key of ["text", "date", "label", "title", "value"]) {
      if (value[key] != null) return metadataText(value[key]);
    }
  }
  return "";
}

function normalizeNewsletterIssueData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  return {
    ...data,
    title: metadataText(data.title) || "Neighborhood Captain Newsletter",
    date: metadataText(data.date),
    nextIssue: metadataText(data.nextIssue) || null,
    deadline: metadataText(data.deadline) || null,
    submissionEmail: metadataText(data.submissionEmail) || null,
    sections: Array.isArray(data.sections)
      ? data.sections.map((section, sIdx) => ({
          ...section,
          id: metadataText(section?.id) || `s${sIdx + 1}`,
          heading: metadataText(section?.heading) || "Other",
          items: Array.isArray(section?.items)
            ? section.items.map((item, iIdx) => ({
                ...item,
                id: metadataText(item?.id) || `s${sIdx + 1}i${iIdx + 1}`,
                type: metadataText(item?.type) || "text",
                text: metadataText(item?.text),
                bodyHtml: typeof item?.bodyHtml === "string" ? item.bodyHtml : null,
                date: metadataText(item?.date) || null,
                time: metadataText(item?.time) || null,
                location: metadataText(item?.location) || null,
                links: Array.isArray(item?.links)
                  ? item.links
                      .map((link) => ({
                        label: metadataText(link?.label),
                        url: metadataText(link?.url),
                      }))
                      .filter((link) => link.label || link.url)
                  : [],
              }))
            : [],
        }))
      : [],
  };
}

function formatNextIssueDate(nextIssue, currentIssueDate) {
  const next = metadataText(nextIssue).trim();
  if (!next || /\b\d{4}\b/.test(next)) return next;
  const year = metadataText(currentIssueDate).match(/\b\d{4}\b/)?.[0];
  return year ? `${next}, ${year}` : next;
}

/** Matches --accent-clay (for borders where CSS vars cannot be concatenated). */
const CLAY_HEX = "#bc5838";

/** One section title for all captain-authored zone updates (preview / email / PDF). */
function zoneUpdatesSectionTitle(zone, newsletterName) {
  const z = (zone || "").trim();
  if (z) return `${z} Updates`;
  const n = (newsletterName || "").trim();
  if (n) return `${n} Updates`;
  return "Zone updates";
}

/** @param {{ id?: string, name?: string, contact?: string }[]} captains */
function captainsWithContent(captains) {
  if (!Array.isArray(captains)) return [];
  return captains.filter((c) => (c.name || "").trim() || (c.contact || "").trim());
}

/** Reader-facing line: name — contact, or whichever is filled. */
function formatCaptainLine(c) {
  const n = (c.name || "").trim();
  const t = (c.contact || "").trim();
  if (n && t) return `${n} — ${t}`;
  if (n) return n;
  return t;
}

function escapeHtmlPlain(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttr(s) {
  return escapeHtmlPlain(s).replace(/"/g, "&quot;");
}

function safeCustomLinkHref(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return `mailto:${raw}`;
  }
  const normalized = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "mailto:") {
      return normalized;
    }
  } catch (_) {}
  return "";
}

function parseCustomUpdateText(text) {
  const source = String(text || "");
  const parts = [];
  const linkPattern = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  let cursor = 0;
  let match;

  while ((match = linkPattern.exec(source)) !== null) {
    const [raw, label, hrefRaw] = match;
    const href = safeCustomLinkHref(hrefRaw);
    if (!href) continue;
    if (match.index > cursor) parts.push({ type: "text", text: source.slice(cursor, match.index) });
    parts.push({ type: "link", label, href });
    cursor = match.index + raw.length;
  }

  if (cursor < source.length) parts.push({ type: "text", text: source.slice(cursor) });
  return parts.length ? parts : [{ type: "text", text: source }];
}

function customUpdateTextToPlain(text) {
  return parseCustomUpdateText(text)
    .map((part) => (part.type === "link" ? `${part.label} (${part.href})` : part.text))
    .join("");
}

function customUpdateTextToHtml(text) {
  return parseCustomUpdateText(text)
    .map((part) => {
      if (part.type === "link") {
        return `<a href="${escapeHtmlAttr(part.href)}" rel="noopener noreferrer">${escapeHtmlPlain(part.label)}</a>`;
      }
      return escapeHtmlPlain(part.text);
    })
    .join("");
}

function splitTrailingUrlPunctuation(raw) {
  let hrefRaw = String(raw || "");
  let suffix = "";
  while (hrefRaw && /[.,!?;:]$/.test(hrefRaw)) {
    suffix = hrefRaw.slice(-1) + suffix;
    hrefRaw = hrefRaw.slice(0, -1);
  }
  return { hrefRaw, suffix };
}

function parseAutoLinkText(text) {
  const source = String(text || "");
  const parts = [];
  const urlPattern = /\b((?:https?:\/\/|www\.)[^\s<>()]+|[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:\/[^\s<>()]*)?)/gi;
  let cursor = 0;
  let match;

  while ((match = urlPattern.exec(source)) !== null) {
    if (match.index > 0 && source[match.index - 1] === "@") continue;
    const raw = match[0];
    const { hrefRaw, suffix } = splitTrailingUrlPunctuation(raw);
    const href = safeCustomLinkHref(hrefRaw);
    if (!href) continue;
    if (match.index > cursor) parts.push({ type: "text", text: source.slice(cursor, match.index) });
    parts.push({ type: "link", label: hrefRaw, href });
    if (suffix) parts.push({ type: "text", text: suffix });
    cursor = match.index + raw.length;
  }

  if (cursor < source.length) parts.push({ type: "text", text: source.slice(cursor) });
  return parts.length ? parts : [{ type: "text", text: source }];
}

function autoLinkTextToHtml(text) {
  return parseAutoLinkText(text)
    .map((part) => {
      if (part.type === "link") {
        return `<a href="${escapeHtmlAttr(part.href)}" rel="noopener noreferrer" style="color:#283618;text-decoration:underline;font-weight:700;">${escapeHtmlPlain(part.label)}</a>`;
      }
      return escapeHtmlPlain(part.text);
    })
    .join("");
}

function AutoLinkedText({ text, color = V.green }) {
  return (
    <>
      {parseAutoLinkText(text).map((part, index) =>
        part.type === "link" ? (
          <a
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color, textDecoration: "underline", fontWeight: 700 }}
          >
            {part.label}
          </a>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

function CustomUpdateText({ text, color = V.green }) {
  return (
    <>
      {parseCustomUpdateText(text).map((part, index) =>
        part.type === "link" ? (
          <a
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color, textDecoration: "underline", fontWeight: 700 }}
          >
            {part.label}
          </a>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** Inline tight list/paragraph spacing for email paste (client defaults are often very loose). */
function augmentEmailItemBodyHtml(fragment) {
  function patchOpeningTag(tag, style) {
    return (match, attrs) => {
      const a = attrs || "";
      if (/style\s*=/i.test(a)) return match;
      return `<${tag}${a} style="${style}">`;
    };
  }
  return String(fragment)
    .replace(/<ul\b([^>]*)>/gi, patchOpeningTag("ul", "margin:4px 0 6px;padding-left:1.2em;list-style-position:outside;"))
    .replace(/<ol\b([^>]*)>/gi, patchOpeningTag("ol", "margin:4px 0 6px;padding-left:1.2em;list-style-position:outside;"))
    .replace(/<li\b([^>]*)>/gi, patchOpeningTag("li", "margin:1px 0;padding:0;line-height:1.45;"))
    .replace(/<p\b([^>]*)>/gi, patchOpeningTag("p", "margin:0.22em 0;line-height:inherit;"));
}

/** Plain-text fallback for an item (email copy / legacy data without bodyHtml). */
function itemToPlainText(item) {
  if (item.bodyHtml) {
    let t = repairLegacyAmpDoubling(item.bodyHtml).replace(/<\/(p|div|h[1-6]|li)>/gi, "\n");
    t = t.replace(/<br\s*\/?>/gi, "\n");
    t = t.replace(/<li[^>]*>/gi, "\n• ");
    t = t.replace(/<[^>]+>/g, "");
    t = t.replace(/\n{3,}/g, "\n\n").trim();
    return t;
  }
  let t = item.text || "";
  if (item.links?.length) {
    t += "\n" + item.links.map((l) => (l.url ? `${l.label}: ${l.url}` : l.label)).join("\n");
  }
  return t.trim();
}

function captainVisibleItems(items) {
  return (items || []).filter((it) => !it._adminHidden);
}

function buildSelectedBySection(newsletterData, selectedIds) {
  return (newsletterData?.sections || [])
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((it) => selectedIds.has(it.id) && !it._adminHidden),
    }))
    .filter((sec) => sec.items.length > 0);
}

function countCaptainVisibleSelected(newsletterData, selectedIds) {
  let n = 0;
  for (const sec of newsletterData?.sections || []) {
    for (const it of sec.items || []) {
      if (!it._adminHidden && selectedIds.has(it.id)) n += 1;
    }
  }
  return n;
}

function NewsletterItemBody({ item, sectionColor, appendixLinks, bodyFont = V.fontBody, lineHeight = 1.65 }) {
  if (item.bodyHtml) {
    return (
      <div
        className="nl-item-body"
        style={{
          fontSize: "0.9rem",
          lineHeight,
          color: "var(--text-primary)",
          fontFamily: bodyFont,
          ["--nl-accent"]: sectionColor,
        }}
        dangerouslySetInnerHTML={{ __html: repairLegacyAmpDoubling(item.bodyHtml) }}
      />
    );
  }
  return (
    <>
      <div style={{ fontSize: "0.9rem", lineHeight, fontFamily: bodyFont }}>{item.text}</div>
      {appendixLinks && item.links?.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {item.links.map((l, i) => (
            <span key={i} style={{ fontSize: 11, color: sectionColor, marginRight: 8, display: "inline-block" }}>
              → {l.label}
              {l.url ? ` (${l.url})` : ""}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

// ── Global styles: list layout in preview/cards + print (visibility trick works when #print-root is nested in #__next)
function injectPrintStyles() {
  const id = "altag-print-styles";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    .nl-item-body ul, .nl-item-body ol {
      margin: 0.35em 0 0.5em;
      padding-left: 1.35em;
    }
    .nl-item-body li { margin: 0.2em 0; }
    .nl-item-body li > ul, .nl-item-body li > ol { margin-top: 0.25em; margin-bottom: 0.25em; }
    .nl-item-body p { margin: 0.35em 0; }
    .nl-item-body p:first-child { margin-top: 0; }
    .nl-item-body p:last-child { margin-bottom: 0; }
    .nl-item-body {
      font-family: var(--font-merriweather), Georgia, serif;
      color: var(--text-primary);
    }
    .nl-item-body a { color: var(--nl-accent, var(--accent-green)); text-decoration: underline; font-weight: 700; }
    @media print {
      body * { visibility: hidden; }
      #print-root, #print-root * { visibility: visible; }
      #print-root {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        background: #fff;
        font-size: 12px !important;
      }
      #print-root .nl-item-body {
        font-size: 12px !important;
        line-height: 1.45 !important;
      }
      #print-root .nl-item-body p { margin: 0.22em 0 !important; }
      #print-root .nl-item-body ul, #print-root .nl-item-body ol {
        margin: 0.25em 0 0.38em !important;
        padding-left: 1.2em !important;
      }
      #print-root .nl-item-body li { margin: 0.12em 0 !important; }
      /* PDF / print: use a white masthead so it survives printers that skip background graphics. */
      #print-root .nl-print-header {
        background: #fff !important;
        color: #1f2937 !important;
        border-top: 5px solid #314059 !important;
        border-bottom: 3px solid #314059 !important;
        padding: 18px 28px !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      #print-root .nl-print-header .nl-print-header-title {
        font-size: 24px !important;
        color: #111827 !important;
        opacity: 1 !important;
      }
      #print-root .nl-print-header .nl-print-header-tagline {
        font-size: 12px !important;
        color: #374151 !important;
        opacity: 1 !important;
      }
      #print-root .nl-print-header .nl-print-header-meta {
        font-size: 11px !important;
        color: #374151 !important;
        opacity: 1 !important;
      }
      #print-root .nl-print-header .nl-print-header-curated {
        font-size: 10.5px !important;
        color: #4b5563 !important;
        opacity: 1 !important;
      }
      #print-root .nl-print-header .nl-print-header-curated a {
        color: #4b5563 !important;
      }
      #print-root .nl-print-header .nl-print-header-rule {
        border-top-color: #d1d5db !important;
      }
      #print-root .nl-print-header .nl-print-header-captains {
        font-size: 11.5px !important;
        color: #374151 !important;
        opacity: 1 !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// ── Components ─────────────────────────────────────────────────────────────────

const LOGO_IMG_HEIGHT = Math.round(40 * 1.2);

/** @param {{ onDark?: boolean, subtitle?: string }} props — onDark: white logo + text on navy header; else logo (darkened) + navy text on light surfaces */
function Logo({ onDark = false, subtitle = "" }) {
  const [imgOk, setImgOk] = useState(true);
  const titleStyle = {
    fontFamily: V.fontDisplay,
    fontWeight: 700,
    fontSize: 24,
    lineHeight: 1.2,
    letterSpacing: "0.01em",
    color: onDark ? V.white : V.navy,
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      {imgOk ? (
        <img
          src="/images/logo_white_transparent.png"
          alt=""
          height={LOGO_IMG_HEIGHT}
          style={{
            display: "block",
            width: "auto",
            height: LOGO_IMG_HEIGHT,
            flexShrink: 0,
            objectFit: "contain",
            ...(onDark
              ? {}
              : {
                  filter: "brightness(0) saturate(100%)",
                  opacity: 0.88,
                }),
          }}
          onError={() => setImgOk(false)}
        />
      ) : null}
      <span style={{ minWidth: 0 }}>
        <span style={titleStyle}>Newsletter Builder</span>
        {subtitle ? (
          <span style={{ display: "block", marginTop: 3, fontSize: 12, lineHeight: 1.35, color: onDark ? "rgba(255,255,255,0.82)" : V.muted, fontFamily: V.fontBody, maxWidth: 560 }}>
            {subtitle}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function Button({ children, onClick, variant = "primary", disabled, style = {}, className = "" }) {
  const cls = `nl-btn nl-btn-${variant} ${className}`.trim();
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} style={style}>
      {children}
    </button>
  );
}

function Tag({ text, color }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 3,
      background: color + "20", color, fontSize: 10, fontWeight: 700,
      letterSpacing: "0.08em", textTransform: "uppercase", border: `1px solid ${color}40`,
    }}>{text}</span>
  );
}

// ── Admin View ─────────────────────────────────────────────────────────────────
function AdminView({
  publishedIssue,
  unpublishedDraft,
  onAdminIssueUpdate,
  onDiscardDraft,
}) {
  // TEMPORARY TESTING BYPASS: start authenticated while admin password is paused.
  const [authed, setAuthed] = useState(true);
  const [adminTab, setAdminTab] = useState("upload");
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const fileRef = useRef();

  async function handleLogin() {
    setPwError("");
    setLoginLoading(true);
    try {
      const response = await fetch("/api/verify-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (response.ok) {
        setAuthed(true);
        return;
      }
      const err = await response.json().catch(() => ({}));
      setPwError(err.error || "Incorrect password.");
    } catch {
      setPwError("Could not reach the server. Check your connection.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleParseOnly() {
    if (!file) return;
    setLoading(true);
    setStatus("");
    try {
      const html = await fileToUtf8Text(file);
      setStatus("Parsing newsletter…");
      const parsed = normalizeNewsletterIssueData(await parseNewsletterHtmlUpload(html));
      parsed._uploadedAt = new Date().toISOString();

      onAdminIssueUpdate(parsed, { draftOnly: true });
      setAdminTab("review");

      const linkCount = (parsed.sections || []).reduce(
        (n, sec) =>
          n + (sec.items || []).reduce((m, it) => m + (it.links?.length || 0), 0),
        0,
      );

      setStatus(
        `✓ Parsed (${parsed.sections?.length || 0} sections, ${linkCount} links). Review structure, then return here to publish for all visitors.`,
      );
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handlePublishForEveryone() {
    if (!unpublishedDraft) return;
    setPublishLoading(true);
    setStatus("");
    try {
      const issueToPublish = normalizeNewsletterIssueData(unpublishedDraft);
      const pub = await fetch("/api/publish-newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, parsed: issueToPublish }),
      });
      const pubBody = await pub.json().catch(() => ({}));

      const linkCount = (issueToPublish.sections || []).reduce(
        (n, sec) =>
          n + (sec.items || []).reduce((m, it) => m + (it.links?.length || 0), 0),
        0,
      );

      if (!pub.ok) {
        setStatus(
          `Error: could not publish — ${pubBody.error || `HTTP ${pub.status}`}. Your draft is unchanged.`,
        );
        return;
      }

      onAdminIssueUpdate(issueToPublish);
      setStatus(
        `✓ Published for all visitors! ${issueToPublish.sections?.length || 0} sections, ${linkCount} links live.`,
      );
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setPublishLoading(false);
    }
  }

  if (!authed) {
    return (
      <div style={{ maxWidth: 400, margin: "80px auto", padding: 32, background: V.card, borderRadius: 8, boxShadow: V.cardShadow, border: `2px solid ${V.border}` }}>
        <Logo />
        <div style={{ marginTop: 28, marginBottom: 6, fontSize: 13, color: V.muted, fontFamily: V.fontDisplay, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Admin Password</div>
        <input
          type="password" value={pw} onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          placeholder="Enter password…"
          style={{ width: "100%", padding: "10px 14px", border: `2px solid ${V.border}`, borderRadius: 8, fontSize: 14, fontFamily: V.fontBody, background: V.inputBg, boxSizing: "border-box" }}
        />
        {pwError && <div style={{ color: V.clay, fontSize: 12, marginTop: 6 }}>{pwError}</div>}
        <Button onClick={handleLogin} disabled={loginLoading} style={{ marginTop: 14, width: "100%" }}>
          {loginLoading ? "Checking…" : "Sign In"}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ margin: "24px auto 40px", padding: "0 16px", maxWidth: adminTab === "review" ? 960 : 640 }}>
      <div
        role="tablist"
        aria-label="Admin tasks"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 0,
          marginBottom: 20,
          border: `2px solid ${V.border}`,
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: V.cardShadow,
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={adminTab === "upload"}
          onClick={() => setAdminTab("upload")}
          style={{
            flex: "1 1 140px",
            padding: "12px 16px",
            border: "none",
            cursor: "pointer",
            fontFamily: V.fontDisplay,
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.04em",
            background: adminTab === "upload" ? V.gold : V.card,
            color: adminTab === "upload" ? V.ink : V.muted,
          }}
        >
          Upload issue
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={adminTab === "review"}
          onClick={() => setAdminTab("review")}
          style={{
            flex: "1 1 140px",
            padding: "12px 16px",
            border: "none",
            borderLeft: `2px solid ${V.border}`,
            cursor: "pointer",
            fontFamily: V.fontDisplay,
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.04em",
            background: adminTab === "review" ? V.gold : V.card,
            color: adminTab === "review" ? V.ink : V.muted,
          }}
        >
          Review structure
        </button>
      </div>

      <div hidden={adminTab !== "upload"}>
        <div style={{ background: V.card, border: `2px solid ${V.border}`, borderRadius: 8, padding: 32, boxShadow: V.cardShadow }}>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: V.fontDisplay, color: V.ink, marginBottom: 4 }}>Upload New Newsletter</div>
          <div style={{ fontSize: 13, color: V.muted, marginBottom: 24 }}>
            Upload the MailerLite HTML export. Parse it first, fix structure on the Review tab if needed, then publish so everyone sees this edition. Until you publish, captains still load the current live issue.
          </div>

          {unpublishedDraft && (
            <div
              style={{
                marginBottom: 20,
                padding: "12px 16px",
                background: V.greenTint08,
                border: `2px solid ${V.border}`,
                borderLeft: `4px solid ${V.gold}`,
                borderRadius: 8,
                fontSize: 13,
                color: V.ink,
                fontFamily: V.fontBody,
              }}
            >
              <strong>Unpublished draft:</strong> {metadataText(unpublishedDraft.title) || "Untitled"} — {metadataText(unpublishedDraft.date) || "No date"}
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10 }}>
                <Button onClick={handlePublishForEveryone} disabled={publishLoading}>
                  {publishLoading ? "Publishing…" : "Publish for all visitors"}
                </Button>
                <Button variant="secondary" onClick={() => onDiscardDraft?.()} disabled={publishLoading}>
                  Discard draft
                </Button>
              </div>
            </div>
          )}

          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${file ? V.green : V.border}`, borderRadius: 8, padding: "32px 24px",
              textAlign: "center", cursor: "pointer", background: file ? V.greenTint08 : V.inputBg,
              transition: "all 0.2s", marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📰</div>
            {file
              ? <div style={{ fontWeight: 700, color: V.green, fontFamily: V.fontBody }}>{file.name}</div>
              : <div style={{ color: V.muted, fontSize: 14 }}>Click to select newsletter HTML (.html)</div>
            }
            <input ref={fileRef} type="file" accept=".html,.htm,text/html" style={{ display: "none" }} onChange={e => setFile(e.target.files[0])} />
          </div>

          <Button onClick={handleParseOnly} disabled={!file || loading || publishLoading} style={{ width: "100%" }}>
            {loading ? "Parsing…" : "Parse newsletter"}
          </Button>

          {status && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: status.startsWith("✓") ? V.greenTint15 : V.border, borderRadius: 8, fontSize: 13, color: status.startsWith("✓") ? V.green : status.startsWith("Error") ? V.clay : V.ink, fontFamily: V.fontBody }}>
              {status}
            </div>
          )}

          {publishedIssue && (
            <div style={{ marginTop: 24, padding: "12px 16px", background: V.border, borderRadius: 6, fontSize: 12, color: V.muted }}>
              <strong>Live issue (what captains see now):</strong> {metadataText(publishedIssue.title)} — {metadataText(publishedIssue.date)}<br />
              Published: {publishedIssue._uploadedAt ? new Date(publishedIssue._uploadedAt).toLocaleDateString() : "Unknown"}
            </div>
          )}
        </div>
      </div>

      <div hidden={adminTab !== "review"}>
        <AdminReviewStructure
          newsletterData={unpublishedDraft ?? publishedIssue}
          password={pw}
          onIssueUpdated={onAdminIssueUpdate}
          draftOnlyMode={Boolean(unpublishedDraft)}
          getSectionColor={getSectionColor}
          Button={Button}
          V={V}
          storageKey={STORAGE_KEY}
        />
      </div>
    </div>
  );
}

// ── Item Card (Captain Builder) ────────────────────────────────────────────────
function ItemCard({ item, selected, onToggle, sectionColor }) {
  return (
    <div
      onClick={(e) => {
        if (e.target.closest?.("a")) {
          e.preventDefault();
          return;
        }
        onToggle();
      }}
      style={{
        display: "flex", gap: 12, padding: "12px 14px",
        background: selected ? sectionColor + "0D" : V.inputBg,
        border: `2px solid ${selected ? `${sectionColor}99` : V.border}`,
        borderRadius: 8,
        boxShadow: selected ? "none" : V.cardShadow,
        cursor: "pointer",
        transition: "all 0.15s",
        marginBottom: 8,
        alignItems: "flex-start",
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2,
        border: `2px solid ${selected ? `${sectionColor}CC` : V.muted}`,
        background: selected ? sectionColor : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
      }}>
        {selected && <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>✓</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {item.date && (
          <div style={{ fontSize: 11, fontWeight: 700, color: sectionColor, marginBottom: 3, letterSpacing: "0.06em" }}>
            {item.date}{item.time ? ` @ ${item.time}` : ""}
          </div>
        )}
        {item.bodyHtml ? (
          <div
            className="nl-item-body"
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              fontFamily: V.fontBody,
              color: V.ink,
              maxHeight: 220,
              overflow: "auto",
              ["--nl-accent"]: sectionColor,
            }}
            dangerouslySetInnerHTML={{ __html: repairLegacyAmpDoubling(item.bodyHtml) }}
          />
        ) : (
          <>
            <div style={{ fontSize: 13, color: V.ink, lineHeight: 1.5, fontFamily: V.fontBody }}>
              {item.text}
            </div>
            {item.links?.length > 0 && (
              <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {item.links.map((l, i) => (
                  <span key={i} style={{ fontSize: 10, color: sectionColor, fontWeight: 600, background: sectionColor + "15", padding: "1px 6px", borderRadius: 3 }}>
                    🔗 {l.label}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
        {item.location && (
          <div style={{ fontSize: 11, color: V.muted, marginTop: 3 }}>📍 {item.location}</div>
        )}
      </div>
    </div>
  );
}

// ── Custom Entry Editor ────────────────────────────────────────────────────────
function CustomEntryEditor({ entries, onChange }) {
  function add() {
    onChange([...entries, { id: `custom_${Date.now()}`, heading: "", text: "", type: "custom" }]);
  }
  function update(id, field, val) {
    onChange(entries.map(e => e.id === id ? { ...e, [field]: val } : e));
  }
  function remove(id) {
    onChange(entries.filter(e => e.id !== id));
  }

  return (
    <div>
      {entries.map(e => (
        <div key={e.id} style={{ marginBottom: 12, background: V.inputBg, border: `2px solid ${V.border}`, borderRadius: 8, boxShadow: V.cardShadow, padding: 14 }}>
          <input
            value={e.heading} onChange={ev => update(e.id, "heading", ev.target.value)}
            placeholder="Optional title for this update (one line)"
            style={{ width: "100%", padding: "8px 12px", border: `2px solid ${V.border}`, borderRadius: 8, fontSize: 13, fontFamily: V.fontBody, marginBottom: 8, boxSizing: "border-box", background: V.card }}
          />
          <textarea
            value={e.text} onChange={ev => update(e.id, "text", ev.target.value)}
            placeholder="Write your zone-specific update here…"
            rows={4}
            style={{ width: "100%", padding: "8px 12px", border: `2px solid ${V.border}`, borderRadius: 8, fontSize: 13, fontFamily: V.fontBody, resize: "vertical", boxSizing: "border-box", background: V.card, lineHeight: 1.6 }}
          />
          <div style={{ marginTop: 5, fontSize: 11, color: V.muted, lineHeight: 1.45 }}>
            <strong>To add a link:</strong> put the clickable words in brackets and the web address in parentheses.
            <br />
            Example: <code>[Register here](altagether.org)</code>
          </div>
          <div style={{ textAlign: "right", marginTop: 6 }}>
            <Button variant="danger" onClick={() => remove(e.id)} style={{ padding: "5px 12px", fontSize: 11 }}>Remove</Button>
          </div>
        </div>
      ))}
      <Button variant="ghost" onClick={add} style={{ width: "100%", padding: "9px", fontSize: 12 }}>
        + Add Zone Update
      </Button>
    </div>
  );
}

function StylePresetChooser({ value, onChange }) {
  return (
    <div className="nl-style-grid">
      {Object.values(NEWSLETTER_STYLE_PRESETS).map((preset) => {
        const selected = value === preset.id;
        const clean = preset.id === "clean";
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            aria-pressed={selected}
            style={{
              textAlign: "left",
              padding: 0,
              overflow: "hidden",
              background: selected ? V.greenTint08 : V.card,
              border: `2px solid ${selected ? V.green : V.border}`,
              borderRadius: 8,
              boxShadow: selected ? "none" : V.cardShadow,
              cursor: "pointer",
              color: V.ink,
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderTop: clean ? "none" : `6px solid ${V.navy}`,
                borderBottom: `1px solid ${V.border}`,
                background: clean ? "#f9fafb" : V.card,
                color: clean ? V.navy : V.ink,
                fontFamily: clean ? V.fontDisplay : preset.bodyFont,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: clean ? "0.01em" : "0.03em" }}>
                {clean ? "Modern" : "Newsprint"}
              </div>
              <div style={{ marginTop: 4, fontSize: 11, opacity: clean ? 0.78 : 0.86 }}>
                {clean ? "Sans serif" : "Serif"}
              </div>
            </div>
            <div style={{ padding: 16, fontFamily: preset.bodyFont }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontFamily: preset.bodyFont, fontSize: 13, fontWeight: 800, color: selected ? V.green : V.ink }}>
                  {preset.label}
                </div>
                {selected ? (
                  <span style={{ fontFamily: V.fontDisplay, fontSize: 10, fontWeight: 800, color: V.green, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Selected
                  </span>
                ) : null}
              </div>
              <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: V.muted }}>
                {preset.description}
              </div>
              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    height: 6,
                    width: "52%",
                    background: clean ? V.gold : V.clay,
                    borderRadius: 999,
                    marginBottom: 8,
                    opacity: 0.7,
                  }}
                />
                <div style={{ height: 5, width: "84%", background: V.border, borderRadius: 999, marginBottom: 5 }} />
                <div style={{ height: 5, width: "68%", background: V.border, borderRadius: 999 }} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function BuilderStatus({ config, preset, visibleSelectedCount, customEntryCount, draftNotice }) {
  const title = (config.name || config.zone || "Your neighborhood newsletter").trim();
  const totalSelected = visibleSelectedCount + customEntryCount;
  return (
    <div className="nl-builder-status">
      <div>
        <div style={{ fontFamily: V.fontDisplay, fontWeight: 800, fontSize: 14, color: V.ink }}>
          {title}
        </div>
        <div style={{ marginTop: 2, color: V.muted, fontSize: 12 }}>
          {visibleSelectedCount} newsletter {visibleSelectedCount === 1 ? "item" : "items"} selected · {customEntryCount} zone {customEntryCount === 1 ? "update" : "updates"} · {preset.shortLabel} style
        </div>
      </div>
      <div style={{ color: draftNotice ? V.green : V.muted, fontSize: 12, lineHeight: 1.45 }}>
        {draftNotice || (totalSelected > 0 ? "Saved in this browser." : "Autosaves in this browser.")}
      </div>
    </div>
  );
}

// ── Preview / Print output ─────────────────────────────────────────────────────
function NewsletterPreview({ config, newsletterData, selectedIds, customEntries }) {
  const { name, tagline, issueDate, zone, zoneLinks, captains } = config;
  const date = (issueDate || "").trim();
  const captainLines = captainsWithContent(captains);
  const zl = (zoneLinks || "").trim();
  const hasLinksStrip = Boolean(zl);
  const preset = getNewsletterStylePreset(config.stylePreset);
  const clean = preset.id === "clean";
  const headerText = clean ? V.navy : V.ink;
  const headerTitleFont = clean ? V.fontDisplay : preset.bodyFont;
  const sectionHeadingStyle = (color) => clean
    ? {
        fontSize: 14,
        fontWeight: 900,
        fontFamily: V.fontDisplay,
        color: V.ink,
        borderLeft: `4px solid ${color}`,
        background: "#f9fafb",
        padding: "8px 10px",
        marginBottom: 12,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
      }
    : {
        fontSize: 15,
        fontWeight: 800,
        fontFamily: V.fontDisplay,
        color,
        borderBottom: `2px solid ${color}`,
        paddingBottom: 6,
        marginBottom: 14,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      };
  const itemShellStyle = (color) => clean
    ? {
        marginBottom: 12,
        padding: "12px 14px",
        border: `1px solid ${V.border}`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 6,
        background: V.card,
      }
    : {
        marginBottom: 14,
        paddingLeft: 12,
        borderLeft: `3px solid ${color}30`,
      };

  const selectedBySection = buildSelectedBySection(newsletterData, selectedIds);

  return (
    <div style={{ fontFamily: preset.bodyFont, color: V.ink, background: V.card, maxWidth: 720, margin: "0 auto" }}>
      <div
        className="nl-print-header"
        style={{
          background: V.card,
          padding: "24px 32px",
          color: headerText,
          borderTop: clean ? "none" : `6px solid ${V.navy}`,
          borderBottom: clean ? `4px solid ${V.gold}` : `3px solid ${V.navy}`,
        }}
      >
        <div className="nl-print-header-title" style={{ fontSize: 28, fontWeight: 900, letterSpacing: "0.02em", fontFamily: headerTitleFont }}>{name || "Zone Newsletter"}</div>
        {tagline && (
          <div className="nl-print-header-tagline" style={{ fontSize: 14, opacity: clean ? 0.82 : 0.92, marginTop: 4 }}>
            {tagline}
          </div>
        )}
        {(date || zone) ? (
          <div className="nl-print-header-meta" style={{ fontSize: 12, opacity: clean ? 0.78 : 0.88, marginTop: 8 }}>
            {[date, zone].filter(Boolean).join(" • ")}
          </div>
        ) : null}
        {captainLines.length > 0 ? (
          <div
            className="nl-print-header-captains"
            style={{ marginTop: 10, fontSize: 12.5, opacity: clean ? 0.86 : 0.92, lineHeight: 1.5, fontFamily: preset.bodyFont }}
          >
            {captainLines.map((c, i) => (
              <div key={c.id || i}>{formatCaptainLine(c)}</div>
            ))}
          </div>
        ) : null}
        <div
          className="nl-print-header-curated nl-print-header-rule"
          style={{
            marginTop: 12,
            fontSize: 12,
            opacity: clean ? 0.76 : 0.88,
            borderTop: clean ? `1px solid ${V.border}` : `1px solid ${V.border}`,
            paddingTop: 10,
          }}
        >
          Curated from the{" "}
          <a href={FULL_NEWSLETTER_URL} target="_blank" rel="noopener noreferrer" style={{ color: headerText, textDecoration: "underline", fontWeight: 700 }}>
            Altagether Neighborhood Captain Newsletter
          </a>
        </div>
      </div>

      {hasLinksStrip ? (
        <div
          className="nl-print-contact"
          style={{
            padding: "18px 32px",
            background: V.inputBg,
            borderBottom: `1px solid ${V.border}`,
            fontFamily: preset.bodyFont,
            fontSize: 13,
            lineHeight: 1.55,
            color: V.ink,
          }}
        >
          <AutoLinkedText text={zl} color={V.green} />
        </div>
      ) : null}

      <div style={{ padding: "0 32px 32px" }}>
        {/* Zone updates: one section title, entries styled like newsletter item cards */}
        {customEntries.filter((e) => e.text).length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={sectionHeadingStyle(CLAY_HEX)}>
              {zoneUpdatesSectionTitle(zone, name)}
            </div>
            {customEntries.filter((e) => e.text).map((e) => (
              <div
                key={e.id}
                style={itemShellStyle(CLAY_HEX)}
              >
                {e.heading ? (
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: preset.bodyFont, color: V.ink, marginBottom: 6 }}>{e.heading}</div>
                ) : null}
                <div style={{ fontSize: 13, lineHeight: clean ? 1.5 : 1.6, whiteSpace: "pre-wrap", color: V.ink, fontFamily: preset.bodyFont }}>
                  <CustomUpdateText text={e.text} color={CLAY_HEX} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected items from newsletter */}
        {selectedBySection.map(sec => (
          <div key={sec.id} style={{ marginTop: 28 }}>
            <div style={sectionHeadingStyle(getSectionColor(sec.heading))}>
              {sec.heading}
            </div>
            {sec.items.map(item => (
              <div key={item.id} style={itemShellStyle(getSectionColor(sec.heading))}>
                {item.date && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: getSectionColor(sec.heading), marginBottom: 2, letterSpacing: "0.06em" }}>
                    {item.date}{item.time ? ` @ ${item.time}` : ""}{item.location ? ` • ${item.location}` : ""}
                  </div>
                )}
                <NewsletterItemBody
                  item={item}
                  sectionColor={getSectionColor(sec.heading)}
                  appendixLinks={!item.bodyHtml}
                  bodyFont={preset.bodyFont}
                  lineHeight={clean ? 1.45 : 1.55}
                />
              </div>
            ))}
          </div>
        ))}

        {selectedBySection.length === 0 && customEntries.filter(e => e.text).length === 0 && (
          <div style={{ marginTop: 40, textAlign: "center", color: V.muted, fontSize: 14 }}>
            No content selected yet.
          </div>
        )}

        <div style={{ marginTop: 36, paddingTop: 16, borderTop: `1px solid ${V.border}`, fontSize: 11, color: V.muted, textAlign: "center" }}>
          Altagether • altagether.org • newsletter@altagether.org
        </div>
      </div>
    </div>
  );
}

// ── Captain Builder View ───────────────────────────────────────────────────────
function CaptainView({ newsletterData, currentIssueLoading = false }) {
  const [step, setStep] = useState(0); // 0=config, 1=select, 2=preview
  const [config, setConfig] = useState(DEFAULT_CAPTAIN_CONFIG);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [customEntries, setCustomEntries] = useState([]);
  const [activeSection, setActiveSection] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [localDraftLoaded, setLocalDraftLoaded] = useState(false);
  const [selectedIssueKeyLoaded, setSelectedIssueKeyLoaded] = useState("");
  const [draftNotice, setDraftNotice] = useState("");
  const printRef = useRef();

  useEffect(() => {
    let restored = false;
    try {
      const savedConfig = localStorage.getItem(CAPTAIN_CONFIG_STORAGE_KEY);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed && typeof parsed === "object") {
          setConfig({
            ...DEFAULT_CAPTAIN_CONFIG,
            ...parsed,
            captains: Array.isArray(parsed.captains) && parsed.captains.length
              ? parsed.captains
              : DEFAULT_CAPTAIN_CONFIG.captains,
            stylePreset: getNewsletterStylePreset(parsed.stylePreset).id,
          });
          restored = true;
        }
      }
      const savedEntries = localStorage.getItem(CUSTOM_ENTRIES_STORAGE_KEY);
      if (savedEntries) {
        const parsed = JSON.parse(savedEntries);
        if (Array.isArray(parsed)) {
          setCustomEntries(parsed);
          if (parsed.length) restored = true;
        }
      }
      const savedBuilderState = localStorage.getItem(BUILDER_STATE_STORAGE_KEY);
      if (savedBuilderState) {
        const parsed = JSON.parse(savedBuilderState);
        if (parsed && typeof parsed === "object") {
          if ([0, 1, 2].includes(parsed.step)) setStep(parsed.step);
          if (typeof parsed.activeSection === "string") setActiveSection(parsed.activeSection);
          restored = true;
        }
      }
    } catch (_) {
      // Local drafts are convenience-only; ignore corrupt or unavailable storage.
    } finally {
      if (restored) setDraftNotice("Your draft was restored on this device.");
      setLocalDraftLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!localDraftLoaded) return;
    try {
      localStorage.setItem(CAPTAIN_CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (_) {}
  }, [config, localDraftLoaded]);

  useEffect(() => {
    if (!localDraftLoaded) return;
    try {
      localStorage.setItem(CUSTOM_ENTRIES_STORAGE_KEY, JSON.stringify(customEntries));
    } catch (_) {}
  }, [customEntries, localDraftLoaded]);

  useEffect(() => {
    if (!localDraftLoaded || !newsletterData) return;
    if (selectedIssueKeyLoaded !== issueDraftStorageSuffix(newsletterData)) return;
    try {
      localStorage.setItem(selectedIdsStorageKey(newsletterData), JSON.stringify([...selectedIds]));
    } catch (_) {}
  }, [selectedIds, localDraftLoaded, newsletterData, selectedIssueKeyLoaded]);

  useEffect(() => {
    if (!localDraftLoaded) return;
    try {
      localStorage.setItem(BUILDER_STATE_STORAGE_KEY, JSON.stringify({ step, activeSection }));
    } catch (_) {}
  }, [step, activeSection, localDraftLoaded]);

  useEffect(() => {
    if (!draftNotice) return undefined;
    const t = setTimeout(() => setDraftNotice(""), 6500);
    return () => clearTimeout(t);
  }, [draftNotice]);

  useEffect(() => {
    if (newsletterData?.sections?.length > 0) {
      setActiveSection((prev) => {
        if (prev === "custom" || newsletterData.sections.some((s) => s.id === prev)) return prev;
        return newsletterData.sections[0].id;
      });
    }
  }, [newsletterData]);

  useEffect(() => {
    if (!localDraftLoaded || !newsletterData) return;
    const issueKey = issueDraftStorageSuffix(newsletterData);
    try {
      const savedSelectedIds = localStorage.getItem(selectedIdsStorageKey(newsletterData));
      if (!savedSelectedIds) {
        setSelectedIds(new Set());
        setSelectedIssueKeyLoaded(issueKey);
        return;
      }
      const parsed = JSON.parse(savedSelectedIds);
      if (Array.isArray(parsed)) {
        const next = new Set(parsed.filter((id) => typeof id === "string"));
        setSelectedIds(next);
        setSelectedIssueKeyLoaded(issueKey);
        if (next.size) setDraftNotice("Your draft was restored on this device.");
      } else {
        setSelectedIds(new Set());
        setSelectedIssueKeyLoaded(issueKey);
      }
    } catch (_) {
      setSelectedIds(new Set());
      setSelectedIssueKeyLoaded(issueKey);
    }
  }, [newsletterData, localDraftLoaded]);

  function toggleItem(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSection(sec) {
    const ids = captainVisibleItems(sec.items).map((i) => i.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) ids.forEach(id => next.delete(id));
      else ids.forEach(id => next.add(id));
      return next;
    });
  }

  function handlePrint() {
    window.print();
  }

  async function handleCopyForEmail() {
    const selectedBySection = buildSelectedBySection(newsletterData, selectedIds);
    const customWithText = customEntries.filter((e) => e.text);
    const preset = getNewsletterStylePreset(config.stylePreset);
    const clean = preset.id === "clean";
    const emailSectionHeadingStyle = (color) => clean
      ? `margin:18px 0 10px;font-size:16px;font-weight:800;letter-spacing:0.03em;text-transform:uppercase;color:#1f2937;border-left:4px solid ${escapeHtmlPlain(color)};background:#f9fafb;padding:8px 10px;line-height:1.25;`
      : `margin:18px 0 8px;font-size:17px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;color:${escapeHtmlPlain(color)};border-bottom:2px solid ${escapeHtmlPlain(color)};padding-bottom:5px;line-height:1.25;`;
    const emailItemStyle = (color) => clean
      ? `margin-bottom:12px;padding:10px 12px;border:1px solid #e5e7eb;border-left:4px solid ${escapeHtmlPlain(color)};border-radius:6px;`
      : `margin-bottom:12px;padding-left:10px;border-left:3px solid rgba(0,0,0,0.08);`;
    const plainParts = [];
    const htmlParts = [];
    plainParts.push(config.name || "Zone Newsletter");
    if (config.tagline) plainParts.push(config.tagline);
    if ((config.issueDate || "").trim()) plainParts.push(config.issueDate.trim());
    if (config.zone) plainParts.push(config.zone);
    for (const c of captainsWithContent(config.captains)) {
      plainParts.push(formatCaptainLine(c));
    }
    const zlPlain = (config.zoneLinks || "").trim();
    if (zlPlain) plainParts.push(zlPlain);
    plainParts.push("");

    htmlParts.push(`<div style="font-family:${preset.emailFontFamily};font-size:14px;line-height:${clean ? "1.5" : "1.55"};color:#1f2937;">`);
    htmlParts.push(
      `<div style="border-top:4px solid ${clean ? "#f59e0b" : "#314059"};border-bottom:1px solid #d1d5db;padding:12px 0 10px;margin:0 0 14px;">`,
    );
    htmlParts.push(
      `<p style="margin:0 0 6px;"><strong style="font-size:28px;line-height:1.15;">${escapeHtmlPlain(config.name || "Zone Newsletter")}</strong></p>`,
    );
    if (config.tagline) {
      htmlParts.push(`<p style="margin:0 0 10px;color:#374151;">${escapeHtmlPlain(config.tagline)}</p>`);
    }
    const metaBits = [];
    if ((config.issueDate || "").trim()) metaBits.push(escapeHtmlPlain(config.issueDate.trim()));
    if (config.zone) metaBits.push(escapeHtmlPlain(config.zone));
    if (metaBits.length) {
      htmlParts.push(`<p style="margin:0 0 10px;color:#374151;font-size:13px;">${metaBits.join(" • ")}</p>`);
    }
    for (const c of captainsWithContent(config.captains)) {
      htmlParts.push(
        `<p style="margin:0 0 4px;font-size:13px;line-height:1.55;color:#1f2937;">${escapeHtmlPlain(formatCaptainLine(c))}</p>`,
      );
    }
    htmlParts.push(
      `<p style="margin:0 0 14px;padding-top:8px;border-top:1px solid #e5e7eb;color:#4b5563;font-size:12px;line-height:1.45;">Curated from the <a href="${FULL_NEWSLETTER_URL}" style="color:#4b5563;text-decoration:underline;">Altagether Neighborhood Captain Newsletter</a></p>`,
    );
    htmlParts.push("</div>");
    const zl = zlPlain;
    if (zl) {
      htmlParts.push(`<p style="margin:0 0 14px;font-size:13px;line-height:1.55;color:#1f2937;">${autoLinkTextToHtml(zl)}</p>`);
    }
    htmlParts.push(`<hr style="border:none;border-top:${clean ? "2px solid #f59e0b" : "1px solid #ddd"};margin:12px 0;" />`);

    if (customWithText.length > 0) {
      const zuTitle = zoneUpdatesSectionTitle(config.zone, config.name);
      plainParts.push(zuTitle.toUpperCase());
      plainParts.push("");
      customWithText.forEach((e) => {
        if (e.heading) plainParts.push(e.heading);
        plainParts.push(customUpdateTextToPlain(e.text));
        plainParts.push("");
      });
      htmlParts.push(`<h3 style="${emailSectionHeadingStyle(CLAY_HEX)}">${escapeHtmlPlain(zuTitle)}</h3>`);
      customWithText.forEach((e) => {
        htmlParts.push(
          `<div style="${emailItemStyle(CLAY_HEX)}">`,
        );
        if (e.heading) {
          htmlParts.push(`<p style="font-weight:700;margin:0 0 6px;font-size:14px;color:#1f2937;">${escapeHtmlPlain(e.heading)}</p>`);
        }
        htmlParts.push(`<p style="white-space:pre-wrap;margin:0;font-size:14px;line-height:${clean ? "1.6" : "1.75"};color:#1f2937;">${customUpdateTextToHtml(e.text)}</p>`);
        htmlParts.push("</div>");
      });
    }

    for (const sec of selectedBySection) {
      const col = getSectionColor(sec.heading);
      plainParts.push(sec.heading.toUpperCase());
      plainParts.push("");
      htmlParts.push(`<h3 style="${emailSectionHeadingStyle(col)}">${escapeHtmlPlain(sec.heading)}</h3>`);
      for (const item of sec.items) {
        plainParts.push(itemToPlainText(item));
        plainParts.push("");
        htmlParts.push(`<div style="${emailItemStyle(col)}">`);
        if (item.bodyHtml) {
          htmlParts.push(augmentEmailItemBodyHtml(repairLegacyAmpDoubling(item.bodyHtml)));
        } else {
          htmlParts.push(`<p style="margin:0.25em 0;">${escapeHtmlPlain(item.text || "")}</p>`);
          if (item.links?.length) {
            for (const l of item.links) {
              if (l.url) {
                htmlParts.push(
                  `<p style="font-size:12px;margin:4px 0;"><a href="${escapeHtmlPlain(l.url)}">${escapeHtmlPlain(l.label)}</a></p>`,
                );
              }
            }
          }
        }
        htmlParts.push("</div>");
      }
    }

    htmlParts.push(
      "<p style=\"font-size:11px;color:#888;margin-top:20px;\">Altagether • altagether.org • newsletter@altagether.org</p>",
    );
    htmlParts.push("</div>");

    const plain = plainParts.join("\n");
    const html = `<!DOCTYPE html><html><body>${htmlParts.join("\n")}</body></html>`;

    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
      setCopyStatus("Copied. Paste into Gmail or Outlook; use Ctrl+Shift+V for plain text only if needed.");
      setTimeout(() => setCopyStatus(""), 5000);
    } catch (err) {
      setCopyStatus(`Copy failed: ${err.message}`);
      setTimeout(() => setCopyStatus(""), 6000);
    }
  }

  function updateConfig(field, val) {
    setConfig(prev => ({ ...prev, [field]: val }));
  }

  function setCaptainField(id, field, val) {
    setConfig((prev) => ({
      ...prev,
      captains: prev.captains.map((c) => (c.id === id ? { ...c, [field]: val } : c)),
    }));
  }

  function addCaptain() {
    setConfig((prev) => ({
      ...prev,
      captains: [...prev.captains, { id: `c_${Date.now()}`, name: "", contact: "" }],
    }));
  }

  function removeCaptain(id) {
    setConfig((prev) => ({
      ...prev,
      captains: prev.captains.length <= 1 ? prev.captains : prev.captains.filter((c) => c.id !== id),
    }));
  }

  const visibleSelectedCount = countCaptainVisibleSelected(newsletterData, selectedIds);
  const customEntryCount = customEntries.filter(e => e.text).length;
  const totalSelected = visibleSelectedCount + customEntryCount;
  const currentPreset = getNewsletterStylePreset(config.stylePreset);

  if (!newsletterData && currentIssueLoading) {
    return (
      <div style={{ maxWidth: 500, margin: "80px auto", padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: V.fontDisplay, color: V.ink, marginBottom: 8 }}>Loading newsletter...</div>
        <div style={{ fontSize: 14, color: V.muted }}>
          We're getting the latest Altagether newsletter ready. This can take a few seconds.
        </div>
      </div>
    );
  }

  if (!newsletterData) {
    return (
      <div style={{ maxWidth: 500, margin: "80px auto", padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: V.fontDisplay, color: V.ink, marginBottom: 8 }}>No Newsletter Yet</div>
        <div style={{ fontSize: 14, color: V.muted }}>
          The admin team hasn't published a newsletter issue yet. Check back soon, or contact newsletter@altagether.org.
        </div>
      </div>
    );
  }

  const sections = newsletterData.sections || [];
  const activeSectionIndex = sections.findIndex((s) => s.id === activeSection);
  const activeIsNewsletterSection = activeSectionIndex >= 0;
  const hasNextNewsletterSection = activeIsNewsletterSection && activeSectionIndex < sections.length - 1;
  const sectionProgressLabel = activeIsNewsletterSection
    ? `Section ${activeSectionIndex + 1} of ${sections.length}`
    : "Zone updates";
  const goToNextNewsletterSection = () => {
    if (hasNextNewsletterSection) setActiveSection(sections[activeSectionIndex + 1].id);
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <BuilderStatus
        config={config}
        preset={currentPreset}
        visibleSelectedCount={visibleSelectedCount}
        customEntryCount={customEntryCount}
        draftNotice={draftNotice}
      />

      {/* Steps */}
      <div className="nl-step-tabs" role="tablist" aria-label="Newsletter builder steps" style={{ display: "flex", gap: 0, marginBottom: 18, borderBottom: `1px solid ${V.border}` }}>
        {["Configure", "Select Content", "Preview & Publish"].map((label, i) => (
          <button
            type="button"
            role="tab"
            aria-selected={i === step}
            key={i}
            onClick={() => setStep(i)}
            style={{
              padding: "10px 20px", fontSize: 13, fontWeight: i === step ? 900 : 500,
              color: i === step ? V.ink : V.muted, borderBottom: i === step ? `4px solid ${V.gold}` : "4px solid transparent",
              cursor: "pointer", fontFamily: V.fontDisplay, letterSpacing: "0.03em",
              marginBottom: -2, transition: "all 0.15s",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              background: i === step ? "rgba(245, 158, 11, 0.08)" : "transparent",
            }}
          >
            <span style={{ opacity: 0.5, marginRight: 6 }}>{i + 1}.</span>{label}
            {i === 1 && totalSelected > 0 && (
              <span style={{ marginLeft: 8, background: V.green, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 800 }}>{totalSelected}</span>
            )}
          </button>
        ))}
      </div>

      {/* Step 0: Configure */}
      {step === 0 && (
        <>
          <div className="nl-step-header">
            <div className="nl-step-kicker">Step 1 of 3</div>
            <h2 className="nl-step-title">Set up your newsletter</h2>
            <p className="nl-step-copy">
              Add the title, date, and contact details that should appear at the top of your neighborhood version.
            </p>
          </div>

          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            {[
              { field: "name", label: "Newsletter Name", placeholder: "e.g. Zone 4 Neighbor Update" },
              { field: "tagline", label: "Tagline (optional)", placeholder: "e.g. News for Loma Alta neighbors" },
              { field: "issueDate", label: "Newsletter Date (optional)", placeholder: "e.g. Wednesday, May 6, 2026" },
              { field: "zone", label: "Zone / Neighborhood", placeholder: "e.g. Zone 4 — Loma Alta" },
            ].map(({ field, label, placeholder }) => (
              <div key={field} style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, fontFamily: V.fontDisplay, color: V.ink, marginBottom: 5, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</label>
                <input
                  value={config[field]} onChange={e => updateConfig(field, e.target.value)}
                  placeholder={placeholder}
                  style={{ width: "100%", padding: "10px 14px", border: `2px solid ${V.border}`, borderRadius: 8, fontSize: 14, fontFamily: V.fontBody, background: V.inputBg, boxSizing: "border-box" }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: V.fontDisplay, color: V.ink, marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Captains (optional)
              </div>
              {config.captains.map((c, idx) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    alignItems: "flex-end",
                    marginBottom: 10,
                    paddingBottom: 10,
                    borderBottom: idx < config.captains.length - 1 ? `1px solid ${V.border}` : "none",
                  }}
                >
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, fontFamily: V.fontDisplay, color: V.muted, marginBottom: 4, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      Captain
                    </label>
                    <input
                      value={c.name}
                      onChange={(e) => setCaptainField(c.id, "name", e.target.value)}
                      placeholder="Name"
                      style={{ width: "100%", padding: "10px 14px", border: `2px solid ${V.border}`, borderRadius: 8, fontSize: 14, fontFamily: V.fontBody, background: V.inputBg, boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, fontFamily: V.fontDisplay, color: V.muted, marginBottom: 4, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      How to contact
                    </label>
                    <input
                      value={c.contact}
                      onChange={(e) => setCaptainField(c.id, "contact", e.target.value)}
                      placeholder="Phone, email, etc."
                      style={{ width: "100%", padding: "10px 14px", border: `2px solid ${V.border}`, borderRadius: 8, fontSize: 14, fontFamily: V.fontBody, background: V.inputBg, boxSizing: "border-box" }}
                    />
                  </div>
                  {config.captains.length > 1 ? (
                    <Button variant="danger" type="button" onClick={() => removeCaptain(c.id)} style={{ fontSize: 11, padding: "8px 12px", flex: "0 0 auto" }}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button variant="ghost" type="button" onClick={addCaptain} style={{ width: "100%", padding: "9px", fontSize: 12 }}>
                + Add a captain
              </Button>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, fontFamily: V.fontDisplay, color: V.ink, marginBottom: 5, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Website, Facebook, WhatsApp, etc. (optional)
              </label>
              <input
                value={config.zoneLinks}
                onChange={(e) => updateConfig("zoneLinks", e.target.value)}
                placeholder="e.g. Zone website, Facebook group, WhatsApp channel — if any"
                style={{ width: "100%", padding: "10px 14px", border: `2px solid ${V.border}`, borderRadius: 8, fontSize: 14, fontFamily: V.fontBody, background: V.inputBg, boxSizing: "border-box" }}
              />
            </div>

            <Button onClick={() => setStep(1)} style={{ width: "100%" }}>
              Next: Select Content →
            </Button>
          </div>
        </>
      )}

      {/* Step 1: Select */}
      {step === 1 && (
        <>
          <div className="nl-step-header">
            <div className="nl-step-kicker">Step 2 of 3</div>
            <h2 className="nl-step-title">Choose updates for your neighborhood</h2>
            <p className="nl-step-copy">
              Click any card to include it. Use the section list to move through the newsletter, then add your own zone updates if needed.
            </p>
          </div>
          <div className="nl-captain-grid">
            {/* Section nav */}
            <div className="nl-section-rail" style={{ background: V.card, border: `2px solid ${V.border}`, borderRadius: 8, boxShadow: V.cardShadow, overflow: "hidden", alignSelf: "start", position: "sticky", top: 20 }}>
              <div style={{ padding: "12px 16px", background: V.border, fontSize: 11, fontWeight: 800, fontFamily: V.fontDisplay, color: V.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>Sections</div>
              {sections.map(sec => {
                const color = getSectionColor(sec.heading);
                const count = captainVisibleItems(sec.items).filter((i) => selectedIds.has(i.id)).length;
                return (
                  <button
                    type="button"
                    key={sec.id}
                    onClick={() => setActiveSection(sec.id)}
                    style={{
                      padding: "10px 16px", cursor: "pointer", fontSize: 12, fontFamily: V.fontDisplay,
                      background: activeSection === sec.id ? color + "15" : "transparent",
                      borderLeft: `3px solid ${activeSection === sec.id ? color : "transparent"}`,
                      transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between",
                      color: activeSection === sec.id ? color : V.ink,
                      width: "100%",
                      borderTop: "none",
                      borderRight: "none",
                      borderBottom: "none",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontWeight: activeSection === sec.id ? 700 : 400 }}>{sec.heading}</span>
                    {count > 0 && (
                      <span style={{ background: color, color: "#fff", borderRadius: 8, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>{count}</span>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setActiveSection("custom")}
                style={{
                  padding: "10px 16px", cursor: "pointer", fontSize: 12, fontFamily: V.fontDisplay,
                  background: activeSection === "custom" ? V.clayTint : "transparent",
                  borderLeft: `3px solid ${activeSection === "custom" ? V.clay : "transparent"}`,
                  color: activeSection === "custom" ? V.clay : V.ink, fontWeight: activeSection === "custom" ? 700 : 400,
                  borderTop: `1px solid ${V.border}`, marginTop: 4,
                  borderRight: "none",
                  borderBottom: "none",
                  width: "100%",
                  textAlign: "left",
                }}
              >
                + Zone Updates
              </button>
            </div>

            {/* Items panel */}
            <div>
              <div style={{ fontSize: 13, color: V.muted, marginBottom: 16, lineHeight: 1.55 }}>
                <strong style={{ color: V.ink }}>{sectionProgressLabel}.</strong>{" "}
                Pick the items your neighbors need most.
              </div>
              {activeSection === "custom" ? (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, fontFamily: V.fontDisplay, color: V.clay, marginBottom: 4 }}>Zone updates</div>
                  <div style={{ fontSize: 13, color: V.muted, marginBottom: 16 }}>Add local announcements or reminders. These will appear first in your finished newsletter.</div>
                  <CustomEntryEditor entries={customEntries} onChange={setCustomEntries} />
                </div>
              ) : (() => {
                const sec = sections.find(s => s.id === activeSection);
                if (!sec) return null;
                const color = getSectionColor(sec.heading);
                const vis = captainVisibleItems(sec.items);
                const allSelected = vis.length > 0 && vis.every((i) => selectedIds.has(i.id));
                return (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 800, fontFamily: V.fontDisplay, color }}>{sec.heading}</div>
                        <div style={{ fontSize: 12, color: V.muted }}>{vis.length} items • {vis.filter((i) => selectedIds.has(i.id)).length} selected</div>
                      </div>
                      <Button variant="ghost" onClick={() => toggleSection(sec)} style={{ fontSize: 11, padding: "6px 14px", borderColor: color, color }}>
                        {allSelected ? "Deselect All" : "Select All"}
                      </Button>
                    </div>
                    {vis.map(item => (
                      <ItemCard key={item.id} item={item} selected={selectedIds.has(item.id)} onToggle={() => toggleItem(item.id)} sectionColor={color} />
                    ))}
                  </div>
                );
              })()}

              <div className="nl-step-toolbar" style={{ justifyContent: "flex-end", marginTop: 24, paddingTop: 16, borderTop: `1px solid ${V.border}` }}>
                <Button variant="secondary" onClick={() => setStep(0)}>← Back</Button>
                {hasNextNewsletterSection ? (
                  <Button onClick={goToNextNewsletterSection}>Next Section ({activeSectionIndex + 2} of {sections.length}) →</Button>
                ) : (
                  <Button onClick={() => setStep(2)}>Preview & Publish →</Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <div>
          <div className="nl-step-header" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div>
              <div className="nl-step-kicker">Step 3 of 3</div>
              <h2 className="nl-step-title">Preview and share</h2>
              <p className="nl-step-copy">
                Review your newsletter, choose a style, then copy it into email or save it as a PDF.
              </p>
              <div style={{ marginTop: 8, color: V.muted, fontSize: 12 }}>
                {visibleSelectedCount} newsletter {visibleSelectedCount === 1 ? "item" : "items"} selected · {customEntryCount} zone {customEntryCount === 1 ? "update" : "updates"} added
              </div>
            </div>
            <div className="nl-step-toolbar" style={{ justifyContent: "flex-end", marginLeft: "auto" }}>
              <Button variant="secondary" onClick={() => setStep(1)}>← Edit</Button>
              <Button onClick={handleCopyForEmail}>Copy for email</Button>
              <Button variant="secondary" onClick={handlePrint}>Print / Save PDF</Button>
            </div>
            {copyStatus && (
              <div style={{ flexBasis: "100%", fontSize: 12, color: V.green, fontFamily: V.fontBody }}>{copyStatus}</div>
            )}
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: V.fontDisplay, color: V.ink, marginBottom: 5, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Choose a style
            </div>
            <div style={{ fontSize: 12, color: V.muted, lineHeight: 1.5, marginBottom: 10 }}>
              Choose the format before copying to email or printing to PDF.
            </div>
            <StylePresetChooser
              value={currentPreset.id}
              onChange={(presetId) => updateConfig("stylePreset", presetId)}
            />
          </div>

          <div
            id="print-root"
            ref={printRef}
            style={{
              border: `2px solid ${V.border}`,
              borderRadius: 8,
              boxShadow: V.cardShadow,
              overflow: "hidden",
              maxWidth: 720,
              margin: "0 auto",
            }}
          >
            <NewsletterPreview config={config} newsletterData={newsletterData} selectedIds={selectedIds} customEntries={customEntries} />
          </div>
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: V.muted }}>
            Drafts are saved only in this browser. Use your browser's Print dialog (Ctrl+P / Cmd+P) and choose "Save as PDF" for a PDF file.
          </div>
        </div>
      )}
    </div>
  );
}

// ── App Shell ──────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState("captain"); // "captain" | "admin"
  /** Issue stored in Supabase / shown to captains */
  const [newsletterData, setNewsletterData] = useState(null);
  const [currentIssueLoading, setCurrentIssueLoading] = useState(true);
  /** Parsed issue not yet published (admin only) */
  const [unpublishedDraft, setUnpublishedDraft] = useState(null);

  useEffect(() => {
    injectPrintStyles();
    let cancelled = false;
    (async () => {
      try {
        try {
          const response = await fetch("/api/current-issue");
          if (cancelled) return;
          if (response.ok) {
            const body = await response.json();
            if (body?.data) {
              const normalized = normalizeNewsletterIssueData(body.data);
              setNewsletterData(normalized);
              try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
              } catch (_) {}
              return;
            }
          }
        } catch (_) {}
        if (cancelled) return;
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) setNewsletterData(normalizeNewsletterIssueData(JSON.parse(saved)));
        } catch (_) {}
      } finally {
        if (!cancelled) setCurrentIssueLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleAdminIssueUpdate(data, meta) {
    const normalized = normalizeNewsletterIssueData(data);
    if (meta?.draftOnly) {
      setUnpublishedDraft(normalized);
      return;
    }
    setNewsletterData(normalized);
    setUnpublishedDraft(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (_) {}
  }

  const currentIssueTitle = metadataText(newsletterData?.title);
  const currentIssueDate = metadataText(newsletterData?.date);
  const currentIssueNext = metadataText(newsletterData?.nextIssue);

  return (
    <div style={{ minHeight: "100vh", background: V.paper, fontFamily: V.fontBody }}>
      <header
        style={{
          background: V.navy,
          color: V.white,
          borderBottom: "3px solid var(--text-primary)",
          padding: "1rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <Logo
          onDark
          subtitle="Create your own neighborhood newsletter by choosing items from the latest Altagether Newsletter and adding your own zone-specific updates."
        />
      </header>

      {newsletterData && (
        <div className="nl-issue-strip-wrap">
          {mode === "captain" ? (
            <div className="nl-captain-intro">
              <div className="nl-captain-intro__meta">
                <span className="nl-captain-intro__kicker">Current issue:</span>
                <a href={FULL_NEWSLETTER_URL} target="_blank" rel="noopener noreferrer" style={{ color: V.green, fontWeight: 700 }}>
                  {currentIssueDate}
                </a>
                {currentIssueNext && (
                  <span style={{ color: V.gold, fontFamily: V.fontDisplay, fontWeight: 700 }}>Next: {formatNextIssueDate(currentIssueNext, currentIssueDate)}</span>
                )}
              </div>
              <h2 className="nl-captain-intro__title">Help your neighbors stay informed.</h2>
              <p className="nl-captain-intro__body">
                Start with the latest Altagether Neighborhood Captain Newsletter, choose the updates your neighbors need most, then copy or print your finished version.
              </p>
            </div>
          ) : (
            <div
              style={{
                background: V.card,
                border: `2px solid ${V.border}`,
                borderRadius: 8,
                boxShadow: V.cardShadow,
                borderLeft: `4px solid ${V.gold}`,
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 11, color: V.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, fontFamily: V.fontDisplay }}>
                Current Issue
              </span>
              <span style={{ fontSize: 13, color: V.ink, fontFamily: V.fontBody, fontWeight: 700 }}>{currentIssueTitle}</span>
              <span style={{ fontSize: 12, color: V.muted }}>• {currentIssueDate}</span>
              {currentIssueNext && (
                <span style={{ fontSize: 12, color: V.gold, fontFamily: V.fontDisplay, fontWeight: 700 }}>• Next: {formatNextIssueDate(currentIssueNext, currentIssueDate)}</span>
              )}
            </div>
          )}
        </div>
      )}

      <main className="nl-app-main" style={newsletterData ? { paddingTop: "0.75rem" } : undefined}>
        {mode === "admin"
          ? (
            <AdminView
              publishedIssue={newsletterData}
              unpublishedDraft={unpublishedDraft}
              onAdminIssueUpdate={handleAdminIssueUpdate}
              onDiscardDraft={() => setUnpublishedDraft(null)}
            />
          )
          : <CaptainView newsletterData={newsletterData} currentIssueLoading={currentIssueLoading} />
        }
      </main>
      <footer style={{ padding: "24px 16px 36px", textAlign: "center" }}>
        <button
          type="button"
          onClick={() => setMode(mode === "admin" ? "captain" : "admin")}
          style={{
            background: "transparent",
            border: "none",
            color: V.muted,
            cursor: "pointer",
            fontFamily: V.fontBody,
            fontSize: 11,
            textDecoration: "underline",
            opacity: 0.75,
          }}
        >
          {mode === "admin" ? "Back to newsletter builder" : "Admin access"}
        </button>
      </footer>
    </div>
  );
}
