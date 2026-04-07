# Altagether subpage style guide

This document describes the visual system used on **`nc-directory.html`**. It is meant to keep future subpages aligned with the same look and feel—especially the **header**—even when body layout differs.

## Where styles come from

| Source | Role |
|--------|------|
| **Embedded `<style>` in the HTML file** | All layout, components, and design tokens (`:root` CSS variables). There is **no** separate project stylesheet linked from this page. |
| **Google Fonts** | Loads **Chivo** and **Merriweather** (see Typefaces). Linked with `preconnect` to `fonts.googleapis.com` and `fonts.gstatic.com`. |
| **Assets** | Favicon: `public/images/favicon.ico`. Header logo: `public/images/logo_white_transparent.png`. |

If you replicate the system elsewhere, either copy the `:root` variables and key rules, or extract them into a shared CSS file—behavior should match this page.

---

## Typefaces

- **Body and long-form UI** — **Merriweather**, serif. Used for `html`/`body`, form controls (inputs, selects, chips), accordion copy, table body, buttons that are “tool” style (view toggle, export), and most secondary labels.
- **Headings and brand-forward labels** — **Chivo**, sans-serif, **700** by default for `h1`, `h2`, `h3`, `.nav-item`, `.btn`. Card titles and table headers also use Chivo 700.
- **Extra weight** — Chivo **800** appears on small section titles inside filter groups (tight, uppercase-adjacent hierarchy). Chivo **400** and **900** are included in the Google Fonts URL for flexibility; the page primarily uses **700** and **800**.

**Font loading URL (reference):**

`https://fonts.googleapis.com/css2?family=Chivo:wght@400;700;900&family=Merriweather:wght@400;700&display=swap`

---

## Font treatments

- **Hierarchy**: Chivo for titles and structural headings; Merriweather for reading and controls. Keeps the page feeling editorial but navigable.
- **Sizes (approximate scale)** — relative to root `rem`:
  - Page title in header: **1.5rem** (Chivo 700).
  - Card / modal titles: **1.15rem** (Chivo 700).
  - Primary body and intro copy: **0.95rem** with **line-height 1.6** where readability matters (intro blurb, instructions).
  - Standard UI (filters, accordion, many labels): **0.9rem**.
  - Small meta (tags, some labels): **0.8rem–0.85rem**.
  - Micro labels (e.g. interest group caps): **~0.76rem**, **uppercase**, **letter-spacing 0.05em**, weight **700**.
- **Emphasis**: `<strong>` in the gold intro callout uses **brand primary dark** for contrast. Inline links in body copy: **Merriweather**, **underline**, **accent green**, **700**.
- **Italic**: Used for a specific secondary line type (notes-style bio) to differentiate tone.
- **Letter-spacing**: Slight positive tracking on small Chivo titles (`0.02em`) and uppercase labels (`0.05em`) for clarity at small sizes.

---

## Colors

### Core tokens (`:root`)

| Token | Hex | Typical use |
|-------|-----|----------------|
| `--bg-paper` | `#FDFBF7` | Page background (warm off-white). |
| `--bg-card` | `#FFFFFF` | Cards, modals, inputs on white. |
| `--brand-primary-dark` | `#314059` | Header background, card titles, table headers, strong text in callouts. |
| `--text-primary` | `#1F2937` | Default body text. |
| `--text-secondary` | `#4B5563` | Supporting text, labels, muted UI. |
| `--accent-gold` | `#F59E0B` | Highlights: intro blurb border, active filter chip, active view-toggle segment. |
| `--accent-clay` | `#BC5838` | Error / alert text tone. |
| `--accent-green` | `#283618` | Primary link and button accent (links, export outline, filled primary modal action). |
| `--border-color` | `#E5E7EB` | Default borders, card outlines, dividers. |

### Supporting neutrals (used directly in CSS)

- **Table striping / hovers**: `#F9FAFB`, `#F3F4F6`.
- **Accordion / subtle panels**: `#F9FAFB` hover on accordion header; modal filter summary background `#F9FAFB`.
- **Interest filter group panels**: background `#FCFBF8`, border `#ECE7DD`.
- **Tag pill (default)**: background `#EEF2FF`, text `--brand-primary-dark`.
- **“Badge” tag base**: `#FEF3C7` / `#92400E`.
- **Modal overlay**: `rgba(0,0,0,0.4)`.

### Badge gradients (decorative; match if you reuse badges)

Special tags use **135deg** linear gradients, **700** weight, **0.85rem**, light **box-shadow**, and a **prefix glyph** (`::before`):

- **1-year**: yellows → text `#78350F`, star prefix.
- **Chair**: blues → text `#1E3A8A`, diamond prefix.
- **Newsletter**: greens → text `#065F46`, envelope prefix.
- **Dena Native**: earth tones → text `#3D3529`, subtle border `rgba(61,53,41,0.15)`, spark prefix.

### Intro callout (privacy / important note)

- **Background**: gold gradient `#FEF3C7` → `#FDE68A` → `#FEF9E7` at **135deg**.
- **Border**: **2px** `var(--accent-gold)`.
- **Text**: `var(--text-primary)`; **strong** pulls **brand primary dark**.

---

## Spacing, layout, and hierarchy

- **Global**: `box-sizing: border-box` on all elements.
- **Header** (intended to stay consistent across subpages):
  - Full-width bar: **`--brand-primary-dark`** background, **white** text.
  - **Padding**: `1rem 1.5rem`; **flex** row, **align center**, **gap 1rem**.
  - **Bottom accent**: **3px solid** `--text-primary` (strong separation from content).
  - **Logo**: **40px** height; sits beside the **h1**.
  - **Title**: Chivo **700**, **1.5rem**, no extra margin.
- **Main column**: `.container` — **max-width 1200px**, centered, **padding 1.5rem** (1rem on small screens).
- **Content width for prose**: Intro blocks cap at **~48rem** (`max-width: 48rem`) so line length stays comfortable.
- **Vertical rhythm**: Section tools use **1rem–1.5rem** gaps; card grid **gap 1rem**; filter rows **0.75rem** gaps.
- **Card grid**: `repeat(auto-fill, minmax(320px, 1fr))` — responsive cards without a rigid breakpoint; collapses to one column under **640px**.
- **“Chunky” UI feel**: Cards use **2px** borders, **8px** radius, and a **hard offset shadow** `4px 4px 0 var(--border-color)` (paper/craft tone, not soft blur).
- **Form controls**: **2px** borders, **4px** radius; inputs **0.6rem × 1rem** padding; selects slightly tighter.

---

## Components and interaction patterns

- **Links**: In running copy — **accent green**, **underline**, **700**; hover **opacity 0.85**. In cards, email links lose underline until hover (cleaner scan).
- **Buttons / toggles**: View toggle is a **segmented control** (shared border, no gap); **active** segment uses **accent gold** fill with primary text color. Export is **outline** accent green, inverts on hover (green fill, white text).
- **Filter chips**: White card background + border; **active** = gold background, dark border, primary text.
- **Accordion**: **2px** border, **4px** radius; header **Merriweather 600**; chevron via `::after` with **0.2s** rotation when open; body **max-height** transition.
- **Tables**: Header row matches **header bar** colors (dark blue, white Chivo). Zebra **even** rows; row hover slightly darker.
- **Modal**: White card, **8px** radius, **2px** border, soft drop shadow; primary action **filled accent green**; secondary **outline brand dark** with hover invert.

---

## Responsive behavior

- **Breakpoint**: `max-width: 640px`.
- Adjustments: Narrower container padding; toolbar and filters **stack**; card grid **single column**; interest filter grid **one column**; some chip rows stack; copy-email control stays visible (opacity 1).

---

## What a designer should carry forward

1. **Two-type pairing**: Chivo (structure, brand) + Merriweather (warm, readable body).
2. **Warm paper page** (`#FDFBF7`) with **crisp white** surfaces for content blocks—not a flat gray app shell.
3. **Navy header + 3px dark rule** under it as the primary brand frame; white wordmark lockup at **40px** logo height.
4. **Accent discipline**: Gold for “selected / important highlight”; deep green for **actions and links**; clay reserved for **errors**.
5. **Tactile surfaces**: Prefer **2px** borders, **small radii (4–8px)**, and the **offset card shadow** over heavy blur shadows for list/card content.
6. **Accessibility**: Maintain contrast on gold active states (text stays `--text-primary`); keep link underline in dense instructional copy.

This guide reflects **`nc-directory.html` as authored**; if shared tokens drift in another file, treat this page’s embedded variables and rules as the reference implementation.
