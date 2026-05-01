// public/bdm-analytics.js
// BDM analytical report (weekly / monthly / quarterly / yearly).
// Self-injecting nav item for COO and Director under the
// "Business Development" department in the sidebar.
//
// Loaded by bdm-po-patch.js patch loader.

(function () {
    'use strict';

    if (window._bdmAnalyticsPatchLoaded) return;
    window._bdmAnalyticsPatchLoaded = true;

    var ALLOWED_ROLES = ['coo', 'director'];

    // app1.js declares `currentUserRole` with `let` at script top-level. That
    // means it's a binding in the Script realm — reachable by name from this
    // IIFE — but it is NOT a property on `window`. Try every plausible source.
    function getCurrentRole() {
        var role = '';
        try {
            // eslint-disable-next-line no-undef
            if (typeof currentUserRole !== 'undefined' && currentUserRole) role = currentUserRole;
        } catch (e) { /* ReferenceError before app1.js parses */ }
        if (!role && window.currentUserRole) role = window.currentUserRole;
        if (!role) {
            // Last-ditch: read the role label rendered into the header.
            var label = document.getElementById('userRole');
            if (label && label.textContent) role = label.textContent;
        }
        return String(role || '').trim().toLowerCase();
    }

    // ── nav injection ──────────────────────────────────────────────────────────
    // The <li id="bdmAnalyticsNavItem"> is shipped in index.html with
    // display:none. We unhide it for COO/Director. If for any reason it isn't
    // in the DOM (older cached index.html), we fall back to creating it.
    function injectNavItem() {
        var role = getCurrentRole();
        if (ALLOWED_ROLES.indexOf(role) === -1) return false;

        var existing = document.getElementById('bdmAnalyticsNavItem');
        if (existing) {
            existing.style.display = '';
            return true;
        }

        var dept = document.getElementById('deptBDM');
        if (!dept) return false;
        var ul = dept.querySelector('ul.nav-dept-items');
        if (!ul) return false;

        var li = document.createElement('li');
        li.id = 'bdmAnalyticsNavItem';
        li.innerHTML =
            '<a href="#" id="nav-bdm-analytics">' +
            '<span class="nav-icon">📊</span>BDM Analytics</a>';
        ul.appendChild(li);

        var link = li.querySelector('a');
        link.addEventListener('click', function (e) {
            e.preventDefault();
            window.showBdmAnalytics();
        });

        return true;
    }

    // Poll until role + sidebar are ready, then inject.
    function tryInject() {
        if (injectNavItem()) {
            console.log('[BDM analytics] nav item injected');
            return true;
        }
        return false;
    }

    var navPoll = setInterval(function () {
        if (tryInject()) clearInterval(navPoll);
    }, 1500);
    setTimeout(function () { clearInterval(navPoll); }, 120000);
    tryInject();

    // ── helpers ────────────────────────────────────────────────────────────────
    function fmtMoney(v, currency) {
        var n = Number(v) || 0;
        var cur = currency || '';
        var s = n.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return cur ? cur + ' ' + s : s;
    }

    function fmtDate(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d)) return '';
        return d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: '2-digit'
        });
    }

    // Pretty period label, e.g. "2025-06" → "Jun 2025", "2025-W26" → "W26 2025".
    function periodLabel(key, granularity) {
        if (!key) return '';
        if (granularity === 'year') return key;
        if (granularity === 'quarter') {
            var qParts = key.split('-Q');
            return 'Q' + qParts[1] + ' ' + qParts[0];
        }
        if (granularity === 'month') {
            var mParts = key.split('-');
            var d = new Date(parseInt(mParts[0], 10), parseInt(mParts[1], 10) - 1, 1);
            return d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
        }
        if (granularity === 'week') {
            var wParts = key.split('-W');
            return 'W' + wParts[1] + ' ' + wParts[0];
        }
        return key;
    }

    function setActive(name) {
        if (typeof window.setActiveNav === 'function') {
            window.setActiveNav(name);
        }
    }

    // ── main view ──────────────────────────────────────────────────────────────
    var state = {
        granularity: 'month',
        from: '', // ISO yyyy-mm-dd; blank = backend default
        to: '',
        data: null,
        selectedBdmUid: 'ALL',
        selectedPeriodKey: null
    };

    window.showBdmAnalytics = async function () {
        var role = getCurrentRole();
        if (ALLOWED_ROLES.indexOf(role) === -1) {
            alert('BDM Analytics is only available for COO and Director.');
            return;
        }

        setActive('nav-bdm-analytics');
        var main = document.getElementById('mainContent');
        if (!main) return;
        main.style.display = 'block';

        if (typeof window.showLoading === 'function') window.showLoading();
        try {
            var qs = 'granularity=' + encodeURIComponent(state.granularity);
            if (state.from) qs += '&from=' + encodeURIComponent(state.from);
            if (state.to) qs += '&to=' + encodeURIComponent(state.to);
            var resp = await window.apiCall('bdm-analytics?' + qs);
            if (!resp || !resp.success) {
                throw new Error((resp && resp.error) || 'Failed to load BDM analytics');
            }
            state.data = resp.data;
            // default to most recent period
            if (!state.selectedPeriodKey || state.data.periodKeys.indexOf(state.selectedPeriodKey) === -1) {
                state.selectedPeriodKey = state.data.periodKeys[state.data.periodKeys.length - 1] || null;
            }
            renderBdmAnalytics(main);
        } catch (err) {
            console.error('[BDM analytics] load error:', err);
            main.innerHTML =
                '<div class="card" style="padding:2rem; text-align:center;">' +
                '<h3 style="color:var(--danger,#dc2626);">⚠️ Error loading BDM analytics</h3>' +
                '<p style="margin:1rem 0;">' + (err.message || err) + '</p>' +
                '<button class="btn btn-primary" onclick="showBdmAnalytics()">🔄 Retry</button>' +
                '</div>';
        } finally {
            if (typeof window.hideLoading === 'function') window.hideLoading();
        }
    };

    function renderBdmAnalytics(main) {
        var d = state.data;
        var totals = d.totals;
        var hasFilteredActivity =
            (totals.numQuotes || 0) +
            (totals.numProjectsWon || 0) +
            (totals.variationValue || 0) > 0;

        // When the user's selected From/To excludes every entry but the
        // database actually has data, fall back to lifetime values so the
        // cards and charts always show real numbers instead of all zeros.
        var lifetime = d.lifetime || {};
        var hasLifetimeActivity =
            ((lifetime.totals && lifetime.totals.numQuotes) || 0) +
            ((lifetime.totals && lifetime.totals.numProjectsWon) || 0) +
            ((lifetime.totals && lifetime.totals.variationValue) || 0) > 0;
        var useLifetime = !hasFilteredActivity && hasLifetimeActivity;
        var cardsTotals = useLifetime ? lifetime.totals : totals;

        main.innerHTML =
            '<div class="page-header">' +
                '<h2>📊 BDM Analytics Report</h2>' +
                '<p class="subtitle">Quotes uploaded, projects won and variations — by BDM, per period. All values in INR.</p>' +
            '</div>' +
            renderLifetimeBanner(d.lifetime) +
            renderControls() +
            (hasFilteredActivity
                ? ''
                : '<div class="card" style="padding:0.75rem 1rem; margin-bottom:1rem; background:#fef3c7; border-left:4px solid #f59e0b;">' +
                  '<strong>ℹ️ No activity in the selected date range.</strong> ' +
                  (useLifetime
                      ? 'Cards and charts below are showing <strong>all-time</strong> figures so you still see the team\'s pipeline. Widen From/To or click Apply with both blank to update the per-period tables.'
                      : 'Lifetime totals are shown above. Widen the From/To range or click Apply with both fields blank to see all-time activity per period.') +
                  '</div>') +
            renderSummaryCards(cardsTotals, useLifetime) +
            renderTabs() +
            '<div id="bdmAnalyticsTabs" style="margin-top:1rem;"></div>';

        // bind controls
        document.getElementById('bdmAnalyticsGranularity').value = state.granularity;
        document.getElementById('bdmAnalyticsGranularity').onchange = function (e) {
            state.granularity = e.target.value;
            state.selectedPeriodKey = null;
            window.showBdmAnalytics();
        };
        document.getElementById('bdmAnalyticsFrom').value = state.from || '';
        document.getElementById('bdmAnalyticsTo').value = state.to || '';
        document.getElementById('bdmAnalyticsApplyBtn').onclick = function () {
            state.from = document.getElementById('bdmAnalyticsFrom').value;
            state.to = document.getElementById('bdmAnalyticsTo').value;
            state.selectedPeriodKey = null;
            window.showBdmAnalytics();
        };
        document.getElementById('bdmAnalyticsExcelBtn').onclick = downloadExcel;

        // open default tab: Period Summary
        showTab('period');
    }

    function renderControls() {
        return (
            '<div class="card" style="padding:1rem; margin-bottom:1rem; display:flex; flex-wrap:wrap; gap:1rem; align-items:end;">' +
                '<div>' +
                    '<label style="display:block; font-size:0.85rem; color:var(--text-light,#666);">Granularity</label>' +
                    '<select id="bdmAnalyticsGranularity" style="padding:0.5rem; border:1px solid var(--border,#ddd); border-radius:6px;">' +
                        '<option value="week">Weekly</option>' +
                        '<option value="month">Monthly</option>' +
                        '<option value="quarter">Quarterly</option>' +
                        '<option value="year">Yearly</option>' +
                    '</select>' +
                '</div>' +
                '<div>' +
                    '<label style="display:block; font-size:0.85rem; color:var(--text-light,#666);">From</label>' +
                    '<input type="date" id="bdmAnalyticsFrom" style="padding:0.5rem; border:1px solid var(--border,#ddd); border-radius:6px;">' +
                '</div>' +
                '<div>' +
                    '<label style="display:block; font-size:0.85rem; color:var(--text-light,#666);">To</label>' +
                    '<input type="date" id="bdmAnalyticsTo" style="padding:0.5rem; border:1px solid var(--border,#ddd); border-radius:6px;">' +
                '</div>' +
                '<button id="bdmAnalyticsApplyBtn" class="btn btn-primary">Apply</button>' +
                '<button id="bdmAnalyticsExcelBtn" class="btn btn-success">📥 Download Excel</button>' +
            '</div>'
        );
    }

    function renderSummaryCards(totals, isLifetime) {
        var caption = isLifetime ? '<div style="text-align:center; font-size:0.75rem; color:#92400e; margin:-0.75rem 0 0.75rem 0; font-weight:600;">📊 Showing all-time totals (current From/To range has no activity)</div>' : '';
        return caption +
            '<div class="dashboard-stats" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin-bottom:1.25rem;">' +
                summaryCard(totals.numQuotes, '📝 Quotes Uploaded', '#3b82f6') +
                summaryCard(fmtMoney(totals.quoteValueTotal, '₹'), '💰 Total Quote Value', '#10b981') +
                summaryCard(totals.numProjectsWon, '🏆 Projects Won', '#f59e0b') +
                summaryCard(fmtMoney(totals.projectValue, '₹'), '📈 Project Value', '#8b5cf6') +
                summaryCard(fmtMoney(totals.variationValue, '₹'), '➕ Variation Value', '#ec4899') +
                summaryCard(fmtMoney(totals.totalValue, '₹'), '💵 Total Value', '#0ea5e9') +
                summaryCard(totals.numNewClients, '🤝 New Clients', '#14b8a6') +
            '</div>';
    }

    // Lifetime banner: always shows all-time totals regardless of the user's
    // date filter. Lets COO/Director see real numbers even when the selected
    // window has no activity.
    function renderLifetimeBanner(lifetime) {
        if (!lifetime || !lifetime.totals) return '';
        var t = lifetime.totals;
        var bdms = lifetime.bdms || [];
        var topRows = bdms.slice(0, 7).map(function (b, i) {
            return (
                '<tr>' +
                    '<td>' + (i + 1) + '</td>' +
                    '<td><strong>' + b.bdmName + '</strong></td>' +
                    '<td style="text-align:right;">' + b.numQuotes + '</td>' +
                    '<td style="text-align:right;">' + fmtMoney(b.quoteValueTotal, '₹') + '</td>' +
                    '<td style="text-align:right;">' + b.numProjectsWon + '</td>' +
                    '<td style="text-align:right;">' + fmtMoney(b.projectValue, '₹') + '</td>' +
                    '<td style="text-align:right;">' + fmtMoney(b.variationValue, '₹') + '</td>' +
                    '<td style="text-align:right; font-weight:700;">' + fmtMoney(b.totalValue, '₹') + '</td>' +
                '</tr>'
            );
        }).join('');

        return (
            '<div class="card" style="padding:1.25rem; margin-bottom:1rem; background:linear-gradient(135deg,#eff6ff,#f0fdf4); border-left:4px solid #2563eb;">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">' +
                    '<h3 style="margin:0; color:#1e40af;">🏆 Lifetime Totals — All BDMs (INR)</h3>' +
                    '<span style="font-size:0.8rem; color:#64748b;">Independent of date filter</span>' +
                '</div>' +
                '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:0.75rem; margin-bottom:0.75rem;">' +
                    miniMetric(t.numQuotes, 'Quotes', '#3b82f6') +
                    miniMetric(fmtMoney(t.quoteValueTotal, '₹'), 'Quote Value', '#10b981') +
                    miniMetric(t.numProjectsWon, 'Wins', '#f59e0b') +
                    miniMetric(fmtMoney(t.projectValue, '₹'), 'Project Value', '#8b5cf6') +
                    miniMetric(fmtMoney(t.variationValue, '₹'), 'Variation Value', '#ec4899') +
                    miniMetric(fmtMoney(t.totalValue, '₹'), 'Total Value', '#0ea5e9') +
                    miniMetric(t.numNewClients, 'Clients', '#14b8a6') +
                '</div>' +
                (topRows
                    ? '<div style="overflow-x:auto;">' +
                      '<table class="data-table" style="width:100%; font-size:0.9rem;">' +
                          '<thead><tr>' +
                              '<th>#</th><th>BDM</th>' +
                              '<th style="text-align:right;">Quotes</th>' +
                              '<th style="text-align:right;">Quote ₹</th>' +
                              '<th style="text-align:right;">Wins</th>' +
                              '<th style="text-align:right;">Project ₹</th>' +
                              '<th style="text-align:right;">Variation ₹</th>' +
                              '<th style="text-align:right;">Total ₹</th>' +
                          '</tr></thead>' +
                          '<tbody>' + topRows + '</tbody>' +
                      '</table></div>'
                    : '<div style="text-align:center; padding:0.5rem; color:#64748b;">No BDM activity recorded in the database yet.</div>') +
            '</div>'
        );
    }

    function miniMetric(value, label, color) {
        return (
            '<div style="background:white; border-radius:6px; padding:0.6rem 0.8rem; border-top:3px solid ' + color + ';">' +
                '<div style="font-size:1.05rem; font-weight:700; color:' + color + ';">' + value + '</div>' +
                '<div style="font-size:0.75rem; color:#64748b;">' + label + '</div>' +
            '</div>'
        );
    }

    function summaryCard(value, label, color) {
        return (
            '<div class="stat-card" style="border-top:4px solid ' + color + '; padding:1rem; background:#fff; border-radius:8px; box-shadow:0 1px 3px rgba(0,0,0,0.06);">' +
                '<div class="stat-number" style="color:' + color + '; font-size:1.5rem; font-weight:700;">' + value + '</div>' +
                '<div class="stat-label" style="font-size:0.8rem; color:var(--text-light,#666); margin-top:0.25rem;">' + label + '</div>' +
            '</div>'
        );
    }

    function renderTabs() {
        return (
            '<div class="card" style="padding:0; margin-bottom:0.5rem;">' +
                '<div style="display:flex; border-bottom:2px solid var(--border,#e5e7eb); overflow-x:auto;">' +
                    tabBtn('period', '📅 Period Summary', true) +
                    tabBtn('quotes', '📝 Quotes Uploaded') +
                    tabBtn('won', '🏆 Projects Won') +
                    tabBtn('variations', '➕ Variations') +
                    tabBtn('charts', '📈 Charts') +
                '</div>' +
            '</div>'
        );
    }

    function tabBtn(name, label, active) {
        return (
            '<button class="bdm-an-tab' + (active ? ' active' : '') + '" ' +
            'data-tab="' + name + '" onclick="window._bdmAnTabClick(\'' + name + '\', this)" ' +
            'style="padding:0.85rem 1.25rem; background:transparent; border:none; cursor:pointer; ' +
            'font-weight:' + (active ? '600' : '500') + '; color:' + (active ? 'var(--primary-blue,#2563eb)' : 'var(--text-light,#666)') + '; ' +
            'border-bottom:3px solid ' + (active ? 'var(--primary-blue,#2563eb)' : 'transparent') + '; white-space:nowrap;">' +
            label + '</button>'
        );
    }

    window._bdmAnTabClick = function (name, btn) {
        document.querySelectorAll('.bdm-an-tab').forEach(function (b) {
            b.classList.remove('active');
            b.style.color = 'var(--text-light,#666)';
            b.style.borderBottom = '3px solid transparent';
            b.style.fontWeight = '500';
        });
        btn.classList.add('active');
        btn.style.color = 'var(--primary-blue,#2563eb)';
        btn.style.borderBottom = '3px solid var(--primary-blue,#2563eb)';
        btn.style.fontWeight = '600';
        showTab(name);
    };

    function showTab(name) {
        var host = document.getElementById('bdmAnalyticsTabs');
        if (!host) return;
        if (name === 'period') host.innerHTML = renderPeriodSummary();
        else if (name === 'quotes') host.innerHTML = renderQuotesList();
        else if (name === 'won') host.innerHTML = renderWonList();
        else if (name === 'variations') host.innerHTML = renderVariationsList();
        else if (name === 'charts') {
            host.innerHTML = renderChartsContainer();
            setTimeout(renderCharts, 50);
        }
    }

    // ── Period Summary tab ─────────────────────────────────────────────────────
    function renderPeriodSummary() {
        var d = state.data;
        var keys = d.periodKeys.slice().reverse(); // most recent first
        var sel = state.selectedPeriodKey || keys[0];

        var perBdm = d.bdms.map(function (b) {
            var p = b.periods.filter(function (pp) { return pp.period === sel; })[0];
            return {
                bdmName: b.bdmName,
                row: p || {
                    numQuotes: 0, quoteValueTotal: 0,
                    numProjectsWon: 0, projectValue: 0,
                    variationValue: 0, totalValue: 0,
                    numNewClients: 0
                }
            };
        });

        // totals row
        var t = perBdm.reduce(function (acc, x) {
            acc.numQuotes += x.row.numQuotes;
            acc.quoteValueTotal += x.row.quoteValueTotal;
            acc.numProjectsWon += x.row.numProjectsWon;
            acc.projectValue += x.row.projectValue;
            acc.variationValue += x.row.variationValue;
            acc.totalValue += x.row.totalValue;
            acc.numNewClients += x.row.numNewClients;
            return acc;
        }, {
            numQuotes: 0, quoteValueTotal: 0,
            numProjectsWon: 0, projectValue: 0,
            variationValue: 0, totalValue: 0, numNewClients: 0
        });

        var periodSelector =
            '<div style="margin-bottom:0.75rem; display:flex; gap:0.75rem; align-items:center;">' +
                '<label style="font-weight:600;">Period:</label>' +
                '<select id="bdmAnPeriodSelect" style="padding:0.5rem; border:1px solid var(--border,#ddd); border-radius:6px;">' +
                keys.map(function (k) {
                    return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' +
                        periodLabel(k, state.granularity) + '</option>';
                }).join('') +
                '</select>' +
            '</div>';

        var rows = perBdm.map(function (x, i) {
            var r = x.row;
            return (
                '<tr>' +
                    '<td>' + (i + 1) + '</td>' +
                    '<td><strong>' + x.bdmName + '</strong></td>' +
                    '<td>' + r.numQuotes + '</td>' +
                    '<td style="text-align:right;">' + fmtMoney(r.quoteValueTotal) + '</td>' +
                    '<td>' + r.numProjectsWon + '</td>' +
                    '<td style="text-align:right;">' + fmtMoney(r.projectValue) + '</td>' +
                    '<td style="text-align:right;">' + fmtMoney(r.variationValue) + '</td>' +
                    '<td style="text-align:right; font-weight:700;">' + fmtMoney(r.totalValue) + '</td>' +
                    '<td>' + r.numNewClients + '</td>' +
                '</tr>'
            );
        }).join('');

        var totalRow =
            '<tr style="background:#f3f4f6; font-weight:700;">' +
                '<td colspan="2">TOTAL</td>' +
                '<td>' + t.numQuotes + '</td>' +
                '<td style="text-align:right;">' + fmtMoney(t.quoteValueTotal) + '</td>' +
                '<td>' + t.numProjectsWon + '</td>' +
                '<td style="text-align:right;">' + fmtMoney(t.projectValue) + '</td>' +
                '<td style="text-align:right;">' + fmtMoney(t.variationValue) + '</td>' +
                '<td style="text-align:right;">' + fmtMoney(t.totalValue) + '</td>' +
                '<td>' + t.numNewClients + '</td>' +
            '</tr>';

        var html =
            '<div class="card" style="padding:1rem;">' +
                periodSelector +
                '<div style="overflow-x:auto;">' +
                '<table class="data-table" style="width:100%;">' +
                    '<thead><tr>' +
                        '<th>#</th><th>BDM</th>' +
                        '<th>No. of Quotes</th><th style="text-align:right;">Quote Value</th>' +
                        '<th>Projects Won</th><th style="text-align:right;">Project Value</th>' +
                        '<th style="text-align:right;">Variation Value</th>' +
                        '<th style="text-align:right;">Total Value</th>' +
                        '<th>New Clients</th>' +
                    '</tr></thead>' +
                    '<tbody>' + (rows || ('<tr><td colspan="9" style="text-align:center; padding:1.5rem;">No BDMs.</td></tr>')) + '</tbody>' +
                    '<tfoot>' + totalRow + '</tfoot>' +
                '</table></div>' +
            '</div>';

        // attach period change handler
        setTimeout(function () {
            var sel = document.getElementById('bdmAnPeriodSelect');
            if (sel) {
                sel.onchange = function () {
                    state.selectedPeriodKey = sel.value;
                    showTab('period');
                };
            }
        }, 0);

        return html;
    }

    // ── Quotes Uploaded tab (date + value) ─────────────────────────────────────
    function renderQuotesList() {
        var d = state.data;
        var rows = [];
        d.bdms.forEach(function (b) {
            b.periods.forEach(function (p) {
                p.quotes.forEach(function (q) {
                    rows.push({
                        date: q.date,
                        bdm: b.bdmName,
                        period: p.period,
                        projectName: q.projectName,
                        client: q.clientCompany,
                        projectNumber: q.projectNumber,
                        currency: q.currency,
                        value: q.value,
                        status: q.status
                    });
                });
            });
        });
        rows.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

        var body = rows.map(function (r, i) {
            return (
                '<tr>' +
                    '<td>' + (i + 1) + '</td>' +
                    '<td>' + fmtDate(r.date) + '</td>' +
                    '<td><strong>' + r.bdm + '</strong></td>' +
                    '<td>' + periodLabel(r.period, state.granularity) + '</td>' +
                    '<td>' + r.projectName + '</td>' +
                    '<td>' + r.client + '</td>' +
                    '<td>' + r.projectNumber + '</td>' +
                    '<td style="text-align:right;">' + fmtMoney(r.value, r.currency) + '</td>' +
                    '<td>' + r.status + '</td>' +
                '</tr>'
            );
        }).join('');

        return (
            '<div class="card" style="padding:1rem;">' +
                '<h3 style="margin:0 0 0.75rem 0;">Quotes Uploaded — ' + rows.length + ' total</h3>' +
                '<div style="overflow-x:auto;">' +
                '<table class="data-table" style="width:100%;">' +
                    '<thead><tr>' +
                        '<th>#</th><th>Date</th><th>BDM</th><th>Period</th>' +
                        '<th>Project</th><th>Client</th><th>Project #</th>' +
                        '<th style="text-align:right;">Value</th><th>Status</th>' +
                    '</tr></thead>' +
                    '<tbody>' + (body || '<tr><td colspan="9" style="text-align:center; padding:1.5rem;">No quotes in this range.</td></tr>') + '</tbody>' +
                '</table></div>' +
            '</div>'
        );
    }

    // ── Projects Won tab ───────────────────────────────────────────────────────
    function renderWonList() {
        var d = state.data;
        var rows = [];
        d.bdms.forEach(function (b) {
            b.periods.forEach(function (p) {
                p.wonProjects.forEach(function (w) {
                    rows.push({
                        date: w.date,
                        bdm: b.bdmName,
                        period: p.period,
                        projectName: w.projectName,
                        client: w.clientCompany,
                        currency: w.currency,
                        value: w.value
                    });
                });
            });
        });
        rows.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

        var body = rows.map(function (r, i) {
            return (
                '<tr>' +
                    '<td>' + (i + 1) + '</td>' +
                    '<td>' + fmtDate(r.date) + '</td>' +
                    '<td><strong>' + r.bdm + '</strong></td>' +
                    '<td>' + periodLabel(r.period, state.granularity) + '</td>' +
                    '<td>' + r.projectName + '</td>' +
                    '<td>' + r.client + '</td>' +
                    '<td style="text-align:right;">' + fmtMoney(r.value, r.currency) + '</td>' +
                '</tr>'
            );
        }).join('');

        return (
            '<div class="card" style="padding:1rem;">' +
                '<h3 style="margin:0 0 0.75rem 0;">Projects Won — ' + rows.length + ' total</h3>' +
                '<div style="overflow-x:auto;">' +
                '<table class="data-table" style="width:100%;">' +
                    '<thead><tr>' +
                        '<th>#</th><th>Won On</th><th>BDM</th><th>Period</th>' +
                        '<th>Project</th><th>Client</th>' +
                        '<th style="text-align:right;">Value</th>' +
                    '</tr></thead>' +
                    '<tbody>' + (body || '<tr><td colspan="7" style="text-align:center; padding:1.5rem;">No wins in this range.</td></tr>') + '</tbody>' +
                '</table></div>' +
            '</div>'
        );
    }

    // ── Variations tab ─────────────────────────────────────────────────────────
    function renderVariationsList() {
        var d = state.data;
        var rows = [];
        d.bdms.forEach(function (b) {
            b.periods.forEach(function (p) {
                p.variations.forEach(function (v) {
                    rows.push({
                        date: v.date,
                        bdm: b.bdmName,
                        period: p.period,
                        variationCode: v.variationCode,
                        projectName: v.projectName,
                        client: v.clientCompany,
                        hours: v.estimatedHours,
                        currency: v.currency,
                        value: v.value
                    });
                });
            });
        });
        rows.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

        var body = rows.map(function (r, i) {
            return (
                '<tr>' +
                    '<td>' + (i + 1) + '</td>' +
                    '<td>' + fmtDate(r.date) + '</td>' +
                    '<td><strong>' + r.bdm + '</strong></td>' +
                    '<td>' + periodLabel(r.period, state.granularity) + '</td>' +
                    '<td>' + r.variationCode + '</td>' +
                    '<td>' + r.projectName + '</td>' +
                    '<td>' + r.client + '</td>' +
                    '<td style="text-align:right;">' + (r.hours || 0) + 'h</td>' +
                    '<td style="text-align:right;">' + fmtMoney(r.value, r.currency) + '</td>' +
                '</tr>'
            );
        }).join('');

        return (
            '<div class="card" style="padding:1rem;">' +
                '<h3 style="margin:0 0 0.75rem 0;">Approved Variations — ' + rows.length + ' total</h3>' +
                '<div style="overflow-x:auto;">' +
                '<table class="data-table" style="width:100%;">' +
                    '<thead><tr>' +
                        '<th>#</th><th>Approved On</th><th>BDM</th><th>Period</th>' +
                        '<th>Variation Code</th><th>Project</th><th>Client</th>' +
                        '<th style="text-align:right;">Hours</th>' +
                        '<th style="text-align:right;">Value</th>' +
                    '</tr></thead>' +
                    '<tbody>' + (body || '<tr><td colspan="9" style="text-align:center; padding:1.5rem;">No approved variations in this range.</td></tr>') + '</tbody>' +
                '</table></div>' +
            '</div>'
        );
    }

    // ── Charts tab ─────────────────────────────────────────────────────────────
    function renderChartsContainer() {
        return (
            '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(420px, 1fr)); gap:1.5rem;">' +
                '<div class="card" style="padding:1rem;">' +
                    '<h3 style="margin-top:0;">Total Value by BDM</h3>' +
                    '<div style="height:320px;"><canvas id="bdmAnTotalsChart"></canvas></div>' +
                '</div>' +
                '<div class="card" style="padding:1rem;">' +
                    '<h3 style="margin-top:0;">Quotes Uploaded by BDM</h3>' +
                    '<div style="height:320px;"><canvas id="bdmAnQuotesChart"></canvas></div>' +
                '</div>' +
                '<div class="card" style="padding:1rem; grid-column:1/-1;">' +
                    '<h3 style="margin-top:0;">Project Value Trend</h3>' +
                    '<div style="height:320px;"><canvas id="bdmAnTrendChart"></canvas></div>' +
                '</div>' +
            '</div>'
        );
    }

    function renderCharts() {
        if (typeof Chart === 'undefined') return;
        var d = state.data;
        var palette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#ef4444', '#84cc16'];

        // Build the per-BDM totals the bar charts will use. Prefer the
        // in-range overall totals so the charts honour the date filter
        // when there's data, but fall back to the lifetime per-BDM totals
        // (keyed by bdmUid) when the in-range totals are all zero -- that
        // way the bars are never empty just because the user picked a
        // narrow window.
        var inRangeTotal = (d.bdms || []).reduce(function (s, b) {
            return s + ((b.overall && b.overall.projectValue) || 0)
                     + ((b.overall && b.overall.variationValue) || 0)
                     + ((b.overall && b.overall.numQuotes) || 0);
        }, 0);
        var lifetimeBdms = (d.lifetime && d.lifetime.bdms) || [];
        var lifetimeByUid = {};
        lifetimeBdms.forEach(function (lb) { lifetimeByUid[lb.bdmUid] = lb; });
        var useLifetimeCharts = inRangeTotal === 0 && lifetimeBdms.length > 0;

        function chartProjectValue(b) {
            if (useLifetimeCharts) {
                var lb = lifetimeByUid[b.bdmUid];
                return lb ? (lb.projectValue || 0) : 0;
            }
            return (b.overall && b.overall.projectValue) || 0;
        }
        function chartVariationValue(b) {
            if (useLifetimeCharts) {
                var lb = lifetimeByUid[b.bdmUid];
                return lb ? (lb.variationValue || 0) : 0;
            }
            return (b.overall && b.overall.variationValue) || 0;
        }
        function chartNumQuotes(b) {
            if (useLifetimeCharts) {
                var lb = lifetimeByUid[b.bdmUid];
                return lb ? (lb.numQuotes || 0) : 0;
            }
            return (b.overall && b.overall.numQuotes) || 0;
        }
        // If we're falling back, prefer the lifetime BDM list itself (it
        // already includes every BDM seeded with zero, ordered by total
        // value descending) so the chart axes match what users expect.
        var chartBdms = useLifetimeCharts && lifetimeBdms.length
            ? lifetimeBdms.map(function (lb) {
                  return { bdmUid: lb.bdmUid, bdmName: lb.bdmName, overall: lb, periods: [] };
              })
            : (d.bdms || []);

        var totalsTitle = useLifetimeCharts ? ' (all-time)' : '';

        // Bar: total value per BDM
        var totalsCanvas = document.getElementById('bdmAnTotalsChart');
        if (totalsCanvas) {
            if (Chart.getChart(totalsCanvas)) Chart.getChart(totalsCanvas).destroy();
            // Update the chart card heading if present so the user knows
            // the bars are showing all-time numbers.
            try {
                var totalsHeading = totalsCanvas.parentNode && totalsCanvas.parentNode.querySelector('h3');
                if (totalsHeading && !/all-time/i.test(totalsHeading.textContent || '')) {
                    totalsHeading.textContent = 'Total Value by BDM' + totalsTitle;
                }
            } catch (e) { /* ignore */ }
            new Chart(totalsCanvas, {
                type: 'bar',
                data: {
                    labels: chartBdms.map(function (b) { return b.bdmName; }),
                    datasets: [{
                        label: 'Project Value',
                        data: chartBdms.map(chartProjectValue),
                        backgroundColor: palette[0]
                    }, {
                        label: 'Variation Value',
                        data: chartBdms.map(chartVariationValue),
                        backgroundColor: palette[3]
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { x: { stacked: true }, y: { stacked: true } }
                }
            });
        }

        // Bar: quotes uploaded per BDM
        var qCanvas = document.getElementById('bdmAnQuotesChart');
        if (qCanvas) {
            if (Chart.getChart(qCanvas)) Chart.getChart(qCanvas).destroy();
            try {
                var qHeading = qCanvas.parentNode && qCanvas.parentNode.querySelector('h3');
                if (qHeading && !/all-time/i.test(qHeading.textContent || '')) {
                    qHeading.textContent = 'Quotes Uploaded by BDM' + totalsTitle;
                }
            } catch (e) { /* ignore */ }
            new Chart(qCanvas, {
                type: 'bar',
                data: {
                    labels: chartBdms.map(function (b) { return b.bdmName; }),
                    datasets: [{
                        label: 'No. of Quotes',
                        data: chartBdms.map(chartNumQuotes),
                        backgroundColor: palette[1]
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            });
        }

        // Line: project value trend across periods (one line per BDM)
        var trendCanvas = document.getElementById('bdmAnTrendChart');
        if (trendCanvas) {
            if (Chart.getChart(trendCanvas)) Chart.getChart(trendCanvas).destroy();
            var labels = d.periodKeys.map(function (k) { return periodLabel(k, state.granularity); });
            var datasets = d.bdms.map(function (b, i) {
                var series = d.periodKeys.map(function (k) {
                    var p = b.periods.filter(function (pp) { return pp.period === k; })[0];
                    return p ? p.projectValue : 0;
                });
                var color = palette[i % palette.length];
                return {
                    label: b.bdmName,
                    data: series,
                    borderColor: color,
                    backgroundColor: color + '33',
                    tension: 0.3,
                    fill: false
                };
            });
            new Chart(trendCanvas, {
                type: 'line',
                data: { labels: labels, datasets: datasets },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }
    }

    // ── Excel download ─────────────────────────────────────────────────────────
    function downloadExcel() {
        if (typeof XLSX === 'undefined') {
            alert('Excel library not loaded. Please refresh the page.');
            return;
        }
        var d = state.data;
        var wb = XLSX.utils.book_new();

        // Sheet 1: Per-BDM-per-period summary
        var sum = [['BDM', 'Period', 'No. of Quotes', 'Quote Value', 'Projects Won', 'Project Value', 'Variation Value', 'Total Value', 'New Clients']];
        d.bdms.forEach(function (b) {
            b.periods.forEach(function (p) {
                sum.push([
                    b.bdmName, periodLabel(p.period, state.granularity),
                    p.numQuotes, p.quoteValueTotal,
                    p.numProjectsWon, p.projectValue,
                    p.variationValue, p.totalValue, p.numNewClients
                ]);
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), 'Period Summary');

        // Sheet 2: All quotes uploaded (date + value)
        var quotes = [['Date', 'BDM', 'Period', 'Project', 'Client', 'Project #', 'Currency', 'Value', 'Status']];
        d.bdms.forEach(function (b) {
            b.periods.forEach(function (p) {
                p.quotes.forEach(function (q) {
                    quotes.push([
                        q.date, b.bdmName, periodLabel(p.period, state.granularity),
                        q.projectName, q.clientCompany, q.projectNumber,
                        q.currency, q.value, q.status
                    ]);
                });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(quotes), 'Quotes Uploaded');

        // Sheet 3: Projects Won
        var wins = [['Won On', 'BDM', 'Period', 'Project', 'Client', 'Currency', 'Value']];
        d.bdms.forEach(function (b) {
            b.periods.forEach(function (p) {
                p.wonProjects.forEach(function (w) {
                    wins.push([
                        w.date, b.bdmName, periodLabel(p.period, state.granularity),
                        w.projectName, w.clientCompany, w.currency, w.value
                    ]);
                });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wins), 'Projects Won');

        // Sheet 4: Variations
        var vars = [['Approved On', 'BDM', 'Period', 'Variation Code', 'Project', 'Client', 'Hours', 'Currency', 'Value']];
        d.bdms.forEach(function (b) {
            b.periods.forEach(function (p) {
                p.variations.forEach(function (v) {
                    vars.push([
                        v.date, b.bdmName, periodLabel(p.period, state.granularity),
                        v.variationCode, v.projectName, v.clientCompany,
                        v.estimatedHours, v.currency, v.value
                    ]);
                });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vars), 'Variations');

        XLSX.writeFile(wb, 'BDM_Analytics_' + state.granularity + '_' + new Date().toISOString().split('T')[0] + '.xlsx');
    }

    console.log('[BDM analytics] module loaded');
})();
