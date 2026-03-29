# UDisc Round Dashboard Generator

Generate a personal disc golf performance dashboard from a UDisc CSV export.

This is a client-side web app (HTML/CSS/JavaScript) that parses your scorecard data in the browser and builds a filterable dashboard with round stats, scorecard details, hole-by-hole AI coaching, export options, and more — all without a backend.

## Highlights

- Upload and parse UDisc CSV files directly in the browser
- Smart player grouping:
	- Normalizes name variations
	- Fuzzy-merges near matches
	- Keeps team/doubles names as separate entries
- Filter your dashboard by:
	- Players (multi-select)
	- Courses (multi-select)
	- Date range (all, last week, last month, custom)
- Dashboard summary tiles: total rounds, avg score, avg to-par, rated rounds, avg rating (UDisc + PDGA equivalent), best/worst rounds, total throws, hole outcome breakdown (aces through triple bogies)
- Recent performance table (last 10 rounds with quality badge)
- Rating and to-par trend charts (last 50 rounds)
- Round quality summary and course quality matrix
- Course breakdown table with per-course avg score, to-par, best round, avg rating
- **Scorecard modal** — per-course, per-layout hole grid showing:
	- Par row (from CSV when present)
	- Average score per hole with green (best) / red (worst) highlights
	- **AI Coaching Plan link** per layout — opens a dedicated popup
- **AI Coaching Plan popup** (per scorecard layout):
	- Scorecard grid with par/avg and best/worst hole highlights
	- Hole-by-hole plan: AI Line and Target for every hole
		- Green-light holes (strong birdie candidates)
		- Par-save holes (placement over aggression)
		- Damage-control holes (widest line, avoid OB)
		- Neutral holes (commit to stock line)
	- Archetype, birdie rate, and risk rate pills
	- Primary Focus derived from your filtered round history
	- Save as Image / Save as PDF exports
- **AI Coach Plan modal** (dashboard-wide):
	- Deterministic local coaching logic across all filtered rounds
	- Player archetype detection (Volatile Attacker, Low-Birdie Grinder, Floor-Collapser, Plateaued Improver, Balanced Builder)
	- Drill and focus recommendations
	- Optional enhanced narrative rewrite via local browser model (Transformers.js + Xenova FLAN-T5)
	- Configurable: days/week, minutes/session, intent preset
	- Save as Image / Save as PDF exports
- Export options:
	- Dashboard: Save as Image / Save as PDF
	- Scorecard modal: Save as Image / Save as PDF
	- AI Coaching Plan popup: Save as Image / Save as PDF
	- AI Coach Plan modal: Save as Image / Save as PDF
- Light / Dark / System theme toggle with preference stored in localStorage

## Tech Stack

| Library | Purpose |
|---|---|
| HTML5 / CSS3 / Vanilla JS | Core app — no framework |
| [PapaParse 5.4.1](https://www.papaparse.com/) | CSV parsing |
| [Chart.js](https://www.chartjs.org/) | Rating and to-par trend charts |
| [html2canvas 1.4.1](https://html2canvas.hertzen.com/) | Image export |
| [jsPDF 2.5.1](https://github.com/parallax/jsPDF) | PDF export (multi-page) |
| [Transformers.js](https://github.com/xenova/transformers.js) | Optional local LLM coach rewrite (Xenova/flan-t5-small) |

## Quick Start

### Option 1: Open directly

1. Open `index.html` in your browser.
2. Upload your UDisc CSV.
3. Click **Analyze File**.

### Option 2: Run with a local static server (recommended)

A local server is more reliable for CDN imports and browser module loading.

```bash
# From the project folder
npx serve .
```

Then open the local URL shown in your terminal.

## CSV Expectations

The parser filters out rows that do not include the core fields used by the dashboard.

Expected core columns:

- `PlayerName`
- `Total`
- `CourseName`

Additional columns used when available:

- `Date` and/or `StartDate` (for date filtering and trend charts)
- `LayoutName`
- `+/-` (to-par per round)
- `RoundRating` (UDisc round rating)
- `Hole1` … `HoleN` (for scorecard grids and per-hole AI coaching)
- Throw outcome/stat columns included in your UDisc export

If no valid rows remain after filtering, the app displays: "No data found in the file."

## How To Use

1. Upload your CSV and click **Analyze File**.
2. Use the floating **Players**, **Courses**, and **Dates** buttons to filter.
3. Review summary tiles, recent performance table, and trend charts on the dashboard.
4. Click **View** in the Course Breakdown table to open the **Scorecard modal** for a course.
5. Click **AI Coaching Plan** under any course layout in the scorecard to open the **hole-by-hole coaching popup** for that layout.
6. Click **Generate AI Coach Plan** on the dashboard to open the **full AI Coach Plan modal**.
7. Export any view as image or PDF using the **Save as Image** / **Save as PDF** links in each modal.

## Modals Overview

| Modal | Opened from | Exportable |
|---|---|---|
| Scorecard | Course Breakdown → View button | Yes (image + PDF) |
| AI Coaching Plan | Scorecard → AI Coaching Plan link | Yes (image + PDF) |
| AI Coach Plan | Dashboard → Generate AI Coach Plan | Yes (image + PDF) |
| Players | Floating Players button | — |
| Courses | Floating Courses button | — |
| Dates | Floating Dates button | — |

## Privacy

- All data is processed entirely in your browser.
- No server, no uploads, no tracking.
- Theme and coach settings are stored in localStorage on your device only.
- The optional LLM rewrite model runs locally in-browser via downloaded model assets.

## Project Files

- `index.html` — App layout, all modal containers, CDN script includes
- `style.css` — Global styling, themes (light/dark/system), responsive modal and table behavior
- `script.js` — CSV parsing, filtering, dashboard rendering, scorecard modal, AI coaching plan popup, AI coach modal, all export handlers
- `TODO_add_export_libs.txt` — Reminder notes about export library includes
- `TODO_export_button_logic.txt` — Reminder notes for export button listener cleanup

## Deploying To GitHub Pages

1. Push this folder to a GitHub repository.
2. In repo settings, open **Pages**.
3. Set source to your main branch (root).
4. Visit your site at:
	 - `https://<username>.github.io/<repo-name>/`

## Known Notes

The repository includes reminder TODO files for export-library verification and export button listener cleanup. These are informational and may indicate future refactoring.