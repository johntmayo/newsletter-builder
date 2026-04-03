import { useState, useEffect, useRef } from "react";

// ── Palette & constants ────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "altagether2025";
const STORAGE_KEY = "altagether_newsletter_data";

const C = {
  cream: "#F5F0E8",
  paper: "#FDFAF4",
  ink: "#1A1612",
  forest: "#2D5016",
  rust: "#C4541A",
  gold: "#D4A017",
  mist: "#E8E2D6",
  smoke: "#9B9488",
  white: "#FFFFFF",
};

const SECTION_COLORS = {
  "Recovery Updates": C.forest,
  "Upcoming Deadlines": C.rust,
  Events: "#5B4A8A",
  Surveys: "#1A6B8A",
  "Community & Financial Support": "#8A4A1A",
  "Case Management": "#4A6B1A",
  "In-Person Locations & Resources": "#6B1A4A",
  Other: C.smoke,
};

// ── Claude API helper (calls our server-side route) ───────────────────────────
async function parseNewsletterWithClaude(base64Data) {
  const response = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Data }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(err.error || `Server error: ${response.status}`);
  }

  return response.json();
}

// ── Utility ────────────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
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
  return C.smoke;
}

// ── Print CSS injector ─────────────────────────────────────────────────────────
function injectPrintStyles() {
  const id = "altag-print-styles";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    @media print {
      body > * { display: none !important; }
      #print-root { display: block !important; }
    }
    #print-root { display: none; }
  `;
  document.head.appendChild(style);
}

// ── Components ─────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 36, height: 36, background: C.forest, borderRadius: 6,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <span style={{ color: C.cream, fontSize: 18, fontWeight: 900, fontFamily: "Georgia, serif" }}>A</span>
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.ink, letterSpacing: "0.08em", fontFamily: "Georgia, serif" }}>ALTAGETHER</div>
        <div style={{ fontSize: 10, color: C.smoke, letterSpacing: "0.12em", textTransform: "uppercase" }}>Newsletter Builder</div>
      </div>
    </div>
  );
}

function Button({ children, onClick, variant = "primary", disabled, style = {} }) {
  const base = {
    padding: "10px 20px", border: "none", borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 13, letterSpacing: "0.04em",
    transition: "all 0.15s", opacity: disabled ? 0.5 : 1, ...style,
  };
  const variants = {
    primary: { background: C.forest, color: C.cream },
    secondary: { background: C.mist, color: C.ink },
    danger: { background: C.rust, color: C.white },
    ghost: { background: "transparent", color: C.forest, border: `1px solid ${C.forest}` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>
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
function AdminView({ onDataParsed, existingData }) {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  function handleLogin() {
    if (pw === ADMIN_PASSWORD) { setAuthed(true); setPwError(""); }
    else setPwError("Incorrect password.");
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setStatus("Reading PDF…");
    try {
      const b64 = await fileToBase64(file);
      setStatus("Sending to Claude for parsing… (this takes ~15 seconds)");
      const parsed = await parseNewsletterWithClaude(b64);
      parsed._uploadedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      onDataParsed(parsed);
      setStatus(`✓ Parsed successfully! Found ${parsed.sections?.length || 0} sections.`);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
    setLoading(false);
  }

  if (!authed) {
    return (
      <div style={{ maxWidth: 400, margin: "80px auto", padding: 32, background: C.paper, borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: `1px solid ${C.mist}` }}>
        <Logo />
        <div style={{ marginTop: 28, marginBottom: 6, fontSize: 13, color: C.smoke, fontFamily: "Georgia, serif" }}>Admin Password</div>
        <input
          type="password" value={pw} onChange={e => setPw(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          placeholder="Enter password…"
          style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.mist}`, borderRadius: 6, fontSize: 14, fontFamily: "Georgia, serif", background: C.cream, boxSizing: "border-box" }}
        />
        {pwError && <div style={{ color: C.rust, fontSize: 12, marginTop: 6 }}>{pwError}</div>}
        <Button onClick={handleLogin} style={{ marginTop: 14, width: "100%" }}>Sign In</Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: 32 }}>
      <div style={{ background: C.paper, border: `1px solid ${C.mist}`, borderRadius: 12, padding: 32, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "Georgia, serif", color: C.ink, marginBottom: 4 }}>Upload New Newsletter</div>
        <div style={{ fontSize: 13, color: C.smoke, marginBottom: 24 }}>Upload the latest issue PDF. Claude will parse every section, item, and link automatically.</div>

        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${file ? C.forest : C.mist}`, borderRadius: 8, padding: "32px 24px",
            textAlign: "center", cursor: "pointer", background: file ? C.forest + "08" : C.cream,
            transition: "all 0.2s", marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
          {file
            ? <div style={{ fontWeight: 700, color: C.forest, fontFamily: "Georgia, serif" }}>{file.name}</div>
            : <div style={{ color: C.smoke, fontSize: 14 }}>Click to select newsletter PDF</div>
          }
          <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => setFile(e.target.files[0])} />
        </div>

        <Button onClick={handleUpload} disabled={!file || loading} style={{ width: "100%" }}>
          {loading ? "Parsing…" : "Parse & Publish Newsletter"}
        </Button>

        {status && (
          <div style={{ marginTop: 16, padding: "12px 16px", background: status.startsWith("✓") ? C.forest + "15" : C.mist, borderRadius: 6, fontSize: 13, color: status.startsWith("✓") ? C.forest : C.ink, fontFamily: "Georgia, serif" }}>
            {status}
          </div>
        )}

        {existingData && (
          <div style={{ marginTop: 24, padding: "12px 16px", background: C.mist, borderRadius: 6, fontSize: 12, color: C.smoke }}>
            <strong>Current issue:</strong> {existingData.title} — {existingData.date}<br />
            Published: {existingData._uploadedAt ? new Date(existingData._uploadedAt).toLocaleDateString() : "Unknown"}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Item Card (Captain Builder) ────────────────────────────────────────────────
function ItemCard({ item, selected, onToggle, sectionColor }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex", gap: 12, padding: "12px 14px",
        background: selected ? sectionColor + "10" : C.cream,
        border: `1px solid ${selected ? sectionColor : C.mist}`,
        borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
        marginBottom: 8, alignItems: "flex-start",
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2,
        border: `2px solid ${selected ? sectionColor : C.smoke}`,
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
        <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.5, fontFamily: "Georgia, serif" }}>
          {item.text}
        </div>
        {item.location && (
          <div style={{ fontSize: 11, color: C.smoke, marginTop: 3 }}>📍 {item.location}</div>
        )}
        {item.links?.length > 0 && (
          <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {item.links.map((l, i) => (
              <span key={i} style={{ fontSize: 10, color: sectionColor, fontWeight: 600, background: sectionColor + "15", padding: "1px 6px", borderRadius: 3 }}>
                🔗 {l.label}
              </span>
            ))}
          </div>
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
        <div key={e.id} style={{ marginBottom: 12, background: C.cream, border: `1px solid ${C.mist}`, borderRadius: 8, padding: 14 }}>
          <input
            value={e.heading} onChange={ev => update(e.id, "heading", ev.target.value)}
            placeholder="Section heading (e.g. Zone 4 Updates)"
            style={{ width: "100%", padding: "7px 10px", border: `1px solid ${C.mist}`, borderRadius: 5, fontSize: 13, fontFamily: "Georgia, serif", marginBottom: 8, boxSizing: "border-box", background: C.paper }}
          />
          <textarea
            value={e.text} onChange={ev => update(e.id, "text", ev.target.value)}
            placeholder="Write your zone-specific update here…"
            rows={4}
            style={{ width: "100%", padding: "7px 10px", border: `1px solid ${C.mist}`, borderRadius: 5, fontSize: 13, fontFamily: "Georgia, serif", resize: "vertical", boxSizing: "border-box", background: C.paper, lineHeight: 1.6 }}
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
  const { name, tagline, headerImage, captainName, zone } = config;
  const date = newsletterData?.date || "";

  const selectedBySection = (newsletterData?.sections || []).map(sec => ({
    ...sec,
    items: sec.items.filter(it => selectedIds.has(it.id)),
  })).filter(sec => sec.items.length > 0);

  return (
    <div style={{ fontFamily: "Georgia, serif", color: C.ink, background: C.white, maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      {headerImage && (
        <img src={headerImage} alt="Header" style={{ width: "100%", maxHeight: 200, objectFit: "cover", display: "block" }} />
      )}
      <div style={{ background: C.forest, padding: "24px 32px", color: C.cream }}>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "0.03em" }}>{name || "Zone Newsletter"}</div>
        {tagline && <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>{tagline}</div>}
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          {date && `${date} • `}
          {zone && `${zone} • `}
          {captainName && `Captain: ${captainName}`}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7, borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: 10 }}>
          Curated from the Altagether Neighborhood Captain Newsletter
        </div>
      </div>

      <div style={{ padding: "0 32px 32px" }}>
        {/* Custom entries */}
        {customEntries.filter(e => e.text).map(e => (
          <div key={e.id} style={{ marginTop: 28 }}>
            {e.heading && (
              <div style={{ fontSize: 17, fontWeight: 800, color: C.rust, borderBottom: `2px solid ${C.rust}`, paddingBottom: 6, marginBottom: 14, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {e.heading}
              </div>
            )}
            <div style={{ fontSize: 14, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{e.text}</div>
          </div>
        ))}

        {/* Selected items from newsletter */}
        {selectedBySection.map(sec => (
          <div key={sec.id} style={{ marginTop: 28 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: getSectionColor(sec.heading), borderBottom: `2px solid ${getSectionColor(sec.heading)}`, paddingBottom: 6, marginBottom: 14, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {sec.heading}
            </div>
            {sec.items.map(item => (
              <div key={item.id} style={{ marginBottom: 14, paddingLeft: 12, borderLeft: `3px solid ${getSectionColor(sec.heading)}30` }}>
                {item.date && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: getSectionColor(sec.heading), marginBottom: 2, letterSpacing: "0.06em" }}>
                    {item.date}{item.time ? ` @ ${item.time}` : ""}{item.location ? ` • ${item.location}` : ""}
                  </div>
                )}
                <div style={{ fontSize: 13, lineHeight: 1.65 }}>{item.text}</div>
                {item.links?.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    {item.links.map((l, i) => (
                      <span key={i} style={{ fontSize: 11, color: getSectionColor(sec.heading), marginRight: 8 }}>→ {l.label}{l.url ? ` (${l.url})` : ""}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        {selectedBySection.length === 0 && customEntries.filter(e => e.text).length === 0 && (
          <div style={{ marginTop: 40, textAlign: "center", color: C.smoke, fontSize: 14 }}>
            No content selected yet.
          </div>
        )}

        <div style={{ marginTop: 36, paddingTop: 16, borderTop: `1px solid ${C.mist}`, fontSize: 11, color: C.smoke, textAlign: "center" }}>
          Altagether • altagether.org • newsletter@altagether.org
        </div>
      </div>
    </div>
  );
}

// ── Captain Builder View ───────────────────────────────────────────────────────
function CaptainView({ newsletterData }) {
  const [step, setStep] = useState(0); // 0=config, 1=select, 2=preview
  const [config, setConfig] = useState({ name: "", tagline: "", captainName: "", zone: "", headerImage: null });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [customEntries, setCustomEntries] = useState([]);
  const [activeSection, setActiveSection] = useState(null);
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
    const ids = sec.items.map(i => i.id);
    const allSelected = ids.every(id => selectedIds.has(id));
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

  function updateConfig(field, val) {
    setConfig(prev => ({ ...prev, [field]: val }));
  }

  const totalSelected = selectedIds.size + customEntries.filter(e => e.text).length;

  if (!newsletterData) {
    return (
      <div style={{ maxWidth: 500, margin: "80px auto", padding: 32, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "Georgia, serif", color: C.ink, marginBottom: 8 }}>No Newsletter Yet</div>
        <div style={{ fontSize: 14, color: C.smoke }}>
          The admin team hasn't published a newsletter issue yet. Check back soon, or contact newsletter@altagether.org.
        </div>
      </div>
    );
  }

  const sections = newsletterData.sections || [];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Steps */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: `2px solid ${C.mist}` }}>
        {["Configure", "Select Content", "Preview & Print"].map((label, i) => (
          <div
            key={i}
            onClick={() => i < step || (i === 1 && step >= 0) || (i === 2 && step >= 1) ? setStep(i) : null}
            style={{
              padding: "12px 24px", fontSize: 13, fontWeight: i === step ? 800 : 500,
              color: i === step ? C.forest : C.smoke, borderBottom: i === step ? `3px solid ${C.forest}` : "3px solid transparent",
              cursor: "pointer", fontFamily: "Georgia, serif", letterSpacing: "0.03em",
              marginBottom: -2, transition: "all 0.15s",
            }}
          >
            <span style={{ opacity: 0.5, marginRight: 6 }}>{i + 1}.</span>{label}
            {i === 1 && totalSelected > 0 && (
              <span style={{ marginLeft: 8, background: C.forest, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 800 }}>{totalSelected}</span>
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Configure */}
      {step === 0 && (
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "Georgia, serif", color: C.ink, marginBottom: 4 }}>Configure Your Newsletter</div>
          <div style={{ fontSize: 13, color: C.smoke, marginBottom: 24 }}>Set up the basics for your zone's version of the newsletter.</div>

          {[
            { field: "name", label: "Newsletter Name", placeholder: "e.g. Zone 4 Neighbor Update" },
            { field: "tagline", label: "Tagline (optional)", placeholder: "e.g. News for Loma Alta neighbors" },
            { field: "captainName", label: "Your Name", placeholder: "Neighborhood Captain name" },
            { field: "zone", label: "Zone / Neighborhood", placeholder: "e.g. Zone 4 — Loma Alta" },
          ].map(({ field, label, placeholder }) => (
            <div key={field} style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 5, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</label>
              <input
                value={config[field]} onChange={e => updateConfig(field, e.target.value)}
                placeholder={placeholder}
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.mist}`, borderRadius: 6, fontSize: 14, fontFamily: "Georgia, serif", background: C.cream, boxSizing: "border-box" }}
              />
            </div>
          ))}

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.ink, marginBottom: 5, letterSpacing: "0.06em", textTransform: "uppercase" }}>Header Image (optional)</label>
            <div
              onClick={() => headerRef.current?.click()}
              style={{
                border: `2px dashed ${config.headerImage ? C.forest : C.mist}`, borderRadius: 8, padding: "20px",
                textAlign: "center", cursor: "pointer", background: config.headerImage ? C.forest + "08" : C.cream,
              }}
            >
              {config.headerImage
                ? <img src={config.headerImage} alt="Header" style={{ maxHeight: 80, maxWidth: "100%", borderRadius: 4 }} />
                : <div style={{ color: C.smoke, fontSize: 13 }}>Click to upload header image</div>
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
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, minHeight: 600 }}>
          {/* Section nav */}
          <div style={{ background: C.paper, border: `1px solid ${C.mist}`, borderRadius: 10, overflow: "hidden", alignSelf: "start", position: "sticky", top: 20 }}>
            <div style={{ padding: "12px 16px", background: C.mist, fontSize: 11, fontWeight: 800, color: C.smoke, letterSpacing: "0.1em", textTransform: "uppercase" }}>Sections</div>
            {sections.map(sec => {
              const color = getSectionColor(sec.heading);
              const count = sec.items.filter(i => selectedIds.has(i.id)).length;
              return (
                <div
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  style={{
                    padding: "10px 16px", cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif",
                    background: activeSection === sec.id ? color + "15" : "transparent",
                    borderLeft: `3px solid ${activeSection === sec.id ? color : "transparent"}`,
                    transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "space-between",
                    color: activeSection === sec.id ? color : C.ink,
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
                padding: "10px 16px", cursor: "pointer", fontSize: 12, fontFamily: "Georgia, serif",
                background: activeSection === "custom" ? C.rust + "15" : "transparent",
                borderLeft: `3px solid ${activeSection === "custom" ? C.rust : "transparent"}`,
                color: activeSection === "custom" ? C.rust : C.ink, fontWeight: activeSection === "custom" ? 700 : 400,
                borderTop: `1px solid ${C.mist}`, marginTop: 4,
              }}
            >
              + Zone Updates
            </div>
          </div>

          {/* Items panel */}
          <div>
            {activeSection === "custom" ? (
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "Georgia, serif", color: C.rust, marginBottom: 4 }}>Zone-Specific Updates</div>
                <div style={{ fontSize: 13, color: C.smoke, marginBottom: 16 }}>Add your own neighborhood news, announcements, or updates.</div>
                <CustomEntryEditor entries={customEntries} onChange={setCustomEntries} />
              </div>
            ) : (() => {
              const sec = sections.find(s => s.id === activeSection);
              if (!sec) return null;
              const color = getSectionColor(sec.heading);
              const allSelected = sec.items.every(i => selectedIds.has(i.id));
              return (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "Georgia, serif", color }}>{sec.heading}</div>
                      <div style={{ fontSize: 12, color: C.smoke }}>{sec.items.length} items • {sec.items.filter(i => selectedIds.has(i.id)).length} selected</div>
                    </div>
                    <Button variant="ghost" onClick={() => toggleSection(sec)} style={{ fontSize: 11, padding: "6px 14px", borderColor: color, color }}>
                      {allSelected ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                  {sec.items.map(item => (
                    <ItemCard key={item.id} item={item} selected={selectedIds.has(item.id)} onToggle={() => toggleItem(item.id)} sectionColor={color} />
                  ))}
                </div>
              );
            })()}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24, paddingTop: 16, borderTop: `1px solid ${C.mist}` }}>
              <Button variant="secondary" onClick={() => setStep(0)}>← Back</Button>
              <Button onClick={() => setStep(2)}>Preview & Print →</Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "Georgia, serif", color: C.ink }}>Preview & Print</div>
              <div style={{ fontSize: 12, color: C.smoke }}>{totalSelected} items selected</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="secondary" onClick={() => setStep(1)}>← Edit</Button>
              <Button onClick={handlePrint}>🖨 Print / Save PDF</Button>
            </div>
          </div>

          <div style={{ border: `1px solid ${C.mist}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
            <div ref={printRef}>
              <NewsletterPreview config={config} newsletterData={newsletterData} selectedIds={selectedIds} customEntries={customEntries} />
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: C.smoke }}>
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
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setNewsletterData(JSON.parse(saved));
    } catch (e) {}
  }, []);

  function handleDataParsed(data) {
    setNewsletterData(data);
    setMode("captain");
  }

  return (
    <div style={{ minHeight: "100vh", background: C.cream, fontFamily: "system-ui, sans-serif" }}>
      {/* Top nav */}
      <div style={{ background: C.paper, borderBottom: `1px solid ${C.mist}`, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
        <Logo />
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setMode("captain")}
            style={{ padding: "6px 16px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "Georgia, serif", background: mode === "captain" ? C.forest : "transparent", color: mode === "captain" ? C.cream : C.smoke, letterSpacing: "0.04em" }}
          >
            Build Newsletter
          </button>
          <button
            onClick={() => setMode("admin")}
            style={{ padding: "6px 16px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "Georgia, serif", background: mode === "admin" ? C.forest : "transparent", color: mode === "admin" ? C.cream : C.smoke, letterSpacing: "0.04em" }}
          >
            Admin
          </button>
        </div>
      </div>

      {/* Issue badge */}
      {newsletterData && (
        <div style={{ background: C.forest, padding: "8px 32px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: C.cream + "aa", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>Current Issue:</span>
          <span style={{ fontSize: 12, color: C.cream, fontFamily: "Georgia, serif", fontWeight: 700 }}>{newsletterData.title}</span>
          <span style={{ fontSize: 11, color: C.cream + "80" }}>• {newsletterData.date}</span>
          {newsletterData.nextIssue && (
            <span style={{ fontSize: 11, color: C.gold }}>• Next: {newsletterData.nextIssue}</span>
          )}
        </div>
      )}

      {/* Main */}
      <div style={{ padding: "32px 32px 64px" }}>
        {mode === "admin"
          ? <AdminView onDataParsed={handleDataParsed} existingData={newsletterData} />
          : <CaptainView newsletterData={newsletterData} />
        }
      </div>
    </div>
  );
}
