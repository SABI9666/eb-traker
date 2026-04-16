// ============================================
// DESIGNER ANALYTICS MODULE - COMPLETE
// Version: 3.0.0
// Features:
// 1. Director/HR Portal - View all designers with Excel download
// 2. Designer Self-View - Daily, Weekly, Monthly analytics
// ============================================

// ============================================
// SECTION 1: DIRECTOR/HR PORTAL - ALL DESIGNERS VIEW
// ============================================

/**
 * Show Designer Weekly Hours Analytics Dashboard (Director/HR View)
 */
async function showDesignerWeeklyAnalytics() {
    setActiveNav('nav-designer-analytics');
    const main = document.getElementById('mainContent');
    main.style.display = 'block';
    showLoading();

    try {
        const response = await apiCall('timesheets?action=designer_weekly_report');
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to load designer weekly report');
        }

        const { designers, weeklyTotals, monthlyTotals, summary } = response.data;
        
        main.innerHTML = renderDesignerAnalyticsDashboard(designers, weeklyTotals, monthlyTotals, summary);
        
        setTimeout(() => renderDesignerCharts(designers, weeklyTotals, monthlyTotals), 100);

    } catch (error) {
        console.error('❌ Error loading designer analytics:', error);
        main.innerHTML = `
            <div class="card" style="padding: 3rem; text-align: center;">
                <h3 style="color: var(--danger);">⚠️ Error Loading Analytics</h3>
                <p style="color: var(--text-light); margin: 1rem 0;">${error.message}</p>
                <button onclick="showDesignerWeeklyAnalytics()" class="btn btn-primary">🔄 Retry</button>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

/**
 * Render Director/HR Analytics Dashboard
 */
function renderDesignerAnalyticsDashboard(designers, weeklyTotals, monthlyTotals, summary) {
    return `
        <div class="page-header">
            <h2>📊 Designer Hours Analytics</h2>
            <p class="subtitle">Comprehensive breakdown of all designers' working hours</p>
        </div>
        
        <!-- Summary Cards -->
        <div class="dashboard-stats">
            <div class="stat-card" style="border-top-color: var(--primary-blue);">
                <div class="stat-number" style="color: var(--primary-blue);">${summary.totalDesigners}</div>
                <div class="stat-label">👥 Total Designers</div>
            </div>
            <div class="stat-card" style="border-top-color: var(--success);">
                <div class="stat-number" style="color: var(--success);">${summary.totalHoursAllTime.toFixed(1)}h</div>
                <div class="stat-label">⏱️ Total Hours Logged</div>
            </div>
            <div class="stat-card" style="border-top-color: var(--warning);">
                <div class="stat-number" style="color: var(--warning);">${summary.avgHoursPerDesigner.toFixed(1)}h</div>
                <div class="stat-label">📈 Avg Hours/Designer</div>
            </div>
            <div class="stat-card" style="border-top-color: #8b5cf6;">
                <div class="stat-number" style="color: #8b5cf6;">${summary.weeksTracked}</div>
                <div class="stat-label">📅 Weeks Tracked</div>
            </div>
        </div>
        
        <!-- Export Buttons -->
        <div style="margin: 2rem 0; display: flex; gap: 1rem; justify-content: flex-end; flex-wrap: wrap;">
            <button onclick="downloadDesignerWeeklyExcel()" class="btn btn-primary">
                📥 Download Weekly Report
            </button>
            <button onclick="downloadDesignerMonthlyExcel()" class="btn btn-success">
                📥 Download Monthly Report
            </button>
        </div>
        
        <!-- Tabs -->
        <div class="card" style="margin-bottom: 2rem; padding: 0;">
            <div style="display: flex; border-bottom: 2px solid var(--border); overflow-x: auto;">
                <button class="analytics-tab active" onclick="showAnalyticsTab('summary', this)">📋 Designer Summary</button>
                <button class="analytics-tab" onclick="showAnalyticsTab('weekly', this)">📆 Weekly View</button>
                <button class="analytics-tab" onclick="showAnalyticsTab('monthly', this)">🗓️ Monthly View</button>
                <button class="analytics-tab" onclick="showAnalyticsTab('charts', this)">📈 Charts</button>
            </div>
        </div>
        
        <!-- Tab Contents -->
        <div id="analytics-tab-summary" class="analytics-tab-content">
            ${renderAllDesignersTable(designers)}
        </div>
        
        <div id="analytics-tab-weekly" class="analytics-tab-content" style="display: none;">
            ${renderWeeklyMatrix(designers, weeklyTotals)}
        </div>
        
        <div id="analytics-tab-monthly" class="analytics-tab-content" style="display: none;">
            ${renderMonthlyMatrix(designers, monthlyTotals)}
        </div>
        
        <div id="analytics-tab-charts" class="analytics-tab-content" style="display: none;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 2rem;">
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">📈 Weekly Hours Trend</h3>
                    <div style="height: 350px;"><canvas id="weeklyTrendChart"></canvas></div>
                </div>
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">👥 Top Designers by Hours</h3>
                    <div style="height: 350px;"><canvas id="designerBarChart"></canvas></div>
                </div>
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">🗓️ Monthly Hours Trend</h3>
                    <div style="height: 350px;"><canvas id="monthlyTrendChart"></canvas></div>
                </div>
                <div class="card">
                    <h3 style="margin-bottom: 1.5rem;">🥧 Hours Distribution</h3>
                    <div style="height: 350px;"><canvas id="designerPieChart"></canvas></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render All Designers Summary Table
 */
function renderAllDesignersTable(designers) {
    if (!designers?.length) {
        return '<div class="card" style="padding: 2rem; text-align: center;">No designer data found.</div>';
    }
    
    const rows = designers.map((d, i) => `
        <tr>
            <td style="font-weight: 600;">${i + 1}</td>
            <td>
                <strong>${d.name}</strong><br>
                <small style="color: var(--text-light);">${d.email || ''}</small>
            </td>
            <td style="font-weight: 700; color: var(--primary-blue);">${d.totalHours.toFixed(1)}h</td>
            <td>${d.weeksActive}</td>
            <td>${d.monthsActive || '-'}</td>
            <td style="color: var(--success); font-weight: 600;">${d.avgWeeklyHours.toFixed(1)}h</td>
            <td style="color: var(--warning); font-weight: 600;">${d.avgDailyHours.toFixed(2)}h</td>
            <td>${d.projectsWorked}</td>
            <td>${d.uniqueWorkingDays}</td>
        </tr>
    `).join('');
    
    return `
        <div class="card">
            <div style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Designer</th>
                            <th>Total Hours</th>
                            <th>Weeks</th>
                            <th>Months</th>
                            <th>Avg/Week</th>
                            <th>Avg/Day</th>
                            <th>Projects</th>
                            <th>Days Worked</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Render Weekly Hours Matrix
 */
function renderWeeklyMatrix(designers, weeklyTotals) {
    if (!weeklyTotals?.length) {
        return '<div class="card" style="padding: 2rem; text-align: center;">No weekly data available.</div>';
    }
    
    const headers = weeklyTotals.map(w => `<th style="min-width: 85px; text-align: center; font-size: 0.85rem;">${w.weekLabel}</th>`).join('');
    
    const rows = designers.slice(0, 20).map(d => {
        const cells = weeklyTotals.map(w => {
            const hrs = d.weeklyHours?.[w.week] || 0;
            const color = hrs > 45 ? 'var(--danger)' : hrs > 35 ? 'var(--warning)' : hrs > 0 ? 'var(--success)' : 'var(--text-light)';
            return `<td style="text-align: center; color: ${color}; font-weight: ${hrs > 0 ? '600' : '400'};">${hrs > 0 ? hrs.toFixed(1) : '-'}</td>`;
        }).join('');
        
        return `<tr>
            <td style="position: sticky; left: 0; background: white; z-index: 1; font-weight: 600;">${d.name}</td>
            ${cells}
            <td style="background: #f3f4f6; font-weight: 700; text-align: center;">${d.avgWeeklyHours.toFixed(1)}h</td>
        </tr>`;
    }).join('');
    
    const totals = weeklyTotals.map(w => `<td style="text-align: center; font-weight: 700;">${w.total.toFixed(1)}</td>`).join('');
    
    return `
        <div class="card">
            <div style="overflow-x: auto;">
                <table class="data-table" style="min-width: max-content;">
                    <thead>
                        <tr>
                            <th style="position: sticky; left: 0; background: var(--light-blue); z-index: 2; min-width: 150px;">Designer</th>
                            ${headers}
                            <th style="background: #e5e7eb;">Avg/Week</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr style="background: #f3f4f6; font-weight: 700;">
                            <td style="position: sticky; left: 0; background: #e5e7eb; z-index: 1;">TOTAL</td>
                            ${totals}
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    `;
}

/**
 * Render Monthly Hours Matrix
 */
function renderMonthlyMatrix(designers, monthlyTotals) {
    if (!monthlyTotals?.length) {
        return '<div class="card" style="padding: 2rem; text-align: center;">No monthly data available.</div>';
    }
    
    const headers = monthlyTotals.map(m => `<th style="min-width: 100px; text-align: center; font-size: 0.85rem;">${m.monthLabel}</th>`).join('');
    
    const rows = designers.slice(0, 20).map(d => {
        const cells = monthlyTotals.map(m => {
            const hrs = d.monthlyHours?.[m.month] || 0;
            const color = hrs > 180 ? 'var(--danger)' : hrs > 140 ? 'var(--warning)' : hrs > 0 ? 'var(--success)' : 'var(--text-light)';
            return `<td style="text-align: center; color: ${color}; font-weight: ${hrs > 0 ? '600' : '400'};">${hrs > 0 ? hrs.toFixed(1) : '-'}</td>`;
        }).join('');
        
        return `<tr>
            <td style="position: sticky; left: 0; background: white; z-index: 1; font-weight: 600;">${d.name}</td>
            ${cells}
            <td style="background: #f3f4f6; font-weight: 700; text-align: center;">${(d.avgMonthlyHours || 0).toFixed(1)}h</td>
        </tr>`;
    }).join('');
    
    const totals = monthlyTotals.map(m => `<td style="text-align: center; font-weight: 700;">${m.total.toFixed(1)}</td>`).join('');
    
    return `
        <div class="card">
            <div style="overflow-x: auto;">
                <table class="data-table" style="min-width: max-content;">
                    <thead>
                        <tr>
                            <th style="position: sticky; left: 0; background: var(--light-blue); z-index: 2; min-width: 150px;">Designer</th>
                            ${headers}
                            <th style="background: #e5e7eb;">Avg/Month</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr style="background: #f3f4f6; font-weight: 700;">
                            <td style="position: sticky; left: 0; background: #e5e7eb; z-index: 1;">TOTAL</td>
                            ${totals}
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    `;
}

/**
 * Tab Switching for Director/HR View
 */
function showAnalyticsTab(tabName, btn) {
    document.querySelectorAll('.analytics-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.analytics-tab-content').forEach(c => c.style.display = 'none');
    
    btn.classList.add('active');
    document.getElementById(`analytics-tab-${tabName}`).style.display = 'block';
    
    if (tabName === 'charts') {
        apiCall('timesheets?action=designer_weekly_report').then(res => {
            if (res.success) renderDesignerCharts(res.data.designers, res.data.weeklyTotals, res.data.monthlyTotals);
        });
    }
}

/**
 * Render Charts for Director/HR View
 */
function renderDesignerCharts(designers, weeklyTotals, monthlyTotals) {
    // Weekly Trend Chart
    const weeklyCtx = document.getElementById('weeklyTrendChart');
    if (weeklyCtx && typeof Chart !== 'undefined') {
        if (Chart.getChart(weeklyCtx)) Chart.getChart(weeklyCtx).destroy();
        new Chart(weeklyCtx, {
            type: 'line',
            data: {
                labels: weeklyTotals.map(w => w.weekLabel),
                datasets: [{
                    label: 'Total Hours',
                    data: weeklyTotals.map(w => w.total),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.3
                }, {
                    label: 'Avg Per Designer',
                    data: weeklyTotals.map(w => w.avgPerDesigner),
                    borderColor: '#10b981',
                    borderDash: [5, 5],
                    tension: 0.3
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }
    
    // Designer Bar Chart
    const barCtx = document.getElementById('designerBarChart');
    if (barCtx && typeof Chart !== 'undefined') {
        if (Chart.getChart(barCtx)) Chart.getChart(barCtx).destroy();
        const top10 = designers.slice(0, 10);
        new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: top10.map(d => d.name.split(' ')[0]),
                datasets: [{
                    label: 'Total Hours',
                    data: top10.map(d => d.totalHours),
                    backgroundColor: '#3b82f6'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }
        });
    }
    
    // Monthly Trend Chart
    const monthlyCtx = document.getElementById('monthlyTrendChart');
    if (monthlyCtx && monthlyTotals && typeof Chart !== 'undefined') {
        if (Chart.getChart(monthlyCtx)) Chart.getChart(monthlyCtx).destroy();
        new Chart(monthlyCtx, {
            type: 'bar',
            data: {
                labels: monthlyTotals.map(m => m.monthLabel),
                datasets: [{
                    label: 'Total Hours',
                    data: monthlyTotals.map(m => m.total),
                    backgroundColor: '#8b5cf6'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
    
    // Pie Chart
    const pieCtx = document.getElementById('designerPieChart');
    if (pieCtx && typeof Chart !== 'undefined') {
        if (Chart.getChart(pieCtx)) Chart.getChart(pieCtx).destroy();
        const top5 = designers.slice(0, 5);
        const others = designers.slice(5).reduce((sum, d) => sum + d.totalHours, 0);
        new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: [...top5.map(d => d.name.split(' ')[0]), 'Others'],
                datasets: [{
                    data: [...top5.map(d => d.totalHours), others],
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }
}

/**
 * Download Weekly Excel Report
 */
async function downloadDesignerWeeklyExcel() {
    try {
        showLoading();
        const response = await apiCall('timesheets?action=designer_weekly_report');
        if (!response.success) throw new Error('Failed to fetch data');
        
        const { designers, weeklyTotals, summary } = response.data;
        
        if (typeof XLSX === 'undefined') {
            alert('Excel library not loaded. Please refresh the page.');
            return;
        }
        
        const wb = XLSX.utils.book_new();
        
        // Sheet 1: Summary
        const summaryData = [
            ['Designer Weekly Hours Report'],
            ['Generated: ' + new Date().toLocaleString()],
            [''],
            ['#', 'Name', 'Email', 'Total Hours', 'Weeks Active', 'Avg/Week', 'Avg/Day', 'Projects', 'Days Worked']
        ];
        designers.forEach((d, i) => {
            summaryData.push([i + 1, d.name, d.email, d.totalHours, d.weeksActive, d.avgWeeklyHours, d.avgDailyHours, d.projectsWorked, d.uniqueWorkingDays]);
        });
        const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
        ws1['!cols'] = [{ wch: 5 }, { wch: 25 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws1, 'Designer Summary');
        
        // Sheet 2: Weekly Breakdown
        const weeklyData = [['Weekly Hours Breakdown'], [''], ['Designer', ...weeklyTotals.map(w => w.weekLabel), 'Average']];
        designers.forEach(d => {
            const row = [d.name];
            weeklyTotals.forEach(w => row.push(d.weeklyHours?.[w.week] || 0));
            row.push(d.avgWeeklyHours);
            weeklyData.push(row);
        });
        weeklyData.push(['TOTAL', ...weeklyTotals.map(w => w.total), '']);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(weeklyData), 'Weekly Breakdown');
        
        XLSX.writeFile(wb, `Designer_Weekly_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Download Monthly Excel Report
 */
async function downloadDesignerMonthlyExcel() {
    try {
        showLoading();
        const response = await apiCall('timesheets?action=designer_weekly_report');
        if (!response.success) throw new Error('Failed to fetch data');
        
        const { designers, monthlyTotals } = response.data;
        
        if (typeof XLSX === 'undefined') {
            alert('Excel library not loaded. Please refresh the page.');
            return;
        }
        
        const wb = XLSX.utils.book_new();
        
        const monthlyData = [['Designer Monthly Hours Report'], ['Generated: ' + new Date().toLocaleString()], [''], ['Designer', ...monthlyTotals.map(m => m.monthLabel), 'Total']];
        designers.forEach(d => {
            const row = [d.name];
            monthlyTotals.forEach(m => row.push(d.monthlyHours?.[m.month] || 0));
            row.push(d.totalHours);
            monthlyData.push(row);
        });
        monthlyData.push(['TOTAL', ...monthlyTotals.map(m => m.total), '']);
        
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(monthlyData), 'Monthly Breakdown');
        XLSX.writeFile(wb, `Designer_Monthly_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        hideLoading();
    }
}


// ============================================
// SECTION 2: DESIGNER SELF-VIEW - MY ANALYTICS
// ============================================

/**
 * Show My Analytics Dashboard (Designer's Own View)
 */
async function showMyAnalytics() {
    setActiveNav('nav-my-analytics');
    const main = document.getElementById('mainContent');
    main.style.display = 'block';
    showLoading();

    try {
        const response = await apiCall('timesheets?action=my_analytics');
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to load your analytics');
        }

        const { summary, currentPeriod, daily, weekly, monthly, byProject } = response.data;
        
        main.innerHTML = renderMyAnalyticsDashboard(summary, currentPeriod, daily, weekly, monthly, byProject);
        
        setTimeout(() => renderMyAnalyticsCharts(weekly, monthly, byProject), 100);

    } catch (error) {
        console.error('❌ Error loading my analytics:', error);
        main.innerHTML = `
            <div class="card" style="padding: 3rem; text-align: center;">
                <h3 style="color: var(--danger);">⚠️ Error Loading Your Analytics</h3>
                <p style="color: var(--text-light); margin: 1rem 0;">${error.message}</p>
                <button onclick="showMyAnalytics()" class="btn btn-primary">🔄 Retry</button>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

/**
 * Render Designer's Personal Analytics Dashboard
 */
function renderMyAnalyticsDashboard(summary, currentPeriod, daily, weekly, monthly, byProject) {
    return `
        <div class="page-header">
            <h2>📊 My Working Hours Analytics</h2>
            <p class="subtitle">Track your daily, weekly, and monthly working hours</p>
        </div>
        
        <!-- Current Period Highlight -->
        <div class="dashboard-stats">
            <div class="stat-card" style="border-top-color: #10b981; background: linear-gradient(135deg, #d1fae5, #a7f3d0);">
                <div class="stat-number" style="color: #059669;">${currentPeriod.todayHours.toFixed(1)}h</div>
                <div class="stat-label">📅 Today</div>
            </div>
            <div class="stat-card" style="border-top-color: #3b82f6; background: linear-gradient(135deg, #dbeafe, #bfdbfe);">
                <div class="stat-number" style="color: #2563eb;">${currentPeriod.thisWeekHours.toFixed(1)}h</div>
                <div class="stat-label">📆 This Week</div>
            </div>
            <div class="stat-card" style="border-top-color: #8b5cf6; background: linear-gradient(135deg, #ede9fe, #ddd6fe);">
                <div class="stat-number" style="color: #7c3aed;">${currentPeriod.thisMonthHours.toFixed(1)}h</div>
                <div class="stat-label">🗓️ This Month</div>
            </div>
            <div class="stat-card" style="border-top-color: #f59e0b; background: linear-gradient(135deg, #fef3c7, #fde68a);">
                <div class="stat-number" style="color: #d97706;">${summary.totalHours.toFixed(1)}h</div>
                <div class="stat-label">⏱️ All Time</div>
            </div>
        </div>
        
        <!-- Summary Stats -->
        <div class="card" style="margin: 2rem 0; padding: 1.5rem;">
            <h3 style="margin-bottom: 1rem;">📈 Your Statistics</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                <div style="text-align: center; padding: 1rem; background: #f9fafb; border-radius: 10px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-blue);">${summary.avgDailyHours.toFixed(2)}h</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Avg per Day</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: #f9fafb; border-radius: 10px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);">${summary.avgWeeklyHours.toFixed(1)}h</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Avg per Week</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: #f9fafb; border-radius: 10px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: #8b5cf6;">${summary.avgMonthlyHours.toFixed(1)}h</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Avg per Month</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: #f9fafb; border-radius: 10px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning);">${summary.totalWorkingDays}</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Days Worked</div>
                </div>
                <div style="text-align: center; padding: 1rem; background: #f9fafb; border-radius: 10px;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--danger);">${summary.totalProjects}</div>
                    <div style="font-size: 0.85rem; color: var(--text-light);">Projects</div>
                </div>
            </div>
        </div>
        
        <!-- Export Button -->
        <div style="margin: 1.5rem 0; text-align: right;">
            <button onclick="downloadMyAnalyticsExcel()" class="btn btn-primary">📥 Download My Report</button>
        </div>
        
        <!-- Tabs -->
        <div class="card" style="margin-bottom: 2rem; padding: 0;">
            <div style="display: flex; border-bottom: 2px solid var(--border); overflow-x: auto;">
                <button class="my-analytics-tab active" onclick="showMyAnalyticsTab('daily', this)">📅 Daily</button>
                <button class="my-analytics-tab" onclick="showMyAnalyticsTab('weekly', this)">📆 Weekly</button>
                <button class="my-analytics-tab" onclick="showMyAnalyticsTab('monthly', this)">🗓️ Monthly</button>
                <button class="my-analytics-tab" onclick="showMyAnalyticsTab('projects', this)">📁 By Project</button>
                <button class="my-analytics-tab" onclick="showMyAnalyticsTab('charts', this)">📈 Charts</button>
            </div>
        </div>
        
        <!-- Tab Contents -->
        <div id="my-analytics-daily" class="my-analytics-content">
            ${renderMyDailyView(daily)}
        </div>
        
        <div id="my-analytics-weekly" class="my-analytics-content" style="display: none;">
            ${renderMyWeeklyView(weekly)}
        </div>
        
        <div id="my-analytics-monthly" class="my-analytics-content" style="display: none;">
            ${renderMyMonthlyView(monthly)}
        </div>
        
        <div id="my-analytics-projects" class="my-analytics-content" style="display: none;">
            ${renderMyProjectsView(byProject)}
        </div>
        
        <div id="my-analytics-charts" class="my-analytics-content" style="display: none;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 2rem;">
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">📆 Weekly Hours Trend</h3>
                    <div style="height: 300px;"><canvas id="myWeeklyChart"></canvas></div>
                </div>
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">🗓️ Monthly Hours</h3>
                    <div style="height: 300px;"><canvas id="myMonthlyChart"></canvas></div>
                </div>
                <div class="card" style="grid-column: span 2;">
                    <h3 style="margin-bottom: 1rem;">📁 Hours by Project</h3>
                    <div style="height: 300px;"><canvas id="myProjectChart"></canvas></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render Daily View
 */
function renderMyDailyView(daily) {
    if (!daily?.length) {
        return '<div class="card" style="padding: 2rem; text-align: center;">No daily entries found.</div>';
    }
    
    const rows = daily.map(d => {
        const date = new Date(d.date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const isToday = d.date === new Date().toISOString().split('T')[0];
        
        const projectsList = d.entries.map(e => `<span style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; margin-right: 4px;">${e.projectCode || e.projectName}: ${e.hours}h</span>`).join('');
        
        return `
            <tr style="${isToday ? 'background: #dbeafe;' : ''}">
                <td style="font-weight: 600;">${dayName}</td>
                <td>${dateStr} ${isToday ? '<span style="background: var(--success); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">TODAY</span>' : ''}</td>
                <td style="font-weight: 700; color: var(--primary-blue);">${d.hours.toFixed(1)}h</td>
                <td>${projectsList}</td>
            </tr>
        `;
    }).join('');
    
    return `
        <div class="card">
            <h3 style="margin-bottom: 1rem;">📅 Daily Hours (Last 30 Days)</h3>
            <div style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Day</th>
                            <th>Date</th>
                            <th>Hours</th>
                            <th>Projects</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Render Weekly View
 */
function renderMyWeeklyView(weekly) {
    if (!weekly?.length) {
        return '<div class="card" style="padding: 2rem; text-align: center;">No weekly data found.</div>';
    }
    
    const rows = weekly.map((w, i) => {
        const isCurrentWeek = i === weekly.length - 1;
        return `
            <tr style="${isCurrentWeek ? 'background: #dbeafe;' : ''}">
                <td style="font-weight: 600;">${w.weekLabel} ${isCurrentWeek ? '<span style="background: var(--success); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">CURRENT</span>' : ''}</td>
                <td style="font-weight: 700; color: var(--primary-blue);">${w.hours.toFixed(1)}h</td>
                <td>${w.daysWorked}</td>
                <td>${w.projects}</td>
                <td style="color: var(--success);">${w.avgPerDay.toFixed(2)}h</td>
            </tr>
        `;
    }).join('');
    
    return `
        <div class="card">
            <h3 style="margin-bottom: 1rem;">📆 Weekly Summary</h3>
            <div style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Week</th>
                            <th>Total Hours</th>
                            <th>Days Worked</th>
                            <th>Projects</th>
                            <th>Avg/Day</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Render Monthly View
 */
function renderMyMonthlyView(monthly) {
    if (!monthly?.length) {
        return '<div class="card" style="padding: 2rem; text-align: center;">No monthly data found.</div>';
    }
    
    const rows = monthly.map((m, i) => {
        const isCurrentMonth = i === monthly.length - 1;
        return `
            <tr style="${isCurrentMonth ? 'background: #ede9fe;' : ''}">
                <td style="font-weight: 600;">${m.monthLabel} ${isCurrentMonth ? '<span style="background: #8b5cf6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">CURRENT</span>' : ''}</td>
                <td style="font-weight: 700; color: #8b5cf6;">${m.hours.toFixed(1)}h</td>
                <td>${m.daysWorked}</td>
                <td>${m.projects}</td>
                <td style="color: var(--success);">${m.avgPerDay.toFixed(2)}h</td>
            </tr>
        `;
    }).join('');
    
    return `
        <div class="card">
            <h3 style="margin-bottom: 1rem;">🗓️ Monthly Summary</h3>
            <div style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>Total Hours</th>
                            <th>Days Worked</th>
                            <th>Projects</th>
                            <th>Avg/Day</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Render Projects View
 */
function renderMyProjectsView(byProject) {
    if (!byProject?.length) {
        return '<div class="card" style="padding: 2rem; text-align: center;">No project data found.</div>';
    }
    
    const totalHours = byProject.reduce((sum, p) => sum + p.hours, 0);
    
    const rows = byProject.map((p, i) => {
        const percentage = totalHours > 0 ? (p.hours / totalHours * 100).toFixed(1) : 0;
        return `
            <tr>
                <td style="font-weight: 600;">${i + 1}</td>
                <td>
                    <strong>${p.projectName}</strong><br>
                    <small style="color: var(--text-light);">${p.projectCode || 'No Code'}</small>
                </td>
                <td style="font-weight: 700; color: var(--primary-blue);">${p.hours.toFixed(1)}h</td>
                <td>${p.entries}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="flex: 1; background: #e5e7eb; border-radius: 10px; height: 10px; overflow: hidden;">
                            <div style="width: ${percentage}%; background: var(--primary-blue); height: 100%;"></div>
                        </div>
                        <span style="font-size: 0.85rem; color: var(--text-light);">${percentage}%</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    return `
        <div class="card">
            <h3 style="margin-bottom: 1rem;">📁 Hours by Project</h3>
            <div style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Project</th>
                            <th>Hours</th>
                            <th>Entries</th>
                            <th>% of Total</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}

/**
 * Tab Switching for Designer Self-View
 */
function showMyAnalyticsTab(tabName, btn) {
    document.querySelectorAll('.my-analytics-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.my-analytics-content').forEach(c => c.style.display = 'none');
    
    btn.classList.add('active');
    document.getElementById(`my-analytics-${tabName}`).style.display = 'block';
    
    if (tabName === 'charts') {
        apiCall('timesheets?action=my_analytics').then(res => {
            if (res.success) renderMyAnalyticsCharts(res.data.weekly, res.data.monthly, res.data.byProject);
        });
    }
}

/**
 * Render Charts for Designer Self-View
 */
function renderMyAnalyticsCharts(weekly, monthly, byProject) {
    // Weekly Chart
    const weeklyCtx = document.getElementById('myWeeklyChart');
    if (weeklyCtx && typeof Chart !== 'undefined') {
        if (Chart.getChart(weeklyCtx)) Chart.getChart(weeklyCtx).destroy();
        new Chart(weeklyCtx, {
            type: 'line',
            data: {
                labels: weekly.map(w => w.weekLabel),
                datasets: [{
                    label: 'Hours',
                    data: weekly.map(w => w.hours),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    
    // Monthly Chart
    const monthlyCtx = document.getElementById('myMonthlyChart');
    if (monthlyCtx && typeof Chart !== 'undefined') {
        if (Chart.getChart(monthlyCtx)) Chart.getChart(monthlyCtx).destroy();
        new Chart(monthlyCtx, {
            type: 'bar',
            data: {
                labels: monthly.map(m => m.monthLabel),
                datasets: [{
                    label: 'Hours',
                    data: monthly.map(m => m.hours),
                    backgroundColor: '#8b5cf6'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    
    // Project Chart
    const projectCtx = document.getElementById('myProjectChart');
    if (projectCtx && typeof Chart !== 'undefined') {
        if (Chart.getChart(projectCtx)) Chart.getChart(projectCtx).destroy();
        const top10 = byProject.slice(0, 10);
        new Chart(projectCtx, {
            type: 'bar',
            data: {
                labels: top10.map(p => p.projectCode || p.projectName.substring(0, 15)),
                datasets: [{
                    label: 'Hours',
                    data: top10.map(p => p.hours),
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

/**
 * Download Designer's Own Analytics Excel
 */
async function downloadMyAnalyticsExcel() {
    try {
        showLoading();
        const response = await apiCall('timesheets?action=my_analytics');
        if (!response.success) throw new Error('Failed to fetch data');
        
        const { summary, daily, weekly, monthly, byProject } = response.data;
        
        if (typeof XLSX === 'undefined') {
            alert('Excel library not loaded. Please refresh the page.');
            return;
        }
        
        const wb = XLSX.utils.book_new();
        
        // Summary Sheet
        const summaryData = [
            ['My Working Hours Report'],
            ['Generated: ' + new Date().toLocaleString()],
            [''],
            ['Metric', 'Value'],
            ['Total Hours', summary.totalHours],
            ['Days Worked', summary.totalWorkingDays],
            ['Avg Hours/Day', summary.avgDailyHours],
            ['Avg Hours/Week', summary.avgWeeklyHours],
            ['Avg Hours/Month', summary.avgMonthlyHours],
            ['Total Projects', summary.totalProjects]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');
        
        // Daily Sheet
        const dailyData = [['Date', 'Hours', 'Projects']];
        daily.forEach(d => {
            const projects = d.entries.map(e => `${e.projectName}: ${e.hours}h`).join(', ');
            dailyData.push([d.date, d.hours, projects]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dailyData), 'Daily');
        
        // Weekly Sheet
        const weeklyData = [['Week', 'Hours', 'Days Worked', 'Projects', 'Avg/Day']];
        weekly.forEach(w => weeklyData.push([w.weekLabel, w.hours, w.daysWorked, w.projects, w.avgPerDay]));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(weeklyData), 'Weekly');
        
        // Monthly Sheet
        const monthlyData = [['Month', 'Hours', 'Days Worked', 'Projects', 'Avg/Day']];
        monthly.forEach(m => monthlyData.push([m.monthLabel, m.hours, m.daysWorked, m.projects, m.avgPerDay]));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(monthlyData), 'Monthly');
        
        // By Project Sheet
        const projectData = [['Project', 'Code', 'Hours', 'Entries']];
        byProject.forEach(p => projectData.push([p.projectName, p.projectCode, p.hours, p.entries]));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(projectData), 'By Project');
        
        XLSX.writeFile(wb, `My_Hours_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        hideLoading();
    }
}


// ============================================
// SECTION 3: CSS STYLES (Add to <style> tag)
// ============================================
// Add these styles to your index.html <style> section:
/*
.analytics-tab, .my-analytics-tab {
    padding: 1rem 1.5rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-light);
    transition: all 0.2s;
    white-space: nowrap;
}

.analytics-tab:hover, .my-analytics-tab:hover {
    color: var(--primary-blue);
    background: #f3f4f6;
}

.analytics-tab.active, .my-analytics-tab.active {
    color: var(--primary-blue);
    font-weight: 600;
    border-bottom: 3px solid var(--primary-blue);
}

.data-table {
    width: 100%;
    border-collapse: collapse;
}

.data-table th, .data-table td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
}

.data-table th {
    background: var(--light-blue);
    font-weight: 600;
}

.data-table tbody tr:hover {
    background: #f9fafb;
}
*/

console.log('✅ Designer Analytics Module v3.0.0 loaded');
console.log('   - Director/HR Portal: showDesignerWeeklyAnalytics()');
console.log('   - Designer Self-View: showMyAnalytics()');
