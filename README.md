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
Runs on http://localhost:3334 (Vite proxies `/api/review`, `/api/override`, and `/api/tmdb-data` to it automatically).

### First-time Google authorization

The API server needs OAuth access to write ratings, reviews, and TMDB data back to your Google Sheet. On first run (or if the token expires) it will print a URL in the terminal:

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

### 1. Environment variables

Create a `.env.local` file in the project root:

```
GOOGLE_SHEET_ID=your_sheet_id_here
```

The Sheet ID is the long string in your Google Sheet URL:
`https://docs.google.com/spreadsheets/d/`**`<SHEET_ID>`**`/edit`

### 2. Google Cloud credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project
2. Enable the **Google Sheets API**
3. Create OAuth 2.0 credentials (type: **Desktop app**)
4. Download the credentials JSON and save it as `google-credentials.json` in the project root
5. On first run of `npm run api`, the browser auth flow will generate `google-token.json` automatically

Both `.env.local` and the credential files are gitignored and must never be committed.

### 3. Google Sheet structure

The app reads from a Google Sheet that must be **published to the web** (File → Share → Publish to web → CSV) so the frontend can fetch it as CSV.

The sheet should have the following tabs:

---

#### Tab 1: Main collection (default tab / gid=0)

Holds your primary media (4K, Blu-ray, Digital, etc.).

| Column | Header | Description |
|---|---|---|
| A | Film Sort Name | Title used for alphabetical sorting (e.g. `Godfather, The`) |
| B | Film Name | Full display title (e.g. `The Godfather`) |
| C | Genre | Primary genre (e.g. `Drama`, `Action`) |
| D | Sub Genre | Secondary genre (optional) |
| E | Disk Type | Format: `4K`, `Blu-Ray`, `DVD`, `Digital`, `Digital HD`, etc. Multiple formats separated by `/` |
| F | Notes | Edition notes (e.g. `Steelbook`, `Criterion`) |
| G | Rating | Star rating 0–5 (written back by the app) |
| H | Review | Text review (written back by the app) |

---

#### Tab 2: DVD (tab named `DVD`)

Holds your DVD collection. Same column structure as the main tab — the app ignores column E and records format as `DVD` automatically.

| Column | Header | Description |
|---|---|---|
| A | Film Sort Name | Sort title |
| B | Film Name | Display title |
| C | Genre | Primary genre |
| D | Sub Genre | Secondary genre (optional) |
| E | Screen Type | Ignored by the app (widescreen, fullscreen, etc.) |
| F | Notes | Edition notes |
| G | Rating | Star rating (written back by the app) |
| H | Review | Text review (written back by the app) |

---

#### Tab 3: TMDB Overrides (auto-created, named `TMDB Overrides`)

Created automatically by the app the first time you fix a TMDB match. Maps movie slugs to TMDB IDs.

| Column | Header | Description |
|---|---|---|
| A | Slug | URL-safe movie identifier (e.g. `the-godfather`) |
| B | TMDB_ID | TMDB movie or collection ID (e.g. `238` or `collection:4385`) |

---

#### Tab 4: TMDB Data (auto-created, named `TMDB Data`)

Created automatically by the app. Stores all TMDB-enriched metadata so the app can load it from the sheet instead of hitting the TMDB API on every visit.

| Column | Header | Description |
|---|---|---|
| A | Slug | URL-safe movie identifier |
| B | Title | Display title |
| C | Year | Release year |
| D | Runtime | Runtime in minutes |
| E | TMDB_Rating | TMDB average vote (0–10) |
| F | Vote_Count | Number of TMDB votes |
| G | Tagline | Movie tagline |
| H | Genres | Comma-separated TMDB genres |
| I | Original_Title | Original language title (only set for non-English films) |
| J | IMDB_ID | IMDb ID (e.g. `tt0068646`) |
| K | Budget | Production budget in USD |
| L | Revenue | Box office revenue in USD |
| M | Director | Director name |
| N | Writers | Comma-separated writers (Screenplay / Story / Writer credits) |
| O | Producers | Comma-separated producers |
| P | Cast | Comma-separated top 5 cast members |
| Q | Languages | Comma-separated spoken languages |
| R | Countries | Comma-separated production countries |
| S | Studios | Comma-separated production companies |
| T | Poster_URL | Poster image (`=IMAGE()` formula pointing to TMDB CDN) |
| U | Backdrop_URL | Backdrop image (`=IMAGE()` formula pointing to TMDB CDN) |
| V | TMDB_ID | Numeric TMDB movie ID |
| W | Enriched_At | ISO timestamp of when the data was last fetched |

### 4. TMDB API key

Add your TMDB API key via the Settings panel (⚙ icon in the nav bar). The key is stored in your browser's localStorage and never sent to the API server.

Get a free API key at [themoviedb.org](https://www.themoviedb.org/settings/api) (use the **Read Access Token**, not the v3 API key).

## How data flows

- **Reading collection**: Vite proxies `/api/sheet` → Google Sheets public CSV → parsed by the app
- **Reading TMDB data**: Loaded from the `TMDB Data` sheet tab on startup; TMDB API is only called for movies not yet in the sheet
- **Writing ratings/reviews**: Saved to localStorage immediately, then synced to the sheet via the API server
- **Writing TMDB data**: Enriched data is written to the `TMDB Data` sheet tab automatically after each fetch
- **TMDB overrides**: When you fix a TMDB match, the override is saved to localStorage, `public/tmdb-overrides.json`, and the `TMDB Overrides` sheet tab
