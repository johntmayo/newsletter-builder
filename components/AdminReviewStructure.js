import { useState, useEffect } from "react";
import { repairLegacyAmpDoubling } from "../lib/sanitizeMailerLiteHtml";
import {
  getBodyHtmlBlocks,
  mergeItemWithNext,
  mergeItemWithPrevious,
  splitItemInSection,
  splitPointCount,
  toggleItemHidden,
} from "../lib/issueStructure";

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
  const [showDebugIds, setShowDebugIds] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setShowDebugIds(new URLSearchParams(window.location.search).get("debug") === "1");
  }, []);

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
          <section key={section.id || sIdx} style={{ marginBottom: 32 }}>
            <div
              style={{
                fontFamily: V.fontDisplay,
                fontWeight: 800,
                fontSize: 20,
                color: sectionColor,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                marginBottom: 14,
                paddingBottom: 8,
                borderBottom: `3px solid ${sectionColor}44`,
              }}
            >
              {section.heading}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(section.items || []).map((item, iIdx) => {
                const blocks = getBodyHtmlBlocks(item.bodyHtml);
                const splits = splitPointCount(item.bodyHtml);
                const canSplit = splits > 0;
                const hidden = Boolean(item._adminHidden);
                return (
                  <div
                    key={item.id || `${sIdx}-${iIdx}`}
                    style={{
                      border: `2px solid ${hidden ? `${V.muted}66` : V.border}`,
                      borderRadius: 8,
                      background: hidden ? "rgba(148, 163, 184, 0.12)" : V.inputBg,
                      boxShadow: hidden ? "none" : V.cardShadow,
                      overflow: "hidden",
                      opacity: hidden ? 0.72 : 1,
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 12px", borderBottom: `1px solid ${V.border}`, background: hidden ? "rgba(148, 163, 184, 0.08)" : V.card }}>
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
                      {hidden ? (
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => applyDraft(toggleItemHidden(draft, sIdx, iIdx))}
                          style={{ fontSize: 11, padding: "6px 10px" }}
                        >
                          Restore card
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => applyDraft(toggleItemHidden(draft, sIdx, iIdx))}
                          style={{ fontSize: 11, padding: "6px 10px", borderColor: V.muted, color: V.muted }}
                        >
                          Hide card
                        </Button>
                      )}
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
                      <div style={{ fontSize: 12, color: V.muted, fontFamily: V.fontBody, marginBottom: 10, lineHeight: 1.5 }}>
                        <strong style={{ color: V.ink }}>Blocks:</strong> {blocks.length}
                        {showDebugIds ? (
                          <>
                            {" "}
                            · <code style={{ fontSize: 11, color: V.muted }}>{item.id}</code>
                          </>
                        ) : null}
                      </div>
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
