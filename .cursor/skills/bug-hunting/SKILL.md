---
name: bug-hunting
description: Finds, reproduces, and fixes bugs in Skimap.eu with a failing test first, and lists the edge cases that break this app (dates and seasons, nulls in data, location and permissions, two map providers, breakpoints, 26 languages, saved settings). Use when fixing a bug, when something is broken, flaky, or wrong, when a test or the e2e suite fails, before writing a plan for a behaviour change, or when reviewing a diff for what could break.
---

# Bug hunting

Two jobs: **find the bugs a change will cause before writing it** (the Research step in `AGENTS.md`), and **fix a reported bug at its root, with a test that failed first.**

## Fixing a reported bug

1. **Get a red signal for the exact symptom.** One command that fails for this bug and will pass once it is fixed. In order of preference:
   - a Vitest test on the `src/lib` function that is wrong (fast, runs in `node`, no DOM),
   - a handler test with `db/test-sqlite.ts` for anything in `functions/`,
   - one Playwright test: `npm run test:e2e -- -g "name"`,
   - the browser tools against `npm run dev`, with a DOM or console check.
   Make sure it fails for the reason the owner described, not a nearby one.
2. **Shrink it.** Remove inputs, steps, and settings until removing anything more makes it pass. The small version usually becomes the regression test.
3. **Write 3–5 hypotheses before testing any.** Rank them by likelihood and by how cheap they are to rule out. Each one predicts something: "if X, then changing Y makes Z happen."
4. **Test one variable at a time.** Tag temporary logs `[DEBUG-xxxx]` so one search removes them all.
5. **Regression with a known good commit?** Use `git bisect run` with a script that exits 0 when good, 1 when bad, and 125 when a commit does not build. Check both ends by hand first, and keep the script outside the repo so old commits still have it.
6. **Fix the cause, not the symptom.** Ask why until the answer is a line of code or a wrong assumption. A `try/catch`, a `?.`, or a longer timeout that makes the error go away is not a fix unless the cause really is "this can be missing".
7. **Watch the test go green, then run the original, un-shrunk scenario again.** Then run lint, typecheck, and tests, plus e2e if the map or layout is involved.
8. **Look for the same bug elsewhere.** Search for the pattern (`rg`) and fix or report its siblings.

After two failed fixes, stop and re-plan from what you learned (`AGENTS.md`).

## Where this app breaks

Before planning a change, walk this list. Name the rows the change can hit in the plan, and test those.

**Data**
- A field is `null` (elevation, slope km, day ticket, price, season). Never render 0 or "NaN"; hide it. Sorting puts nulls last in both directions.
- A resort with no passes, a pass with no resorts, an abandoned resort (`showAbandoned`), a resort with no piste file (`public/pistes/none.json`).
- Names with accents and umlauts in search and sorting (`fold`, `localeCompare`).

**Dates and money**
- Today is before presale, during presale, on the exact deadline day, after the season. Price changes on a date: test the day before, the day of, and the day after.
- Birth year missing, in a bracket edge year, or for a pass priced by age on the purchase date (`resolveForViewer`).
- Time zones: `new Date("YYYY-MM-DD")` is UTC. A visitor in the Americas on the evening before a deadline must still see the old price. Pass "today" in as a parameter (`todayISO(date)`) and set it in tests; with fake timers, Vitest 5 also fakes `Temporal`.
- Rounding happens once, at display.

**Location and privacy**
- Permission denied, prompt dismissed, timeout (not a block: see `geolocate.ts`), position unavailable, very low accuracy, and a fix arriving after the visitor cleared their data. Anything that deletes the location stops the watch first (Lessons).

**Settings and storage**
- First visit (nothing stored), an old stored version (`STORAGE_VERSION`), a stored value that contradicts the system (theme, reduced motion), `localStorage` full or blocked (private mode), a hand-edited or old export file on import.
- Save only what the visitor changed (`AGENTS.md`, Settings).

**URL and history**
- A shared link with filters and a resort open; Back from an open resort (`history-step.ts`); unknown or removed resort id in the URL; the GitHub Pages path prefix (`BASE_PATH`).

**Map**
- Both providers: MapLibre by default, Mapbox with a token and consent. Style swap (theme change) drops sources and layers until `style.load`.
- Camera padding with the side panel, the sheet at each snap, and the consent card open.
- Map failed to load (WebGL off, tiles blocked, offline): the list must still work.

**Layout, input, languages**
- 390×844 and 1440×900, light and dark, the 899/900 px boundary, a component rendered once per breakpoint (select `:visible` in tests).
- Keyboard only, screen reader names, reduced motion.
- A long language (`de`, `fi`) and every new key in all 26 files.

**Offline and service worker**
- First load offline, an old service worker serving new HTML (`sw.js`, `stamp-sw.mjs`), a failed fetch for piste lines.

## Writing tests

- **Unit**: next to the file (`foo.ts` → `foo.test.ts`). One behaviour per test, named as a sentence about what the visitor gets. Build inputs from small literal objects, and use real `data/*.json` only when the test is about the data.
- **Clock**: pass the date in. When you must fake time, `vi.useFakeTimers({ now })` and `vi.useRealTimers()` in `afterEach`.
- **Playwright** (1.63 docs): locate by role and name (`getByRole`, `getByLabel`), and assert with auto-retrying web-first assertions (`await expect(locator).toBeVisible()`). Never `expect(await locator.isVisible())`. Do not add `waitForTimeout`: the suite has 10, and each one is a flake waiting to happen. Wait for a state instead (`expect.poll`, `toHaveAttribute`). Emulate with `page.emulateMedia({ reducedMotion, colorScheme })`.
- **A layer, source, or CSS class renamed?** Search `e2e/` and update it in the same change (`AGENTS.md`, Map).
- A test that passes without the fix proves nothing. Run it against the old code once.

## Flaky tests

A flaky test is a bug: in the test, or in the app's timing. Rerun it 5–10 times (`--repeat-each` in Playwright) to get a rate, find what it races (map `idle`, a fetch, an animation, a rate limit), and wait for that state. Never fix a flake with retries or a longer sleep.
