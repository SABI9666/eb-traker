// ============================================
// EBTRACKER ANALYTICS DASHBOARD (V2)
// This file is loaded by index.html
// It provides analytics for BDM, COO, and Director roles.
// ============================================

// Chart.js Global Colors
const CHART_COLORS = {
    blue: 'rgba(0, 191, 255, 0.7)',
    darkBlue: 'rgba(0, 153, 204, 1)',
    green: 'rgba(39, 174, 96, 0.7)',
    red: 'rgba(231, 76, 60, 0.7)',
    yellow: 'rgba(243, 156, 18, 0.7)',
    grey: 'rgba(127, 140, 141, 0.7)',
    purple: 'rgba(155, 89, 182, 0.7)',
    orange: 'rgba(230, 126, 34, 0.7)',
};

/**
 * Main function to show the Analytics Dashboard.
 * This is called by the 'Analytics' link in the nav menu.
 */
async function showAnalyticsDashboard() {
    setActiveNav('nav-analytics'); // Assumes setActiveNav is global in index.html
    const main = document.getElementById('mainContent');
    main.style.display = 'block';
    showLoading(); // Assumes showLoading is global

    try {
        // 1. Render the dashboard UI skeleton
        // The HTML skeleton is now dynamic based on role
        main.innerHTML = getAnalyticsHTML(currentUserRole);

        // 2. Fetch and process the data
        // Assumes apiCall and currentUser are global
        const analyticsData = await loadAnalyticsData(currentUserRole);

        // 3. Render the KPI cards
        renderKpiCards(analyticsData.kpis, currentUserRole);

        // 4. Render the base charts (Monthly Revenue & Status)
        renderMonthlyRevenueChart(analyticsData.monthlyRevenue);
        renderStatusPieChart(analyticsData.statusCounts);

        // 5. Render COO/Director charts if data exists for them
        if (currentUserRole !== 'bdm') {
            if (analyticsData.bdmPerformance) {
                renderBdmPerformanceChart(analyticsData.bdmPerformance);
            }
            if (analyticsData.weeklyRevenue) {
                renderWeeklyRevenueChart(analyticsData.weeklyRevenue);
            }
            if (analyticsData.regionalData) {
                renderRegionalPieChart(analyticsData.regionalData);
            }
        }

    } catch (error) {
        console.error('❌ Error loading analytics:', error);
        main.innerHTML = `<div class="error-message"><h3>Error Loading Analytics</h3><p>${error.message}</p></div>`;
    } finally {
        hideLoading(); // Assumes hideLoading is global
    }
}

/**
 * Returns the HTML skeleton for the analytics dashboard,
 * dynamically adding chart containers for COO/Director.
 */
function getAnalyticsHTML(role) {
    const isDirectorView = role === 'coo' || role === 'director';
    const title = isDirectorView ? '📊 Company Analytics Dashboard' : '📈 My BDM Analytics';

    // Add extra containers for director charts
    const directorCharts = `
        <div class="action-section">
            <h3>BDM Performance (Won Revenue)</h3>
            <div style="position: relative; height: 350px;">
                <canvas id="bdmPerformanceChart"></canvas>
            </div>
        </div>

        <div class="action-section">
            <h3>Regional Business (Won Revenue)</h3>
            <div style="position: relative; height: 350px; display: flex; align-items: center; justify-content: center;">
                <canvas id="regionalPieChart" style="max-height: 350px; max-width: 350px;"></canvas>.
            </div>
        </div>

        <div class="action-section">
            <h3>Weekly Revenue (Last 16 Weeks)</h3>
            <div style="position: relative; height: 350px;">
                <canvas id="weeklyRevenueChart"></canvas>
            </div>
        </div>
    `;

    return `
        <div class="page-header">
            <h2>${title}</h2>
            <div class="subtitle">Insights on proposals and revenue</div>
        </div>
        
        <div class="dashboard-stats" id="bdm-kpi-cards">
            </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 2rem; margin-top: 3rem;">
            
            <div class="action-section">
                <h3>Monthly Revenue (Last 12 Months)</h3>
                <div style="position: relative; height: 350px;">
                    <canvas id="monthlyRevenueChart"></canvas>
                </div>
            </div>

            <div class="action-section">
                <h3>Proposal Status Breakdown</h3>
                <div style="position: relative; height: 350px; display: flex; align-items: center; justify-content: center;">
                    <canvas id="statusPieChart" style="max-height: 350px; max-width: 350px;"></canvas>
                </div>
            </div>

            ${isDirectorView ? directorCharts : ''}
        </div>
    `;
}

/**
 * Fetches and processes all proposal data.
 * - If role is 'bdm', it filters for their proposals.
 * - If role is 'coo' or 'director', it processes all proposals.
 */
async function loadAnalyticsData(role) {
    const response = await apiCall('proposals');
    if (!response.success || !response.data) {
        throw new Error('Failed to fetch proposal data');
    }

    let proposals;
    if (role === 'bdm') {
        // BDM view: Filter for their own proposals
        proposals = response.data.filter(p => p.createdByUid === currentUser.uid);
    } else {
        // COO/Director view: Use all proposals
        proposals = response.data;
    }

    // --- Process KPIs ---
    const wonProposals = proposals.filter(p => p.status === 'won');
    const lostProposals = proposals.filter(p => p.status === 'lost');
    
    const totalRevenue = wonProposals.reduce((sum, p) => sum + (p.pricing?.quoteValue || 0), 0);
    const totalWon = wonProposals.length;
    const totalLost = lostProposals.length;
    const totalProposals = proposals.length;
    const winRate = (totalWon + totalLost) > 0 ? (totalWon / (totalWon + totalLost)) * 100 : 0;
    const avgDealValue = totalWon > 0 ? totalRevenue / totalWon : 0;

    const kpis = {
        totalRevenue,
        totalProposals,
        winRate,
        avgDealValue,
        totalWon,
        totalLost
    };

    // --- Process Monthly Revenue (Bar Chart) ---
    const monthlyRevenue = {};
    const labels = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const label = `${year}-${month}`;
        labels.push(label);
        monthlyRevenue[label] = 0;
    }

    wonProposals.forEach(p => {
        let date;
        if (p.wonDate) {
             date = new Date(p.wonDate.seconds ? p.wonDate.seconds * 1000 : p.wonDate);
        } else if (p.updatedAt) {
             date = new Date(p.updatedAt.seconds ? p.updatedAt.seconds * 1000 : p.updatedAt);
        }

        if (date) {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const label = `${year}-${month}`;
            if (monthlyRevenue.hasOwnProperty(label)) {
                monthlyRevenue[label] += (p.pricing?.quoteValue || 0);
            }
        }
    });

    // --- Process Status Counts (Pie Chart) ---
    const statusCounts = {
        Won: 0,
        Lost: 0,
        Pending: 0, // Submitted, Approved
        Pricing: 0, // Estimated, Pricing
        Draft: 0    // Draft, Rejected
    };

    proposals.forEach(p => {
        switch (p.status) {
            case 'won':
                statusCounts.Won++;
                break;
            case 'lost':
                statusCounts.Lost++;
                break;
            case 'submitted_to_client':
            case 'approved':
                statusCounts.Pending++;
                break;
            case 'estimated':
            case 'pricing_complete':
            case 'pending_director_approval':
                statusCounts.Pricing++;
                break;
            case 'draft':
            case 'rejected':
            default:
                statusCounts.Draft++;
                break;
        }
    });

    // --- Process COO/Director Data ---
    let bdmPerformance = null, weeklyRevenue = null, regionalData = null;

    if (role !== 'bdm') {
        // 1. BDM Performance
        bdmPerformance = {};
        wonProposals.forEach(p => {
            const bdmName = p.createdByName || 'Unknown';
            if (!bdmPerformance[bdmName]) {
                bdmPerformance[bdmName] = 0;
            }
            bdmPerformance[bdmName] += (p.pricing?.quoteValue || 0);
        });

        // 2. Weekly Revenue
        weeklyRevenue = {};
        const weekLabels = [];
        const today = new Date();
        for (let i = 15; i >= 0; i--) { // Last 16 weeks
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (i * 7));
            const weekStart = getWeekStartDate(d);
            if (!weekLabels.includes(weekStart)) {
                weekLabels.push(weekStart);
                weeklyRevenue[weekStart] = 0;
            }
        }
        wonProposals.forEach(p => {
            let date;
            if (p.wonDate) {
                date = new Date(p.wonDate.seconds ? p.wonDate.seconds * 1000 : p.wonDate);
            }
            if (date) {
                const weekStart = getWeekStartDate(date);
                if (weeklyRevenue.hasOwnProperty(weekStart)) {
                    weeklyRevenue[weekStart] += (p.pricing?.quoteValue || 0);
                }
            }
        });
        
        // 3. Regional Data
        regionalData = {};
        wonProposals.forEach(p => {
            let region = p.country || 'Unknown';
            if (region === "") {
                region = "Unknown";
            }
            if (!regionalData[region]) {
                regionalData[region] = 0;
            }
            regionalData[region] += (p.pricing?.quoteValue || 0);
        });
    }

    return { kpis, monthlyRevenue, statusCounts, bdmPerformance, weeklyRevenue, regionalData };
}

/**
 * Renders the KPI cards with processed data
 */
function renderKpiCards(kpis, role) {
    const container = document.getElementById('bdm-kpi-cards');
    const currencyFormat = { style: 'currency', currency: 'USD', maximumFractionDigits: 0 };
    
    // BDM-specific KPIs
    let bdmCards = `
        <div class="stat-card">
            <div class="stat-number">${kpis.totalProposals}</div>
            <div class="stat-label">Total Proposals</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" style="color: ${CHART_COLORS.green}">${kpis.totalWon}</div>
            <div class="stat-label">Proposals Won</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" style="color: ${CHART_COLORS.red}">${kpis.totalLost}</div>
            <div class="stat-label">Proposals Lost</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${kpis.winRate.toFixed(1)}%</div>
            <div class="stat-label">Win Rate</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${kpis.totalRevenue.toLocaleString('en-US', currencyFormat)}</div>
            <div class="stat-label">Total Revenue (Won)</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${kpis.avgDealValue.toLocaleString('en-US', currencyFormat)}</div>
            <div class="stat-label">Avg. Revenue (Won)</div>
        </div>
    `;

    // COO/Director has a slightly different focus
    let directorCards = `
        <div class="stat-card">
            <div class="stat-number">${kpis.totalRevenue.toLocaleString('en-US', currencyFormat)}</div>
            <div class="stat-label">Total Revenue (Won)</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${kpis.avgDealValue.toLocaleString('en-US', currencyFormat)}</div>
            <div class="stat-label">Avg. Revenue (Won)</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${kpis.winRate.toFixed(1)}%</div>
            <div class="stat-label">Company Win Rate</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${kpis.totalProposals}</div>
            <div class="stat-label">Total Proposals</div>
        </div>
    `;

    container.innerHTML = (role === 'bdm') ? bdmCards : directorCards;
}

/**
 * Renders the Monthly Revenue bar chart
 */
function renderMonthlyRevenueChart(monthlyRevenue) {
    const ctx = document.getElementById('monthlyRevenueChart').getContext('2d');
    
    const displayLabels = Object.keys(monthlyRevenue).map(label => {
        const [year, month] = label.split('-');
        const date = new Date(year, month - 1, 1);
        return date.toLocaleString('default', { month: 'short', year: '2-digit' });
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: displayLabels,
            datasets: [{
                label: 'Revenue',
                data: Object.values(monthlyRevenue),
                backgroundColor: CHART_COLORS.blue,
                borderColor: CHART_COLORS.darkBlue,
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + (value / 1000) + 'k';
                        }
                    }
                },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (context) => formatTooltipAsCurrency(context) } }
            }
        }
    });
}

/**
 * Renders the Proposal Status pie chart
 */
function renderStatusPieChart(statusCounts) {
    const ctx = document.getElementById('statusPieChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                label: 'Proposal Status',
                data: Object.values(statusCounts),
                backgroundColor: [
                    CHART_COLORS.green,
                    CHART_COLORS.red,
                    CHART_COLORS.blue,
                    CHART_COLORS.yellow,
                    CHART_COLORS.grey
                ],
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            let value = context.raw || 0;
                            return ` ${label}: ${value}`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Renders the BDM Performance bar chart (COO/Director only)
 */
function renderBdmPerformanceChart(bdmData) {
    const ctx = document.getElementById('bdmPerformanceChart').getContext('2d');
    
    // Sort BDMs by performance
    const sortedData = Object.entries(bdmData).sort(([, a], [, b]) => b - a);
    const labels = sortedData.map(item => item[0]);
    const data = sortedData.map(item => item[1]);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue Won',
                data: data,
                backgroundColor: [ // Using an array of colors
                    CHART_COLORS.green,
                    CHART_COLORS.blue,
                    CHART_COLORS.yellow,
                    CHART_COLORS.purple,
                    CHART_COLORS.orange,
                    CHART_COLORS.red,
                    CHART_COLORS.grey
                ],
                borderColor: '#ffffff', // Matching pie chart style
                borderWidth: 2,         // Matching pie chart style
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: 'y', // Horizontal bar chart
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + (value / 1000) + 'k';
                        }
                    }
                },
                y: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (context) => formatTooltipAsCurrency(context) } }
            }
        }
    });
}

/**
 * Renders the Weekly Revenue line chart (COO/Director only)
 * --- TYPO FIX APPLIED HERE ---
 */
function renderWeeklyRevenueChart(weeklyData) {
    const ctx = document.getElementById('weeklyRevenueChart').getContext('2d');
    
    const displayLabels = Object.keys(weeklyData).map(label => {
        const [year, month, day] = label.split('-');
        return `${month}/${day}`; // Short format e.g., 10/28
    });

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: displayLabels,
            datasets: [{
                label: 'Revenue',
                data: Object.values(weeklyData),
                backgroundColor: CHART_COLORS.blue,
                borderColor: CHART_COLORS.darkBlue,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            // The extra 'MS' string was removed from here
                            return '$' + (value / 1000) + 'k';
                        }
                    }
                },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (context) => formatTooltipAsCurrency(context) } }
            }
        }
    });
}

/**
 * Renders the Regional Business pie chart (COO/Director only)
 * --- TYPO FIX APPLIED HERE ---
 */
function renderRegionalPieChart(regionalData) {
    const ctx = document.getElementById('regionalPieChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(regionalData),
            datasets: [{
                label: 'Regional Revenue',
                data: Object.values(regionalData),
                backgroundColor: [
                    CHART_COLORS.blue,
                    CHART_COLORS.green,
                    CHART_COLORS.yellow,
                    CHART_COLORS.purple,
                    // Fixed: Was 'CHART_PROPERTIES.orange', now 'CHART_COLORS.orange'
                    CHART_COLORS.orange,
                    CHART_COLORS.red,
                    CHART_COLORS.grey
                ],
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: (context) => formatTooltipAsCurrency(context, context.label) } }
            }
        }
    });
}


// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Helper to get the start of the week (Monday) for a given date
 */
function getWeekStartDate(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // 0 = Sunday, 1 = Monday
    const monday = new Date(date.setDate(diff));
    return monday.toISOString().split('T')[0];
}

/**
 * Helper to format Chart.js tooltips as currency
 */
function formatTooltipAsCurrency(context, labelPrefix = '') {
    let label = labelPrefix || context.dataset.label || '';
    if (label) {
        label += ': ';
    }
    if (context.parsed.y !== null) {
        label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.parsed.y);
    } else if (context.raw !== null) {
        label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(context.raw);
    }
    return label;
}
