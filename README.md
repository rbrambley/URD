# UDisc Round Dashboard Generator

Generate a personal disc golf performance dashboard from a UDisc CSV export.

This is a client-side web app (HTML/CSS/JavaScript) that parses your scorecard data in the browser and builds a filterable dashboard with round stats, scorecard details, export options, and an AI coaching plan.

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
- Dashboard metrics and trend sections (including recent performance summaries)
- Scorecard modal with hole-level detail (including par-row support when present)
- Export options:
	- Save dashboard as image/PDF
	- Save scorecard modal as image/PDF
	- Save coach plan as image/PDF
- Built-in AI Coach Plan:
	- Deterministic local coaching logic based on your filtered stats
	- Optional enhanced narrative rewrite with a local browser model (Transformers.js + Xenova FLAN-T5)
- Light/Dark/System theme toggle with preference stored in localStorage

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- [PapaParse](https://www.papaparse.com/) for CSV parsing
- [Chart.js](https://www.chartjs.org/) for charting
- [html2canvas](https://html2canvas.hertzen.com/) for image export
- [jsPDF](https://github.com/parallax/jsPDF) for PDF export
- [Transformers.js](https://github.com/xenova/transformers.js) for optional local coach-plan text rewrite

## Quick Start

### Option 1: Open directly

1. Open `index.html` in your browser.
2. Upload your UDisc CSV.
3. Click **Analyze File**.

### Option 2: Run with a local static server (recommended)

Using a local server is more reliable for browser module loading and CDN behavior.

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

- `Date` and/or `StartDate` (for date filtering)
- `LayoutName`
- `Hole1` ... `HoleN` (for scorecard/par details)
- Throw outcome/stat columns included in your UDisc export

If no valid rows remain after filtering, the app shows: "No data found in the file."

## How To Use

1. Upload your CSV and click **Analyze File**.
2. Use floating buttons to adjust filters:
	 - Players
	 - Courses
	 - Dates
3. Open scorecard and coach modals for deeper analysis.
4. Export dashboard/scorecard/coach plan as image or PDF.

## Privacy

- Data is processed in your browser.
- No backend is required for core dashboard behavior.
- Theme and coach settings are stored in localStorage on your device.
- Optional model-based coach rewrite runs locally in-browser via downloaded model assets.

## Project Files

- `index.html` - App layout, modals, CDN script includes
- `style.css` - Global styling, responsive modal/table behavior, themes
- `script.js` - CSV parsing, filtering, dashboard rendering, exports, coach generation
- `TODO_add_export_libs.txt` - Reminder notes about export library includes
- `TODO_export_button_logic.txt` - Reminder notes for export button listener cleanup

## Deploying To GitHub Pages

1. Push this folder to a GitHub repository.
2. In repo settings, open **Pages**.
3. Set source to your main branch (root).
4. Visit your site at:
	 - `https://<username>.github.io/<repo-name>/`

## Known Notes

The repository currently includes reminder TODO files for export-library verification and export button listener cleanup. These are informational and may indicate future refactoring.