# UDisc Round Dashboard Generator — User Guide

Turn your UDisc scorecard export into a full performance dashboard with hole-by-hole AI coaching — all in your browser, no account required.

---

## Step 1 — Export Your UDisc Scorecards

1. Open the UDisc app and make sure you are signed into the account you want to export.
2. Tap the **You** tab in the bottom navigation.
3. Tap the **menu (☰)** in the top-right, then select **Rounds**.
4. In the Rounds screen, tap the **menu (☰)** again and choose **Export to CSV**.
5. Save the downloaded `.csv` file somewhere easy to find.

> Need help? [How to export your UDisc scorecards to CSV](https://help.udisc.com/en/articles/10705081-how-can-i-export-my-scorecards-to-a-csv)

---

## Step 2 — Load Your Data

1. Open `index.html` in your browser (or visit the hosted URL if shared with you).
2. Click **Choose CSV File** and select the file you exported.
3. Click **Analyze File**.

Your dashboard appears immediately.

---

## Filtering Your Dashboard

Use the three floating buttons to narrow what you see:

| Button | What it controls |
|---|---|
| **Players** | Show stats for one or more players |
| **Courses** | Focus on specific courses |
| **Dates** | Filter by last week, last month, custom range, or all time |

Hit **Apply** after making selections. The entire dashboard updates instantly.

---

## What's On the Dashboard

### Summary Tiles
At-a-glance stats for your filtered rounds: total rounds played, average score, average to-par, best and worst rounds, rated round info, and a full hole-outcome breakdown (aces through triple bogies).

### Recent Performance
A table of your last 10 rounds with date, course, score, to-par, round rating, and a quality badge (Excellent / Solid / Scrappy / Rough).

### Trend Charts
- **Rating Trend** — your UDisc round ratings over the last 50 rounds
- **To-Par Trend** — your strokes-to-par across the last 50 rounds

### Round Quality Summary
Counts and percentages of your rounds by quality tier.

### Course Breakdown
Average score, to-par, best round, and rating split by course — with a **View** button to open the scorecard for each course.

---

## Scorecard View

Click **View** next to any course in the Course Breakdown table.

The scorecard shows every layout you've played at that course with:
- A hole-by-hole grid with **par** and your **average score per hole**
- Green highlights on your best holes, red on your toughest holes

### AI Coaching Plan (per layout)

Click **AI Coaching Plan** under any layout. A popup opens with:

1. **The scorecard grid** for that layout
2. **A hole-by-hole plan** for every hole:
   - 🟢 **Green-light hole** — strong birdie candidate, attack your best line
   - 🟡 **Par-save hole** — placement over distance, position for an easy next shot
   - 🔴 **Damage-control hole** — widest safe line, avoid OB at all costs
   - ⚪ **Neutral hole** — commit to your stock line and trust the putt
3. Your player **archetype**, birdie rate, and risk rate
4. A **Primary Focus** recommendation based on your history at this course

You can export the coaching plan as an image or PDF using the links at the top of the popup.

---

## AI Coach Plan (Full Dashboard)

Click **Generate AI Coach Plan** on the dashboard for a coaching plan built from all your currently filtered rounds.

This includes:
- Your player archetype and what it means
- Your top improvement focuses with specific drills
- Recent trend analysis
- Optional **Enhanced AI Coaching** — check the box to have the plan rewritten in a more natural style using a model that runs locally in your browser (first run downloads the model, no data leaves your device)

Configure your available practice time (days per week, minutes per session) and goal preset before generating.

---

## Exporting

Every view can be saved:

| View | Export available |
|---|---|
| Full dashboard | Save as Image / Save as PDF |
| Scorecard modal | Save as Image / Save as PDF |
| AI Coaching Plan popup | Save as Image / Save as PDF |
| AI Coach Plan modal | Save as Image / Save as PDF |

Look for the **Save as Image** and **Save as PDF** links at the top of each popup.

---

## Themes

Use the **Auto / ☀ / ☾** buttons in the bottom-right corner to switch between system, light, and dark themes. Your preference is saved automatically.

---

## Privacy

- Your CSV data never leaves your browser.
- No server, no account, no tracking.
- All stats, coaching plans, and exports are generated locally on your device.
