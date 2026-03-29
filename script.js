// Utility: Get par for a given course, layout, and hole number using the 'Par' row
function getParForHole(courseName, layoutName, holeNum, dataSource) {
    // dataSource: array of all rounds (default to global 'data' if not provided)
    const allData = dataSource || (window.allUDiscData || data);
    // Find the Par row for this course/layout
    const parRow = allData.find(r =>
        (r.CourseName === courseName) &&
        ((r.LayoutName || 'Default') === (layoutName || 'Default')) &&
        (r.PlayerName || '').toLowerCase().replace(/\s+/g, '').trim() === 'par'
    );
    if (!parRow) return undefined;
    const val = parRow[`Hole${holeNum}`];
    if (val === undefined || val === null || val === '') return undefined;
    const num = Number(val);
    return isNaN(num) ? undefined : num;
}
function processFile() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select a file first.');
        return;
    }
    Papa.parse(file, {
        header: true,
        complete: function(results) {
            const data = results.data.filter(row => row && row.PlayerName && row.Total && row.CourseName && row.Total !== '');
            if (data.length === 0) {
                document.getElementById('dashboardContainer').innerHTML = '<p>No data found in the file.</p>';
                return;
            }
            // Player selection UI
            // Intelligent player name grouping
            function normalizeName(name) {
                return name
                    .toLowerCase()
                    .replace(/[^a-z0-9 ]/g, '') // remove punctuation
                    .replace(/\s+/g, ' ') // collapse whitespace
                    .trim();
            }
            // Only consider single-person names (no +, &, or ' and ')
            const playerNameCounts = {};
            data.forEach(r => {
                const name = r.PlayerName;
                if (!name) return;
                if (/\+|\&| and /i.test(name)) return; // skip doubles/teams
                const norm = normalizeName(name);
                if (!playerNameCounts[norm]) playerNameCounts[norm] = { names: new Set(), count: 0 };
                playerNameCounts[norm].names.add(name);
                playerNameCounts[norm].count++;
            });
            // Fuzzy merge: if names are substrings or Levenshtein distance <=2, treat as same
            function similar(a, b) {
                if (a === b) return true;
                if (a.includes(b) || b.includes(a)) return true;
                // Levenshtein distance <=2
                function lev(s, t) {
                    const dp = Array(s.length + 1).fill().map(() => Array(t.length + 1).fill(0));
                    for (let i = 0; i <= s.length; i++) dp[i][0] = i;
                    for (let j = 0; j <= t.length; j++) dp[0][j] = j;
                    for (let i = 1; i <= s.length; i++) {
                        for (let j = 1; j <= t.length; j++) {
                            dp[i][j] = Math.min(
                                dp[i-1][j] + 1,
                                dp[i][j-1] + 1,
                                dp[i-1][j-1] + (s[i-1] === t[j-1] ? 0 : 1)
                            );
                        }
                    }
                    return dp[s.length][t.length];
                }
                return lev(a, b) <= 2;
            }
            // Merge similar normalized names
            const mergedPlayers = [];
            const used = new Set();
            const normNames = Object.keys(playerNameCounts);
            for (let i = 0; i < normNames.length; i++) {
                if (used.has(normNames[i])) continue;
                let group = [normNames[i]];
                used.add(normNames[i]);
                for (let j = i + 1; j < normNames.length; j++) {
                    if (used.has(normNames[j])) continue;
                    if (similar(normNames[i], normNames[j])) {
                        group.push(normNames[j]);
                        used.add(normNames[j]);
                    }
                }
                // Pick the most common display name in the group
                let allNames = [];
                group.forEach(n => allNames.push(...Array.from(playerNameCounts[n].names)));
                let displayName = allNames.sort((a, b) =>
                    data.filter(r => r.PlayerName === b).length - data.filter(r => r.PlayerName === a).length
                )[0];
                mergedPlayers.push({
                    displayName,
                    normNames: group,
                    allNames: allNames
                });
            }
            // Add doubles/teams as separate entries
            const teamPlayers = [...new Set(data.map(r => r.PlayerName).filter(n => n && (/\+|\&| and /i.test(n))))];
            teamPlayers.forEach(n => mergedPlayers.push({ displayName: n, normNames: [normalizeName(n)], allNames: [n] }));

            // Filter out 'Par' from mergedPlayers for default selection
            const nonParPlayers = mergedPlayers.filter(p => p.displayName.toLowerCase().replace(/\s+/g, '').trim() !== 'par');
            // Auto-select the player with the most rounds
            let player = '';
            let maxRounds = 0;
            nonParPlayers.forEach(p => {
                const norm = p.displayName.toLowerCase().replace(/\s+/g, '').trim();
                // Count rounds for this player
                const count = data.filter(r => (r.PlayerName || '').toLowerCase().replace(/\s+/g, '').trim() === norm).length;
                if (count > maxRounds) {
                    maxRounds = count;
                    player = p.displayName;
                }
            });
                // Set selectedPlayers to the default player (array), never 'Par'
                let selectedPlayers = [player];
            // Hide upload section
            document.getElementById('uploadSection').style.display = 'none';
            // Inject dashboard styles if not already present
            if (!document.getElementById('dashboardStyles')) {
                const style = document.createElement('style');
                style.id = 'dashboardStyles';
                style.innerHTML = `
body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background-color: var(--bg);
    color: var(--text);
    margin: 0;
    min-height: 100vh;
    width: 100vw;
    box-sizing: border-box;
    padding: 0 0 32px 0;
}
.dashboard-root {
    max-width: 1100px;
    width: 95vw;
    margin: 48px auto 48px auto;
    padding: 32px 24px 48px 24px;
    background: var(--bg-surface);
    border-radius: 16px;
    box-shadow: 0 4px 32px 0 var(--shadow-lg), 0 1.5px 4px 0 rgba(0,0,0,0.15);
    display: flex;
    flex-direction: column;
    align-items: center;
}
h1, h2, h3 {
    color: var(--text-heading);
}
.summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
}
.card {
    background: var(--bg-card);
    border-radius: 8px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    box-shadow: 0 1.5px 4px 0 #0002;
}
.card-title {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-sub);
    margin-bottom: 4px;
}
.card-value {
    font-size: 1.3rem;
    font-weight: 600;
}
table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
    font-size: 0.95rem;
    background: var(--bg-table);
    border-radius: 8px;
    overflow: hidden;
    margin-left: auto;
    margin-right: auto;
    box-shadow: 0 1.5px 4px 0 #0002;
}
th, td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    text-align: center;
}
th {
    background-color: var(--bg-card);
    color: var(--text-th);
    font-weight: 600;
}
tr:nth-child(even) td {
    background-color: var(--bg-row-even);
}
.badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 0.85rem;
}
.excellent {
    background-color: #14532d;
    color: #bbf7d0;
}
.solid {
    background-color: #4b5563;
    color: #e5e7eb;
}
.scrappy {
    background-color: #78350f;
    color: #fed7aa;
}
.rough {
    background-color: #7f1d1d;
    color: #fecaca;
}
.rating-pill {
    background-color: #1d4ed8;
    color: #dbeafe;
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 0.85rem;
}
.section-title {
    margin-top: 32px;
    margin-bottom: 12px;
    font-size: 1.1rem;
    font-weight: 600;
    text-align: left;
}
.small {
    font-size: 0.9rem;
    color: var(--text-sub);
}
.sparkline {
    font-family: 'Segoe UI Symbol', 'Segoe UI', system-ui, sans-serif;
    letter-spacing: 1px;
}
.matrix-cell {
    text-align: center;
}
#playerSelect {
    background: var(--bg-card);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 1rem;
    margin-left: 8px;
    margin-bottom: 12px;
}
label[for='playerSelect'] {
    font-size: 1rem;
    color: var(--text-th);
    margin-right: 8px;
}
`;
                document.head.appendChild(style);
            }
            document.getElementById('dashboardContainer').innerHTML = `
    <div id="exportButtons" class="export-links export-links--dashboard">
        <a id="saveImageBtn" href="#" class="export-link">Save as Image</a>
        <a id="savePdfBtn" href="#" class="export-link">Save as PDF</a>
  </div>
    <div class='dashboard-root'>
        <div id="playerDashboard"></div>
        <footer class="help-links dashboard-help-footer">
            <a href="https://joerobdiscs.com/discount/RICHB" target="_blank" rel="noopener noreferrer" class="promo-link dashboard-promo-link">
                <img src="https://joerobdiscs.com/cdn/shop/files/JRDG_Name_Logo_Joe_f24f21e2-4c03-4fa2-83c5-e34d9da1f39b.png?v=1761072560" alt="JoeRob Discs" class="dashboard-promo-logo">
                <span>Free Shipping For Orders Over $25 at JoeRobDiscs.com</span>
            </a>
        </footer>
    </div>
`;


            // Show floating Players and Courses buttons
            const openPlayerBtn = document.getElementById('openPlayerModal');
            openPlayerBtn.style.display = 'block';
            const openCourseBtn = document.getElementById('openCourseModal');
            openCourseBtn.style.display = 'block';
            const openDateBtn = document.getElementById('openDateModal');
            openDateBtn.style.display = 'block';


            // Player modal logic
            const playerModal = document.getElementById('playerModal');
            const closePlayerModal = document.getElementById('closePlayerModal');
            const applyPlayerBtn = document.getElementById('applyPlayerSelection');
            const checkboxList = document.getElementById('playerCheckboxList');

            function renderPlayerCheckboxes() {
                checkboxList.innerHTML = '';
                checkboxList.innerHTML += `<div style="margin-bottom:8px;">
                    <a href="#" id='selectAllPlayers' class='selector-action-link' style='margin-right:8px;'>Select All</a>
                    <a href="#" id='clearAllPlayers' class='selector-action-link'>Clear All</a>
                </div>`;
                mergedPlayers.forEach(p => {
                    const checked = selectedPlayers.includes(p.displayName) ? 'checked' : '';
                    checkboxList.innerHTML += `<label><input type="checkbox" value="${p.displayName}" ${checked}/> ${p.displayName}</label>`;
                });
                // Add event listeners for select/clear all
                setTimeout(() => {
                    document.getElementById('selectAllPlayers').onclick = (evt) => {
                        evt.preventDefault();
                        selectedPlayers = mergedPlayers.map(p => p.displayName);
                        renderPlayerCheckboxes();
                    };
                    document.getElementById('clearAllPlayers').onclick = (evt) => {
                        evt.preventDefault();
                        selectedPlayers = [];
                        renderPlayerCheckboxes();
                    };
                }, 0);
            }

            openPlayerBtn.onclick = function() {
                renderPlayerCheckboxes();
                playerModal.style.display = 'flex';
            };
            closePlayerModal.onclick = function() {
                playerModal.style.display = 'none';
            };
            applyPlayerBtn.onclick = function() {
                // Gather checked players
                selectedPlayers = Array.from(checkboxList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
                if (selectedPlayers.length === 0) {
                    // Always keep at least one selected
                    selectedPlayers = [mergedPlayers[0]?.displayName];
                }
                playerModal.style.display = 'none';
                renderPlayerDashboard(selectedPlayers, selectedCourses);
            };


            // --- Courses modal logic (multi-select) ---
            const courseModal = document.getElementById('courseModal');
            const closeCourseModal = document.getElementById('closeCourseModal');
            const applyCourseBtn = document.getElementById('applyCourseSelection');
            const courseCheckboxList = document.getElementById('courseRadioList');
            // Get all unique courses from data
            const allCourses = Array.from(new Set(data.map(r => r.CourseName).filter(Boolean))).sort();
            let selectedCourses = [...allCourses]; // All selected by default
            let selectedDateFilter = {
                mode: 'all',
                startDate: '',
                endDate: ''
            };

            function renderCourseCheckboxes() {
                courseCheckboxList.innerHTML = '';
                courseCheckboxList.innerHTML += `<div style="margin-bottom:8px;">
                    <a href="#" id='selectAllCourses' class='selector-action-link' style='margin-right:8px;'>Select All</a>
                    <a href="#" id='clearAllCourses' class='selector-action-link'>Clear All</a>
                </div>`;
                allCourses.forEach(c => {
                    const checked = selectedCourses.includes(c) ? 'checked' : '';
                    courseCheckboxList.innerHTML += `<label><input type="checkbox" value="${c}" ${checked}/> ${c}</label>`;
                });
                // Add event listeners for select/clear all
                setTimeout(() => {
                    document.getElementById('selectAllCourses').onclick = (evt) => {
                        evt.preventDefault();
                        selectedCourses = [...allCourses];
                        renderCourseCheckboxes();
                    };
                    document.getElementById('clearAllCourses').onclick = (evt) => {
                        evt.preventDefault();
                        selectedCourses = [];
                        renderCourseCheckboxes();
                    };
                }, 0);
            }

            openCourseBtn.onclick = function() {
                renderCourseCheckboxes();
                courseModal.style.display = 'flex';
            };
            closeCourseModal.onclick = function() {
                courseModal.style.display = 'none';
            };
            applyCourseBtn.onclick = function() {
                // Gather checked courses
                selectedCourses = Array.from(courseCheckboxList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
                if (selectedCourses.length === 0) {
                    // Always keep at least one selected
                    selectedCourses = [allCourses[0]];
                }
                courseModal.style.display = 'none';
                renderPlayerDashboard(selectedPlayers, selectedCourses);
            };

            // --- Date modal logic ---
            const dateModal = document.getElementById('dateModal');
            const closeDateModal = document.getElementById('closeDateModal');
            const applyDateBtn = document.getElementById('applyDateSelection');
            const dateCustomInputs = document.getElementById('dateCustomInputs');
            const customStartDate = document.getElementById('customStartDate');
            const customEndDate = document.getElementById('customEndDate');
            const scorecardModal = document.getElementById('scorecardModal');
            const closeScorecardModal = document.getElementById('closeScorecardModal');

            function getDatePresetValue() {
                const checked = document.querySelector('input[name="datePreset"]:checked');
                return checked ? checked.value : 'all';
            }

            function updateDateCustomVisibility() {
                const mode = getDatePresetValue();
                dateCustomInputs.style.display = mode === 'custom' ? 'flex' : 'none';
            }

            function syncDateModalFromState() {
                const preset = document.querySelector(`input[name="datePreset"][value="${selectedDateFilter.mode}"]`) || document.querySelector('input[name="datePreset"][value="all"]');
                if (preset) preset.checked = true;
                customStartDate.value = selectedDateFilter.startDate || '';
                customEndDate.value = selectedDateFilter.endDate || '';
                updateDateCustomVisibility();
            }

            openDateBtn.onclick = function() {
                syncDateModalFromState();
                dateModal.style.display = 'flex';
            };
            closeDateModal.onclick = function() {
                dateModal.style.display = 'none';
            };
            closeScorecardModal.onclick = function() {
                scorecardModal.style.display = 'none';
            };
            applyDateBtn.onclick = function() {
                selectedDateFilter.mode = getDatePresetValue();
                selectedDateFilter.startDate = customStartDate.value || '';
                selectedDateFilter.endDate = customEndDate.value || '';
                dateModal.style.display = 'none';
                renderPlayerDashboard(selectedPlayers, selectedCourses, selectedDateFilter);
            };

            document.querySelectorAll('input[name="datePreset"]').forEach(radio => {
                radio.addEventListener('change', updateDateCustomVisibility);
            });

            // Close modals on outside click
            window.onclick = function(event) {
                if (event.target === playerModal) playerModal.style.display = 'none';
                if (event.target === courseModal) courseModal.style.display = 'none';
                if (event.target === dateModal) dateModal.style.display = 'none';
                if (event.target === scorecardModal) scorecardModal.style.display = 'none';
            };

            function safeInt(val) {
                const n = parseInt(val);
                return isNaN(n) ? 0 : n;
            }
            function safeFloat(val) {
                const n = parseFloat(val);
                return isNaN(n) ? 0 : n;
            }
            function parseRoundDate(row) {
                let d = row.Date || row.StartDate || '';
                if (typeof d !== 'string' || !d.trim()) return new Date('');
                if (/\d{4}-\d{2}-\d{2} \d{4}/.test(d)) {
                    d = d.replace(/(\d{4}-\d{2}-\d{2}) (\d{2})(\d{2})/, '$1T$2:$3');
                }
                return new Date(d);
            }
            function getDateFilterBounds(filter) {
                if (!filter || filter.mode === 'all') return null;
                const now = new Date();
                const end = new Date(now);
                end.setHours(23, 59, 59, 999);

                if (filter.mode === 'lastWeek') {
                    const start = new Date(now);
                    start.setDate(start.getDate() - 7);
                    start.setHours(0, 0, 0, 0);
                    return { start, end };
                }
                if (filter.mode === 'lastMonth') {
                    const start = new Date(now);
                    start.setDate(start.getDate() - 30);
                    start.setHours(0, 0, 0, 0);
                    return { start, end };
                }
                if (filter.mode === 'custom') {
                    const start = filter.startDate ? new Date(`${filter.startDate}T00:00:00`) : null;
                    const customEnd = filter.endDate ? new Date(`${filter.endDate}T23:59:59.999`) : null;
                    return { start, end: customEnd };
                }
                return null;
            }
            function getDateFilterLabel(filter) {
                if (!filter || filter.mode === 'all') return 'All Dates';
                if (filter.mode === 'lastWeek') return 'Last Week';
                if (filter.mode === 'lastMonth') return 'Last Month';
                if (filter.mode === 'custom') {
                    const start = filter.startDate || 'Any';
                    const end = filter.endDate || 'Any';
                    return `${start} to ${end}`;
                }
                return 'All Dates';
            }
            function getQuality(tp) {
                if (tp <= -3) return 'excellent';
                if (tp <= 1) return 'solid';
                if (tp <= 5) return 'scrappy';
                return 'rough';
            }


            // Accepts array of selected players and array of selected courses
            function renderPlayerDashboard(selectedPlayers, selectedCourses, dateFilter = selectedDateFilter) {
                let selected = Array.isArray(selectedPlayers) ? selectedPlayers : [selectedPlayers];
                let selectedC = Array.isArray(selectedCourses) ? selectedCourses : [selectedCourses];
                // Find all merged player groups
                const mergedGroups = mergedPlayers.filter(p => selected.includes(p.displayName));
                // Merge all names
                const allNames = [].concat(...mergedGroups.map(g => g.allNames));
                // Filter rounds by selected courses if set
                let playerRounds = data.filter(row => allNames.includes(row.PlayerName));
                if (selectedC.length > 0) {
                    playerRounds = playerRounds.filter(row => selectedC.includes(row.CourseName));
                }
                const dateBounds = getDateFilterBounds(dateFilter);
                if (dateBounds) {
                    playerRounds = playerRounds.filter(row => {
                        const dt = parseRoundDate(row);
                        if (isNaN(dt.getTime())) return false;
                        if (dateBounds.start && dt < dateBounds.start) return false;
                        if (dateBounds.end && dt > dateBounds.end) return false;
                        return true;
                    });
                }
                // Remove rounds with Score = 0
                const validRounds = playerRounds.filter(r => safeInt(r.Total) !== 0);
                const removedRounds = playerRounds.filter(r => safeInt(r.Total) === 0);

                // Sort validRounds by date descending (most recent first)
                validRounds.sort((a, b) => parseRoundDate(b) - parseRoundDate(a));
                removedRounds.sort((a, b) => parseRoundDate(b) - parseRoundDate(a));

                // Summary metrics
                const totalRounds = validRounds.length;
                // --- Throw Type Counts ---
                let totalThrows = 0, aces = 0, birdies = 0, pars = 0, bogies = 0, dblBogies = 0, trpBogies = 0, other = 0;
                validRounds.forEach(r => {
                    // UDisc exports have hole-by-hole columns: Hole1, Hole2, ...
                    Object.keys(r).forEach(k => {
                        if (/^Hole\d+$/i.test(k) && r[k] !== '' && !isNaN(Number(r[k]))) {
                            const val = Number(r[k]);
                            if (val === 0) return; // skip holes not played
                            totalThrows++;
                            // Use getParForHole utility
                            const par = getParForHole(r.CourseName, r.LayoutName, k.replace('Hole',''), window.allUDiscData || data) || 3;
                            const diff = val - par;
                            if (val === 1) aces++;
                            else if (diff === -1) birdies++;
                            else if (diff === 0) pars++;
                            else if (diff === 1) bogies++;
                            else if (diff === 2) dblBogies++;
                            else if (diff === 3) trpBogies++;
                            else other++;
                        }
                    });
                });
                const pct = x => totalThrows > 0 ? ` | ${(100 * x / totalThrows).toFixed(1)}%` : '';
                const coursesPlayed = [...new Set(validRounds.map(r => r.CourseName))].length;
                const scores = validRounds.map(r => safeInt(r.Total)).filter(x => x !== 0);
                // Calculate to-par using per-hole par utility
                const toPars = validRounds.map(r => {
                    let sum = 0, holes = 0;
                    Object.keys(r).forEach(k => {
                        const m = k.match(/^Hole(\d+)$/i);
                        if (m && r[k] !== '' && !isNaN(Number(r[k]))) {
                            const val = Number(r[k]);
                            if (val === 0) return;
                            const par = getParForHole(r.CourseName, r.LayoutName, m[1], window.allUDiscData || data) || 3;
                            sum += val - par;
                            holes++;
                        }
                    });
                    return holes > 0 ? sum : 0;
                });
                const ratings = validRounds.map(r => safeInt(r.RoundRating)).filter(s => !isNaN(s) && s !== 0);
                const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
                const avgToPar = toPars.length > 0 ? (toPars.reduce((a, b) => a + b, 0) / toPars.length) : 0;
                // Best/worst round by rating, fallback to best/worst by score if no ratings
                const ratedRounds = validRounds.filter(r => r.RoundRating && r.RoundRating !== '' && !isNaN(safeInt(r.RoundRating)));
                let best = ratedRounds.length > 0 ? ratedRounds.reduce((a, b) => (safeInt(a.RoundRating) > safeInt(b.RoundRating) ? a : b)) : (validRounds.length > 0 ? validRounds.reduce((a, b) => (safeInt(a.Total) < safeInt(b.Total) ? a : b)) : {});
                let worst = ratedRounds.length > 0 ? ratedRounds.reduce((a, b) => (safeInt(a.RoundRating) < safeInt(b.RoundRating) ? a : b)) : (validRounds.length > 0 ? validRounds.reduce((a, b) => (safeInt(a.Total) > safeInt(b.Total) ? a : b)) : {});
                const bestPDGA = best.RoundRating ? (safeInt(best.RoundRating) * 2 + 500) : '';
                const worstPDGA = worst.RoundRating ? (safeInt(worst.RoundRating) * 2 + 500) : '';
                const ratedCount = ratedRounds.length;
                const avgRating = ratedCount > 0 ? Math.round(ratedRounds.map(r => safeInt(r.RoundRating)).reduce((a, b) => a + b, 0) / ratedCount) : 'N/A';
                const avgPDGA = ratedCount > 0 ? Math.round(ratedRounds.map(r => safeInt(r.RoundRating) * 2 + 500).reduce((a, b) => a + b, 0) / ratedCount) : 'N/A';

                // Recent 10 rounds (most recent)
                const recent = validRounds.slice(0, 10);

                // Summary cards HTML
                let summaryHtml = `<div class='small'>Player(s): <strong>${selected.join(', ')}</strong> &nbsp;•&nbsp; Course(s): <strong>${selectedC.length === allCourses.length ? 'All' : selectedC.join(', ')}</strong> &nbsp;•&nbsp; Date: <strong>${getDateFilterLabel(dateFilter)}</strong> &nbsp;•&nbsp; Source: UDisc Scorecards Export (Summary)</div>`;
                summaryHtml += `<div class='summary-grid'>`;
                summaryHtml += `<div class='card'><div class='card-title'>Total Rounds</div><div class='card-value'>${totalRounds}</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Courses Played</div><div class='card-value'>${coursesPlayed}</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Average Score</div><div class='card-value'>${avgScore.toFixed(1)}</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Average To Par</div><div class='card-value'>${avgToPar.toFixed(1)}</div></div>`;
                summaryHtml += `<div class='card best-round'><div class='card-title'>Best Round</div><div class='card-value'>${best.RoundRating || ''} | ${bestPDGA}</div><div class='small'>${best.CourseName || ''} (${best.LayoutName || ''}) — Score ${best.Total || ''}</div></div>`;
                summaryHtml += `<div class='card worst-round'><div class='card-title'>Worst Round</div><div class='card-value'>${worst.RoundRating || ''} | ${worstPDGA}</div><div class='small'>${worst.CourseName || ''} (${worst.LayoutName || ''}) — Score ${worst.Total || ''}</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Removed Rounds</div><div class='card-value'>${removedRounds.length}</div><div class='small'>Score = 0</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Rated Rounds</div><div class='card-value'>${ratedCount}</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Average Rating</div><div class='card-value'>${avgRating} | ${avgPDGA}</div></div>`;
                // --- New Throw Summary Tiles ---
                summaryHtml += `<div class='card'><div class='card-title'>Total Throws</div><div class='card-value'>${totalThrows}</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Aces</div><div class='card-value'>${aces}${pct(aces)}</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Birdies</div><div class='card-value'>${birdies}${pct(birdies)}</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Pars</div><div class='card-value'>${pars}${pct(pars)}</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Bogies</div><div class='card-value'>${bogies}${pct(bogies)}</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Dbl Bogies</div><div class='card-value'>${dblBogies}${pct(dblBogies)}</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Trp Bogies</div><div class='card-value'>${trpBogies}${pct(trpBogies)}</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Other</div><div class='card-value'>${other}${pct(other)}</div></div>`;
                summaryHtml += `</div>`;

                // Recent performance table
                let recentHtml = `<div class='section-title'>Recent Performance (Last 10 Rounds)</div>`;
                recentHtml += `<table><thead><tr><th>#</th><th>Date</th><th class='left-align-col'>Course / Layout</th><th>Score</th><th>To Par</th><th>Rating (U | P)</th><th class='left-align-col'>Quality</th></tr></thead><tbody>`;
                recent.forEach((r, i) => {
                    const pdga = r.RoundRating ? (safeInt(r.RoundRating) * 2 + 500) : '';
                    const ratingDisplay = r.RoundRating ? `<span class='rating-pill'>${r.RoundRating}</span> | <span class='rating-pill'>${pdga}</span>` : '';
                    const qClass = getQuality(safeInt(r['+/-']));
                    const qLabel = qClass.charAt(0).toUpperCase() + qClass.slice(1);
                    recentHtml += `<tr><td>${i + 1}</td><td>${r.Date || r.StartDate || ''}</td><td class='left-align-col'>${r.CourseName || ''} (${r.LayoutName || ''})</td><td>${r.Total || ''}</td><td>${r['+/-'] || ''}</td><td>${ratingDisplay}</td><td class='left-align-col'><span class='badge ${qClass}'>${qLabel}</span></td></tr>`;
                });
                recentHtml += `</tbody></table>`;

                // --- Rating Trend (last 50 rated rounds, most recent, chronological left→right) ---
                const trend50 = ratedRounds.slice(0, 50).slice().reverse();
                const trendLabels = trend50.map(r => r.Date || r.StartDate || '');
                const trendData = trend50.map(r => safeInt(r.RoundRating));
                // 7-round rolling average
                const rolling = [];
                for (let i = 0; i < trendData.length; i++) {
                    const start = Math.max(0, i - 6);
                    const subset = trendData.slice(start, i + 1);
                    const avg = subset.length > 0 ? Math.round(subset.reduce((a, b) => a + b, 0) / subset.length) : 0;
                    rolling.push(avg);
                }
                let trendHtml = `<div class='section-title'>Rating Trend (Last 50 Rated Rounds)</div><canvas id='ratingTrendChart' height='120'></canvas>`;

                // --- To-Par Trend (last 50 rounds, most recent, chronological left→right) ---
                const tp50 = validRounds.slice(0, 50).slice().reverse();
                const tpLabels = tp50.map(r => r.Date || r.StartDate || '');
                const tpData = tp50.map(r => safeInt(r['+/-']));
                const rollingTP = [];
                for (let i = 0; i < tpData.length; i++) {
                    const start = Math.max(0, i - 6);
                    const subset = tpData.slice(start, i + 1);
                    const avg = subset.length > 0 ? Math.round(subset.reduce((a, b) => a + b, 0) / subset.length) : 0;
                    rollingTP.push(avg);
                }
                let tpHtml = `<div class='section-title'>To-Par Trend (Last 50 Rounds)</div><canvas id='toParTrendChart' height='120'></canvas>`;

                // --- Course Breakdown ---
                const courseGroups = {};
                validRounds.forEach(r => {
                    if (!courseGroups[r.CourseName]) courseGroups[r.CourseName] = [];
                    courseGroups[r.CourseName].push(r);
                });
                let courseHtml = `<div class='section-title'>Course Breakdown</div><table class='course-breakdown-table'><thead><tr><th class='left-align-col'>Course</th><th>Rounds</th><th>Avg Score</th><th>Avg To Par</th><th>Best</th><th>Avg Rating</th><th>Avg PDGA</th><th>Scorecard</th></tr></thead><tbody>`;
                Object.entries(courseGroups).forEach(([course, group]) => {
                    const validGroup = group.filter(r => safeInt(r.Total) !== 0);
                    const avgS = validGroup.length > 0 ? validGroup.map(r => safeInt(r.Total)).reduce((a, b) => a + b, 0) / validGroup.length : 0;
                    // Calculate avgT (to-par) using per-hole par utility
                    const avgT = validGroup.length > 0 ? (validGroup.map(r => {
                        let sum = 0, holes = 0;
                        Object.keys(r).forEach(k => {
                            const m = k.match(/^Hole(\d+)$/i);
                            if (m && r[k] !== '' && !isNaN(Number(r[k]))) {
                                const val = Number(r[k]);
                                if (val === 0) return;
                                const par = getParForHole(r.CourseName, r.LayoutName, m[1], window.allUDiscData || data) || 3;
                                sum += val - par;
                                holes++;
                            }
                        });
                        return holes > 0 ? sum : 0;
                    }).reduce((a, b) => a + b, 0) / validGroup.length) : 0;
                    const bestR = Math.min(...group.map(r => safeInt(r.Total)));
                    const ratings = group.map(r => safeInt(r.RoundRating)).filter(s => !isNaN(s) && s !== 0);
                    const avgR = ratings.length > 0 ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : 'N/A';
                    const avgPDGA = ratings.length > 0 ? Math.round(ratings.map(x => x * 2 + 500).reduce((a, b) => a + b, 0) / ratings.length) : 'N/A';
                    const safeId = `scorecard-btn-${btoa(encodeURIComponent(course)).replace(/[^a-zA-Z0-9]/g, '')}`;
                    courseHtml += `<tr><td class='left-align-col'>${course}</td><td>${group.length}</td><td>${avgS.toFixed(1)}</td><td>${avgT.toFixed(1)}</td><td>${bestR}</td><td>${avgR}</td><td>${avgPDGA}</td><td><button class='apply-btn scorecard-btn' data-course="${encodeURIComponent(course)}" id="${safeId}">View</button></td></tr>`;
                });
                courseHtml += `</tbody></table>`;
                // Scorecard modal logic
                setTimeout(() => {
                    document.querySelectorAll('.scorecard-btn').forEach(btn => {
                        btn.onclick = function() {
                            const course = decodeURIComponent(this.getAttribute('data-course'));
                            renderScorecardModal(course, courseGroups[course]);
                        };
                    });
                }, 0);

                // Scorecard rendering function (to be implemented)
                function renderScorecardModal(courseName, rounds) {
                    // Always use the full data set to find the Par row for each layout
                    const allData = window.allUDiscData || data;
                    const allCourseRounds = allData.filter(r => r.CourseName === courseName);
                    // Group by layout, always including the 'Par' row if it exists
                    const layoutGroups = {};
                    allCourseRounds.forEach(r => {
                        const layout = r.LayoutName || 'Default';
                        if (!layoutGroups[layout]) layoutGroups[layout] = [];
                        layoutGroups[layout].push(r);
                    });
                    let html = '';
                    Object.entries(layoutGroups).forEach(([layout, allGroup]) => {
                        // Get Par row (if any) from all data
                        const parRow = allGroup.find(r => (r.PlayerName || '').toLowerCase().replace(/\s+/g, '').trim() === 'par');
                        // Get selected player rounds for this layout (excluding Par)
                        const selectedGroup = rounds.filter(r => (r.LayoutName || 'Default') === layout)
                            .filter(r => {
                                const pn = (r.PlayerName || '').toLowerCase().replace(/\s+/g, '').trim();
                                return pn !== 'par';
                            });
                        // Only show this layout if at least one selected player has played it
                        if (selectedGroup.length === 0) return;
                        // Build group for Scorecard: selected players + Par row (if any)
                        const group = parRow ? [parRow, ...selectedGroup] : selectedGroup;
                        // Find all holes that exist for this layout (at least one non-empty value in any round)
                        const holeNums = [];
                        group.forEach(r => {
                            Object.keys(r).forEach(k => {
                                const m = k.match(/^Hole(\d+)$/i);
                                if (m && r[k] !== '' && !isNaN(Number(r[k])) && !holeNums.includes(+m[1])) holeNums.push(+m[1]);
                            });
                        });
                        holeNums.sort((a, b) => a - b);
                        // Compute par and average per hole
                        const parByHole = {};
                        const avgByHole = {};
                        // Find the Par row for this layout (from group)
                        holeNums.forEach(h => {
                            // Use the Par row's HoleN value as par for this hole
                            let parVal = parRow ? parRow[`Hole${h}`] : undefined;
                            if (parVal !== undefined && parVal !== null && parVal !== '') {
                                parByHole[h] = Number(parVal);
                            } else {
                                parByHole[h] = '–';
                            }
                            // Avg: mean of HoleN (excluding Par row)
                            const scores = selectedGroup
                                .map(r => Number(r[`Hole${h}`]))
                                .filter(x => !isNaN(x) && x !== 0);
                            avgByHole[h] = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : '';
                        });
                        // Find 3 best/worst holes by average relative to par
                        const avgArr = holeNums
                            .map(h => {
                                const avg = avgByHole[h];
                                const par = parByHole[h];
                                if (avg === '' || par === '' || par === '–' || typeof par !== 'number') return null;
                                return { h, diff: avg - par };
                            })
                            .filter(x => x !== null)
                            .sort((a, b) => a.diff - b.diff);
                        const bestHoles = avgArr.slice(0, 3).map(x => x.h);
                        const worstHoles = avgArr.slice(-3).map(x => x.h);
                        // Build table: for each group of 9 holes, show 3 rows (Hole No, Par, Avg)
                        let table = `<div class='scorecard-title'><b>${courseName}</b> — <span class='scorecard-layout'>${layout}</span> <span class='scorecard-played'>(${group.length} played)</span></div>`;
                        for (let i = 0; i < holeNums.length; i += 9) {
                            const holes = holeNums.slice(i, i + 9);
                            table += `<table class='scorecard-table'><tbody>`;
                            // Row 1: Hole No
                            table += '<tr>';
                            holes.forEach(h => { table += `<th>H${h}</th>`; });
                            table += '</tr>';
                            // Row 2: Par
                            table += '<tr>';
                            holes.forEach(h => { table += `<td class='scorecard-par'>${parByHole[h]}</td>`; });
                            table += '</tr>';
                            // Row 3: Avg
                            table += '<tr>';
                            holes.forEach(h => {
                                let cls = 'scorecard-avg';
                                if (bestHoles.includes(h)) cls += ' scorecard-best';
                                if (worstHoles.includes(h)) cls += ' scorecard-worst';
                                table += `<td class='${cls}'>${avgByHole[h] !== '' ? avgByHole[h].toFixed(2) : ''}</td>`;
                            });
                            table += '</tr>';
                            table += '</tbody></table>';
                        }
                        html += `<div class='scorecard-block'>${table}</div>`;
                    });
                    document.getElementById('scorecardContent').innerHTML = html;
                    scorecardModal.style.display = 'flex';

                    // Helper: mode (most common value)
                    function mode(arr) {
                        if (!arr.length) return '';
                        const counts = {};
                        arr.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
                        return +Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
                    }
                }

                // --- Quality Summary ---
                const qualityGroups = { excellent: [], solid: [], scrappy: [], rough: [] };
                validRounds.forEach(r => { qualityGroups[getQuality(safeInt(r['+/-']))].push(r); });
                let qualityHtml = `<div class='section-title'>Round Quality Summary (By To Par)</div><table><thead><tr><th class='left-align-col'>Quality</th><th>Count</th><th>%</th><th>Avg Score</th><th>Avg To Par</th></tr></thead><tbody>`;
                const totalValid = validRounds.length;
                [['excellent','🟩'],['solid','🟨'],['scrappy','🟧'],['rough','🟥']].forEach(([key, emoji]) => {
                    const group = qualityGroups[key];
                    const count = group.length;
                    const pct = totalValid > 0 ? ((100 * count / totalValid).toFixed(1)) : '0.0';
                    const validQGroup = group.filter(r => safeInt(r.Total) !== 0);
                    const avgS = validQGroup.length > 0 ? (validQGroup.map(r => safeInt(r.Total)).reduce((a, b) => a + b, 0) / validQGroup.length).toFixed(1) : 'N/A';
                    // Calculate avgT (to-par) using per-hole par utility
                    const avgT = validQGroup.length > 0 ? (validQGroup.map(r => {
                        let sum = 0, holes = 0;
                        Object.keys(r).forEach(k => {
                            const m = k.match(/^Hole(\d+)$/i);
                            if (m && r[k] !== '' && !isNaN(Number(r[k]))) {
                                const val = Number(r[k]);
                                if (val === 0) return;
                                const par = getParForHole(r.CourseName, r.LayoutName, m[1], window.allUDiscData || data) || 3;
                                sum += val - par;
                                holes++;
                            }
                        });
                        return holes > 0 ? sum : 0;
                    }).reduce((a, b) => a + b, 0) / validQGroup.length).toFixed(1) : 'N/A';
                    const label = `${emoji} ${key.charAt(0).toUpperCase() + key.slice(1)}`;
                    qualityHtml += `<tr><td class='left-align-col'>${label}</td><td>${count}</td><td>${pct}%</td><td>${avgS}</td><td>${avgT}</td></tr>`;
                });
                qualityHtml += `</tbody></table>`;

                // --- Course Quality Matrix ---
                let matrixHtml = `<div class='section-title'>Course Quality Matrix</div><div class='small'>Counts of rounds by quality tier for each course.</div><table><thead><tr><th class='left-align-col'>Course</th><th class='matrix-cell'>🟩</th><th class='matrix-cell'>🟨</th><th class='matrix-cell'>🟧</th><th class='matrix-cell'>🟥</th></tr></thead><tbody>`;
                Object.entries(courseGroups).forEach(([course, group]) => {
                    const counts = { excellent: 0, solid: 0, scrappy: 0, rough: 0 };
                    group.forEach(r => { counts[getQuality(safeInt(r['+/-']))]++; });
                    matrixHtml += `<tr><td class='left-align-col'>${course}</td><td class='matrix-cell'>${counts.excellent}</td><td class='matrix-cell'>${counts.solid}</td><td class='matrix-cell'>${counts.scrappy}</td><td class='matrix-cell'>${counts.rough}</td></tr>`;
                });
                matrixHtml += `</tbody></table>`;

                // --- Removed Rounds ---
                let removedHtml = `<div class='section-title'>Removed Rounds (Score = 0)</div><div class='small'>These rounds were excluded from all metrics and summaries.</div><table><thead><tr><th>Date</th><th class='left-align-col'>Course / Layout</th><th>Score</th><th>Rating</th></tr></thead><tbody>`;
                removedRounds.forEach(r => {
                    removedHtml += `<tr><td>${r.Date || r.StartDate || ''}</td><td class='left-align-col'>${r.CourseName || ''} (${r.LayoutName || ''})</td><td>${r.Total || ''}</td><td>${r.RoundRating || ''}</td></tr>`;
                });
                removedHtml += `</tbody></table>`;

                document.getElementById('playerDashboard').innerHTML = `<h1>UDisc Round Dashboard</h1>${summaryHtml}${recentHtml}${trendHtml}${tpHtml}${courseHtml}${qualityHtml}${matrixHtml}${removedHtml}`;

                // Render charts
                setTimeout(() => {
                    const cs = getComputedStyle(document.documentElement);
                    const chartTextSub = cs.getPropertyValue('--text-sub').trim() || '#9ca3af';
                    const chartBorder = cs.getPropertyValue('--border').trim() || '#1f2937';
                    const chartText = cs.getPropertyValue('--text').trim() || '#e5e7eb';
                    if (document.getElementById('ratingTrendChart')) {
                        new Chart(document.getElementById('ratingTrendChart').getContext('2d'), {
                            type: 'line',
                            data: {
                                labels: trendLabels,
                                datasets: [
                                    {
                                        label: 'UDisc Rating',
                                        data: trendData,
                                        borderColor: '#60a5fa',
                                        backgroundColor: 'rgba(96,165,250,0.15)',
                                        borderWidth: 2,
                                        tension: 0.3,
                                        pointRadius: 2,
                                        pointBackgroundColor: '#93c5fd'
                                    },
                                    {
                                        label: '7-Round Avg',
                                        data: rolling,
                                        borderColor: '#fbbf24',
                                        backgroundColor: 'rgba(251,191,36,0.15)',
                                        borderWidth: 2,
                                        tension: 0.3,
                                        pointRadius: 0
                                    }
                                ]
                            },
                            options: {
                                responsive: true,
                                scales: {
                                    x: { ticks: { color: chartTextSub }, grid: { color: chartBorder } },
                                    y: { ticks: { color: chartTextSub }, grid: { color: chartBorder } }
                                },
                                plugins: {
                                    legend: { labels: { color: chartText } }
                                }
                            }
                        });
                    }
                    if (document.getElementById('toParTrendChart')) {
                        new Chart(document.getElementById('toParTrendChart').getContext('2d'), {
                            type: 'line',
                            data: {
                                labels: tpLabels,
                                datasets: [
                                    {
                                        label: 'To-Par',
                                        data: tpData,
                                        borderColor: '#34d399',
                                        backgroundColor: 'rgba(52,211,153,0.15)',
                                        borderWidth: 2,
                                        tension: 0.3,
                                        pointRadius: 2,
                                        pointBackgroundColor: '#6ee7b7'
                                    },
                                    {
                                        label: '7-Round Avg',
                                        data: rollingTP,
                                        borderColor: '#fbbf24',
                                        backgroundColor: 'rgba(251,191,36,0.15)',
                                        borderWidth: 2,
                                        tension: 0.3,
                                        pointRadius: 0
                                    }
                                ]
                            },
                            options: {
                                responsive: true,
                                scales: {
                                    x: { ticks: { color: chartTextSub }, grid: { color: chartBorder } },
                                    y: { ticks: { color: chartTextSub }, grid: { color: chartBorder } }
                                },
                                plugins: {
                                    legend: { labels: { color: chartText } }
                                }
                            }
                        });
                    }
                }, 0);
            }

            // Initial render (default player and all courses)
            setTimeout(() => {
                renderPlayerDashboard(selectedPlayers, selectedCourses);
            }, 0);
        },
        error: function(error) {
            document.getElementById('dashboardContainer').innerHTML = '<p>Error parsing file: ' + error.message + '</p>';
        }
    });
}

function downloadDashboardHtml() {
    if (!window.generatedDashboardHtml) return;
    const blob = new Blob([window.generatedDashboardHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard.html';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// Export button handlers via event delegation (buttons are dynamically injected)
document.addEventListener('click', function(e) {
    const scorecardImageTrigger = e.target.closest('#scorecardSaveImageBtn');
    if (scorecardImageTrigger) {
        e.preventDefault();
        const content = document.getElementById('scorecardContent');
        if (!content) return;
        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#181f2f';
        html2canvas(content, {backgroundColor: bgColor, scale: 2}).then(canvas => {
            const link = document.createElement('a');
            link.download = 'scorecard.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }
    const scorecardPdfTrigger = e.target.closest('#scorecardSavePdfBtn');
    if (scorecardPdfTrigger) {
        e.preventDefault();
        const content = document.getElementById('scorecardContent');
        if (!content) return;
        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#181f2f';
        html2canvas(content, {backgroundColor: bgColor, scale: 2}).then(canvas => {
            const pdf = new window.jspdf.jsPDF({orientation: 'portrait', unit: 'pt', format: 'a4'});
            const margin = 16;
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pageWidth - margin * 2;
            const pageHeightInCanvas = Math.floor((pageHeight - margin * 2) * canvas.width / imgWidth);
            const totalPages = Math.ceil(canvas.height / pageHeightInCanvas);
            for (let page = 0; page < totalPages; page++) {
                if (page > 0) pdf.addPage();
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = canvas.width;
                const sliceStart = page * pageHeightInCanvas;
                const sliceHeight = Math.min(pageHeightInCanvas, canvas.height - sliceStart);
                sliceCanvas.height = sliceHeight;
                const ctx = sliceCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, -sliceStart);
                const sliceImgHeight = sliceHeight * imgWidth / canvas.width;
                pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, margin, imgWidth, sliceImgHeight);
            }
            pdf.save('scorecard.pdf');
        });
    }
    const imageTrigger = e.target.closest('#saveImageBtn');
    if (imageTrigger) {
        e.preventDefault();
        const dash = document.querySelector('.dashboard-root');
        if (!dash) return;
        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-surface').trim() || '#111827';
        html2canvas(dash, {backgroundColor: bgColor, scale: 2}).then(canvas => {
            const link = document.createElement('a');
            link.download = 'dashboard.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }
    const pdfTrigger = e.target.closest('#savePdfBtn');
    if (pdfTrigger) {
        e.preventDefault();
        const dash = document.querySelector('.dashboard-root');
        if (!dash) return;
        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-surface').trim() || '#111827';
        html2canvas(dash, {backgroundColor: bgColor, scale: 2}).then(canvas => {
            const pdf = new window.jspdf.jsPDF({orientation: 'portrait', unit: 'pt', format: 'a4'});
            const margin = 16;
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pageWidth - margin * 2;
            // How many canvas pixels fit in one PDF page (vertically)
            const pageHeightInCanvas = Math.floor((pageHeight - margin * 2) * canvas.width / imgWidth);
            const totalPages = Math.ceil(canvas.height / pageHeightInCanvas);
            for (let page = 0; page < totalPages; page++) {
                if (page > 0) pdf.addPage();
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = canvas.width;
                const sliceStart = page * pageHeightInCanvas;
                const sliceHeight = Math.min(pageHeightInCanvas, canvas.height - sliceStart);
                sliceCanvas.height = sliceHeight;
                const ctx = sliceCanvas.getContext('2d');
                ctx.drawImage(canvas, 0, -sliceStart);
                const sliceImgHeight = sliceHeight * imgWidth / canvas.width;
                pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', margin, margin, imgWidth, sliceImgHeight);
            }
            pdf.save('dashboard.pdf');
        });
    }
});

// ===== Theme Management =====
function setTheme(theme) {
    localStorage.setItem('udisc-theme', theme);
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    document.querySelectorAll('.theme-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.getAttribute('data-theme-val') === theme);
    });
}
// Apply saved (or system) theme immediately
(function() {
    var saved = localStorage.getItem('udisc-theme') || 'system';
    setTheme(saved);
})();