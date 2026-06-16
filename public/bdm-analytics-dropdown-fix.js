// public/bdm-analytics-dropdown-fix.js
// Guarantees the BDM Analytics period dropdown is populated whenever
// there is ANY activity to show. Sits on top of bdm-analytics.js without
// modifying it.
//
// Two layers of defence:
//
//   A. Server-driven path -- adds buttons + auto-reset so the existing
//      analytics dropdown gets populated by clearing the date filter.
//   B. Live-data fallback -- fetches /api/bdm-entries directly, computes
//      period keys client-side using the same isoWeek / month / quarter /
//      year logic as the backend, and renders its own "Live Period
//      Summary" panel above the tabs. Includes inline diagnostics so we
//      can see exactly what the fetch returned (per-type counts, errors,
//      sample document) when the panel says "no entries found".
//
// Loaded by bdm-po-patch.js's patch list AFTER bdm-analytics.js.

(function () {
    'use strict';
    if (window._bdmAnalyticsDropdownFixLoaded) return;
    window._bdmAnalyticsDropdownFixLoaded = true;

    var autoResetDoneThisVisit = false;
    var liveDataCache = null;
    var liveDataFetching = false;
    var liveSelectedPeriod = null;
    var liveDiagnostics = null;

    function isAnalyticsVisible() {
        return !!document.getElementById('bdmAnalyticsApplyBtn');
    }
    function currentGranularity() {
        var sel = document.getElementById('bdmAnalyticsGranularity');
        return (sel && sel.value) || 'month';
    }
    function hasLifetimeActivity() {
        var banner = Array.prototype.find.call(
            document.querySelectorAll('h3'),
            function (h) { return /Lifetime\s+Totals/i.test(h.textContent || ''); }
        );
        if (!banner) return false;
        var card = banner.closest('.card') || banner.parentElement;
        if (!card) return false;
        var nums = card.querySelectorAll('div[style*="font-weight:700"]');
        for (var i = 0; i < nums.length; i++) {
            var t = (nums[i].textContent || '').replace(/[^\d.]/g, '');
            if (t && parseFloat(t) > 0) return true;
        }
        return false;
    }
    function periodDropdownIsEmpty() {
        var sel = document.getElementById('bdmAnPeriodSelect');
        if (!sel) return false;
        return sel.options.length === 0;
    }
    function clearFiltersAndApply() {
        var f = document.getElementById('bdmAnalyticsFrom');
        var t = document.getElementById('bdmAnalyticsTo');
        var b = document.getElementById('bdmAnalyticsApplyBtn');
        if (f) f.value = '';
        if (t) t.value = '';
        if (b) b.click();
    }
    function injectButtons() {
        var applyBtn = document.getElementById('bdmAnalyticsApplyBtn');
        if (!applyBtn) return false;
        if (document.getElementById('bdmAnAllTimeBtn')) return true;
        var allTime = document.createElement('button');
        allTime.id = 'bdmAnAllTimeBtn';
        allTime.type = 'button';
        allTime.textContent = '📅 All Time';
        allTime.style.cssText = 'padding:0.5rem 0.85rem; background:#0ea5e9; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600;';
        allTime.onclick = function () {
            autoResetDoneThisVisit = true;
            clearFiltersAndApply();
            refreshLiveData(true);
        };
        var resetBtn = document.createElement('button');
        resetBtn.id = 'bdmAnResetBtn';
        resetBtn.type = 'button';
        resetBtn.textContent = '🔄 Reset & Refresh';
        resetBtn.style.cssText = 'padding:0.5rem 0.85rem; background:#64748b; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600;';
        resetBtn.onclick = function () {
            autoResetDoneThisVisit = true;
            clearFiltersAndApply();
            refreshLiveData(true);
        };
        applyBtn.parentNode.insertBefore(allTime, applyBtn.nextSibling);
        applyBtn.parentNode.insertBefore(resetBtn, allTime.nextSibling);
        return true;
    }
    function ensureEmptyStateHelper() {
        var sel = document.getElementById('bdmAnPeriodSelect');
        if (!sel) return;
        if (sel.options.length > 0) return;
        if (document.getElementById('bdmAnEmptyHelper')) return;
        var helper = document.createElement('div');
        helper.id = 'bdmAnEmptyHelper';
        helper.style.cssText = 'margin-top:0.5rem; padding:0.6rem 0.85rem; background:#fef3c7; border-left:4px solid #f59e0b; border-radius:6px; font-size:0.85rem; color:#7c5d10;';
        helper.innerHTML =
            'No periods to show with the current From/To filter. ' +
            '<button type="button" id="bdmAnEmptyHelperBtn" style="margin-left:0.5rem; padding:0.3rem 0.7rem; background:#0ea5e9; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:600;">Show All Time</button>';
        sel.parentNode.appendChild(helper);
        var btn = document.getElementById('bdmAnEmptyHelperBtn');
        if (btn) btn.onclick = function () {
            autoResetDoneThisVisit = true;
            clearFiltersAndApply();
        };
    }
    function maybeAutoReset() {
        if (autoResetDoneThisVisit) return;
        if (!periodDropdownIsEmpty()) return;
        // Force the all-time view on first load so the dashboard cards,
        // period dropdown, and charts populate from the saved entries
        // even when the default From/To range happens to exclude every
        // entry. The user can still narrow the window manually.
        autoResetDoneThisVisit = true;
        console.log('[bdm-analytics-dropdown-fix] auto-clearing date filter to surface all-time activity');
        clearFiltersAndApply();
    }

    // ── Layer B helpers ────────────────────────────────────────────────
    var FX = { INR: 1, USD: 90.0, AUD: 55.0, NZD: 51.0, EUR: 90.0, GBP: 105.0, SGD: 62.0, AED: 22.7, CAD: 61.0, JPY: 0.55 };
    function n(v) { var x = parseFloat(v); return isNaN(x) ? 0 : x; }
    function toInr(v, c) {
        var raw = n(v);
        if (!raw) return 0;
        var rate = FX[String(c || 'INR').toUpperCase()];
        return rate != null ? raw * rate : raw;
    }
    function fmtInr(x) {
        return '₹ ' + (Number(x) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function fmtDate(iso) {
        var d = new Date(iso);
        if (isNaN(d.getTime())) return iso || '';
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    }
    function isoWeek(d) {
        var date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        var yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        var week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
        return { year: date.getUTCFullYear(), week: week };
    }
    function periodKey(date, granularity) {
        var d = (date instanceof Date) ? date : new Date(date);
        if (isNaN(d.getTime())) return null;
        var y = d.getUTCFullYear();
        var m = d.getUTCMonth();
        if (granularity === 'year') return String(y);
        if (granularity === 'quarter') return y + '-Q' + (Math.floor(m / 3) + 1);
        if (granularity === 'month') return y + '-' + String(m + 1).padStart(2, '0');
        if (granularity === 'week') {
            var w = isoWeek(d);
            return w.year + '-W' + String(w.week).padStart(2, '0');
        }
        if (granularity === 'day') return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
        return null;
    }
    function periodLabel(key, granularity) {
        if (!key) return '';
        if (granularity === 'year') return key;
        if (granularity === 'quarter') { var qp = key.split('-Q'); return 'Q' + qp[1] + ' ' + qp[0]; }
        if (granularity === 'month') {
            var mp = key.split('-');
            var d = new Date(parseInt(mp[0], 10), parseInt(mp[1], 10) - 1, 1);
            return d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
        }
        if (granularity === 'week') { var wp = key.split('-W'); return 'W' + wp[1] + ' ' + wp[0]; }
        return key;
    }

    // app1.js's apiCall wraps responses lacking a top-level `data` key as
    // `{success: true, data: <originalResponse>}`. Our backend returns
    // `{success, entries, count, meta}` with no `data`, so the actual
    // payload is one level deeper than this code used to assume — that's
    // why Live Period Summary used to show 0 even when entries existed.
    function unwrapApi(resp) {
        if (!resp || typeof resp !== 'object') return resp;
        if (resp.data && typeof resp.data === 'object' && !Array.isArray(resp.data)) {
            var inner = resp.data;
            if (inner.success !== undefined ||
                'entries' in inner || 'count' in inner || 'meta' in inner) {
                return inner;
            }
        }
        return resp;
    }

    async function fetchAllEntries() {
        if (typeof window.apiCall !== 'function') {
            liveDiagnostics = { error: 'window.apiCall is not available yet', perType: {}, totalCount: 0 };
            return [];
        }
        var types = ['quote', 'won', 'variation'];
        var diag = { perType: {}, totalCount: 0, totalDocsInCollection: null, sample: null, errors: [], rawSample: null };
        var lists = await Promise.all(types.map(async function (t) {
            try {
                var raw = await window.apiCall('bdm-entries?type=' + t);
                var resp = unwrapApi(raw);
                if (!diag.rawSample) diag.rawSample = JSON.parse(JSON.stringify(raw || {}));
                var entries = (resp && resp.success && resp.entries) || [];
                if (resp && resp.meta && resp.meta.totalDocsInCollection != null) {
                    diag.totalDocsInCollection = resp.meta.totalDocsInCollection;
                }
                if (!entries.length) {
                    var raw2 = await window.apiCall('bdm-entries?type=' + t + '&_cb=' + Date.now());
                    var resp2 = unwrapApi(raw2);
                    var entries2 = (resp2 && resp2.success && resp2.entries) || [];
                    if (entries2.length) entries = entries2;
                }
                diag.perType[t] = {
                    count: entries.length,
                    success: !!(resp && resp.success),
                    rawCount: resp && resp.count,
                    rawKeys: resp ? Object.keys(resp).slice(0, 10) : [],
                    error: (resp && !resp.success) ? (resp.error || 'success=false') : null
                };
                return entries;
            } catch (e) {
                diag.perType[t] = { count: 0, success: false, error: String(e && e.message || e) };
                diag.errors.push(t + ': ' + (e && e.message || e));
                return [];
            }
        }));
        var all = [].concat.apply([], lists);
        diag.totalCount = all.length;
        if (all.length) {
            var s = all[0];
            diag.sample = {
                id: s.id, type: s.type, date: s.date,
                bdmUid: s.bdmUid, bdmName: s.bdmName,
                value: s.value, currency: s.currency,
                projectName: s.projectName, clientCompany: s.clientCompany
            };
        }
        liveDiagnostics = diag;
        return all;
    }

    async function refreshLiveData(force) {
        if (liveDataFetching) return;
        if (liveDataCache && !force) return renderLivePanel();
        liveDataFetching = true;
        try {
            liveDataCache = await fetchAllEntries();
            console.log('[bdm-analytics-dropdown-fix] live entries:', liveDataCache.length, 'diagnostics:', liveDiagnostics);
        } finally {
            liveDataFetching = false;
        }
        renderLivePanel();
    }

    function ensureLivePanelHost() {
        if (document.getElementById('bdmAnLivePanel')) return document.getElementById('bdmAnLivePanel');
        var anchor = document.getElementById('bdmAnalyticsTabs') ||
                     document.getElementById('bdmAnalyticsApplyBtn');
        if (!anchor) return null;
        var host = document.createElement('div');
        host.id = 'bdmAnLivePanel';
        host.style.cssText = 'margin-top:1rem;';
        var parent = anchor.id === 'bdmAnalyticsTabs' ? anchor.parentNode : anchor.closest('.card').parentNode;
        var refNode = anchor.id === 'bdmAnalyticsTabs' ? anchor : anchor.closest('.card').nextSibling;
        if (refNode) parent.insertBefore(host, refNode); else parent.appendChild(host);
        return host;
    }

    function renderDiagnosticsBlock() {
        if (!liveDiagnostics) return '';
        var d = liveDiagnostics;
        var perType = d.perType || {};
        var perTypeText = Object.keys(perType).map(function (k) {
            var pt = perType[k];
            return k + '=' + pt.count + (pt.error ? ' (' + pt.error + ')' : '');
        }).join(', ');
        var sampleHtml = d.sample
            ? '<pre style="font-size:0.72rem; background:#0f172a; color:#e2e8f0; padding:0.5rem; border-radius:4px; overflow:auto; max-height:160px;">' +
              JSON.stringify(d.sample, null, 2) + '</pre>'
            : '';
        var rawHtml = d.rawSample
            ? '<pre style="font-size:0.72rem; background:#1e293b; color:#cbd5e1; padding:0.5rem; border-radius:4px; overflow:auto; max-height:160px;">' +
              JSON.stringify(d.rawSample, null, 2).slice(0, 2000) + '</pre>'
            : '';
        var collectionLine = d.totalDocsInCollection != null
            ? '<strong>Docs in <code>bdm_entries</code> collection:</strong> ' + d.totalDocsInCollection +
              (d.totalDocsInCollection > 0 && d.totalCount === 0
                  ? ' <span style="color:#b91c1c;">(filtered out by current type/filter — try saving via the form again or check role)</span>'
                  : '') + '<br>'
            : '';
        return (
            '<details style="margin-top:0.5rem;">' +
                '<summary style="cursor:pointer; font-weight:600; color:#0f172a;">🔍 Diagnostics — ' + perTypeText + '</summary>' +
                '<div style="margin-top:0.5rem; font-size:0.78rem; color:#475569; line-height:1.6;">' +
                    '<strong>Errors:</strong> ' + (d.errors && d.errors.length ? d.errors.join('; ') : 'none') + '<br>' +
                    collectionLine +
                    '<strong>Total fetched:</strong> ' + d.totalCount + '<br>' +
                    (d.sample ? '<strong>First entry (parsed):</strong>' + sampleHtml : '<em>No entries returned by /api/bdm-entries.</em>') +
                    (d.rawSample ? '<strong>First raw response (any type):</strong>' + rawHtml : '') +
                '</div>' +
            '</details>'
        );
    }

    function renderLivePanel() {
        var host = ensureLivePanelHost();
        if (!host) return;
        var entries = liveDataCache || [];
        var gran = currentGranularity();

        var byPeriod = {};
        entries.forEach(function (e) {
            if (!e || !e.date) return;
            var k = periodKey(e.date, gran);
            if (!k) return;
            if (!byPeriod[k]) byPeriod[k] = [];
            byPeriod[k].push(e);
        });
        var keys = Object.keys(byPeriod).sort().reverse();

        if (!liveSelectedPeriod || keys.indexOf(liveSelectedPeriod) === -1) {
            liveSelectedPeriod = keys[0] || null;
        }

        if (keys.length === 0) {
            host.innerHTML =
                '<div class="card" style="padding:1rem; border-left:4px solid #94a3b8;">' +
                    '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.5rem;">' +
                        '<h3 style="margin:0;">📊 Live Period Summary</h3>' +
                        '<button type="button" id="bdmAnLiveRefresh" style="padding:0.4rem 0.85rem; background:#10b981; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600;">🔄 Refresh Live Data</button>' +
                    '</div>' +
                    '<div style="color:#64748b; font-size:0.9rem;">No manual entries returned by /api/bdm-entries. Save a quote from the "Upload Quote / Won" form, or open the diagnostics below to see the raw response.</div>' +
                    renderDiagnosticsBlock() +
                '</div>';
            var ref0 = document.getElementById('bdmAnLiveRefresh');
            if (ref0) ref0.onclick = function () { refreshLiveData(true); };
            return;
        }

        var current = byPeriod[liveSelectedPeriod] || [];
        var perBdm = {};
        current.forEach(function (e) {
            var bdm = e.bdmName || e.bdmUid || 'Unknown';
            if (!perBdm[bdm]) {
                perBdm[bdm] = { bdmName: bdm, numQuotes: 0, quoteValueTotal: 0,
                    numProjectsWon: 0, projectValue: 0, variationValue: 0, totalValue: 0 };
            }
            var inr = toInr(e.value, e.currency);
            if (e.type === 'quote') { perBdm[bdm].numQuotes += 1; perBdm[bdm].quoteValueTotal += inr; }
            else if (e.type === 'won') { perBdm[bdm].numProjectsWon += 1; perBdm[bdm].projectValue += inr; perBdm[bdm].totalValue += inr; }
            else if (e.type === 'variation') { perBdm[bdm].variationValue += inr; perBdm[bdm].totalValue += inr; }
        });
        var bdmRows = Object.values(perBdm).map(function (b, i) {
            return '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td><strong>' + b.bdmName + '</strong></td>' +
                '<td>' + b.numQuotes + '</td>' +
                '<td style="text-align:right;">' + fmtInr(b.quoteValueTotal) + '</td>' +
                '<td>' + b.numProjectsWon + '</td>' +
                '<td style="text-align:right;">' + fmtInr(b.projectValue) + '</td>' +
                '<td style="text-align:right;">' + fmtInr(b.variationValue) + '</td>' +
                '<td style="text-align:right; font-weight:700;">' + fmtInr(b.totalValue) + '</td>' +
            '</tr>';
        }).join('');
        var entryRows = current.slice().sort(function (a, b) {
            return new Date(b.date) - new Date(a.date);
        }).map(function (e, i) {
            return '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td>' + fmtDate(e.date) + '</td>' +
                '<td>' + (e.bdmName || '') + '</td>' +
                '<td>' + (e.type || '') + '</td>' +
                '<td>' + (e.projectName || '') + '</td>' +
                '<td>' + (e.clientCompany || '') + '</td>' +
                '<td>' + (e.projectNumber || '') + '</td>' +
                '<td style="text-align:right;">' + (e.currency || 'INR') + ' ' + (Number(e.value) || 0).toLocaleString() + '</td>' +
                '<td style="text-align:right; font-weight:600; color:#0f766e;">' + fmtInr(toInr(e.value, e.currency)) + '</td>' +
            '</tr>';
        }).join('');
        var dropdownOpts = keys.map(function (k) {
            var sel = k === liveSelectedPeriod ? ' selected' : '';
            var count = byPeriod[k].length;
            return '<option value="' + k + '"' + sel + '>' + periodLabel(k, gran) + ' (' + count + ')</option>';
        }).join('');

        host.innerHTML =
            '<div class="card" style="padding:1.1rem; border-left:4px solid #10b981; background:#f0fdf4;">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.75rem;">' +
                    '<h3 style="margin:0; color:#065f46;">📊 Live Period Summary <span style="font-weight:400; font-size:0.8rem; color:#64748b;">(client-side, from /api/bdm-entries)</span></h3>' +
                    '<button type="button" id="bdmAnLiveRefresh" style="padding:0.4rem 0.85rem; background:#10b981; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600;">🔄 Refresh Live Data</button>' +
                '</div>' +
                '<div style="display:flex; gap:0.75rem; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap;">' +
                    '<label style="font-weight:600;">Period (' + gran + '):</label>' +
                    '<select id="bdmAnLivePeriodSelect" style="padding:0.45rem 0.6rem; border:1px solid #ddd; border-radius:6px; min-width:200px;">' + dropdownOpts + '</select>' +
                    '<span style="font-size:0.85rem; color:#475569;">' + entries.length + ' total entries · ' + keys.length + ' periods</span>' +
                '</div>' +
                '<div style="overflow-x:auto; margin-bottom:0.85rem;">' +
                    '<table class="data-table" style="width:100%;">' +
                        '<thead><tr style="background:#ecfdf5;">' +
                            '<th>#</th><th>BDM</th><th>Quotes</th><th style="text-align:right;">Quote ₹</th>' +
                            '<th>Wins</th><th style="text-align:right;">Project ₹</th>' +
                            '<th style="text-align:right;">Variation ₹</th>' +
                            '<th style="text-align:right;">Total ₹</th>' +
                        '</tr></thead>' +
                        '<tbody>' + (bdmRows || '<tr><td colspan="8" style="text-align:center; padding:1rem; color:#64748b;">No BDMs in this period.</td></tr>') + '</tbody>' +
                    '</table>' +
                '</div>' +
                '<details style="margin-top:0.5rem;">' +
                    '<summary style="cursor:pointer; font-weight:600; color:#065f46;">📋 Show all ' + current.length + ' entries in this period</summary>' +
                    '<div style="overflow-x:auto; margin-top:0.5rem;">' +
                        '<table class="data-table" style="width:100%; font-size:0.85rem;">' +
                            '<thead><tr style="background:#ecfdf5;">' +
                                '<th>#</th><th>Date</th><th>BDM</th><th>Type</th>' +
                                '<th>Project</th><th>Client</th><th>Project #</th>' +
                                '<th style="text-align:right;">Entered</th>' +
                                '<th style="text-align:right;">In ₹</th>' +
                            '</tr></thead>' +
                            '<tbody>' + (entryRows || '<tr><td colspan="9" style="text-align:center; padding:0.75rem; color:#64748b;">—</td></tr>') + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</details>' +
                renderDiagnosticsBlock() +
            '</div>';

        var sel = document.getElementById('bdmAnLivePeriodSelect');
        if (sel) sel.onchange = function () {
            liveSelectedPeriod = sel.value;
            renderLivePanel();
        };
        var ref = document.getElementById('bdmAnLiveRefresh');
        if (ref) ref.onclick = function () { refreshLiveData(true); };
    }

    function tick() {
        if (!isAnalyticsVisible()) {
            autoResetDoneThisVisit = false;
            return;
        }
        injectButtons();
        ensureEmptyStateHelper();
        maybeAutoReset();
        if (!liveDataCache) refreshLiveData(false);
        else if (!document.getElementById('bdmAnLivePanel')) renderLivePanel();
    }
    setInterval(tick, 1000);

    document.addEventListener('change', function (ev) {
        if (ev.target && ev.target.id === 'bdmAnalyticsGranularity') {
            setTimeout(function () { if (liveDataCache) renderLivePanel(); }, 800);
        }
    }, true);

    window.addEventListener('bdm-quote-saved', function () {
        refreshLiveData(true);
        if (!isAnalyticsVisible()) return;
        try {
            var b = document.getElementById('bdmAnalyticsApplyBtn');
            if (b) b.click();
        } catch (e) { /* ignore */ }
    });

    console.log('[bdm-analytics-dropdown-fix] loaded (server + live-data fallback + diagnostics)');
})();
