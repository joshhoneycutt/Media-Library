# The Library

A personal media collection browser backed by Google Sheets, with TMDB metadata enrichment.

## Running the app

The app requires **two servers** running simultaneously — open two terminal windows.

**Terminal 1 — Frontend (Vite dev server)**
```
npm run dev
```
Opens at http://localhost:5173

**Terminal 2 — API server (Google Sheets write-back)**
```
npm run api
```
Runs on http://localhost:3334 (Vite proxies `/api/review` to it automatically).

### First-time Google authorization

The API server needs OAuth access to write ratings and reviews back to your Google Sheet. On first run (or if the token expires) it will print a URL in the terminal:

```
*** ACTION REQUIRED — open this URL in your browser ***
https://accounts.google.com/o/oauth2/v2/auth?...
```

Open that URL, sign in with your Google account, and grant Sheets access. The browser will redirect to `localhost:3335` and the server will save the token automatically. You only need to do this once — the token refreshes itself.

## Other scripts

| Command | Description |
|---|---|
| `npm run fetch-tmdb` | Enrich collection with TMDB metadata |
| `npm run update-sheet` | Write TMDB runtime data back to the sheet |
| `npm run fetch-awards` | Fetch Oscar/awards data |
| `npm test` | Run unit tests |

## Setup

### Google Sheets
Create a `.env.local` file in the project root with your Sheet ID:

```
GOOGLE_SHEET_ID=your_sheet_id_here
```

Place OAuth credentials in `google-credentials.json` (Desktop app type, downloaded from Google Cloud Console). On first run of any write script, the browser auth flow will generate `google-token.json`.

Both `.env.local` and the credential files are gitignored and must never be committed.

### TMDB API key
Add your TMDB API key via the Settings panel (⚙ icon in the nav bar).
