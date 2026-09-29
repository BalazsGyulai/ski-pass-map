# Design guide: Skimap.eu

How the site looks and behaves, for anyone (person or agent) changing the UI. `AGENTS.md` sends you here for any change to layout, styling, components, or text on screen. The source of truth is `src/app/globals.css`; when this file and the CSS disagree, fix whichever is wrong in the same change.

## What the design is for

A visitor wants to answer one question fast: which pass covers the resorts I care about, and what does it cost me? Everything else serves that.

- **The map is the page.** Controls float on it as glass panels and pills. Nothing covers more of the map than the task needs.
- **Calm neutrals, colour as data.** The interface is ink on grey-white (or light on navy in dark mode). Pass colours from `config/pass-colors.json` appear only as data: dots, stripes, chips. Never use a pass colour for a button, a heading, or decoration.
- **Numbers are the content.** Prices, elevations, and kilometres use tabular figures (`.num`, `.price-lg`) so columns line up. A missing number is hidden, never shown as 0 or a dash that looks like a value.
- **Plain words.** Short labels that say what happens. See "Text and languages" in `AGENTS.md`.

## Tokens

Use the custom properties on `:root`. Never write a raw hex colour, pixel shadow, or duration in a component rule. If you need a value that has no token, add the token (light and both dark blocks) instead of a one-off.

| Group | Tokens | Rule |
| --- | --- | --- |
| Spacing | `--space-1` … `--space-7` (4, 8, 12, 16, 24, 32, 48 px) | Stay on the scale. Gaps inside a control use 1–3, between groups 4–6 |
| Corners | `--radius-xs` … `--radius-lg`, `--radius-pill` | Pills and chips are `--radius-pill`; cards and sheets `--radius-md` / `--radius-lg` |
| Type | `--text-xs` (12) … `--text-3xl` (34), Inter via `next/font` | Body text is `--text-md` (15). Nothing a visitor must read goes below `--text-xs` |
| Colour | `--ink`, `--ink-2`, `--ink-3`, `--surface*`, `--bg`, `--line*`, status pairs (`--save`/`--save-bg`, `--warn`, `--danger`, `--amber-*`), `--heart` | Status colour always comes as a text + background pair, and always with words; colour alone never carries meaning. `--heart` is the filled save icon |
| Glass | `--glass`, `--glass-strong`, `--glass-edge`, `--glass-blur` | Only for surfaces that float over the map |
| Elevation | `--shadow-1`, `-2`, `-3`, `-float`, `-chip` | Chips use `--shadow-chip`: their row clips anything larger |
| Motion | `--ease-out`, `--ease-sheet`, `--ease-in-out`, `--dur-fast` (140), `--dur` (220), `--dur-slow` (360 ms) | See Motion below |

Dark mode is defined twice: under `@media (prefers-color-scheme: dark)` for `:root:not([data-theme="light"])`, and under `:root[data-theme="dark"]`. A new colour token goes into `:root` **and both** dark blocks.

## Layout

| | Phone (below 900 px) | Desktop (900 px and up) |
| --- | --- | --- |
| Lists and cards | Bottom sheet over the map, snaps `shut` (handle) / `bar` (name) / `peek` / `half` / `full` (`src/lib/sheet.ts`, `useBottomSheet.ts`) | Side panel floating on the map's left edge; the map keeps `--panel-space` as camera padding |
| Navigation | `BottomTabBar` (`--tab-bar-height`) and `MobileTopBar` | `Header` |
| Only-one-side markup | `.desk-only` and friends | Same |

- The breakpoint is `899px` / `900px`. Use those two numbers, nothing new.
- A component that renders once per breakpoint exists twice in the DOM. Tests must select the visible one (see Lessons in `AGENTS.md`).
- Map camera padding must match what covers the map (panel, sheet, consent card). Change them together; see `src/lib/map-padding.ts` and `map-camera.ts`.
- `--bottom-overlay-height` is the room a consent or support card takes. Anything pinned to the bottom must respect it.

## Components and their rules

- **Bottom sheet.** Persistent, no scrim: the map stays usable behind it. The handle (`.sheet-grab`) is focusable and changes snap with the keyboard (`snapFromKey`). Every sheet that can be dismissed also has a visible close button: a drag is never the only way (WCAG 2.5.7). Browser Back closes an open card before it leaves the page.
- **Pills and chips.** One line, never wrap. The row scrolls sideways; the active chip must stay fully visible when focused.
- **Glass panels.** Text on glass must still meet contrast over the busiest map area (a dark forest or a white glacier). Check both themes on a real map tile, not on a blank background.
- **Forms and toggles.** One ink control style everywhere (see the comment above the checkbox rules). A label is always visible; a placeholder is never the only label.
- **Consent and support card.** One compact card, rising from the bottom on phones. It must never hide the focused element (see Focus below).
- **Map markers.** Built as HTML strings: every text goes through `escapeHtml` (`src/lib/html.ts`).

## Accessibility (WCAG 2.2 AA)

These are the rules this site is held to. Each has a check.

| Rule | Standard | This site | How to check |
| --- | --- | --- | --- |
| Touch target | 24×24 px minimum (2.5.8) | 44 px: `button { min-height: 44px }`. Desktop side panel may use smaller labels, never below 24 px | Dev tools box model |
| Text contrast | 4.5:1, large text 3:1 (1.4.3) | `--ink-3` is the lightest text allowed: 4.56:1 on `--bg`, 6.17:1 in dark mode. Never use `--line*` or `--no-pass` for text | Contrast picker on both themes |
| Non-text contrast | 3:1 for anything that identifies a control or state (1.4.11) | `--line-strong` is only 1.47:1. A border in it may decorate, but a control must also be identified by its label, fill, or icon | Contrast picker |
| Visible focus | Always visible (2.4.7) | `:focus-visible` draws a 2 px `--focus-ring` with 2 px offset. Never `outline: none` without a replacement | Tab through the page |
| Focus not hidden | Focused element never fully covered by sticky content (2.4.11) | Sheets, the tab bar, and the consent card are sticky. Use `scroll-margin` / `scroll-padding` with `--tab-bar-height` and `--bottom-overlay-height` | Tab with the consent card open, on a phone viewport |
| Dragging | Every drag has a single-tap or key alternative (2.5.7) | Sheet handle: keyboard and tap; map: zoom buttons | Try it without dragging |
| Escape and focus return | Overlay closes on Escape, focus returns to its opener | See Lessons: portal menus | Keyboard |
| Motion | Stop animation under reduced motion (2.3.3) | Global `prefers-reduced-motion` rule kills transitions and animations; moving lifts follow it until the visitor chooses | Emulate reduced motion in dev tools |
| Names | Every control has an accessible name in the visitor's language | `aria-label={t(...)}`, never English literals | Screen reader or `browser_snapshot` |

`@axe-core/playwright` is already installed. Deque puts axe at about 57% of real issues (contrast, names, roles, target size). Focus order, hidden focus, dragging alternatives, and whether a label makes sense stay manual.

## Motion

- Use the motion tokens. Sheets move with `--ease-sheet`; small state changes use `--dur-fast`.
- Animate `transform` and `opacity` only. Never animate `height`, `top`, or `width` of anything big (see the performance skill).
- Nothing transitions until `AppState` has applied stored settings (rule at the end of `globals.css`); keep that for new transitions so a returning visitor does not see the theme flash.
- Under `prefers-reduced-motion` the global rule already stops CSS transitions. JavaScript motion is not covered: a camera move (`flyTo`, `easeTo`) needs `duration: 0`, and lift cars follow `storedLiftMotionChoice`.

## Text and languages

- 26 languages. German and Finnish often run 30% longer than English; a two-word label can double. Design for the long one: allow wrapping in cards, `text-wrap: balance` on headings, and never truncate a price, a pass name, or a button label with an ellipsis.
- Test a new layout in `de` and `fi` at 390 px wide, not only `en`.
- Numbers, dates, and currency go through `src/lib/format.ts`, never string concatenation.

## References

Use free, primary sources. A pattern from them is a starting point; this file and the existing CSS decide.

- **Accessibility:** [WCAG 2.2 Understanding docs](https://www.w3.org/WAI/WCAG22/Understanding/) (read the "Understanding" page for a criterion, not a summary blog).
- **Bottom sheets:** [NN/g: Bottom sheets](https://www.nngroup.com/articles/bottom-sheet/), [Material 3 bottom sheet accessibility](https://m3.material.io/components/bottom-sheets/accessibility), [Apple HIG: Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets).
- **Forms and plain language:** [GOV.UK Design System](https://design-system.service.gov.uk/) (error messages, labels, question pages).
- **Map apps to compare against:** Google Maps and Apple Maps (sheet over map), Komoot and Strava (outdoor map with filters). Describe the pattern you borrow in the plan; never copy their assets or icons.
- **Real app screens, free:** [Lazyweb](https://www.lazyweb.com/screens) (free browsing; public MCP at `https://www.lazyweb.com/mcp/public`, no account), [Banani references](https://www.banani.co/references). Mobbin needs a paid plan.

## Before you finish a UI change

1. Desktop 1440×900 and phone 390×844, light and dark, in the browser.
2. Keyboard only: Tab reaches every new control, focus is visible and never hidden, Escape closes and returns focus.
3. Reduced motion emulated: nothing moves that should not.
4. One long language (`de`) and one other (`fi` or `hu`).
5. Both map providers if the change touches anything on or over the map.
