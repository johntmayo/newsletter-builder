# Newsletter Builder — Handoff Overview

This document is for anyone taking over engineering, operations, or admin training for the **Altagether Neighborhood Captain Newsletter Builder**. It summarizes what the app does, how it is built, and the main product and technical decisions embedded in the codebase.

---

## What this app is for

Volunteer **neighborhood captains** use the site to build a **zone-specific** version of a master newsletter: they configure a header, optionally add local updates, pick which stories from the master issue to include, then preview, print to PDF, or copy HTML for email.

An **admin** uploads the master issue (MailerLite HTML export), **parses** it into a private draft, **reviews structure** (merge/split/hide items), then **publishes** so **every visitor** loads that issue from shared storage—without retraining MailerLite authors.

---

## User modes

| Mode | Who | Purpose |
|------|-----|--------|
| **Build Newsletter** (captain) | Zone captains | Configure → select content → preview / print / copy for email |
| **Admin** | Trusted publisher | Password-protected: upload → **parse** (draft) → **Review structure** → **Publish** to shared storage; can also fix structure on the already-live issue |

The captain and admin experiences live on the same Next.js page (`pages/index.js`); mode is toggled in the header.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | **Next.js 14** (Pages Router) |
| UI | **React 18**, inline styles + `styles/globals.css` design tokens |
| HTML parsing | **node-html-parser** (`lib/parseNewsletterHtml.js`, `lib/sanitizeMailerLiteHtml.js`) |
| Shared “current issue” | **Supabase** (Postgres JSON row) via **@supabase/supabase-js** |
| Hosting | **Vercel** (typical setup: GitHub → deploy) |
| Legacy / standalone | `newsletter-builder.jsx` — older single-file copy; **production path is the Next app** |

---

## Repository layout (important files)

```
pages/
  index.js              — Main UI: captain flow, admin, preview, print
  api/
    parse.js            — POST: raw MailerLite HTML → parsed JSON
    current-issue.js    — GET: published issue from Supabase
    verify-admin.js     — POST: check admin password
    publish-newsletter.js — POST: write parsed issue to Supabase when admin explicitly publishes (admin password)
    save-issue.js       — POST: save issue after structure edits (admin password)
lib/
  parseNewsletterHtml.js   — Section/item extraction from HTML
  sanitizeMailerLiteHtml.js — HTML cleanup for display / email
  issueStructure.js        — Merge / split / hide item helpers + renumber IDs
  supabaseAdmin.js         — Server Supabase client (service role)
  newsletterAdminAuth.js — Admin password check (env + dev fallback)
components/
  AdminReviewStructure.js — Admin “Review structure” tab UI (live issue vs unpublished draft modes)
supabase-newsletter-current.sql — DDL for Supabase (run once)
env.example             — Environment variable names (copy to `.env.local`)
```

---

## Environment variables

Set on **Vercel** (Production / Preview as needed) and in **`.env.local`** for local dev. See `env.example`.

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Full DB access; never expose to the browser |
| `NEWSLETTER_ADMIN_PASSWORD` | Must match what admins type in the Admin tab. If unset, code falls back to a default (change this in production) |

**Supabase keys:** The dashboard may show “new” (`sb_secret_…`) vs “legacy” JWT keys; either elevated secret can work with the client during Supabase’s transition. Project URL is under **General** or the Connect dialog, not always on the API Keys page.

---

## Data: where the “current issue” lives

1. **Supabase table** `newsletter_current` (singleton row `id = 1`)  
   - Column **`payload`**: JSON — full parsed newsletter object (`title`, `date`, `sections[]`, each with `items[]`, etc.).  
   - Created by running `supabase-newsletter-current.sql` in the Supabase SQL Editor.

2. **Browser `localStorage`** key `altagether_newsletter_data`  
   - Cache / offline-ish behavior: on load, the app fetches `/api/current-issue`; if that fails or returns empty, it may fall back to localStorage.  
   - Updated when a **published** issue is loaded from the API or after a successful **Publish for all visitors** — not when an admin only parses a draft.

3. **Unpublished admin draft** (in-memory only)  
   - After **Parse newsletter**, the parsed JSON lives in React state until **Publish** or **Discard draft**. Captains and `/api/current-issue` keep showing the **previous live** issue until publish.

4. **Captain config** (name, zone, captains, zone links, header image, custom entries, selections)  
   - **Not** persisted to the server today — lives in React state for the session only.

---

## API routes (summary)

| Route | Method | Auth | Behavior |
|-------|--------|------|----------|
| `/api/parse` | POST | None | Body `{ html }` → parsed JSON (used on upload) |
| `/api/current-issue` | GET | None | Reads `newsletter_current` via service role |
| `/api/verify-admin` | POST | Body password | Validates `NEWSLETTER_ADMIN_PASSWORD` |
| `/api/publish-newsletter` | POST | Body password | Body `{ parsed }` — upserts that JSON to Supabase when admin clicks **Publish for all visitors** |
| `/api/save-issue` | POST | Body password | Upserts full issue JSON (e.g. after structure edits); sets `_structureEditedAt` |

All Supabase writes use the **service role** only inside these routes.

---

## Parsing model (why MailerLite HTML is fragile)

The parser (`lib/parseNewsletterHtml.js`) targets **MailerLite-style** exports:

- **Orange `#d35400` `h2`** = section headings (Recovery Updates, Events, …).
- Items are inferred from block structure: runs of `p` / `h3` / `h4` followed by a `ul`/`ol` are often **merged into one item** (title + body + list). That helps normal events but can **merge two stories** if the HTML has no structural break before a shared list.

**Product decision:** Rather than endless parser tweaks, **Admin → Review structure** lets a human merge/split items and **hide** junk cards (e.g. blank spacers). Hidden items use `_adminHidden: true` and are **omitted** from the captain picker and from built preview/email content.

---

## Captain flow (high level)

1. **Configure** — Newsletter name, tagline, zone, one or more **Captain / How to contact** rows (+ add captain), optional zone links (websites/social — **shown in output with no label**), optional header image.  
2. **Select content** — By section; toggles selection by item `id`. Items with `_adminHidden` are hidden.  
3. **Preview & print** — Composes header, optional zone-specific updates block (**one** section title: `{zone} Updates` or fallback), then selected master items. **Print** uses `#print-root` and injected print CSS so the header stays legible when backgrounds are not printed (dark text on white in `@media print`).

**Copy for email** builds multipart HTML + plain text with the same structural choices as preview.

---

## Admin flow (high level)

1. **Sign in** — Password on the Admin tab (`/api/verify-admin`). Session is only in UI state until refresh.

2. **Upload issue** — Select MailerLite HTML → **Parse newsletter** (`/api/parse`). This creates an **unpublished draft** in the browser. The app switches to **Review structure**; **captains still see the previous live issue** until you publish.

3. **Review structure** (new edition) — While a draft exists, merge/split/hide updates stay in draft state. **Save structure (draft)** confirms locally and reminds you to publish; it does **not** call `/api/save-issue`. Structural changes sync to the draft immediately so **Publish** sends the latest structure.

4. **Publish** — On **Upload issue**, **Publish for all visitors** (`/api/publish-newsletter`) writes the draft to Supabase and refreshes client cache (`localStorage`). **Discard draft** drops the draft without changing the live issue.

5. **Review structure** (already-live issue) — When there is **no** unpublished draft, this tab edits what everyone sees. **Save structure for everyone** → `/api/save-issue` (same as before).

Tabs stay mounted when switching so in-progress edits on the review UI are not lost.

**Debug:** Append `?debug=1` to the site URL to show item IDs in the review UI.

---

## Security notes (short)

- **Never** put `SUPABASE_SERVICE_ROLE_KEY` in client code or public env vars prefixed with `NEXT_PUBLIC_`.  
- Set a strong **`NEWSLETTER_ADMIN_PASSWORD`** on Vercel; do not rely on the code fallback.  
- Admin password is sent over HTTPS to the server for verify/publish/save — standard pattern; rotate password if leaked.

---

## Design / UX decisions (record)

- **Shared issue via Supabase** so any captain gets the latest edition without Git or per-browser uploads.  
- **Parse → review → publish** so structure can be fixed **before** a new edition replaces the live issue for all visitors.  
- **Structure editor** preferred over perfect MailerLite markup discipline for volunteers.  
- **Zone updates** use a **single** auto section title (`{zone} Updates`) with per-entry optional **title line** + body; avoids multiple fake “section” headings in preview/PDF/email.  
- **Captain contact** is **multiple rows** (name + how to contact), rendered as reader-facing lines like `Name — contact` in the header band.  
- **Print/PDF:** Header band gets print-specific overrides so tagline and meta are not illegible light gray when backgrounds don’t print.

---

## Local development

```bash
npm install
cp env.example .env.local   # fill in values
npm run dev
```

Open `http://localhost:3000`. Without Supabase configured, publish/save will fail; fetch current issue may 503 — localStorage can still hold a parsed issue for UI testing.

```bash
npm run build
```

Use before shipping to confirm production compile.

---

## Deployment checklist (for a new maintainer)

1. Supabase project created; **`supabase-newsletter-current.sql`** executed.  
2. Vercel env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEWSLETTER_ADMIN_PASSWORD`.  
3. Redeploy after env changes.  
4. Smoke test: admin parse → review (optional) → publish → incognito captain sees new issue; separate check: structure save on live issue → captain refresh sees update.  
5. Document the admin password location for your org (password manager / handoff), **not** in Git.

---

## Known gaps / follow-ups

- **`newsletter-builder.jsx`** is not kept in sync with `pages/index.js` (older captain-only flow). Prefer the Next app for all work.  
- Captain **configuration and selections** are not persisted server-side; refreshing loses work (by design unless you add persistence later).  
- Parser will never be perfect for all MailerLite variants; keep **Review structure** as the escape hatch.

---

## Who to contact (non-technical)

Product / org contacts (fill in for your handoff):

- **Newsletter questions:** newsletter@altagether.org (referenced in app footer copy)  
- **Supabase / Vercel access:** _[list accounts / owners]_

---

*Last aligned with the codebase April 2026 (parse → review → publish admin flow); update this file when behavior or env requirements change.*
