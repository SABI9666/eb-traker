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

    // Compact Indian-currency format for dashboard tiles so large values are
    // shown professionally (₹5.16 Cr / ₹79.51 L) instead of being truncated.
    function fmtMoneyShort(v, currency) {
        var n = Number(v) || 0;
        var cur = currency || '';
        var abs = Math.abs(n);
        var out;
        var strip = function (x) { return x.toFixed(2).replace(/\.?0+$/, ''); };
        if (abs >= 1e7)      out = strip(n / 1e7) + ' Cr';
        else if (abs >= 1e5) out = strip(n / 1e5) + ' L';
        else                 out = n.toLocaleString(undefined, { maximumFractionDigits: 0 });
        return cur ? cur + ' ' + out : out;
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
        selectedPeriodKey: null,
        // Cached payloads for the Charts tab keyed by granularity so the
        // weekly / monthly / yearly views can be rendered side-by-side
        // without firing the same fetch every time the tab is opened.
        chartsCache: { week: null, month: null, year: null },
        chartsCacheKey: null,
        // Per-cadence selected period for the Charts tab. Each entry is
        // a period key from the matching cache payload (e.g. "2025-W26",
        // "2025-06", "2025"). Charts render for the chosen period.
        chartsSelectedPeriod: { week: null, month: null, year: null }
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
            // The cached charts payloads were fetched against the previous
            // From/To window — invalidate so the Charts tab refetches.
            state.chartsCache = { week: null, month: null, year: null };
            state.chartsCacheKey = null;
            window.showBdmAnalytics();
        };
        document.getElementById('bdmAnalyticsExcelBtn').onclick = function () {
            var sel = document.getElementById('bdmAnExportGranularity');
            var g = (sel && sel.value) || state.granularity || 'month';
            downloadExcel(g);
        };
        var chartsBtn = document.getElementById('bdmAnChartsPngBtn');
        if (chartsBtn) chartsBtn.onclick = downloadChartsPng;

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
                '<div style="border-left:1px solid var(--border,#ddd); padding-left:1rem; display:flex; gap:0.5rem; align-items:end; flex-wrap:wrap;">' +
                    '<div>' +
                        '<label style="display:block; font-size:0.85rem; color:var(--text-light,#666);">Export</label>' +
                        '<select id="bdmAnExportGranularity" style="padding:0.5rem; border:1px solid var(--border,#ddd); border-radius:6px;">' +
                            '<option value="week">Weekly</option>' +
                            '<option value="month" selected>Monthly</option>' +
                            '<option value="year">Yearly</option>' +
                            '<option value="all">All cadences</option>' +
                        '</select>' +
                    '</div>' +
                    '<button id="bdmAnalyticsExcelBtn" class="btn btn-success" title="Download summary + quotes + wins + variations + lifetime">📥 Excel</button>' +
                    '<button id="bdmAnChartsPngBtn" class="btn btn-info" title="Save the rendered chart canvases as PNG files (open the Charts tab first)">🖼️ Charts (PNG)</button>' +
                '</div>' +
            '</div>'
        );
    }

    function renderSummaryCards(totals, isLifetime) {
        var caption = isLifetime ? '<div style="text-align:center; font-size:0.75rem; color:#92400e; margin:-0.75rem 0 0.75rem 0; font-weight:600;">📊 Showing all-time totals (current From/To range has no activity)</div>' : '';
        return caption +
            '<div class="dashboard-stats" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin-bottom:1.25rem;">' +
                summaryCard(totals.numQuotes, '📝 Quotes Uploaded') +
                summaryCard(fmtMoneyShort(totals.quoteValueTotal, '₹'), '💰 Total Quote Value', fmtMoney(totals.quoteValueTotal, '₹')) +
                summaryCard(totals.numProjectsWon, '🏆 Projects Won') +
                summaryCard(fmtMoneyShort(totals.projectValue, '₹'), '📈 Project Value', fmtMoney(totals.projectValue, '₹')) +
                summaryCard(fmtMoneyShort(totals.variationValue, '₹'), '➕ Variation Value', fmtMoney(totals.variationValue, '₹')) +
                summaryCard(fmtMoneyShort(totals.totalValue, '₹'), '💵 Total Value', fmtMoney(totals.totalValue, '₹')) +
                summaryCard(totals.numNewClients, '🤝 New Clients') +
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
                    miniMetric(t.numQuotes, 'Quotes') +
                    miniMetric(fmtMoneyShort(t.quoteValueTotal, '₹'), 'Quote Value', fmtMoney(t.quoteValueTotal, '₹')) +
                    miniMetric(t.numProjectsWon, 'Wins') +
                    miniMetric(fmtMoneyShort(t.projectValue, '₹'), 'Project Value', fmtMoney(t.projectValue, '₹')) +
                    miniMetric(fmtMoneyShort(t.variationValue, '₹'), 'Variation Value', fmtMoney(t.variationValue, '₹')) +
                    miniMetric(fmtMoneyShort(t.totalValue, '₹'), 'Total Value', fmtMoney(t.totalValue, '₹')) +
                    miniMetric(t.numNewClients, 'Clients') +
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

    function miniMetric(value, label, titleFull) {
        var ACCENT = '#0e7490'; // uniform brand accent
        var titleAttr = titleFull ? ' title="' + String(titleFull).replace(/"/g, '&quot;') + '"' : '';
        return (
            '<div' + titleAttr + ' style="background:white; border-radius:8px; padding:0.6rem 0.8rem; border-top:3px solid ' + ACCENT + '; border:1px solid #e6ebf2;">' +
                '<div style="font-size:1.05rem; font-weight:800; color:' + ACCENT + '; white-space:normal;">' + value + '</div>' +
                '<div style="font-size:0.72rem; letter-spacing:0.4px; text-transform:uppercase; color:#64748b; font-weight:600;">' + label + '</div>' +
            '</div>'
        );
    }

    // Uniform, professional stat tile. `titleFull` (optional) shows the exact
    // value on hover when the displayed value is compacted (e.g. ₹5.16 Cr).
    function summaryCard(value, label, titleFull) {
        var STAT_ACCENT = '#0e7490'; // uniform brand accent for all tiles
        var titleAttr = titleFull ? ' title="' + String(titleFull).replace(/"/g, '&quot;') + '"' : '';
        return (
            '<div class="stat-card"' + titleAttr + ' style="border-top:3px solid ' + STAT_ACCENT + '; padding:1.15rem 1.1rem; background:#fff; border:1px solid #e6ebf2; border-radius:14px; box-shadow:0 10px 28px -14px rgba(15,23,42,0.18);">' +
                '<div class="stat-number" style="color:' + STAT_ACCENT + '; font-size:1.5rem; font-weight:800; line-height:1.15; letter-spacing:-0.01em; white-space:normal; overflow:visible; text-overflow:clip;">' + value + '</div>' +
                '<div class="stat-label" style="font-size:0.72rem; letter-spacing:0.6px; text-transform:uppercase; color:#64748b; margin-top:0.4rem; font-weight:600;">' + label + '</div>' +
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
            loadAndRenderCharts(host);
        }
    }

    // Fetch a single granularity payload for the Charts tab. Honours the
    // user's From/To filter so the weekly / monthly / yearly bars stay in
    // sync with the rest of the page.
    async function fetchChartsData(granularity) {
        var qs = 'granularity=' + encodeURIComponent(granularity);
        if (state.from) qs += '&from=' + encodeURIComponent(state.from);
        if (state.to) qs += '&to=' + encodeURIComponent(state.to);
        var resp = await window.apiCall('bdm-analytics?' + qs);
        if (!resp || !resp.success) {
            throw new Error((resp && resp.error) || 'Failed to load BDM analytics (' + granularity + ')');
        }
        return resp.data;
    }

    async function loadAndRenderCharts(host) {
        var cacheKey = (state.from || '') + '|' + (state.to || '');
        if (state.chartsCacheKey !== cacheKey) {
            state.chartsCache = { week: null, month: null, year: null };
            state.chartsSelectedPeriod = { week: null, month: null, year: null };
            state.chartsCacheKey = cacheKey;
        }
        host.innerHTML =
            '<div class="card" style="padding:1.5rem; text-align:center; color:#64748b;">' +
                '⏳ Loading weekly / monthly / yearly charts…' +
            '</div>';
        try {
            var needs = [];
            if (!state.chartsCache.week) needs.push(['week', fetchChartsData('week')]);
            if (!state.chartsCache.month) needs.push(['month', fetchChartsData('month')]);
            if (!state.chartsCache.year) needs.push(['year', fetchChartsData('year')]);
            if (needs.length) {
                var results = await Promise.all(needs.map(function (n) { return n[1]; }));
                needs.forEach(function (n, i) { state.chartsCache[n[0]] = results[i]; });
            }
            // Default each cadence to the most recent period that
            // actually has activity, so the chart isn't blank on first
            // open. Falls back to the most recent key if nothing has
            // activity in the entire range.
            ['week', 'month', 'year'].forEach(function (g) {
                var data = state.chartsCache[g];
                var keys = (data && data.periodKeys) || [];
                if (state.chartsSelectedPeriod[g] && keys.indexOf(state.chartsSelectedPeriod[g]) !== -1) return;
                var pick = null;
                for (var i = keys.length - 1; i >= 0 && !pick; i--) {
                    var k = keys[i];
                    var hasIt = (data.bdms || []).some(function (b) {
                        return (b.periods || []).some(function (pp) {
                            if (String(pp.period) !== String(k)) return false;
                            return (pp.numQuotes || 0) + (pp.numProjectsWon || 0)
                                 + (pp.quoteValueTotal || 0) + (pp.projectValue || 0) > 0;
                        });
                    });
                    if (hasIt) pick = k;
                }
                state.chartsSelectedPeriod[g] = pick || keys[keys.length - 1] || null;
            });
            host.innerHTML = renderChartsContainer();
            setTimeout(function () {
                renderCharts();
                bindPeriodSelectors();
            }, 50);
        } catch (err) {
            console.error('[BDM analytics] charts load error:', err);
            host.innerHTML =
                '<div class="card" style="padding:1.5rem; color:#dc2626;">' +
                    '⚠️ Failed to load charts: ' + (err.message || err) +
                '</div>';
        }
    }

    function bindPeriodSelectors() {
        ['week', 'month', 'year'].forEach(function (g) {
            var sel = document.getElementById('bdmAnPeriodSel_' + g);
            if (!sel) return;
            sel.onchange = function () {
                state.chartsSelectedPeriod[g] = sel.value;
                var palette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#ef4444', '#84cc16'];
                renderGranularityCharts(g, palette);
            };
        });
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
    // Three independent sections (Weekly / Monthly / Yearly), each with
    // a period dropdown so the bar charts re-render for the chosen
    // week / month / year. Trend line still spans the full window.
    function renderChartsContainer() {
        return (
            renderGranularitySection('week', 'Weekly') +
            renderGranularitySection('month', 'Monthly') +
            renderGranularitySection('year', 'Yearly') +
            '<div class="card" style="padding:1rem; margin-top:1.5rem;">' +
                '<h3 style="margin-top:0;">Total Value by BDM (current filter)</h3>' +
                '<div style="height:320px;"><canvas id="bdmAnTotalsChart"></canvas></div>' +
            '</div>'
        );
    }

    function renderGranularitySection(gran, label) {
        var d = state.chartsCache[gran] || {};
        var keys = (d.periodKeys || []).slice().reverse(); // most recent first
        var sel = state.chartsSelectedPeriod[gran];
        var pickerLabel = gran === 'week' ? 'Week' : gran === 'month' ? 'Month' : 'Year';
        var options = keys.length
            ? keys.map(function (k) {
                  return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' +
                      periodLabel(k, gran) + '</option>';
              }).join('')
            : '<option value="">(no data)</option>';

        return (
            '<div style="margin-bottom:1.75rem;">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem; flex-wrap:wrap; padding-bottom:0.4rem; margin-bottom:0.75rem; border-bottom:2px solid #e5e7eb;">' +
                    '<h3 style="margin:0; color:#1e293b;">📅 ' + label + ' Charts</h3>' +
                    '<div style="display:flex; align-items:center; gap:0.5rem;">' +
                        '<label style="font-size:0.85rem; color:#475569; font-weight:600;">' + pickerLabel + ':</label>' +
                        '<select id="bdmAnPeriodSel_' + gran + '" style="padding:0.4rem 0.6rem; border:1px solid #ddd; border-radius:6px; font-size:0.9rem; min-width:140px;">' +
                            options +
                        '</select>' +
                    '</div>' +
                '</div>' +
                '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(420px, 1fr)); gap:1.5rem;">' +
                    '<div class="card" style="padding:1rem;">' +
                        '<h4 style="margin-top:0; color:#3b82f6;" id="bdmAnHead_quotes_' + gran + '">📝 Quotes Uploaded by BDM (' + label + ')</h4>' +
                        '<div style="height:300px;"><canvas id="bdmAnChart_quotes_' + gran + '"></canvas></div>' +
                    '</div>' +
                    '<div class="card" style="padding:1rem;">' +
                        '<h4 style="margin-top:0; color:#f59e0b;" id="bdmAnHead_won_' + gran + '">🏆 Projects Won by BDM (' + label + ')</h4>' +
                        '<div style="height:300px;"><canvas id="bdmAnChart_won_' + gran + '"></canvas></div>' +
                    '</div>' +
                    '<div class="card" style="padding:1rem; grid-column:1/-1;">' +
                        '<h4 style="margin-top:0; color:#8b5cf6;">📈 ' + label + ' Trend — Quote Value vs Won Value</h4>' +
                        '<div style="height:320px;"><canvas id="bdmAnChart_trend_' + gran + '"></canvas></div>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );
    }

    function renderCharts() {
        if (typeof Chart === 'undefined') return;
        var palette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9', '#ef4444', '#84cc16'];

        renderGranularityCharts('week', palette);
        renderGranularityCharts('month', palette);
        renderGranularityCharts('year', palette);
        renderTotalValueChart(palette);
    }

    // Render the per-BDM bar charts (Quotes Uploaded + Projects Won) and
    // the per-period trend line for one granularity. Bar charts are
    // scoped to the period selected in the section's dropdown
    // (state.chartsSelectedPeriod[gran]); the trend line still spans the
    // full window so trends remain visible.
    function renderGranularityCharts(gran, palette) {
        var d = state.chartsCache[gran];
        if (!d) return;

        var selectedKey = state.chartsSelectedPeriod[gran];
        var allBdms = d.bdms || [];

        // Build a per-BDM row from the selected period. If that period
        // has no entry for a BDM the row is zeroed.
        function periodRowFor(b) {
            if (!selectedKey) return null;
            var p = (b.periods || []).filter(function (pp) {
                return String(pp.period) === String(selectedKey);
            })[0];
            return p || {
                numQuotes: 0, quoteValueTotal: 0,
                numProjectsWon: 0, projectValue: 0,
                variationValue: 0, totalValue: 0
            };
        }

        // Keep only BDMs who have activity in the selected period so the
        // chart isn't dominated by a long tail of zero bars. If nobody
        // has any activity we render an empty-state message.
        var perBdmAll = allBdms.map(function (b) {
            return { bdmUid: b.bdmUid, bdmName: b.bdmName, row: periodRowFor(b) || {} };
        });
        function rowHasActivity(r) {
            return (r.numQuotes || 0) + (r.numProjectsWon || 0)
                 + (r.quoteValueTotal || 0) + (r.projectValue || 0) > 0;
        }
        var perBdm = perBdmAll.filter(function (x) { return rowHasActivity(x.row); });
        var hasActivityInPeriod = perBdm.length > 0;

        function pick(x, field) { return (x.row && x.row[field]) || 0; }

        var bdms = perBdm;
        var labels = perBdm.map(function (x) { return x.bdmName; });
        var suffix = selectedKey ? ' — ' + periodLabel(selectedKey, gran) : '';
        var emptyMsg = selectedKey
            ? 'No activity recorded for ' + periodLabel(selectedKey, gran) + '.'
            : 'No period selected.';

        // Quotes Uploaded — count + value as a grouped bar chart.
        var quotesCanvas = document.getElementById('bdmAnChart_quotes_' + gran);
        if (quotesCanvas) {
            if (Chart.getChart(quotesCanvas)) Chart.getChart(quotesCanvas).destroy();
            var quotesHead = document.getElementById('bdmAnHead_quotes_' + gran);
            if (quotesHead) quotesHead.textContent = '📝 Quotes Uploaded by BDM' + suffix;
            renderEmptyOverlay(quotesCanvas, hasActivityInPeriod ? '' : emptyMsg);
        }
        if (quotesCanvas && hasActivityInPeriod) {
            new Chart(quotesCanvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'No. of Quotes',
                            data: bdms.map(function (b) { return pick(b, 'numQuotes'); }),
                            backgroundColor: palette[0],
                            yAxisID: 'yCount'
                        },
                        {
                            label: 'Quote Value (₹)',
                            data: bdms.map(function (b) { return pick(b, 'quoteValueTotal'); }),
                            backgroundColor: palette[1],
                            yAxisID: 'yValue'
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: {
                        yCount: { type: 'linear', position: 'left', title: { display: true, text: 'Count' }, beginAtZero: true },
                        yValue: { type: 'linear', position: 'right', title: { display: true, text: 'Value (₹)' }, beginAtZero: true, grid: { drawOnChartArea: false } }
                    }
                }
            });
        }

        // Projects Won — count + value as a grouped bar chart.
        var wonCanvas = document.getElementById('bdmAnChart_won_' + gran);
        if (wonCanvas) {
            if (Chart.getChart(wonCanvas)) Chart.getChart(wonCanvas).destroy();
            var wonHead = document.getElementById('bdmAnHead_won_' + gran);
            if (wonHead) wonHead.textContent = '🏆 Projects Won by BDM' + suffix;
            renderEmptyOverlay(wonCanvas, hasActivityInPeriod ? '' : emptyMsg);
        }
        if (wonCanvas && hasActivityInPeriod) {
            new Chart(wonCanvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Projects Won',
                            data: bdms.map(function (b) { return pick(b, 'numProjectsWon'); }),
                            backgroundColor: palette[2],
                            yAxisID: 'yCount'
                        },
                        {
                            label: 'Won Value (₹)',
                            data: bdms.map(function (b) { return pick(b, 'projectValue'); }),
                            backgroundColor: palette[3],
                            yAxisID: 'yValue'
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: {
                        yCount: { type: 'linear', position: 'left', title: { display: true, text: 'Count' }, beginAtZero: true },
                        yValue: { type: 'linear', position: 'right', title: { display: true, text: 'Value (₹)' }, beginAtZero: true, grid: { drawOnChartArea: false } }
                    }
                }
            });
        }

        // Trend — per-period totals across the team. Two lines:
        // total quote value uploaded, and total won project value.
        var trendCanvas = document.getElementById('bdmAnChart_trend_' + gran);
        if (trendCanvas) {
            if (Chart.getChart(trendCanvas)) Chart.getChart(trendCanvas).destroy();
            var pkeys = d.periodKeys || [];
            var trendLabels = pkeys.map(function (k) { return periodLabel(k, gran); });
            var quoteSeries = pkeys.map(function (k) {
                var sum = 0;
                (d.bdms || []).forEach(function (b) {
                    var p = (b.periods || []).filter(function (pp) { return pp.period === k; })[0];
                    if (p) sum += (p.quoteValueTotal || 0);
                });
                return sum;
            });
            var wonSeries = pkeys.map(function (k) {
                var sum = 0;
                (d.bdms || []).forEach(function (b) {
                    var p = (b.periods || []).filter(function (pp) { return pp.period === k; })[0];
                    if (p) sum += (p.projectValue || 0);
                });
                return sum;
            });
            new Chart(trendCanvas, {
                type: 'line',
                data: {
                    labels: trendLabels,
                    datasets: [
                        {
                            label: 'Quote Value Uploaded',
                            data: quoteSeries,
                            borderColor: palette[1],
                            backgroundColor: palette[1] + '33',
                            tension: 0.3,
                            fill: false
                        },
                        {
                            label: 'Won Project Value',
                            data: wonSeries,
                            borderColor: palette[3],
                            backgroundColor: palette[3] + '33',
                            tension: 0.3,
                            fill: false
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { beginAtZero: true, title: { display: true, text: 'Value (₹)' } } }
                }
            });
        }
    }

    // Total value bar chart for the currently selected granularity. Kept
    // around so the previous "stacked Project + Variation" view is still
    // available below the per-cadence sections.
    function renderTotalValueChart(palette) {
        var d = state.data;
        if (!d) return;
        var totalsCanvas = document.getElementById('bdmAnTotalsChart');
        if (!totalsCanvas) return;

        var inRangeTotal = (d.bdms || []).reduce(function (s, b) {
            return s + ((b.overall && b.overall.projectValue) || 0)
                     + ((b.overall && b.overall.variationValue) || 0);
        }, 0);
        var lifetimeBdms = (d.lifetime && d.lifetime.bdms) || [];
        var useLifetime = inRangeTotal === 0 && lifetimeBdms.length > 0;
        var bdms = useLifetime
            ? lifetimeBdms.map(function (lb) {
                  return { bdmUid: lb.bdmUid, bdmName: lb.bdmName, overall: lb };
              })
            : (d.bdms || []);

        if (Chart.getChart(totalsCanvas)) Chart.getChart(totalsCanvas).destroy();
        updateHeading(totalsCanvas, 'h3', 'Total Value by BDM (current filter)', useLifetime ? ' (all-time)' : '');
        new Chart(totalsCanvas, {
            type: 'bar',
            data: {
                labels: bdms.map(function (b) { return b.bdmName; }),
                datasets: [{
                    label: 'Project Value',
                    data: bdms.map(function (b) { return (b.overall && b.overall.projectValue) || 0; }),
                    backgroundColor: palette[0]
                }, {
                    label: 'Variation Value',
                    data: bdms.map(function (b) { return (b.overall && b.overall.variationValue) || 0; }),
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

    // Show a centered message over a canvas's wrapper when there's
    // nothing to chart. Pass an empty message to clear any existing
    // overlay so the next chart render isn't masked.
    function renderEmptyOverlay(canvas, message) {
        var wrap = canvas && canvas.parentNode;
        if (!wrap) return;
        if (getComputedStyle(wrap).position === 'static') {
            wrap.style.position = 'relative';
        }
        var existing = wrap.querySelector('[data-bdm-an-empty]');
        if (!message) {
            if (existing) existing.remove();
            canvas.style.opacity = '';
            return;
        }
        if (!existing) {
            existing = document.createElement('div');
            existing.setAttribute('data-bdm-an-empty', '1');
            existing.style.cssText = 'position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#64748b; font-size:0.95rem; text-align:center; padding:1rem; background:rgba(255,255,255,0.85); border-radius:6px;';
            wrap.appendChild(existing);
        }
        existing.textContent = message;
        canvas.style.opacity = '0.15';
    }

    function updateHeading(canvas, tag, baseText, suffix) {
        try {
            var heading = canvas.parentNode && canvas.parentNode.parentNode && canvas.parentNode.parentNode.querySelector(tag);
            if (!heading) heading = canvas.parentNode && canvas.parentNode.querySelector(tag);
            if (heading && suffix && !/all-time/i.test(heading.textContent || '')) {
                heading.textContent = baseText + suffix;
            }
        } catch (e) { /* ignore */ }
    }

    // ── Excel download ─────────────────────────────────────────────────────────
    // Fetch a full-detail (section=all) payload for one granularity so the
    // workbook can include quotes / wins / variations rows alongside the
    // per-BDM × period summary.
    async function fetchFullForGranularity(granularity) {
        var qs = 'granularity=' + encodeURIComponent(granularity) + '&section=all';
        if (state.from) qs += '&from=' + encodeURIComponent(state.from);
        if (state.to) qs += '&to=' + encodeURIComponent(state.to);
        var resp = await window.apiCall('bdm-analytics?' + qs);
        if (!resp || !resp.success) {
            throw new Error((resp && resp.error) || 'Failed to load BDM analytics (' + granularity + ')');
        }
        return resp.data;
    }

    // Append the four standard sheets (Summary, Quotes, Wins, Variations)
    // for a single granularity to the supplied workbook. Sheet names are
    // prefixed with the cadence label so an "All cadences" workbook keeps
    // Weekly / Monthly / Yearly tabs disambiguated.
    function appendGranularitySheets(wb, d, granLabel, granKey) {
        var sum = [['BDM', 'Period', 'No. of Quotes', 'Quote Value (INR)', 'Projects Won', 'Project Value (INR)', 'Variation Value (INR)', 'Total Value (INR)', 'New Clients']];
        (d.bdms || []).forEach(function (b) {
            (b.periods || []).forEach(function (p) {
                sum.push([
                    b.bdmName, periodLabel(p.period, granKey),
                    p.numQuotes, p.quoteValueTotal,
                    p.numProjectsWon, p.projectValue,
                    p.variationValue, p.totalValue, p.numNewClients
                ]);
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sum), (granLabel + ' Summary').slice(0, 31));

        var quotes = [['Date', 'BDM', 'Period', 'Project', 'Client', 'Project #', 'Currency', 'Value (INR)', 'Status']];
        (d.bdms || []).forEach(function (b) {
            (b.periods || []).forEach(function (p) {
                (p.quotes || []).forEach(function (q) {
                    quotes.push([
                        fmtDate(q.date), b.bdmName, periodLabel(p.period, granKey),
                        q.projectName, q.clientCompany, q.projectNumber,
                        q.currency, q.value, q.status
                    ]);
                });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(quotes), (granLabel + ' Quotes').slice(0, 31));

        var wins = [['Won On', 'BDM', 'Period', 'Project', 'Client', 'Currency', 'Value (INR)']];
        (d.bdms || []).forEach(function (b) {
            (b.periods || []).forEach(function (p) {
                (p.wonProjects || []).forEach(function (w) {
                    wins.push([
                        fmtDate(w.date), b.bdmName, periodLabel(p.period, granKey),
                        w.projectName, w.clientCompany, w.currency, w.value
                    ]);
                });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wins), (granLabel + ' Wins').slice(0, 31));

        var vars = [['Approved On', 'BDM', 'Period', 'Variation Code', 'Project', 'Client', 'Hours', 'Currency', 'Value (INR)']];
        (d.bdms || []).forEach(function (b) {
            (b.periods || []).forEach(function (p) {
                (p.variations || []).forEach(function (v) {
                    vars.push([
                        fmtDate(v.date), b.bdmName, periodLabel(p.period, granKey),
                        v.variationCode, v.projectName, v.clientCompany,
                        v.estimatedHours, v.currency, v.value
                    ]);
                });
            });
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vars), (granLabel + ' Variations').slice(0, 31));
    }

    function appendLifetimeSheet(wb, lifetime) {
        if (!lifetime) return;
        var rows = [['BDM', 'No. of Quotes', 'Quote Value (INR)', 'Projects Won', 'Project Value (INR)', 'Variation Value (INR)', 'Total Value (INR)', 'New Clients']];
        (lifetime.bdms || []).forEach(function (b) {
            rows.push([b.bdmName, b.numQuotes, b.quoteValueTotal, b.numProjectsWon, b.projectValue, b.variationValue, b.totalValue, b.numNewClients]);
        });
        var t = lifetime.totals;
        if (t) {
            rows.push([]);
            rows.push(['TOTAL', t.numQuotes, t.quoteValueTotal, t.numProjectsWon, t.projectValue, t.variationValue, t.totalValue, t.numNewClients]);
        }
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Lifetime');
    }

    async function downloadExcel(granularity) {
        if (typeof XLSX === 'undefined') {
            alert('Excel library not loaded. Please refresh the page.');
            return;
        }
        var picks = granularity === 'all' ? ['week', 'month', 'year'] : [granularity || 'month'];
        if (typeof window.showLoading === 'function') window.showLoading();
        try {
            var datas = await Promise.all(picks.map(fetchFullForGranularity));
            var wb = XLSX.utils.book_new();
            // Lifetime is identical across granularities — pull from the
            // first response so it appears once at the top of the workbook.
            appendLifetimeSheet(wb, datas[0] && datas[0].lifetime);
            picks.forEach(function (g, i) {
                var label = g === 'week' ? 'Weekly' : g === 'month' ? 'Monthly' : 'Yearly';
                appendGranularitySheets(wb, datas[i], label, g);
            });
            var GRAN_LABELS = { week: 'Weekly', month: 'Monthly', year: 'Yearly', all: 'All' };
            var fname = 'BDM_Analytics_' + (GRAN_LABELS[granularity] || 'Report') + '_' + new Date().toISOString().split('T')[0] + '.xlsx';
            XLSX.writeFile(wb, fname);
        } catch (err) {
            console.error('[BDM analytics] excel download error:', err);
            alert('Failed to download Excel: ' + (err.message || err));
        } finally {
            if (typeof window.hideLoading === 'function') window.hideLoading();
        }
    }

    // Save every rendered chart canvas as a PNG. The user must have opened
    // the Charts tab at least once for the canvases to exist; otherwise we
    // surface a hint instead of silently doing nothing.
    function downloadChartsPng() {
        var ids = [
            'bdmAnChart_quotes_week', 'bdmAnChart_won_week', 'bdmAnChart_trend_week',
            'bdmAnChart_quotes_month', 'bdmAnChart_won_month', 'bdmAnChart_trend_month',
            'bdmAnChart_quotes_year', 'bdmAnChart_won_year', 'bdmAnChart_trend_year',
            'bdmAnTotalsChart'
        ];
        var date = new Date().toISOString().split('T')[0];
        var found = 0;
        ids.forEach(function (id, i) {
            var canvas = document.getElementById(id);
            if (!canvas) return;
            var url;
            try { url = canvas.toDataURL('image/png'); } catch (e) { return; }
            found += 1;
            setTimeout(function () {
                var a = document.createElement('a');
                a.href = url;
                a.download = 'BDM_' + id.replace(/^bdmAn/, '') + '_' + date + '.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }, i * 250);
        });
        if (!found) {
            alert('No charts to export. Open the 📈 Charts tab first so the canvases render, then click again.');
        }
    }

    console.log('[BDM analytics] module loaded');
})();
