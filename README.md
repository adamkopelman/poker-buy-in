# poker-buy-in

A simple poker buy-in tracker. No build step, no framework — just static HTML/CSS/JS, deployed to GitHub Pages.

Live: https://adamkopelman.github.io/poker-buy-in/

## Pages

- **Buy-ins** (`index.html`) — add players and track how many times each one has bought in.
- **Settle Game** (`settle.html`) — set the chip-to-dollar ratio, enter each player's cash-out (in chips or dollars), and see who's up and who's down.

Both pages share the same data (saved in `localStorage`, and optionally synced live via Firebase — see below).

## Chip ratio

By default 1 chip = $1. If your group plays with a different ratio (e.g. 4 chips = $1), set it on the Settle Game page — cash-outs can be entered either in chips or dollars and stay in sync.

## Sharing a live game

The "Share live game" panel (on either page) generates a link that keeps everyone's view in sync in real time, powered by Firebase Realtime Database. To enable it for your own deployment:

1. Go to https://console.firebase.google.com, create a project (the free Spark plan is enough).
2. In the project, enable **Realtime Database** (Build → Realtime Database → Create Database, start in locked mode).
3. In the database's **Rules** tab, paste:
   ```json
   {
     "rules": {
       "games": {
         "$gameId": {
           ".read": true,
           ".write": true
         }
       }
     }
   }
   ```
   This keeps it open read/write under `/games/<gameId>` only — fine for a casual tool among friends with no login, but anyone with a link can edit that game's data.
4. In Project settings → General, find your web app's Firebase config (or add a web app if you haven't yet).
5. Copy the values into `firebase-config.js` in this repo, replacing the placeholders.
6. Commit and deploy. The "Start Shared Game" button will now work.

If `firebase-config.js` still has placeholder values, the Share panel will tell you live sharing isn't set up yet, but the rest of the app works fine offline/local-only.

## Tests

```
npm test
```
