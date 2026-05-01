# Agent brief: MailerLite parser status (Newsletter Builder)

**Current status:** the MailerLite parser is considered **functionally ship-ready and frozen** after a broad fixture/audit pass across the sample newsletters. Future agents should preserve this behavior by default.

Do **not** treat parser work as an open-ended task. Only change parsing when there is clear evidence of:

- dropped content,
- a recurring severe over-merge/split across real samples,
- a sanitizer/security issue,
- or a product request that explicitly accepts parser risk.

For ordinary edge cases, use **Admin → Review structure** (merge/split/hide) as the intended fallback.

---

## Product context

| Step | System |
|------|--------|
| Editors build the newsletter | **MailerLite** |
| Operator exports **HTML** from MailerLite | (we do not control markup) |
| Operator uploads HTML here | **Newsletter Builder** (this Next.js app) |
| Structure is corrected, issue published | Admin **Review structure** → publish |
| Captains pick which items to include | Same app; **nothing is sent back to MailerLite** |

MailerLite is upstream only. Fixes, when needed, belong in this repo.

---

## Parser behavior now covered

Primary logic lives in `lib/parseNewsletterHtml.js`; safe HTML serialization lives in `lib/sanitizeMailerLiteHtml.js`; manual structure edits live in `lib/issueStructure.js`.

Current parser coverage includes:

- Orange `#d35400` `h2` elements become newsletter sections.
- `p`, `h3`, `h4`, `ul`, and `ol` blocks are eligible item content.
- Dense MailerLite paragraphs split at two-or-more `<br>` separators.
- A narrow single-`<br>` split exists only when the left fragment looks like a complete sentence and the next fragment starts with a linked/bold lead-in.
- Normal `TITLE<br>description` cards remain merged.
- Consecutive lists after event-like text are merged into the same item.
- Empty list blocks are ignored so they do not force unrelated paragraph over-merges.
- When several unrelated paragraphs precede a real list, the list attaches only to the trailing heading-like run.
- Malformed/orphan nested lists are attached to the previous list item instead of being dropped.
- Leading/trailing MailerLite spacer `<br>` noise is trimmed without removing meaningful inline spaces.
- Existing output remains compatible with `/api/parse`, publish/save flows, captain selection, and Admin Review Structure.

Verification lives in `scripts/verify-parser-segmentation.mjs` and is run with:

```bash
npm run verify:parser
```

Also run:

```bash
npm run build
```

---

## Known limits

Perfect segmentation is not expected. Do not add fragile heuristics for one-off editorial ambiguity.

Known acceptable/manual cases:

- Large Links-directory cards with many links are expected.
- Multi-link survey or advocacy clusters may be editorially valid; split manually only when desired.
- Single-`<br>` cases without sentence-ending punctuation before the next linked/bold lead should usually remain manual cleanup.
- CTA patterns like `<a><strong>CTA</strong><br /></a>Body` can be intentional and should be preserved unless visibly broken.

If a future issue has 1-3 odd cards, prefer Review Structure over parser churn.

---

## Files to inspect first

| Area | Path |
|------|------|
| Parse MailerLite HTML → JSON | `lib/parseNewsletterHtml.js` |
| Sanitize for display/email | `lib/sanitizeMailerLiteHtml.js` |
| Parser verification fixtures | `scripts/verify-parser-segmentation.mjs` |
| Merge / split / hide, renumber IDs | `lib/issueStructure.js` |
| Admin structure UI | `components/AdminReviewStructure.js` |
| Parse API | `pages/api/parse.js` |

Broader context: `HANDOFF.md`.

---

## Future-change checklist

Before changing parser/sanitizer behavior:

- [ ] Confirm the failure is dropped content or recurring/severe across real samples.
- [ ] Add a focused fixture to `scripts/verify-parser-segmentation.mjs`.
- [ ] Preserve existing fixtures and `/api/parse` JSON shape.
- [ ] Run `npm run verify:parser`.
- [ ] Run `npm run build`.
- [ ] Update `HANDOFF.md` only if behavior or operator workflow materially changes.

*Last aligned after parser audit and freeze, May 2026.*
