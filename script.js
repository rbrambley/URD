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
        <a id="generateCoachBtn" href="#" class="export-link">Generate AI Coach Plan</a>
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
            const coachModal = document.getElementById('coachModal');
            const closeCoachModal = document.getElementById('closeCoachModal');
            const coachContent = document.getElementById('coachContent');
            let lastDashboardSnapshot = null;
            let localCoachGenerator = null;
            const coachSettingsState = {
                useLocalLLMRewrite: false,
                daysPerWeek: 5,
                minutesPerSession: 45,
                intentPreset: 'balanced',
                intentText: ''
            };
            const savedCoachLLM = localStorage.getItem('coach-use-local-llm');
            if (savedCoachLLM !== null) coachSettingsState.useLocalLLMRewrite = savedCoachLLM === 'true';
            const savedCoachDays = localStorage.getItem('coach-days-per-week');
            if (savedCoachDays) coachSettingsState.daysPerWeek = Math.max(3, Math.min(7, safeInt(savedCoachDays) || 5));
            const savedCoachMinutes = localStorage.getItem('coach-minutes-per-session');
            if (savedCoachMinutes) coachSettingsState.minutesPerSession = Math.max(30, Math.min(90, safeInt(savedCoachMinutes) || 45));
            const savedCoachIntent = localStorage.getItem('coach-intent-preset');
            if (savedCoachIntent) coachSettingsState.intentPreset = savedCoachIntent;
            const savedCoachIntentText = localStorage.getItem('coach-intent-text');
            if (savedCoachIntentText) coachSettingsState.intentText = savedCoachIntentText;

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
            closeCoachModal.onclick = function() {
                coachModal.style.display = 'none';
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
                if (event.target === coachModal) coachModal.style.display = 'none';
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
            function calcStdDev(values) {
                if (!values || values.length === 0) return 0;
                const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
                const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
                return Math.sqrt(variance);
            }
            const coachDrillLibrary = [
                { id: 'safe-landing-round', title: 'Safe Landing Round', tags: ['risk-control', 'course-management'], minutes: '1 round', detail: 'Play one round choosing conservative landing zones on every tee shot.' },
                { id: 'fairway-line-work', title: 'Fairway Line Control', tags: ['risk-control', 'consistency'], minutes: '35-45 min', detail: 'Throw 30 fairway-driver reps on one line shape and track misses left/right.' },
                { id: 'midrange-centerline', title: 'Midrange Centerline Reps', tags: ['risk-control', 'approach'], minutes: '30-40 min', detail: 'Throw 25-30 mids to a center target and log circle-hit percentage.' },
                { id: 'edge-circle-putts', title: 'Edge-of-Circle Putting', tags: ['putting', 'birdie-conversion'], minutes: '20-30 min', detail: 'Hit 30 edge-of-circle putts in sets of 10 and record make rate.' },
                { id: 'birdie-approach-ladder', title: 'Birdie Approach Ladder', tags: ['birdie-conversion', 'approach'], minutes: '25-35 min', detail: 'Throw approach ladders at 150/200/250 feet and score each rep by makeable putt quality.' },
                { id: 'scramble-save-block', title: 'Scramble Save Block', tags: ['scramble', 'risk-control'], minutes: '25-35 min', detail: 'Play 20 scramble scenarios from obstructed lies and track save percentage.' },
                { id: 'pre-shot-routine', title: 'Pre-Shot Routine Round', tags: ['consistency', 'mental'], minutes: '1 round', detail: 'Run one fixed pre-shot checklist on every drive and upshot for an entire round.' },
                { id: 'pressure-putt-finisher', title: 'Pressure Putt Finisher', tags: ['putting', 'consistency'], minutes: '15-20 min', detail: 'Finish sessions with 15 pressure putts; reset count if you miss 2 in a row.' },
                { id: 'placement-only-round', title: 'Placement-Only Scoring Round', tags: ['course-management', 'consistency'], minutes: '1 round', detail: 'Play for position first and throw only your highest-trust lines.' },
                { id: 'distance-control-grid', title: 'Distance Control Grid', tags: ['approach', 'consistency'], minutes: '30-40 min', detail: 'Throw 5 discs to 4 distance buckets and track average distance error.' }
            ];
            function toPercent(x) {
                return (100 * x).toFixed(1);
            }
            function confidenceFrom(rounds, severity) {
                const roundsScore = Math.min(1, rounds / 30);
                const sevScore = Math.min(1, Math.max(0, severity));
                const combined = 0.55 * roundsScore + 0.45 * sevScore;
                if (combined >= 0.7) return 'High';
                if (combined >= 0.45) return 'Medium';
                return 'Low';
            }
            function detectArchetype(snapshot) {
                if (snapshot.riskOutcomeRate >= 0.5 && snapshot.birdieRate >= 0.18) return 'Volatile Attacker';
                if (snapshot.birdieRate < 0.14 && snapshot.riskOutcomeRate <= 0.42) return 'Low-Birdie Grinder';
                if (snapshot.riskOutcomeRate >= 0.5 && snapshot.toParStdDev > 3.0) return 'Floor-Collapser';
                const recentTrend = snapshot.previousTenAvgToPar !== null ? (snapshot.recentTenAvgToPar - snapshot.previousTenAvgToPar) : 0;
                if (Math.abs(recentTrend) <= 0.4 && snapshot.toParStdDev <= 2.6) return 'Plateaued Improver';
                return 'Balanced Builder';
            }
            function getArchetypeSelectionExplanation(snapshot) {
                const recentTrend = snapshot.previousTenAvgToPar !== null
                    ? (snapshot.recentTenAvgToPar - snapshot.previousTenAvgToPar)
                    : 0;
                const checks = [
                    {
                        name: 'Volatile Attacker',
                        pass: snapshot.riskOutcomeRate >= 0.5 && snapshot.birdieRate >= 0.18,
                        rule: `risk >= 50% and birdie >= 18% (risk ${snapshot.riskOutcomeRatePct}%, birdie ${snapshot.birdieRatePct}%)`
                    },
                    {
                        name: 'Low-Birdie Grinder',
                        pass: snapshot.birdieRate < 0.14 && snapshot.riskOutcomeRate <= 0.42,
                        rule: `birdie < 14% and risk <= 42% (birdie ${snapshot.birdieRatePct}%, risk ${snapshot.riskOutcomeRatePct}%)`
                    },
                    {
                        name: 'Floor-Collapser',
                        pass: snapshot.riskOutcomeRate >= 0.5 && snapshot.toParStdDev > 3.0,
                        rule: `risk >= 50% and to-par SD > 3.0 (risk ${snapshot.riskOutcomeRatePct}%, SD ${snapshot.toParStdDev.toFixed(1)})`
                    },
                    {
                        name: 'Plateaued Improver',
                        pass: Math.abs(recentTrend) <= 0.4 && snapshot.toParStdDev <= 2.6,
                        rule: `|recent trend| <= 0.4 and to-par SD <= 2.6 (trend ${recentTrend.toFixed(1)}, SD ${snapshot.toParStdDev.toFixed(1)})`
                    }
                ];
                const matched = checks.find(c => c.pass);
                const selected = matched ? matched.name : 'Balanced Builder';
                if (matched) {
                    return {
                        selected,
                        summary: `Selected archetype: ${matched.name}.`,
                        details: checks
                            .slice(0, checks.findIndex(c => c.name === matched.name) + 1)
                            .map(c => `${c.pass ? 'Match' : 'No match'}: ${c.name} (${c.rule})`)
                    };
                }
                return {
                    selected,
                    summary: 'No specific archetype rule matched, so Balanced Builder was selected as fallback.',
                    details: [
                        ...checks.map(c => `No match: ${c.name} (${c.rule})`),
                        'Match: Balanced Builder (fallback: no earlier archetype rule matched).'
                    ]
                };
            }
            function getArchetypeWeights(archetype) {
                const base = { risk: 1, birdie: 1, consistency: 1, trend: 1 };
                if (archetype === 'Volatile Attacker') return { risk: 1.35, birdie: 1.1, consistency: 1.15, trend: 1 };
                if (archetype === 'Low-Birdie Grinder') return { risk: 0.95, birdie: 1.4, consistency: 1.05, trend: 1.1 };
                if (archetype === 'Floor-Collapser') return { risk: 1.4, birdie: 0.95, consistency: 1.35, trend: 1.1 };
                if (archetype === 'Plateaued Improver') return { risk: 1, birdie: 1.2, consistency: 1.2, trend: 1.3 };
                return base;
            }
            function pickDrills(tags, limit = 2, usedIds = null) {
                const scored = coachDrillLibrary.map(d => {
                    const overlap = d.tags.filter(t => tags.includes(t)).length;
                    return { drill: d, score: overlap };
                }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
                const chosen = [];
                for (const item of scored) {
                    if (chosen.length >= limit) break;
                    if (usedIds && usedIds.has(item.drill.id)) continue;
                    chosen.push(item);
                    if (usedIds) usedIds.add(item.drill.id);
                }
                if (chosen.length < limit) {
                    for (const item of scored) {
                        if (chosen.length >= limit) break;
                        if (chosen.find(c => c.drill.id === item.drill.id)) continue;
                        chosen.push(item);
                    }
                }
                return chosen.map(x => `${x.drill.title}: ${x.drill.detail}`);
            }
            function pickDrillObjects(tags, limit = 2, usedIds = null) {
                const scored = coachDrillLibrary.map(d => {
                    const overlap = d.tags.filter(t => tags.includes(t)).length;
                    return { drill: d, score: overlap };
                }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
                const chosen = [];
                for (const item of scored) {
                    if (chosen.length >= limit) break;
                    if (usedIds && usedIds.has(item.drill.id)) continue;
                    chosen.push(item.drill);
                    if (usedIds) usedIds.add(item.drill.id);
                }
                if (chosen.length < limit) {
                    for (const item of scored) {
                        if (chosen.length >= limit) break;
                        if (chosen.find(c => c.id === item.drill.id)) continue;
                        chosen.push(item.drill);
                    }
                }
                return chosen;
            }
            function getCoachConstraints() {
                return {
                    daysPerWeek: Math.max(3, Math.min(7, safeInt(coachSettingsState.daysPerWeek))),
                    minutesPerSession: Math.max(30, Math.min(90, safeInt(coachSettingsState.minutesPerSession))),
                    intentPreset: coachSettingsState.intentPreset || 'balanced',
                    intentText: (coachSettingsState.intentText || '').trim()
                };
            }
            function parseCustomIntent(customText) {
                const text = (customText || '').toLowerCase();
                const matches = [];
                const addMatch = (id, title, directive, tags, preferredFocusIds, boosts, kpiCheck) => {
                    if (matches.find(m => m.id === id)) return;
                    matches.push({ id, title, directive, tags, preferredFocusIds, boosts, kpiCheck });
                };

                if (/drive\s*accuracy|fairway|off\s*tee\s*accuracy|tee\s*accuracy/.test(text)) {
                    addMatch(
                        'drive-accuracy',
                        'Drive Accuracy',
                        'Prioritize controlled tee-shot placement and fairway-hit consistency before adding power.',
                        ['risk-control', 'consistency', 'course-management'],
                        ['risk', 'consistency', 'birdie'],
                        { risk: 0.28, consistency: 0.18, birdie: 0 },
                        'Track fairway-hit percentage over each 5-round block.'
                    );
                }
                if (/drive\s*distance|throw\s*farther|more\s*distance|distance\s*off\s*tee/.test(text)) {
                    addMatch(
                        'drive-distance',
                        'Controlled Drive Distance',
                        'Build distance with control: pair power sessions with line-holding and miss-dispersion tracking.',
                        ['birdie-conversion', 'approach', 'consistency'],
                        ['birdie', 'consistency', 'risk'],
                        { risk: 0, consistency: 0.1, birdie: 0.3 },
                        'Track average landing distance and left/right dispersion for 10 max-control drives.'
                    );
                }
                if (/hit\s*my\s*lines|line\s*shape|line\s*control/.test(text)) {
                    addMatch(
                        'line-control',
                        'Line-Hitting Consistency',
                        'Emphasize repeatable release angles and target-line execution under light pressure.',
                        ['consistency', 'risk-control', 'approach'],
                        ['consistency', 'risk', 'birdie'],
                        { risk: 0.1, consistency: 0.3, birdie: 0 },
                        'Track planned-vs-actual line execution rate each round.'
                    );
                }
                if (/pdga|rating|increase\s*my\s*rating|raise\s*my\s*rating/.test(text)) {
                    addMatch(
                        'pdga-rating',
                        'PDGA Rating Progression',
                        'Prioritize low-variance scoring and bogey avoidance while preserving birdie opportunities.',
                        ['risk-control', 'consistency', 'birdie-conversion'],
                        ['risk', 'consistency', 'birdie'],
                        { risk: 0.2, consistency: 0.22, birdie: 0.08 },
                        'Track clean-round percentage and double-bogey-or-worse frequency every 5 rounds.'
                    );
                }

                return {
                    text: customText || '',
                    matches,
                    combined: {
                        tags: Array.from(new Set(matches.flatMap(m => m.tags))),
                        preferredFocusIds: matches.flatMap(m => m.preferredFocusIds).filter((x, i, arr) => arr.indexOf(x) === i),
                        boosts: matches.reduce((acc, m) => ({
                            risk: acc.risk + (m.boosts.risk || 0),
                            consistency: acc.consistency + (m.boosts.consistency || 0),
                            birdie: acc.birdie + (m.boosts.birdie || 0)
                        }), { risk: 0, consistency: 0, birdie: 0 }),
                        kpiChecks: matches.map(m => m.kpiCheck)
                    }
                };
            }
            function getCoachIntentProfile(constraints) {
                const preset = constraints && constraints.intentPreset ? constraints.intentPreset : 'balanced';
                const customText = (constraints && constraints.intentText ? constraints.intentText : '').trim();
                const profile = {
                    preset,
                    label: 'Balanced Improvement',
                    instruction: 'Keep plan balanced across risk control, birdie conversion, and consistency.',
                    maxMinutes: null,
                    riskBoost: 0,
                    birdieBoost: 0,
                    consistencyBoost: 0,
                    customIntent: null
                };
                if (preset === 'prep_tournament') {
                    profile.label = 'Prep for Tournament';
                    profile.instruction = 'Prioritize scoring floor, routine consistency, and on-course execution under pressure.';
                    profile.riskBoost = 0.2;
                    profile.consistencyBoost = 0.25;
                } else if (preset === 'short_sessions') {
                    profile.label = 'Short Sessions Only';
                    profile.instruction = 'Favor compact sessions with one primary drill block and quick KPI checks.';
                    profile.maxMinutes = 35;
                } else if (preset === 'putting_priority') {
                    profile.label = 'Putting Priority Week';
                    profile.instruction = 'Bias training toward putting reps and birdie conversion while maintaining risk control floor.';
                    profile.birdieBoost = 0.28;
                } else if (preset === 'custom' && customText) {
                    const parsed = parseCustomIntent(customText);
                    profile.label = `Custom: ${customText}`;
                    profile.customIntent = parsed;
                    if (parsed.matches.length > 0) {
                        profile.instruction = `Custom user intent mapped to: ${parsed.matches.map(m => m.title).join(', ')}.`;
                        profile.riskBoost += parsed.combined.boosts.risk;
                        profile.birdieBoost += parsed.combined.boosts.birdie;
                        profile.consistencyBoost += parsed.combined.boosts.consistency;
                    } else {
                        profile.instruction = `Custom user intent: ${customText}.`;
                    }
                }
                return profile;
            }
            function buildLocalCoachPlan(snapshot, constraints) {
                const recentTrend = snapshot.previousTenAvgToPar !== null
                    ? (snapshot.recentTenAvgToPar - snapshot.previousTenAvgToPar)
                    : 0;
                const intent = getCoachIntentProfile(constraints);
                const archetype = detectArchetype(snapshot);
                const archetypeSelection = getArchetypeSelectionExplanation(snapshot);
                const weights = getArchetypeWeights(archetype);
                const focusPool = [];

                const riskSeverity = Math.max(0, (snapshot.riskOutcomeRate - 0.38) / 0.2) + intent.riskBoost;
                focusPool.push({
                    id: 'risk',
                    title: 'Reduce High-Risk Mistakes',
                    why: `High-risk outcomes are ${snapshot.riskOutcomeRatePct}% of holes.`,
                    target: `Reduce risk outcomes to ${(Math.max(0.22, snapshot.riskOutcomeRate - 0.05) * 100).toFixed(1)}% over next 10 rounds.`,
                    evidence: [`Current risk rate: ${snapshot.riskOutcomeRatePct}%`, 'Driver miss-to-scramble pattern likely inflating scores.'],
                    tags: ['risk-control', 'course-management', 'consistency'],
                    severity: riskSeverity,
                    confidence: confidenceFrom(snapshot.totalRounds, riskSeverity)
                });

                const birdieSeverity = Math.max(0, (0.19 - snapshot.birdieRate) / 0.1) + intent.birdieBoost;
                focusPool.push({
                    id: 'birdie',
                    title: 'Increase Birdie Conversion',
                    why: `Birdie rate is ${snapshot.birdieRatePct}% of holes.`,
                    target: `Raise birdie rate to ${(Math.min(30, snapshot.birdieRate * 100 + 3)).toFixed(1)}% in next 10 rounds.`,
                    evidence: [`Current birdie rate: ${snapshot.birdieRatePct}%`, 'Approach + circle-edge putt conversion are likely biggest upside levers.'],
                    tags: ['birdie-conversion', 'putting', 'approach'],
                    severity: birdieSeverity,
                    confidence: confidenceFrom(snapshot.totalRounds, birdieSeverity)
                });

                const consistencySeverity = Math.max(0, (snapshot.toParStdDev - 2.4) / 1.6) + intent.consistencyBoost;
                focusPool.push({
                    id: 'consistency',
                    title: 'Stabilize Round-to-Round Variance',
                    why: `To-par standard deviation is ${snapshot.toParStdDev.toFixed(1)}.`,
                    target: `Lower to-par SD to ${Math.max(1.8, snapshot.toParStdDev - 0.8).toFixed(1)} in 4 weeks.`,
                    evidence: [`Current volatility: ${snapshot.toParStdDev.toFixed(1)}`, 'Large spread suggests avoidable blow-up holes.'],
                    tags: ['consistency', 'mental', 'course-management'],
                    severity: consistencySeverity,
                    confidence: confidenceFrom(snapshot.totalRounds, consistencySeverity)
                });

                const trendSeverity = Math.max(0, recentTrend / 2.5);
                focusPool.push({
                    id: 'trend',
                    title: 'Reverse Recent Trend Drift',
                    why: snapshot.previousTenAvgToPar !== null
                        ? `Recent 10 rounds are ${recentTrend.toFixed(1)} worse to-par than previous 10.`
                        : 'Recent-trend sample is limited; use a short-cycle reset plan.',
                    target: snapshot.previousTenAvgToPar !== null
                        ? `Return recent average to ${snapshot.previousTenAvgToPar.toFixed(1)} to-par baseline.`
                        : 'Improve last-10 average by at least 0.8 strokes to-par in 2 weeks.',
                    evidence: snapshot.previousTenAvgToPar !== null
                        ? [`Last 10 to-par: ${snapshot.recentTenAvgToPar.toFixed(1)}`, `Prev 10 to-par: ${snapshot.previousTenAvgToPar.toFixed(1)}`]
                        : ['Not enough prior rounds for stable trend comparison.'],
                    tags: ['consistency', 'course-management', 'risk-control'],
                    severity: trendSeverity,
                    confidence: confidenceFrom(snapshot.totalRounds, trendSeverity)
                });

                const rankedFocuses = focusPool
                    .map(f => ({ ...f, score: f.severity * (weights[f.id] || 1) }))
                    .sort((a, b) => b.score - a.score);

                let selectedFocuses = rankedFocuses.filter(f => f.score > 0.15).slice(0, 3);
                if (selectedFocuses.length === 0) {
                    selectedFocuses = [{
                        id: 'momentum',
                        title: 'Maintain Momentum and Raise Ceiling',
                        why: 'No major leaks stand out from current filters.',
                        target: 'Preserve floor and gain 1-2 makeable birdie looks per round.',
                        evidence: ['Current profile is balanced across risk, conversion, and consistency.'],
                        tags: ['birdie-conversion', 'consistency'],
                        severity: 0.25,
                        confidence: confidenceFrom(snapshot.totalRounds, 0.25),
                        score: 0.25
                    }];
                }

                const getIntentPreferredFocusIds = () => {
                    if (intent.preset === 'putting_priority') return ['birdie', 'consistency', 'risk'];
                    if (intent.preset === 'prep_tournament') return ['risk', 'consistency', 'trend'];
                    if (intent.preset === 'short_sessions') return ['risk', 'birdie', 'consistency'];
                    if (intent.preset === 'custom') {
                        if (intent.customIntent && intent.customIntent.matches.length > 0) {
                            return intent.customIntent.combined.preferredFocusIds;
                        }
                        const t = (constraints.intentText || '').toLowerCase();
                        if (/putt|c1|c2|birdie/.test(t)) return ['birdie', 'consistency', 'risk'];
                        if (/tournament|event|pressure|clean/.test(t)) return ['risk', 'consistency', 'birdie'];
                        if (/short|quick|time|busy/.test(t)) return ['risk', 'birdie', 'consistency'];
                    }
                    return [];
                };
                const preferredIds = getIntentPreferredFocusIds();
                const severeLeak = rankedFocuses[0];
                if (preferredIds.length > 0) {
                    const preferredFocus = preferredIds
                        .map(id => rankedFocuses.find(f => f.id === id))
                        .find(f => !!f);
                    if (preferredFocus) {
                        const severeGap = severeLeak && severeLeak.id !== preferredFocus.id && (severeLeak.score - preferredFocus.score) > 0.75;
                        if (!severeGap) {
                            const dedup = [preferredFocus, ...selectedFocuses].filter((f, idx, arr) => arr.findIndex(x => x.id === f.id) === idx);
                            selectedFocuses = dedup.slice(0, 3);
                        }
                    }
                }

                const focuses = selectedFocuses.map(f => ({
                    title: f.title,
                    why: f.why,
                    target: f.target,
                    evidence: f.evidence,
                    confidence: f.confidence,
                    tags: f.tags,
                    drills: pickDrills(f.tags, 2)
                }));

                const strengths = [];
                if (snapshot.birdieRate >= 0.20) strengths.push(`Birdie production is strong at ${snapshot.birdieRatePct}% of holes.`);
                if (snapshot.riskOutcomeRate <= 0.35) strengths.push(`Mistake containment is solid with only ${snapshot.riskOutcomeRatePct}% high-risk holes.`);
                if (snapshot.toParStdDev <= 2.2) strengths.push(`Round consistency is good (to-par SD ${snapshot.toParStdDev.toFixed(1)}).`);
                if (strengths.length === 0) strengths.push('Baseline is steady enough to support focused gains with targeted reps.');

                const gaps = [];
                if (snapshot.riskOutcomeRate > 0.40) gaps.push(`High-risk outcomes are elevated at ${snapshot.riskOutcomeRatePct}% of holes.`);
                if (snapshot.birdieRate < 0.18) gaps.push(`Birdie conversion is low at ${snapshot.birdieRatePct}% of holes.`);
                if (snapshot.toParStdDev > 2.8) gaps.push(`Score volatility is high (to-par SD ${snapshot.toParStdDev.toFixed(1)}).`);
                if (recentTrend > 0.5) gaps.push(`Recent 10-round trend is ${recentTrend.toFixed(1)} strokes worse than prior 10.`);
                if (gaps.length === 0) gaps.push('No critical leaks detected; focus on incremental scoring gains.');

                const primary = focuses[0];
                const min = intent.maxMinutes ? Math.min(constraints.minutesPerSession, intent.maxMinutes) : constraints.minutesPerSession;
                const sessionDuration = min <= 30 ? '20-30 min' : min <= 45 ? '30-45 min' : min <= 60 ? '45-60 min' : '60-75 min';

                const analysis = [
                    `Sample includes ${snapshot.totalRounds} rounds with an average score of ${snapshot.avgScore.toFixed(1)} and average to-par of ${snapshot.avgToPar.toFixed(1)}.`,
                    `Birdie rate is ${snapshot.birdieRatePct}% and high-risk outcomes are ${snapshot.riskOutcomeRatePct}% of holes.`,
                    `Total throws in this filtered sample: ${snapshot.totalThrows}; outcome volume: ${snapshot.totalOutcomes}.`,
                    `Round consistency (to-par SD) is ${snapshot.toParStdDev.toFixed(1)}.`
                ];
                if (intent.preset !== 'balanced') {
                }
                if (snapshot.previousTenAvgToPar !== null) {
                    analysis.push(`Recent trend: last 10 rounds at ${snapshot.recentTenAvgToPar.toFixed(1)} to-par vs previous 10 at ${snapshot.previousTenAvgToPar.toFixed(1)}.`);
                }

                const coachingInsights = [
                    'Course-management rule: if tee shot risk is high, play to your most repeatable landing zone.',
                    'Putt process rule: use one consistent pre-putt routine on every scoring putt.',
                    'Round reset rule: after any double-bogey or worse, play next hole for par floor first.'
                ];
                let customIntentActions = null;
                if (intent.preset === 'custom' && intent.customIntent && intent.customIntent.matches.length > 0) {
                    const customTags = intent.customIntent.combined.tags.length > 0
                        ? intent.customIntent.combined.tags
                        : ['consistency', 'risk-control'];
                    customIntentActions = {
                        mappedThemes: intent.customIntent.matches.map(m => m.title),
                        drillPlan: pickDrills(customTags, 3),
                        checks: intent.customIntent.combined.kpiChecks
                    };
                }
                if (customIntentActions) {
                }

                const targetRiskPct = Math.max(5, snapshot.riskOutcomeRate * 100 - 5);
                const targetBirdiePct = Math.min(45, snapshot.birdieRate * 100 + 2);
                const targetToParSd = Math.max(0.9, snapshot.toParStdDev * (snapshot.toParStdDev > 1.6 ? 0.85 : 0.95));
                const kpis = [
                    `Reduce high-risk outcomes from ${snapshot.riskOutcomeRatePct}% to ${targetRiskPct.toFixed(1)}%`,
                    `Increase birdie rate from ${snapshot.birdieRatePct}% to ${targetBirdiePct.toFixed(1)}%`,
                    `Lower to-par SD from ${snapshot.toParStdDev.toFixed(1)} to ${targetToParSd.toFixed(1)}`
                ];

                const riskSessionsPerWeek = Math.max(1, Math.min(3, Math.floor(constraints.daysPerWeek / 2)));
                const birdieSessionsPerWeek = Math.max(1, Math.min(3, Math.ceil(constraints.daysPerWeek / 2)));
                const consistencySessionsPerWeek = snapshot.toParStdDev >= 3.0 && constraints.daysPerWeek >= 6 ? 2 : 1;
                const kpiUsedDrills = new Set();
                const kpiSupport = [
                    {
                        title: 'KPI 1: Risk Outcome Rate',
                        metric: kpis[0],
                        sessionsPerWeek: riskSessionsPerWeek,
                        cadence: `${riskSessionsPerWeek} day(s)/week`,
                        check: 'Log high-risk outcomes each round and compare 5-round rolling average.',
                        drills: pickDrillObjects(['risk-control', 'course-management', 'scramble'], 2, kpiUsedDrills)
                    },
                    {
                        title: 'KPI 2: Birdie Conversion',
                        metric: kpis[1],
                        sessionsPerWeek: birdieSessionsPerWeek,
                        cadence: `${birdieSessionsPerWeek} day(s)/week`,
                        check: 'Track makeable birdie looks and conversion rate by round.',
                        drills: pickDrillObjects(['birdie-conversion', 'putting', 'approach'], 2, kpiUsedDrills)
                    },
                    {
                        title: 'KPI 3: Round Consistency',
                        metric: kpis[2],
                        sessionsPerWeek: consistencySessionsPerWeek,
                        cadence: `${consistencySessionsPerWeek} day(s)/week`,
                        check: 'Track to-par each round and update SD every 5 rounds.',
                        drills: pickDrillObjects(['consistency', 'mental', 'course-management'], 2, kpiUsedDrills)
                    }
                ];

                const weekSlots = Array.from({ length: 7 }, () => []);
                const getPreferredDays = (count) => {
                    if (count <= 0) return [];
                    const picks = [];
                    for (let i = 0; i < count; i++) {
                        const d = Math.round(((i + 0.5) * 7) / count);
                        picks.push(Math.max(1, Math.min(7, d)));
                    }
                    return picks;
                };
                const placeOnNearestOpenDay = (preferredDay, payload) => {
                    const preferredIdx = preferredDay - 1;
                    if (weekSlots[preferredIdx].length === 0) {
                        weekSlots[preferredIdx].push(payload);
                        return;
                    }
                    for (let offset = 1; offset < 7; offset++) {
                        const left = preferredIdx - offset;
                        const right = preferredIdx + offset;
                        if (left >= 0 && weekSlots[left].length === 0) {
                            weekSlots[left].push(payload);
                            return;
                        }
                        if (right < 7 && weekSlots[right].length === 0) {
                            weekSlots[right].push(payload);
                            return;
                        }
                    }
                    weekSlots[preferredIdx].push(payload);
                };
                const sortedKpiSupport = [...kpiSupport].sort((a, b) => b.sessionsPerWeek - a.sessionsPerWeek);
                sortedKpiSupport.forEach(kpi => {
                    const preferredDays = getPreferredDays(kpi.sessionsPerWeek);
                    preferredDays.forEach((day, idx) => {
                        placeOnNearestOpenDay(day, { kpi, sessionIndex: idx });
                    });
                });
                const formatSessionDrills = (kpi, sessionIndex) => {
                    const drills = kpi.drills || [];
                    if (drills.length === 0) return ['Run one focused block tied to this KPI and log outcomes.'];
                    const first = drills[sessionIndex % drills.length];
                    const second = drills.length > 1 ? drills[(sessionIndex + 1) % drills.length] : null;
                    const lines = [`${first.title}: ${first.detail}`];
                    if (second && intent.preset !== 'short_sessions') lines.push(`${second.title}: ${second.detail}`);
                    lines.push(`Session check: ${kpi.check}`);
                    return lines;
                };
                const dailyPlan = Array.from({ length: 7 }, (_, idx) => {
                    const dayNum = idx + 1;
                    const sessions = weekSlots[idx];
                    if (!sessions || sessions.length === 0) {
                        if (dayNum === 7) {
                            return {
                                day: `Day ${dayNum}`,
                                focus: 'Review + Recalibrate',
                                duration: '15-20 min',
                                cadence: 'Weekly checkpoint',
                                drills: [
                                    'Review KPI movement from this week.',
                                    `Set next week primary focus: ${primary.title}.`
                                ]
                            };
                        }
                        return {
                            day: `Day ${dayNum}`,
                            focus: 'Recovery / Light Technical Reset',
                            duration: '15-20 min optional',
                            cadence: 'No KPI block',
                            drills: [
                                'Light mobility and 10-15 smooth form reps.',
                                'Quick note review: one adjustment for next KPI session.'
                            ]
                        };
                    }
                    if (sessions.length === 1) {
                        const slot = sessions[0];
                        return {
                            day: `Day ${dayNum}`,
                            focus: slot.kpi.title.replace(/^KPI\s*\d+\s*:\s*/i, ''),
                            duration: sessionDuration,
                            cadence: slot.kpi.cadence,
                            drills: formatSessionDrills(slot.kpi, slot.sessionIndex)
                        };
                    }
                    const combinedDrills = [];
                    sessions.forEach(slot => {
                        combinedDrills.push(...formatSessionDrills(slot.kpi, slot.sessionIndex).slice(0, 2));
                    });
                    return {
                        day: `Day ${dayNum}`,
                        focus: 'Combined KPI Session',
                        duration: sessionDuration,
                        cadence: sessions.map(s => s.kpi.cadence).join(' + '),
                        drills: combinedDrills
                    };
                });

                return {
                    intentLabel: intent.label,
                    archetype,
                    archetypeSelection,
                    headline: focuses[0].title,
                    summary: `Primary focus for your next 2 weeks: ${focuses[0].title}. Intent: ${intent.label}. Plan calibrated for ${constraints.daysPerWeek} day(s)/week at ~${min} minutes/session. Reassess after 5 rounds using the same filters.`,
                    analysis,
                    strengths,
                    gaps,
                    focuses: focuses.slice(0, 3),
                    dailyPlan,
                    coachingInsights,
                    kpis,
                    kpiSupport,
                    customIntentActions
                };
            }
            async function getLocalCoachGenerator() {
                if (localCoachGenerator) return localCoachGenerator;
                const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
                env.allowLocalModels = false;
                env.useBrowserCache = true;
                localCoachGenerator = await pipeline('text2text-generation', 'Xenova/flan-t5-small');
                return localCoachGenerator;
            }
            async function rewriteCoachPlanWithLocalLLM(plan, snapshot, constraints) {
                const generator = await getLocalCoachGenerator();
                const intent = getCoachIntentProfile(constraints || {});
                const runId = Date.now();
                const fallbackDrills = Array.from(new Set(plan.focuses.flatMap(f => f.drills || []))).slice(0, 4);
                const buildDynamicFallbackNotes = () => {
                    const pool = [
                        `This week's priority: ${plan.headline} — focus on this in your first session.`,
                        `Micro-goal: improve one KPI check this week (${plan.kpis[0]}).`,
                        `Pressure rep: end each session with one must-make sequence tied to ${plan.focuses[0].title}.`,
                        `On-course cue: use one repeatable commit phrase before every high-impact throw.`,
                        `Variation: shift one weekly session to a scored simulation under time pressure.`
                    ];
                    const selected = [];
                    while (selected.length < 3 && pool.length > 0) {
                        const idx = Math.floor(Math.random() * pool.length);
                        selected.push(pool.splice(idx, 1)[0]);
                    }
                    return selected;
                };
                const prompt = [
                    'Rewrite this disc golf coaching plan with unique narrative and fresh drill phrasing.',
                    'Keep practical coaching tone. Do not change the numeric facts.',
                    `User intent: ${intent.label}. ${intent.instruction}`,
                    `Run context id: ${runId} (use this to produce unique tactical variation for this run).`,
                    `Metrics: rounds=${snapshot.totalRounds}, avgScore=${snapshot.avgScore.toFixed(1)}, avgToPar=${snapshot.avgToPar.toFixed(1)}, birdieRate=${snapshot.birdieRatePct}%, riskOutcomes=${snapshot.riskOutcomeRatePct}%, toParSD=${snapshot.toParStdDev.toFixed(1)}.`,
                    `Primary focus: ${plan.headline}.`,
                    `Current summary: ${plan.summary}`,
                    'Output only in this plain-text format (no placeholders, no angle brackets):',
                    'NARRATIVE: <4-6 sentences>',
                    'DRILLS:',
                    '- item 1',
                    '- item 2',
                    '- item 3',
                    '- item 4',
                    'KPI_SCOPE:',
                    '- KPI 1: <reframed KPI target statement>',
                    '- KPI 2: <reframed KPI target statement>',
                    '- KPI 3: <reframed KPI target statement>',
                    'ALT_WEEK:',
                    '- Day 1: Focus Name | drill 1; drill 2; drill 3',
                    '- Day 2: Focus Name | drill 1; drill 2; drill 3',
                    '- Day 3: Focus Name | drill 1; drill 2; drill 3',
                    '- Day 4: Focus Name | drill 1; drill 2; drill 3',
                    '- Day 5: Focus Name | drill 1; drill 2; drill 3',
                    '- Day 6: Focus Name | drill 1; drill 2; drill 3',
                    '- Day 7: Focus Name | drill 1; drill 2; drill 3',
                    'DYNAMIC_NOTES:',
                    '- note 1',
                    '- note 2',
                    '- note 3',
                    'Do not write words like bullet, placeholder, item 1 template.'
                ].join('\n');
                const out = await generator(prompt, {
                    max_new_tokens: 320,
                    temperature: 0.9,
                    top_p: 0.95,
                    repetition_penalty: 1.08
                });
                const text = (out && out[0] && out[0].generated_text) ? out[0].generated_text.trim() : '';
                const narrativeMatch = text.match(/NARRATIVE:\s*([\s\S]*?)DRILLS:/i);
                const drillsMatch = text.match(/DRILLS:\s*([\s\S]*?)KPI_SCOPE:/i) || text.match(/DRILLS:\s*([\s\S]*?)ALT_WEEK:/i) || text.match(/DRILLS:\s*([\s\S]*)/i);
                const kpiScopeMatch = text.match(/KPI_SCOPE:\s*([\s\S]*?)ALT_WEEK:/i) || text.match(/KPI_SCOPE:\s*([\s\S]*?)DYNAMIC_NOTES:/i) || text.match(/KPI_SCOPE:\s*([\s\S]*)/i);
                const altWeekMatch = text.match(/ALT_WEEK:\s*([\s\S]*?)DYNAMIC_NOTES:/i) || text.match(/ALT_WEEK:\s*([\s\S]*)/i);
                const dynamicNotesMatch = text.match(/DYNAMIC_NOTES:\s*([\s\S]*)/i);
                const rawNarrative = narrativeMatch ? narrativeMatch[1].trim() : text;
                const narrative = rawNarrative
                    .replace(/DRILLS:\s*[\s\S]*$/i, '')
                    .replace(/[<>]/g, '')
                    .trim();
                const rawDrillSection = drillsMatch ? drillsMatch[1] : '';
                const splitDrills = rawDrillSection
                    .replace(/\r/g, '\n')
                    .split(/\n|(?=\s*-\s)|(?=\s*\*\s)|(?=\s*\d+[\).]\s)/)
                    .map(l => l.trim())
                    .map(l => l.replace(/^[-*]\s*/, '').replace(/^\d+[\).]\s*/, '').trim())
                    .map(l => l.replace(/[<>]/g, '').trim())
                    .filter(l => l.length > 8)
                    .filter(l => !/^(bullet|placeholder|item\s*\d+)/i.test(l))
                    .filter(l => !/(template|example)/i.test(l));
                const drills = (splitDrills.length >= 3 ? splitDrills : fallbackDrills).slice(0, 6);
                const rawAltWeek = altWeekMatch ? altWeekMatch[1] : '';
                const altWeek = rawAltWeek
                    .replace(/\r/g, '\n')
                    .split(/\n|(?=\s*-\s)|(?=\s*\d+[\).]\s)/)
                    .map(l => l.trim())
                    .map(l => l.replace(/^[-*]\s*/, '').replace(/^\d+[\).]\s*/, '').trim())
                    .map(l => l.replace(/[<>]/g, '').trim())
                    .filter(l => /day\s*\d+/i.test(l) || l.length > 18)
                    .slice(0, 7);
                const rawKpiScope = kpiScopeMatch ? kpiScopeMatch[1] : '';
                const kpiAdjustments = rawKpiScope
                    .replace(/\r/g, '\n')
                    .split(/\n|(?=\s*-\s)|(?=\s*\d+[\).]\s)/)
                    .map(l => l.trim())
                    .map(l => l.replace(/^[-*]\s*/, '').replace(/^\d+[\).]\s*/, '').trim())
                    .map(l => l.replace(/[<>]/g, '').trim())
                    .map(l => l.replace(/^kpi\s*\d+\s*:\s*/i, '').trim())
                    .filter(l => l.length > 12)
                    .slice(0, 3);
                const rawDynamicNotes = dynamicNotesMatch ? dynamicNotesMatch[1] : '';
                const dynamicNotes = rawDynamicNotes
                    .replace(/\r/g, '\n')
                    .split(/\n|(?=\s*-\s)|(?=\s*\d+[\).]\s)/)
                    .map(l => l.trim())
                    .map(l => l.replace(/^[-*]\s*/, '').replace(/^\d+[\).]\s*/, '').trim())
                    .map(l => l.replace(/[<>]/g, '').trim())
                    .filter(l => l.length > 10)
                    .slice(0, 4);
                const safeNarrative = narrative.length >= 20 ? narrative : plan.summary;
                return {
                    narrative: safeNarrative,
                    drills,
                    kpiAdjustments,
                    altWeek,
                    dynamicNotes: dynamicNotes.length > 0 ? dynamicNotes : buildDynamicFallbackNotes(),
                    runId,
                    raw: text
                };
            }
            function applyLLMScopeToPlan(basePlan, llmRewrite) {
                if (!basePlan || !llmRewrite) return basePlan;
                const scoped = JSON.parse(JSON.stringify(basePlan));

                if (Array.isArray(llmRewrite.kpiAdjustments) && llmRewrite.kpiAdjustments.length > 0) {
                    for (let i = 0; i < Math.min(3, llmRewrite.kpiAdjustments.length); i++) {
                        if (llmRewrite.kpiAdjustments[i]) scoped.kpis[i] = llmRewrite.kpiAdjustments[i];
                    }
                    if (Array.isArray(scoped.kpiSupport)) {
                        scoped.kpiSupport = scoped.kpiSupport.map((item, idx) => ({
                            ...item,
                            metric: scoped.kpis[idx] || item.metric
                        }));
                    }
                }

                if (Array.isArray(llmRewrite.altWeek) && llmRewrite.altWeek.length > 0 && Array.isArray(scoped.dailyPlan)) {
                    const dayOverrides = llmRewrite.altWeek
                        .map(line => {
                            const m = line.match(/day\s*(\d+)\s*[:\-]\s*(.*)/i);
                            if (!m) return null;
                            const dayNumber = parseInt(m[1], 10);
                            const payload = (m[2] || '').trim();
                            if (!dayNumber || dayNumber < 1 || dayNumber > 7 || !payload) return null;
                            const parts = payload.split('|').map(p => p.trim()).filter(Boolean);
                            const focus = parts[0] || '';
                            const drillText = parts.slice(1).join('|').trim();
                            const drills = drillText
                                ? drillText.split(';').map(d => d.trim()).filter(d => d.length > 3).slice(0, 4)
                                : [];
                            return { dayNumber, focus, drills };
                        })
                        .filter(Boolean);

                    dayOverrides.forEach(ovr => {
                        const idx = ovr.dayNumber - 1;
                        if (!scoped.dailyPlan[idx]) return;
                        scoped.dailyPlan[idx] = {
                            ...scoped.dailyPlan[idx],
                            focus: ovr.focus || scoped.dailyPlan[idx].focus,
                            drills: ovr.drills.length > 0 ? ovr.drills : scoped.dailyPlan[idx].drills
                        };
                    });
                }

                // Dynamic notes are shown in the AI Coach Insights section; do not duplicate into coachingInsights

                return scoped;
            }
            async function renderCoachModal(useLLMRewrite = false) {
                if (!lastDashboardSnapshot || lastDashboardSnapshot.totalRounds === 0) {
                    coachContent.innerHTML = `<div class='small'>No round data is available for the current player, course, and date filters.</div>`;
                    coachModal.style.display = 'flex';
                    return;
                }
                const constraints = getCoachConstraints();
                let plan = buildLocalCoachPlan(lastDashboardSnapshot, constraints);
                let llmRewrite = null;
                if (useLLMRewrite) {
                    coachContent.innerHTML = `<div class='small'>Generating your AI-enhanced coaching plan... This may take a moment on first use.</div>`;
                    coachModal.style.display = 'flex';
                    try {
                        llmRewrite = await rewriteCoachPlanWithLocalLLM(plan, lastDashboardSnapshot, constraints);
                    } catch (err) {
                        const fallbackRunId = Date.now();
                        llmRewrite = {
                            narrative: plan.summary,
                            drills: [],
                            altWeek: [],
                            dynamicNotes: [
                                `Focus cue: ${plan.headline}.`,
                                `Micro-goal: ${plan.kpis[0]}.`
                            ],
                            runId: fallbackRunId,
                            error: err && err.message ? err.message : 'AI enhancement temporarily unavailable.'
                        };
                    }
                }
                if (useLLMRewrite && llmRewrite) {
                    plan = applyLLMScopeToPlan(plan, llmRewrite);
                }
                let html = `<div id='coachExportContent'>`;
                html += `<div class='coach-controls-panel'>
                    <label class='coach-llm-toggle'><input type='checkbox' id='coachModalUseLocalLLM' ${coachSettingsState.useLocalLLMRewrite ? 'checked' : ''}> Enhanced AI Coaching</label>
                    <label class='coach-llm-toggle'>Days/week
                        <select id='coachModalDaysPerWeek' class='coach-setting-select'>
                            <option value='3' ${coachSettingsState.daysPerWeek === 3 ? 'selected' : ''}>3</option>
                            <option value='4' ${coachSettingsState.daysPerWeek === 4 ? 'selected' : ''}>4</option>
                            <option value='5' ${coachSettingsState.daysPerWeek === 5 ? 'selected' : ''}>5</option>
                            <option value='6' ${coachSettingsState.daysPerWeek === 6 ? 'selected' : ''}>6</option>
                            <option value='7' ${coachSettingsState.daysPerWeek === 7 ? 'selected' : ''}>7</option>
                        </select>
                    </label>
                    <label class='coach-llm-toggle'>Minutes/session
                        <select id='coachModalMinutesPerSession' class='coach-setting-select'>
                            <option value='30' ${coachSettingsState.minutesPerSession === 30 ? 'selected' : ''}>30</option>
                            <option value='45' ${coachSettingsState.minutesPerSession === 45 ? 'selected' : ''}>45</option>
                            <option value='60' ${coachSettingsState.minutesPerSession === 60 ? 'selected' : ''}>60</option>
                            <option value='75' ${coachSettingsState.minutesPerSession === 75 ? 'selected' : ''}>75</option>
                        </select>
                    </label>
                    <label class='coach-llm-toggle'>Intent
                        <select id='coachModalIntentPreset' class='coach-setting-select'>
                            <option value='balanced' ${coachSettingsState.intentPreset === 'balanced' ? 'selected' : ''}>Balanced Improvement</option>
                            <option value='prep_tournament' ${coachSettingsState.intentPreset === 'prep_tournament' ? 'selected' : ''}>Prep for Tournament</option>
                            <option value='short_sessions' ${coachSettingsState.intentPreset === 'short_sessions' ? 'selected' : ''}>Short Sessions Only</option>
                            <option value='putting_priority' ${coachSettingsState.intentPreset === 'putting_priority' ? 'selected' : ''}>Putting Priority Week</option>
                            <option value='custom' ${coachSettingsState.intentPreset === 'custom' ? 'selected' : ''}>Custom Intent</option>
                        </select>
                    </label>
                    <label class='coach-llm-toggle'>Intent note
                        <input id='coachModalIntentText' class='coach-intent-input' type='text' maxlength='90' placeholder='Optional custom intent' value="${(coachSettingsState.intentText || '').replace(/"/g, '&quot;')}">
                    </label>
                </div>`;
                html += `<div class='small'>Player(s): <strong>${lastDashboardSnapshot.playerLabel}</strong> • Course(s): <strong>${lastDashboardSnapshot.courseLabel}</strong> • Date: <strong>${lastDashboardSnapshot.dateLabel}</strong></div>`;
                html += `<div class='coach-profile-row'><span class='coach-profile-pill'>Player Archetype: ${plan.archetype}</span><span class='coach-profile-pill'>Intent: ${plan.intentLabel}</span><span class='coach-profile-pill'>Rounds in scope: ${lastDashboardSnapshot.totalRounds}</span></div>`;
                if (plan.archetypeSelection && plan.archetypeSelection.summary) {
                    html += `<div class='coach-section-title'>Archetype Selection</div>`;
                    html += `<div class='small'>Selected archetype: <strong>${plan.archetypeSelection.selected}</strong></div>`;
                    html += `<div class='small'>${plan.archetypeSelection.summary}</div>`;
                    if (Array.isArray(plan.archetypeSelection.details) && plan.archetypeSelection.details.length > 0) {
                        html += `<ul class='coach-list'>${plan.archetypeSelection.details.map(item => `<li>${item}</li>`).join('')}</ul>`;
                    }
                }
                html += `<div class='coach-popup-headline'>${plan.headline}</div>`;
                html += `<div class='coach-popup-summary'>${plan.summary}</div>`;
                const norm = (t) => (t || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
                const isGarbageNarrative = (text) => {
                    if (!text || text.length < 20) return true;
                    const words = text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
                    if (words.length < 5) return true;
                    const freq = {};
                    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
                    const maxFreq = Math.max(...Object.values(freq));
                    if (maxFreq / words.length > 0.22) return true;
                    const capsWords = text.split(/\s+/).filter(w => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
                    if (capsWords.length / Math.max(1, text.split(/\s+/).length) > 0.25) return true;
                    // Detect prompt echo — model regurgitated the instruction text
                    const promptPhrases = [
                        'rewrite this disc golf', 'unique narrative', 'fresh drill phrasing',
                        'do not write words like', 'keep practical coaching tone',
                        'output only in this', 'plain-text format', 'no placeholders',
                        'run context id', 'user intent:', 'kpi_scope', 'alt_week', 'dynamic_notes'
                    ];
                    const lower = text.toLowerCase();
                    if (promptPhrases.some(phrase => lower.includes(phrase))) return true;
                    return false;
                };
                if (llmRewrite && !llmRewrite.error) {
                    const baseSummary = norm(plan.summary);
                    const rewriteNarrative = norm(llmRewrite.narrative);
                    const existingDrills = new Set(plan.focuses.flatMap(f => (f.drills || []).map(norm)));
                    const novelDrills = (llmRewrite.drills || []).filter(d => !existingDrills.has(norm(d)));
                    const dynamicNotes = (llmRewrite.dynamicNotes || []).filter(line => line && line.length > 0);
                    const narrativeOk = !isGarbageNarrative(llmRewrite.narrative);
                    const summarySimilar = narrativeOk && rewriteNarrative && (baseSummary.includes(rewriteNarrative) || rewriteNarrative.includes(baseSummary));
                    html += `<div class='coach-section-title'>AI Coach Insights</div>`;
                    if (!narrativeOk || summarySimilar) {
                        html += `<div class='small'>Personalized tactics for this session are below.</div>`;
                    } else {
                        html += `<div class='small'>${llmRewrite.narrative}</div>`;
                    }
                    if (novelDrills.length > 0) {
                        html += `<ul class='coach-list'>${novelDrills.map(d => `<li>${d}</li>`).join('')}</ul>`;
                    }
                    if (dynamicNotes.length > 0) {
                        html += `<ul class='coach-list'>${dynamicNotes.map(line => `<li>${line}</li>`).join('')}</ul>`;
                    }
                }
                if (llmRewrite && llmRewrite.error) {
                    if (llmRewrite.dynamicNotes && llmRewrite.dynamicNotes.length > 0) {
                        html += `<div class='coach-section-title'>Coaching Notes</div>`;
                        html += `<ul class='coach-list'>${llmRewrite.dynamicNotes.map(line => `<li>${line}</li>`).join('')}</ul>`;
                    }
                }
                html += `<div class='coach-section-title'>Performance Analysis</div>`;
                html += `<ul class='coach-list'>${plan.analysis.map(item => `<li>${item}</li>`).join('')}</ul>`;
                html += `<div class='coach-section-title'>Strengths</div>`;
                html += `<ul class='coach-list'>${plan.strengths.map(item => `<li>${item}</li>`).join('')}</ul>`;
                html += `<div class='coach-section-title'>Improvement Areas</div>`;
                html += `<ul class='coach-list'>${plan.gaps.map(item => `<li>${item}</li>`).join('')}</ul>`;
                html += `<div class='coach-section-title'>Priority Focus Areas</div>`;
                html += `<div class='coach-popup-grid'>`;
                plan.focuses.forEach((focus, idx) => {
                    html += `<div class='card coach-popup-card'><div class='card-title'>Priority ${idx + 1} • Confidence: ${focus.confidence}</div><div class='card-value'>${focus.title}</div><div class='small'>${focus.why}</div><ul class='coach-list'>${(focus.evidence || []).map(item => `<li>${item}</li>`).join('')}</ul><div class='small'><strong>Target:</strong> ${focus.target}</div><div class='small'><strong>Drills:</strong> ${focus.drills.join(' ')}</div></div>`;
                });
                html += `</div>`;
                html += `<div class='coach-section-title'>Coaching Insights</div>`;
                html += `<ul class='coach-list'>${plan.coachingInsights.map(item => `<li>${item}</li>`).join('')}</ul>`;
                if (plan.customIntentActions) {
                    html += `<div class='coach-section-title'>Custom Intent Actions</div>`;
                    html += `<div class='small'><strong>Mapped Themes:</strong> ${plan.customIntentActions.mappedThemes.join(', ')}</div>`;
                    html += `<ul class='coach-list'>${(plan.customIntentActions.drillPlan || []).map(item => `<li>${item}</li>`).join('')}</ul>`;
                    html += `<div class='small'><strong>Tracking Checks:</strong></div>`;
                    html += `<ul class='coach-list'>${(plan.customIntentActions.checks || []).map(item => `<li>${item}</li>`).join('')}</ul>`;
                }
                html += `<div class='coach-section-title'>Track These KPIs</div>`;
                html += `<ul class='coach-list'>${plan.kpis.map(item => `<li>${item}</li>`).join('')}</ul>`;
                html += `<div class='coach-section-title'>KPI Support Plan</div>`;
                html += `<div class='coach-popup-grid'>`;
                plan.kpiSupport.forEach(item => {
                    const drillItems = (item.drills || []).map(d => `<li><strong>${d.title}</strong> (${d.minutes}): ${d.detail}</li>`).join('');
                    html += `<div class='card coach-popup-card'><div class='card-title'>${item.title}</div><div class='small'><strong>Target:</strong> ${item.metric}</div><div class='small'><strong>Cadence:</strong> ${item.cadence}</div><div class='small'><strong>Check:</strong> ${item.check}</div><ul class='coach-list'>${drillItems}</ul></div>`;
                });
                html += `</div>`;
                html += `<div class='coach-section-title'>7-Day Drill Plan</div>`;
                html += `<div class='coach-day-grid'>`;
                plan.dailyPlan.forEach(day => {
                    html += `<div class='card coach-day-card'><div class='card-title'>${day.day}</div><div class='card-value'>${day.focus}</div><div class='small'><strong>Duration:</strong> ${day.duration}</div><div class='small'><strong>Cadence:</strong> ${day.cadence || 'Practice block'}</div><ul class='coach-list'>${day.drills.map(d => `<li>${d}</li>`).join('')}</ul></div>`;
                });
                html += `</div>`;
                html += `</div>`;
                coachContent.innerHTML = html;
                const modalLLM = document.getElementById('coachModalUseLocalLLM');
                const modalDays = document.getElementById('coachModalDaysPerWeek');
                const modalMinutes = document.getElementById('coachModalMinutesPerSession');
                const modalIntentPreset = document.getElementById('coachModalIntentPreset');
                const modalIntentText = document.getElementById('coachModalIntentText');
                if (modalLLM) {
                    modalLLM.addEventListener('change', async () => {
                        coachSettingsState.useLocalLLMRewrite = modalLLM.checked;
                        localStorage.setItem('coach-use-local-llm', String(coachSettingsState.useLocalLLMRewrite));
                        await renderCoachModal(coachSettingsState.useLocalLLMRewrite);
                    });
                }
                if (modalDays) {
                    modalDays.addEventListener('change', async () => {
                        coachSettingsState.daysPerWeek = safeInt(modalDays.value) || 5;
                        localStorage.setItem('coach-days-per-week', String(coachSettingsState.daysPerWeek));
                        await renderCoachModal(coachSettingsState.useLocalLLMRewrite);
                    });
                }
                if (modalMinutes) {
                    modalMinutes.addEventListener('change', async () => {
                        coachSettingsState.minutesPerSession = safeInt(modalMinutes.value) || 45;
                        localStorage.setItem('coach-minutes-per-session', String(coachSettingsState.minutesPerSession));
                        await renderCoachModal(coachSettingsState.useLocalLLMRewrite);
                    });
                }
                if (modalIntentPreset) {
                    modalIntentPreset.addEventListener('change', async () => {
                        coachSettingsState.intentPreset = modalIntentPreset.value || 'balanced';
                        localStorage.setItem('coach-intent-preset', coachSettingsState.intentPreset);
                        await renderCoachModal(coachSettingsState.useLocalLLMRewrite);
                    });
                }
                if (modalIntentText) {
                    modalIntentText.addEventListener('change', async () => {
                        coachSettingsState.intentText = modalIntentText.value.trim();
                        localStorage.setItem('coach-intent-text', coachSettingsState.intentText);
                        await renderCoachModal(coachSettingsState.useLocalLLMRewrite);
                    });
                }
                coachModal.style.display = 'flex';
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
                let totalThrows = validRounds.reduce((sum, r) => sum + safeInt(r.Total), 0);
                let aces = 0, birdies = 0, pars = 0, bogies = 0, dblBogies = 0, trpBogies = 0, other = 0;
                let acesThrows = 0, birdiesThrows = 0, parsThrows = 0, bogiesThrows = 0, dblBogiesThrows = 0, trpBogiesThrows = 0, otherThrows = 0;
                validRounds.forEach(r => {
                    // UDisc exports have hole-by-hole columns: Hole1, Hole2, ...
                    Object.keys(r).forEach(k => {
                        if (/^Hole\d+$/i.test(k) && r[k] !== '' && !isNaN(Number(r[k]))) {
                            const val = Number(r[k]);
                            if (val === 0) return; // skip holes not played
                            // Use getParForHole utility
                            const par = getParForHole(r.CourseName, r.LayoutName, k.replace('Hole',''), window.allUDiscData || data) || 3;
                            const diff = val - par;
                            if (val === 1) {
                                aces++;
                                acesThrows += val;
                            }
                            else if (diff === -1) {
                                birdies++;
                                birdiesThrows += val;
                            }
                            else if (diff === 0) {
                                pars++;
                                parsThrows += val;
                            }
                            else if (diff === 1) {
                                bogies++;
                                bogiesThrows += val;
                            }
                            else if (diff === 2) {
                                dblBogies++;
                                dblBogiesThrows += val;
                            }
                            else if (diff === 3) {
                                trpBogies++;
                                trpBogiesThrows += val;
                            }
                            else {
                                other++;
                                otherThrows += val;
                            }
                        }
                    });
                });
                const totalOutcomes = aces + birdies + pars + bogies + dblBogies + trpBogies + other;
                const outcomePct = x => totalOutcomes > 0 ? `${(100 * x / totalOutcomes).toFixed(1)}%` : '0.0%';
                const throwPct = x => totalThrows > 0 ? `${(100 * x / totalThrows).toFixed(1)}%` : '0.0%';
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
                const riskOutcomeCount = bogies + dblBogies + trpBogies + other;
                const totalOutcomeCount = aces + birdies + pars + riskOutcomeCount;
                const recentTenAvgToPar = recent.length > 0
                    ? (recent.map(r => safeInt(r['+/-'])).reduce((a, b) => a + b, 0) / recent.length)
                    : 0;
                const previousTen = validRounds.slice(10, 20);
                const previousTenAvgToPar = previousTen.length > 0
                    ? (previousTen.map(r => safeInt(r['+/-'])).reduce((a, b) => a + b, 0) / previousTen.length)
                    : null;
                lastDashboardSnapshot = {
                    playerLabel: selected.join(', '),
                    courseLabel: selectedC.length === allCourses.length ? 'All' : selectedC.join(', '),
                    dateLabel: getDateFilterLabel(dateFilter),
                    totalRounds,
                    avgScore,
                    avgToPar,
                    totalThrows,
                    totalOutcomes,
                    riskOutcomeRate: totalOutcomeCount > 0 ? (riskOutcomeCount / totalOutcomeCount) : 0,
                    riskOutcomeRatePct: totalOutcomeCount > 0 ? ((100 * riskOutcomeCount / totalOutcomeCount).toFixed(1)) : '0.0',
                    birdieRate: totalOutcomeCount > 0 ? (birdies / totalOutcomeCount) : 0,
                    birdieRatePct: totalOutcomeCount > 0 ? ((100 * birdies / totalOutcomeCount).toFixed(1)) : '0.0',
                    toParStdDev: calcStdDev(toPars),
                    recentTenAvgToPar,
                    previousTenAvgToPar
                };

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
                summaryHtml += `<div class='card'><div class='card-title'>Hole Outcomes</div><div class='card-value'>${totalOutcomes}</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Aces</div><div class='card-value'>${aces} (${outcomePct(aces)})</div><div class='small'>Throws: ${acesThrows} (${throwPct(acesThrows)})</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Birdies</div><div class='card-value'>${birdies} (${outcomePct(birdies)})</div><div class='small'>Throws: ${birdiesThrows} (${throwPct(birdiesThrows)})</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Pars</div><div class='card-value'>${pars} (${outcomePct(pars)})</div><div class='small'>Throws: ${parsThrows} (${throwPct(parsThrows)})</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Bogies</div><div class='card-value'>${bogies} (${outcomePct(bogies)})</div><div class='small'>Throws: ${bogiesThrows} (${throwPct(bogiesThrows)})</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Dbl Bogies</div><div class='card-value'>${dblBogies} (${outcomePct(dblBogies)})</div><div class='small'>Throws: ${dblBogiesThrows} (${throwPct(dblBogiesThrows)})</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Trp Bogies</div><div class='card-value'>${trpBogies} (${outcomePct(trpBogies)})</div><div class='small'>Throws: ${trpBogiesThrows} (${throwPct(trpBogiesThrows)})</div></div>`;
                summaryHtml += `<div class='card'><div class='card-title'>Other</div><div class='card-value'>${other} (${outcomePct(other)})</div><div class='small'>Throws: ${otherThrows} (${throwPct(otherThrows)})</div></div>`;
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
            const generateCoachBtn = document.getElementById('generateCoachBtn');
            generateCoachBtn.onclick = async function(e) {
                e.preventDefault();
                await renderCoachModal(coachSettingsState.useLocalLLMRewrite);
            };
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
    const coachImageTrigger = e.target.closest('#coachSaveImageBtn');
    if (coachImageTrigger) {
        e.preventDefault();
        const content = document.getElementById('coachExportContent');
        if (!content) return;
        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#181f2f';
        html2canvas(content, {backgroundColor: bgColor, scale: 2}).then(canvas => {
            const link = document.createElement('a');
            link.download = 'ai-coach-plan.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }
    const coachPdfTrigger = e.target.closest('#coachSavePdfBtn');
    if (coachPdfTrigger) {
        e.preventDefault();
        const content = document.getElementById('coachExportContent');
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
            pdf.save('ai-coach-plan.pdf');
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