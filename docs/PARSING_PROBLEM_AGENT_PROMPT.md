# Agent brief: Fix MailerLite HTML segmentation (Newsletter Builder)

**Give this entire document to an engineering agent.** Your job is not only to understand the situation—you are asked to **implement a solution** (or a concrete, justified phased plan with code if scope is large).

---

## Your mission

**Solve unreliable splitting of the master newsletter into selectable items.** Today, MailerLite exports often cram many logical “offerings” into **one `<p>`** separated only by `<br><br>`. Our parser follows block-level DOM structure, so those offerings arrive as **a single parsed item** or with **wrong boundaries**. That pushes tedious work onto **Admin → Review structure** (manual merge/split).

You must **reduce that failure mode** by changing **this repository**: parsing, HTML preprocessing/normalization, heuristics, and/or targeted admin UX—**without** assuming MailerLite authors or templates will change.

---

## Product context (read once)

| Step | System |
|------|--------|
| Editors build the newsletter | **MailerLite** |
| Operator exports **HTML** from MailerLite | (we do not control markup) |
| Operator uploads HTML here | **Newsletter Builder** (this Next.js app) |
| Structure is corrected, issue published | Admin **Review structure** → publish |
| Captains pick which items to include | Same app; **nothing is sent back to MailerLite** |

MailerLite is **upstream only**. Fixes belong **here**.

---

## What “solved” looks like (acceptance criteria)

Deliver changes that measurably improve segmentation. At minimum, articulate and verify:

1. **Representative fixtures:** Use real or anonymized MailerLite HTML snippets where **one `<p>` previously produced one oversized item**—after your change, those segments should become **multiple distinct items** when that matches editorial intent, **or** document precisely why a subset must stay merged.

2. **No regressions:** Existing parsed issues still load; **`/api/parse`** output remains compatible with publish, captain selection, and **`issueStructure.js`** (merge/split/hide, IDs). **`sanitizeMailerLiteHtml.js`** and preview/email output must not break.

3. **Explicit testing:** Add or extend automated tests (or a repeatable script + documented manual checklist if tests are impractical) so future edits don’t silently re-merge paragraphs.

4. **Honest limits:** If perfect segmentation is impossible without ML, ship **best-effort parsing improvements** plus clear **in-app or code comments** on remaining edge cases—do **not** stop at description alone.

---

## Technical facts you must use

- **`<br><br>` inside one `<p>` does not create multiple DOM blocks.** More line breaks in the export do not fix segmentation unless **you** split or normalize markup (e.g. wrap fragments in block elements, split on heuristics, post-process serialized HTML).

- Subsection titles **inside** the same `<p>` as the prior story (e.g. bold line before a `<ul>`) are a **boundary bug** until the parser or a preprocessor **cuts** them apart.

- **`lib/parseNewsletterHtml.js`** is the primary extraction logic; **`pages/api/parse.js`** calls it. **`lib/issueStructure.js`** owns merge/split/hide semantics.

---

## Required implementation direction (pick one or combine)

You **must** ship **something** that advances segmentation—not documentation-only unless paired with a documented blocker and a smallest viable code change.

Reasonable approaches:

- **Pre-parse normalization:** Transform incoming HTML so intra-paragraph `<br><br>` boundaries become **separate block nodes** (or explicit markers the parser understands), with rules tuned for this newsletter’s patterns.

- **Parser upgrades:** Walk text/HTML inside large `<p>` nodes and emit multiple items when separators / link clusters / bold titles match reliable patterns.

- **Hybrid:** Normalize first, then simplify parser branches.

- **Admin UX (secondary):** Bulk actions or clearer warnings only **supplement** parsing—they do **not** replace fixing the default parse when automation is feasible.

---

## Files to touch first

| Area | Path |
|------|------|
| Parse MailerLite HTML → JSON | `lib/parseNewsletterHtml.js` |
| Sanitize for display/email | `lib/sanitizeMailerLiteHtml.js` |
| Merge / split / hide, renumber IDs | `lib/issueStructure.js` |
| Parse API | `pages/api/parse.js` |
| Admin structure UI | `components/AdminReviewStructure.js` |

Broader context: **`HANDOFF.md`** at repo root.

---

## Deliverables checklist

- [ ] Code (and tests or verification procedure) that **improve default item boundaries** for MailerLite-style dense `<p>` sections.
- [ ] Short note in PR or commit message: **what changed**, **how to validate**, **known remaining failures**.
- [ ] Update **`HANDOFF.md`** parsing section **only if** behavior or operator workflow materially changes.

---

*Problem framing aligned with Newsletter Builder maintainer handoff; revise this brief when parsing architecture changes.*
