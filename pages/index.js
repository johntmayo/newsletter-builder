import { useState, useEffect, useRef } from "react";
import AdminReviewStructure from "../components/AdminReviewStructure";
import { repairLegacyAmpDoubling } from "../lib/sanitizeMailerLiteHtml";

// ── Design tokens (CSS vars — see styles/globals.css & altagether-subpage-style.md)
const STORAGE_KEY = "altagether_newsletter_data";

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

function imageFileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });
}

function getSectionColor(heading) {
  for (const [key, color] of Object.entries(SECTION_COLORS)) {
    if (heading?.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return SECTION_COLORS.Other;
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

function NewsletterItemBody({ item, sectionColor, appendixLinks }) {
  if (item.bodyHtml) {
    return (
      <div
        className="nl-item-body"
        style={{
          fontSize: "0.9rem",
          lineHeight: 1.65,
          color: "var(--text-primary)",
          fontFamily: V.fontBody,
          ["--nl-accent"]: sectionColor,
        }}
        dangerouslySetInnerHTML={{ __html: repairLegacyAmpDoubling(item.bodyHtml) }}
      />
    );
  }
  return (
    <>
      <div style={{ fontSize: "0.9rem", lineHeight: 1.65, fontFamily: V.fontBody }}>{item.text}</div>
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
      }
      /* PDF / print: force dark text on white so tagline and meta stay legible without background graphics. */
      #print-root .nl-print-header {
        background: #fff !important;
        color: #1f2937 !important;
        border-bottom: 3px solid #314059 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      #print-root .nl-print-header .nl-print-header-title {
        color: #111827 !important;
        opacity: 1 !important;
      }
      #print-root .nl-print-header .nl-print-header-tagline {
        color: #374151 !important;
        opacity: 1 !important;
      }
      #print-root .nl-print-header .nl-print-header-meta {
        color: #374151 !important;
        opacity: 1 !important;
      }
      #print-root .nl-print-header .nl-print-header-curated {
        color: #4b5563 !important;
        opacity: 1 !important;
      }
      #print-root .nl-print-header .nl-print-header-rule {
        border-top-color: #d1d5db !important;
      }
      #print-root .nl-print-header .nl-print-header-captains {
        color: #374151 !important;
        opacity: 1 !important;
      }
    }
  `;
  document.head.appendChild(style);
}

// ── Components ─────────────────────────────────────────────────────────────────

const LOGO_IMG_HEIGHT = Math.round(40 * 1.2);

/** @param {{ onDark?: boolean }} props — onDark: white logo + text on navy header; else logo (darkened) + navy text on light surfaces */
function Logo({ onDark = false }) {
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
      <span style={titleStyle}>Newsletter Builder</span>
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
function AdminView({ onDataParsed, existingData, onIssueUpdated }) {
  const [authed, setAuthed] = useState(false);
  const [adminTab, setAdminTab] = useState("upload");
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
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

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setStatus("Reading HTML…");
    try {
      const html = await fileToUtf8Text(file);
      setStatus("Parsing newsletter…");
      const parsed = await parseNewsletterHtmlUpload(html);
      parsed._uploadedAt = new Date().toISOString();

      setStatus("Saving for all visitors…");
      const pub = await fetch("/api/publish-newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw, parsed }),
      });
      const pubBody = await pub.json().catch(() => ({}));

      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      onDataParsed(parsed);

      const linkCount = (parsed.sections || []).reduce(
        (n, sec) =>
          n + (sec.items || []).reduce((m, it) => m + (it.links?.length || 0), 0),
        0,
      );

      if (!pub.ok) {
        setStatus(
          `⚠ Parsed OK, but only saved on this device — not for everyone: ${pubBody.error || `HTTP ${pub.status}`}. (${parsed.sections?.length || 0} sections, ${linkCount} links.)`,
        );
        return;
      }

      setStatus(
        `✓ Published for all visitors! ${parsed.sections?.length || 0} sections, ${linkCount} links captured.`,
      );
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setLoading(false);
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
          <div style={{ fontSize: 13, color: V.muted, marginBottom: 24 }}>Upload the MailerLite HTML export for the latest issue. It is parsed and saved so everyone who opens the site gets this edition.</div>

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

          <Button onClick={handleUpload} disabled={!file || loading} style={{ width: "100%" }}>
            {loading ? "Parsing…" : "Parse & Publish Newsletter"}
          </Button>

          {status && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: status.startsWith("✓") ? V.greenTint15 : V.border, borderRadius: 8, fontSize: 13, color: status.startsWith("✓") ? V.green : status.startsWith("Error") ? V.clay : V.ink, fontFamily: V.fontBody }}>
              {status}
            </div>
          )}

          {existingData && (
            <div style={{ marginTop: 24, padding: "12px 16px", background: V.border, borderRadius: 6, fontSize: 12, color: V.muted }}>
              <strong>Current issue:</strong> {existingData.title} — {existingData.date}<br />
              Published: {existingData._uploadedAt ? new Date(existingData._uploadedAt).toLocaleDateString() : "Unknown"}
            </div>
          )}
        </div>
      </div>

      <div hidden={adminTab !== "review"}>
        <AdminReviewStructure
          newsletterData={existingData}
          password={pw}
          onIssueUpdated={onIssueUpdated}
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
        background: selected ? sectionColor + "10" : V.inputBg,
        border: `2px solid ${selected ? sectionColor : V.border}`,
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
        border: `2px solid ${selected ? sectionColor : V.muted}`,
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

// ── Preview / Print output ─────────────────────────────────────────────────────
function NewsletterPreview({ config, newsletterData, selectedIds, customEntries }) {
  const { name, tagline, headerImage, zone, zoneLinks, captains } = config;
  const date = newsletterData?.date || "";
  const captainLines = captainsWithContent(captains);
  const zl = (zoneLinks || "").trim();
  const hasLinksStrip = Boolean(zl);

  const selectedBySection = buildSelectedBySection(newsletterData, selectedIds);

  return (
    <div style={{ fontFamily: V.fontBody, color: V.ink, background: V.card, maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      {headerImage && (
        <img src={headerImage} alt="Header" style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }} />
      )}
      <div className="nl-print-header" style={{ background: V.navy, padding: "24px 32px", color: V.white }}>
        <div className="nl-print-header-title" style={{ fontSize: 28, fontWeight: 900, letterSpacing: "0.03em", fontFamily: V.fontDisplay }}>{name || "Zone Newsletter"}</div>
        {tagline && (
          <div className="nl-print-header-tagline" style={{ fontSize: 14, opacity: 0.92, marginTop: 4 }}>
            {tagline}
          </div>
        )}
        {(date || zone) ? (
          <div className="nl-print-header-meta" style={{ fontSize: 12, opacity: 0.88, marginTop: 8 }}>
            {[date, zone].filter(Boolean).join(" • ")}
          </div>
        ) : null}
        {captainLines.length > 0 ? (
          <div
            className="nl-print-header-captains"
            style={{ marginTop: 10, fontSize: 13, opacity: 0.92, lineHeight: 1.55, fontFamily: V.fontBody }}
          >
            {captainLines.map((c, i) => (
              <div key={c.id || i}>{formatCaptainLine(c)}</div>
            ))}
          </div>
        ) : null}
        <div
          className="nl-print-header-curated nl-print-header-rule"
          style={{ marginTop: 12, fontSize: 12, opacity: 0.88, borderTop: "1px solid rgba(255,255,255,0.28)", paddingTop: 10 }}
        >
          Curated from the Altagether Neighborhood Captain Newsletter
        </div>
      </div>

      {hasLinksStrip ? (
        <div
          className="nl-print-contact"
          style={{
            padding: "18px 32px",
            background: V.inputBg,
            borderBottom: `1px solid ${V.border}`,
            fontFamily: V.fontBody,
            fontSize: 13,
            lineHeight: 1.55,
            color: V.ink,
          }}
        >
          {zl}
        </div>
      ) : null}

      <div style={{ padding: "0 32px 32px" }}>
        {/* Zone updates: one section title, entries styled like newsletter item cards */}
        {customEntries.filter((e) => e.text).length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                fontFamily: V.fontDisplay,
                color: CLAY_HEX,
                borderBottom: `2px solid ${CLAY_HEX}`,
                paddingBottom: 6,
                marginBottom: 14,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {zoneUpdatesSectionTitle(zone, name)}
            </div>
            {customEntries.filter((e) => e.text).map((e) => (
              <div
                key={e.id}
                style={{
                  marginBottom: 14,
                  paddingLeft: 12,
                  borderLeft: `3px solid ${CLAY_HEX}4d`,
                }}
              >
                {e.heading ? (
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.fontBody, color: V.ink, marginBottom: 6 }}>{e.heading}</div>
                ) : null}
                <div style={{ fontSize: 14, lineHeight: 1.75, whiteSpace: "pre-wrap", color: V.ink, fontFamily: V.fontBody }}>{e.text}</div>
              </div>
            ))}
          </div>
        )}

        {/* Selected items from newsletter */}
        {selectedBySection.map(sec => (
          <div key={sec.id} style={{ marginTop: 28 }}>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: V.fontDisplay, color: getSectionColor(sec.heading), borderBottom: `2px solid ${getSectionColor(sec.heading)}`, paddingBottom: 6, marginBottom: 14, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {sec.heading}
            </div>
            {sec.items.map(item => (
              <div key={item.id} style={{ marginBottom: 14, paddingLeft: 12, borderLeft: `3px solid ${getSectionColor(sec.heading)}30` }}>
                {item.date && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: getSectionColor(sec.heading), marginBottom: 2, letterSpacing: "0.06em" }}>
                    {item.date}{item.time ? ` @ ${item.time}` : ""}{item.location ? ` • ${item.location}` : ""}
                  </div>
                )}
                <NewsletterItemBody
                  item={item}
                  sectionColor={getSectionColor(sec.heading)}
                  appendixLinks={!item.bodyHtml}
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
function CaptainView({ newsletterData }) {
  const [step, setStep] = useState(0); // 0=config, 1=select, 2=preview
  const [config, setConfig] = useState({
    name: "",
    tagline: "",
    zone: "",
    captains: [{ id: "c1", name: "", contact: "" }],
    zoneLinks: "",
    headerImage: null,
  });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [customEntries, setCustomEntries] = useState([]);
  const [activeSection, setActiveSection] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");
  const headerRef = useRef();
  const printRef = useRef();

  useEffect(() => {
    if (newsletterData?.sections?.length > 0) {
      setActiveSection(newsletterData.sections[0].id);
    }
  }, [newsletterData]);

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
    const plainParts = [];
    const htmlParts = [];
    plainParts.push(config.name || "Zone Newsletter");
    if (config.tagline) plainParts.push(config.tagline);
    if (newsletterData?.date) plainParts.push(newsletterData.date);
    if (config.zone) plainParts.push(config.zone);
    for (const c of captainsWithContent(config.captains)) {
      plainParts.push(formatCaptainLine(c));
    }
    const zlPlain = (config.zoneLinks || "").trim();
    if (zlPlain) plainParts.push(zlPlain);
    plainParts.push("");

    htmlParts.push('<div style="font-family:Merriweather,Georgia,serif;font-size:14px;line-height:1.55;color:#1f2937;">');
    htmlParts.push(
      `<p style="margin:0 0 6px;"><strong style="font-size:20px;line-height:1.2;">${escapeHtmlPlain(config.name || "Zone Newsletter")}</strong></p>`,
    );
    if (config.tagline) {
      htmlParts.push(`<p style="margin:0 0 10px;color:#374151;">${escapeHtmlPlain(config.tagline)}</p>`);
    }
    const metaBits = [];
    if (newsletterData?.date) metaBits.push(escapeHtmlPlain(newsletterData.date));
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
      '<p style="margin:0 0 14px;padding-top:8px;border-top:1px solid #e5e7eb;color:#4b5563;font-size:12px;line-height:1.45;">Curated from the Altagether Neighborhood Captain Newsletter</p>',
    );
    const zl = zlPlain;
    if (zl) {
      htmlParts.push(`<p style="margin:0 0 14px;font-size:13px;line-height:1.55;color:#1f2937;">${escapeHtmlPlain(zl)}</p>`);
    }
    htmlParts.push("<hr style=\"border:none;border-top:1px solid #ddd;margin:12px 0;\" />");

    if (customWithText.length > 0) {
      const zuTitle = zoneUpdatesSectionTitle(config.zone, config.name);
      plainParts.push(zuTitle.toUpperCase());
      plainParts.push("");
      customWithText.forEach((e) => {
        if (e.heading) plainParts.push(e.heading);
        plainParts.push(e.text);
        plainParts.push("");
      });
      htmlParts.push(
        `<h3 style="margin:18px 0 8px;font-size:17px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;color:${CLAY_HEX};border-bottom:2px solid ${CLAY_HEX};padding-bottom:5px;line-height:1.25;">${escapeHtmlPlain(zuTitle)}</h3>`,
      );
      customWithText.forEach((e) => {
        htmlParts.push(
          `<div style="margin-bottom:12px;padding-left:10px;border-left:3px solid rgba(188,88,56,0.25);">`,
        );
        if (e.heading) {
          htmlParts.push(`<p style="font-weight:700;margin:0 0 6px;font-size:14px;color:#1f2937;">${escapeHtmlPlain(e.heading)}</p>`);
        }
        htmlParts.push(`<p style="white-space:pre-wrap;margin:0;font-size:14px;line-height:1.75;color:#1f2937;">${escapeHtmlPlain(e.text)}</p>`);
        htmlParts.push("</div>");
      });
    }

    for (const sec of selectedBySection) {
      const col = getSectionColor(sec.heading);
      plainParts.push(sec.heading.toUpperCase());
      plainParts.push("");
      htmlParts.push(
        `<h3 style="margin:18px 0 8px;font-size:17px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;color:${escapeHtmlPlain(col)};border-bottom:2px solid ${escapeHtmlPlain(col)};padding-bottom:5px;line-height:1.25;">${escapeHtmlPlain(sec.heading)}</h3>`,
      );
      for (const item of sec.items) {
        plainParts.push(itemToPlainText(item));
        plainParts.push("");
        htmlParts.push('<div style="margin-bottom:12px;padding-left:10px;border-left:3px solid rgba(0,0,0,0.08);">');
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
  const totalSelected = visibleSelectedCount + customEntries.filter(e => e.text).length;

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

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Steps */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: `2px solid ${V.border}` }}>
        {["Configure", "Select Content", "Preview & Print"].map((label, i) => (
          <div
            key={i}
            onClick={() => i < step || (i === 1 && step >= 0) || (i === 2 && step >= 1) ? setStep(i) : null}
            style={{
              padding: "12px 24px", fontSize: 13, fontWeight: i === step ? 800 : 500,
              color: i === step ? V.ink : V.muted, borderBottom: i === step ? `3px solid ${V.gold}` : "3px solid transparent",
              cursor: "pointer", fontFamily: V.fontDisplay, letterSpacing: "0.03em",
              marginBottom: -2, transition: "all 0.15s",
            }}
          >
            <span style={{ opacity: 0.5, marginRight: 6 }}>{i + 1}.</span>{label}
            {i === 1 && totalSelected > 0 && (
              <span style={{ marginLeft: 8, background: V.green, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 800 }}>{totalSelected}</span>
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Configure */}
      {step === 0 && (
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: V.fontDisplay, color: V.ink, marginBottom: 4 }}>Configure Your Newsletter</div>
          <div style={{ fontSize: 13, color: V.muted, marginBottom: 24 }}>Set up the basics for your zone's version of the newsletter.</div>

          {[
            { field: "name", label: "Newsletter Name", placeholder: "e.g. Zone 4 Neighbor Update" },
            { field: "tagline", label: "Tagline (optional)", placeholder: "e.g. News for Loma Alta neighbors" },
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

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, fontFamily: V.fontDisplay, color: V.ink, marginBottom: 5, letterSpacing: "0.06em", textTransform: "uppercase" }}>Header Image (optional)</label>
            <div
              onClick={() => headerRef.current?.click()}
              style={{
                border: `2px dashed ${config.headerImage ? V.green : V.border}`, borderRadius: 8, padding: "20px",
                textAlign: "center", cursor: "pointer", background: config.headerImage ? V.greenTint08 : V.inputBg,
              }}
            >
              {config.headerImage
                ? <img src={config.headerImage} alt="Header" style={{ maxHeight: 80, maxWidth: "100%", borderRadius: 4 }} />
                : <div style={{ color: V.muted, fontSize: 13 }}>Click to upload header image</div>
              }
              <input ref={headerRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={async e => {
                  const f = e.target.files[0];
                  if (f) updateConfig("headerImage", await imageFileToDataUrl(f));
                }}
              />
            </div>
          </div>

          <Button onClick={() => setStep(1)} style={{ width: "100%" }}>
            Next: Select Content →
          </Button>
        </div>
      )}

      {/* Step 1: Select */}
      {step === 1 && (
        <div className="nl-captain-grid">
          {/* Section nav */}
          <div style={{ background: V.card, border: `2px solid ${V.border}`, borderRadius: 8, boxShadow: V.cardShadow, overflow: "hidden", alignSelf: "start", position: "sticky", top: 20 }}>
            <div style={{ padding: "12px 16px", background: V.border, fontSize: 11, fontWeight: 800, fontFamily: V.fontDisplay, color: V.muted, letterSpacing: "0.1em", textTransform: "uppercase" }}>Sections</div>
            {sections.map(sec => {
              const color = getSectionColor(sec.heading);
              const count = captainVisibleItems(sec.items).filter((i) => selectedIds.has(i.id)).length;
              return (
                <div
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  style={{
                    padding: "10px 16px", cursor: "pointer", fontSize: 12, fontFamily: V.fontDisplay,
                    background: activeSection === sec.id ? color + "15" : "transparent",
                    borderLeft: `3px solid ${activeSection === sec.id ? color : "transparent"}`,
                    transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between",
                    color: activeSection === sec.id ? color : V.ink,
                  }}
                >
                  <span style={{ fontWeight: activeSection === sec.id ? 700 : 400 }}>{sec.heading}</span>
                  {count > 0 && (
                    <span style={{ background: color, color: "#fff", borderRadius: 8, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>{count}</span>
                  )}
                </div>
              );
            })}
            <div
              onClick={() => setActiveSection("custom")}
              style={{
                padding: "10px 16px", cursor: "pointer", fontSize: 12, fontFamily: V.fontDisplay,
                background: activeSection === "custom" ? V.clayTint : "transparent",
                borderLeft: `3px solid ${activeSection === "custom" ? V.clay : "transparent"}`,
                color: activeSection === "custom" ? V.clay : V.ink, fontWeight: activeSection === "custom" ? 700 : 400,
                borderTop: `1px solid ${V.border}`, marginTop: 4,
              }}
            >
              + Zone Updates
            </div>
          </div>

          {/* Items panel */}
          <div>
            {activeSection === "custom" ? (
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: V.fontDisplay, color: V.clay, marginBottom: 4 }}>Zone-Specific Updates</div>
                <div style={{ fontSize: 13, color: V.muted, marginBottom: 16 }}>Add your own neighborhood news, announcements, or updates.</div>
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
              <Button onClick={() => setStep(2)}>Preview & Print →</Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: V.fontDisplay, color: V.ink }}>Preview & Print</div>
                <div style={{ fontSize: 12, color: V.muted }}>{totalSelected} items selected</div>
              </div>
              <div className="nl-step-toolbar" style={{ justifyContent: "flex-end", marginLeft: "auto" }}>
                <Button variant="secondary" onClick={() => setStep(1)}>← Edit</Button>
                <Button variant="secondary" onClick={handleCopyForEmail}>📋 Copy for email</Button>
                <Button onClick={handlePrint}>🖨 Print / Save PDF</Button>
              </div>
            </div>
            {copyStatus && (
              <div style={{ marginTop: 10, fontSize: 12, color: V.green, fontFamily: V.fontBody }}>{copyStatus}</div>
            )}
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
            Use your browser's Print dialog (Ctrl+P / Cmd+P) and choose "Save as PDF" for a PDF file.
          </div>
        </div>
      )}
    </div>
  );
}

// ── App Shell ──────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState("captain"); // "captain" | "admin"
  const [newsletterData, setNewsletterData] = useState(null);

  useEffect(() => {
    injectPrintStyles();
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/current-issue");
        if (cancelled) return;
        if (response.ok) {
          const body = await response.json();
          if (body?.data) {
            setNewsletterData(body.data);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(body.data));
            } catch (_) {}
            return;
          }
        }
      } catch (_) {}
      if (cancelled) return;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setNewsletterData(JSON.parse(saved));
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleDataParsed(data) {
    setNewsletterData(data);
    setMode("captain");
  }

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
        <Logo onDark />
        <div className="nl-mode-segmented" role="group" aria-label="App mode">
          <button
            type="button"
            className={mode === "captain" ? "nl-mode-segmented--active" : ""}
            onClick={() => setMode("captain")}
          >
            Build Newsletter
          </button>
          <button
            type="button"
            className={mode === "admin" ? "nl-mode-segmented--active" : ""}
            onClick={() => setMode("admin")}
          >
            Admin
          </button>
        </div>
      </header>

      {newsletterData && (
        <div className="nl-issue-strip-wrap">
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
            <span style={{ fontSize: 13, color: V.ink, fontFamily: V.fontBody, fontWeight: 700 }}>{newsletterData.title}</span>
            <span style={{ fontSize: 12, color: V.muted }}>• {newsletterData.date}</span>
            {newsletterData.nextIssue && (
              <span style={{ fontSize: 12, color: V.gold, fontFamily: V.fontDisplay, fontWeight: 700 }}>• Next: {newsletterData.nextIssue}</span>
            )}
          </div>
        </div>
      )}

      <main className="nl-app-main" style={newsletterData ? { paddingTop: "0.75rem" } : undefined}>
        {mode === "admin"
          ? (
            <AdminView
              onDataParsed={handleDataParsed}
              existingData={newsletterData}
              onIssueUpdated={(data) => {
                setNewsletterData(data);
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                } catch (_) {}
              }}
            />
          )
          : <CaptainView newsletterData={newsletterData} />
        }
      </main>
    </div>
  );
}
