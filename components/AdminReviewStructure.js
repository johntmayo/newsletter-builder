import { useState, useEffect } from "react";
import { repairLegacyAmpDoubling } from "../lib/sanitizeMailerLiteHtml";
import {
  getBodyHtmlBlocks,
  mergeItemWithNext,
  mergeItemWithPrevious,
  splitItemInSection,
  splitPointCount,
} from "../lib/issueStructure";

function previewSnippet(text, max = 140) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t || "(empty text)";
  return `${t.slice(0, max)}…`;
}

/**
 * @param {{
 *   newsletterData: object | null,
 *   password: string,
 *   onIssueUpdated: (data: object) => void,
 *   getSectionColor: (heading: string) => string,
 *   Button: import('react').ComponentType<any>,
 *   V: Record<string, string>,
 *   storageKey: string,
 * }} props
 */
export default function AdminReviewStructure({
  newsletterData,
  password,
  onIssueUpdated,
  getSectionColor,
  Button,
  V,
  storageKey,
}) {
  const [draft, setDraft] = useState(null);
  const [saveStatus, setSaveStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (newsletterData) {
      try {
        setDraft(structuredClone(newsletterData));
      } catch {
        setDraft(JSON.parse(JSON.stringify(newsletterData)));
      }
    } else {
      setDraft(null);
    }
  }, [newsletterData]);

  if (!draft?.sections?.length) {
    return (
      <div
        style={{
          maxWidth: 560,
          margin: "48px auto",
          padding: 24,
          background: V.card,
          border: `2px solid ${V.border}`,
          borderRadius: 8,
          color: V.muted,
          fontFamily: V.fontBody,
          fontSize: 14,
          textAlign: "center",
        }}
      >
        No issue loaded yet. Upload and publish a newsletter first, then return here to fix how items are split.
      </div>
    );
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setSaveStatus("");
    try {
      const response = await fetch("/api/save-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, data: draft }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveStatus(`Could not save: ${body.error || response.status}`);
        setSaving(false);
        return;
      }
      const saved = body.data || draft;
      try {
        localStorage.setItem(storageKey, JSON.stringify(saved));
      } catch (_) {}
      setDraft(saved);
      onIssueUpdated?.(saved);
      setSaveStatus("✓ Saved. All visitors now see this structure.");
    } catch (e) {
      setSaveStatus(`Could not save: ${e.message}`);
    }
    setSaving(false);
  }

  function applyDraft(next) {
    setDraft(next);
    setSaveStatus("");
  }

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 16px 48px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: V.fontDisplay, color: V.ink }}>Review issue structure</div>
          <div style={{ fontSize: 13, color: V.muted, marginTop: 4, maxWidth: 520 }}>
            Merge items that were split incorrectly, or split an item that was merged with the next story. Changes are not public until you save.
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save structure for everyone"}
        </Button>
      </div>

      {saveStatus && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontFamily: V.fontBody,
            background: saveStatus.startsWith("✓") ? V.greenTint15 : saveStatus ? "#fef2f2" : V.border,
            color: saveStatus.startsWith("✓") ? V.green : saveStatus ? V.clay : V.ink,
            border: `2px solid ${saveStatus.startsWith("✓") ? V.green : V.border}`,
          }}
        >
          {saveStatus}
        </div>
      )}

      {draft.sections.map((section, sIdx) => {
        const sectionColor = getSectionColor(section.heading);
        return (
          <section key={section.id || sIdx} style={{ marginBottom: 28 }}>
            <div
              style={{
                fontFamily: V.fontDisplay,
                fontWeight: 800,
                fontSize: 15,
                color: sectionColor,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                marginBottom: 12,
                paddingBottom: 6,
                borderBottom: `2px solid ${sectionColor}33`,
              }}
            >
              {section.heading}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(section.items || []).map((item, iIdx) => {
                const blocks = getBodyHtmlBlocks(item.bodyHtml);
                const splits = splitPointCount(item.bodyHtml);
                const canSplit = splits > 0;
                return (
                  <div
                    key={item.id || `${sIdx}-${iIdx}`}
                    style={{
                      border: `2px solid ${V.border}`,
                      borderRadius: 8,
                      background: V.inputBg,
                      boxShadow: V.cardShadow,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${V.border}`, background: V.card }}>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={iIdx === 0}
                        onClick={() => applyDraft(mergeItemWithPrevious(draft, sIdx, iIdx))}
                        style={{ fontSize: 11, padding: "6px 10px" }}
                      >
                        Merge with previous
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={iIdx >= (section.items?.length || 0) - 1}
                        onClick={() => applyDraft(mergeItemWithNext(draft, sIdx, iIdx))}
                        style={{ fontSize: 11, padding: "6px 10px" }}
                      >
                        Merge with next
                      </Button>
                      <div style={{ flex: "1 1 120px" }} />
                      {canSplit ? (
                        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: V.muted, fontFamily: V.fontBody }}>
                          <span>Split after block:</span>
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "") return;
                              const afterIdx = parseInt(v, 10);
                              applyDraft(splitItemInSection(draft, sIdx, iIdx, afterIdx));
                              e.target.value = "";
                            }}
                            style={{
                              padding: "6px 8px",
                              borderRadius: 6,
                              border: `2px solid ${V.border}`,
                              fontFamily: V.fontBody,
                              fontSize: 12,
                              background: V.inputBg,
                            }}
                          >
                            <option value="">Choose…</option>
                            {Array.from({ length: splits }, (_, k) => (
                              <option key={k} value={k}>
                                After block {k + 1} ({k + 1} / {blocks.length})
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <span style={{ fontSize: 11, color: V.muted, alignSelf: "center" }}>
                          {blocks.length <= 1 ? "Single block — cannot split" : "Cannot split"}
                        </span>
                      )}
                    </div>
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, color: V.muted, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
                        Preview (read-only)
                      </div>
                      <div style={{ fontSize: 12, color: V.ink, fontFamily: V.fontBody, marginBottom: 8, lineHeight: 1.5 }}>
                        <strong>ID:</strong>{" "}
                        <code style={{ fontSize: 11 }}>{item.id}</code>
                        {" · "}
                        <strong>Blocks:</strong> {blocks.length}
                      </div>
                      <div style={{ fontSize: 13, color: V.muted, fontFamily: V.fontBody, marginBottom: 10 }}>{previewSnippet(item.text)}</div>
                      {item.bodyHtml ? (
                        <div
                          className="nl-item-body nl-review-body"
                          style={{
                            fontSize: 13,
                            lineHeight: 1.6,
                            color: V.ink,
                            maxHeight: 220,
                            overflow: "auto",
                            border: `1px dashed ${V.border}`,
                            borderRadius: 6,
                            padding: 10,
                            background: V.card,
                            ["--nl-accent"]: sectionColor,
                          }}
                          dangerouslySetInnerHTML={{ __html: repairLegacyAmpDoubling(item.bodyHtml) }}
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
