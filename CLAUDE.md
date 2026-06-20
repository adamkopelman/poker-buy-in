# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static poker buy-in tracker: no build step, no framework, just HTML/CSS/JS deployed directly to GitHub Pages. Two pages share state through `localStorage` and an optional Firebase Realtime Database live-sync.

## Commands

```
npm test                              # full suite (pure-logic + browser tests)
node --test tests/app.test.js         # pure-logic tests only (fast, no browser)
node --test tests/responsive.test.js  # Playwright browser tests only
npx playwright install --with-deps chromium   # one-time, needed before responsive tests will run
```

There is no build step and no linter. To preview locally, just open `index.html`/`settle.html` in a browser, or serve the directory (`python3 -m http.server`) since the responsive tests rely on `http://` fetches rather than `file://`.

## Architecture

**Pages share one state shape** (`{ buyinValue, chipsPerDollar, players: [{id, name, buyins, cashout}] }`) via `localStorage` (`PokerApp.STORAGE_KEY`) and, optionally, a Firebase Realtime Database row per shared game. `index.html` (Buy-ins) and `settle.html` (Settle Game) are independent HTML files with their own inline `<script>` blocks, but both load the same three shared scripts in this order — order matters, each assumes the previous one's globals exist:

1. Firebase compat SDKs (CDN) + `firebase-config.js` (safe to commit — it's not a secret, security is enforced by Firebase Database Rules, see README)
2. `app.js` — pure logic, no DOM access. Dual UMD export (`module.exports` for Node, `window.PokerApp` for the browser) so it's unit-testable with `node:test`. Holds state shape validation (`normalizeLoadedState`/`sanitizePlayer`), money/chip math (`fmtMoney`, `chipsToDollars`/`dollarsToChips`, `computePlayerNet`, `computeTotals`), and input clamping (`clampBuyins`).
3. `shared.js` (`window.PokerShared`) — DOM/Firebase glue: `loadState()`, `ensureFirebase()`, and `createSyncController(opts)`, which wires up the "Share live game" panel and returns `saveLocalAndSync(state)`. Both pages call this instead of duplicating Firebase logic. A page calls `saveState()` → `sync.saveLocalAndSync(state)` after every mutation, which writes `localStorage` and pushes to Firebase if a game is currently connected.

Each page's own inline script then does its own `render()` (full re-build of its player table from `state`) and wires up page-specific controls (rebuy/undo and the editable count input on the Buy-ins page; chip/dollar cash-out inputs on the Settle page).

**Styling**: one shared `styles.css` with a dark theme via CSS custom properties (`--bg`, `--panel`, `--accent`, `--danger`, `--gold`, etc.). Both pages' tables share `id="playersTable"`, but their *columns differ* (Buy-ins page: Name/Buy-ins-editor/Total/Remove; Settle page: Name/Buy-ins/Cash-out/Net). The `@media (max-width: 480px)` rule that hides column 2 on phones is intentionally scoped to `.settle-table` only (a class only `settle.html`'s table has) — that column is just informational there, but on the Buy-ins page column 2 *is* the buy-in editor (count input + +/- buttons) and must never be hidden. If you add more responsive CSS, keep it scoped per-page the same way; `tests/responsive.test.js` exists specifically to catch this class of regression.

**Cache busting**: `index.html`/`settle.html` load `styles.css`, `app.js`, and `shared.js` with a `?v=N` query string. Bump `N` on every change to any of those three shared files — GitHub Pages/mobile browsers can otherwise serve a stale cached copy after deploy even though the new file is live.

**Deployment**: pushing to `master` auto-deploys to production — `.github/workflows/pages.yml` uploads the repo root as-is to GitHub Pages on every push to `master` (no build step). `.github/workflows/test.yml` runs `npm ci` + Playwright Chromium install + `npm test` on pushes to `master` and on PRs.

## Tests

- `tests/app.test.js` — plain `node:test`/`assert` tests against `app.js`'s pure functions.
- `tests/responsive.test.js` — spins up an ephemeral local static HTTP server (not `file://`, since the app needs real relative-URL fetches) and drives the real pages with Playwright/Chromium across a set of real phone viewport widths (320px–430px, plus the 480/481px breakpoint boundary), asserting the buy-in controls and cash-out inputs stay visible and clickable. Requires Chromium to be installed locally first (see Commands above).
