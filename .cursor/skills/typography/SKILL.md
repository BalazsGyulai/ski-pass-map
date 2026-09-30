---
name: typography
description: Typography and grouping rules for Skimap.eu, using the type and spacing tokens in src/app/globals.css. Use whenever a change sets font size, weight, line height, letter spacing, line length, margins, gaps, or padding around text, labels, prices, headings, lists, cards, forms, or sheets, or when related content looks evenly spaced and the groups are unclear.
---

# Typography

The type and the gaps are one system. A visitor should see which words belong together before they read them. The source of truth is the tokens in `src/app/globals.css` and `DESIGN.md`. When this file and the CSS disagree, fix whichever is wrong in the same change.

Sources: [WCAG 1.4.12 Text Spacing](https://www.w3.org/WAI/WCAG21/Understanding/text-spacing.html) (the layout must survive a reader's override; it does not require these values as the design), [MDN `line-height`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/line-height) (unitless numbers), [web.dev typography](https://web.dev/learn/design/typography) and Every Layout (measure in `ch`), and the proximity rule: the gap inside a group is smaller than the gap between groups.

## The set

One family: Inter, loaded in `DocumentShell.tsx`. Do not add a second font.

| Role | Token | Size | Use |
| --- | --- | --- | --- |
| Caption | `--text-xs` | 12px | Disclaimer, source line, chip meta. Nothing a visitor must read goes smaller |
| Secondary | `--text-sm` | 13px | Hints, "where this pass works" |
| Body | `--text-md` | 15px | Paragraphs, resort names in a list, default UI text |
| Title | `--text-lg` | 17px | Sheet heading, brand, a short name on a card |
| Card title | `--text-xl` | 20px | Pass name on a pass card |
| Name | `--text-2xl` | 26px | The open resort's name |
| Page title | `--text-3xl` | 34px | A page heading, once |

Weight: 400 body, 500 labels, 600 names and short titles, 700 page and sheet headings. Do not invent 650.

Tracking: `--tracking-tight` (`-0.022em`) on `h1`–`h3` only. `--tracking-caps` (`0.06em`) with uppercase only on an eyebrow (a group label such as a settings heading). Body text is not tracked. Prices, elevations, and kilometres use tabular figures (`.num`, `.price-lg`).

A few older rules use raw sizes (11px eyebrows, 14px hints, 16px settings labels, 19px facts). New text uses the table. Do not copy the raw sizes.

## Line height and line length

- Multi-line text uses a unitless `line-height`, so it scales with the size. Body and captions: 1.45 (already on `body`). A paragraph of prose may use 1.5. A heading that can wrap: 1.1–1.2. A price or a one-line title: 1.1–1.25.
- Do not set `line-height` in `em` or `px` on text that can wrap. A fixed pixel line height is only for a control that is always one line (the sheet's `h2` is 24px).
- Prose wraps by 60–65 characters: `max-width: 60ch` (`.lede` already does). UI labels and hints stay shorter, about 35–50 characters, which the phone column already forces. A line of body text wider than 75 characters is too long; raise the line height toward 1.6 or narrow the column. Do not justify.
- `text-wrap: balance` stays on headings, `pretty` on paragraphs.

## Grouping

Space comes only from `--space-1` … `--space-7` (4, 8, 12, 16, 24, 32, 48). Use `gap` on the parent. Margin, when needed, is `margin-bottom` only, so two margins never add. The gap inside a group is always smaller than the gap that separates that group from the next.

| How the pieces relate | Gap | On this site |
| --- | --- | --- |
| One unit: icon and its word, a price and its unit, a label and the hint under it | `--space-1` (4px), or 2px when the two lines are one label | `.settings-row-copy` is 2px between the label and its hint |
| A title and the line that explains it | `--space-1` or `--space-2` | `.page-head h1` sits 6px above `.lede`; a resort name sits on its region |
| Peers in one group: rows, facts, chips in a card | `--space-2` or `--space-3` | `.fact-grid` is 8px; a settings row is padded `--space-3` `--space-4` and divided by a hairline, not by a big gap |
| Between groups | `--space-4` or `--space-5` | `.settings-page` separates groups by `--space-5` (24px). The group title sits `--space-2` (8px) above its card, so the title belongs to the card |
| Between page regions | `--space-6` or `--space-7` | A new section on a long page (about, passes), not inside a sheet or a pill |

Checks before finishing:

- A heading is closer to the content it introduces than to the block above it. Equal space above and below a heading leaves it floating.
- Padding inside a card is at least as large as the gaps inside it. Settings cards do this: 12–16px padding, 2px between label and hint.
- Repeated peers share one rhythm. Do not give the first row a different gap unless it is a title.
- A label sits on its field (`--space-1`). The next field is a group away (`--space-4` or `--space-5`). An error sits on the field it describes (`--space-1`), not in the gap before the next field.
- Map chrome stays tight. A sheet, a pill, and a chip use the first two rows of the table. Do not pad them like a marketing page.
- Do not separate groups with a border alone. The gap has to change too. A hairline between rows is for peers inside one card.

## What must not clip

WCAG 1.4.12 (AA): if a reader sets line height to 1.5, space after a paragraph to 2× the font size, letter spacing to 0.12em, and word spacing to 0.16em, nothing is cut off and no control stops working. So:

- No fixed height on a box that holds wrapping text. `min-height` is fine (buttons are already 44px).
- A one-line pill may ellipsis a resort name. It must not ellipsis a price, a pass name on a button, or a heading. German and Finnish run long; test `de` at 390px (`DESIGN.md`).
- Leave about 20% spare in a control whose width is fixed and whose label must stay on one line, or let it wrap.

## Colour of text

`--ink` for primary, `--ink-2` for secondary, `--ink-3` for captions. `--ink-3` is the lightest text allowed (it clears 4.5:1 on `--bg`). `--line*` and `--no-pass` are not text colours. A status uses its text and background pair plus words.
