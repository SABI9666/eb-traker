// public/bdm-analytics-dropdown-fix.js
// Guarantees the BDM Analytics period dropdown is populated whenever
// there is ANY activity to show. Sits on top of bdm-analytics.js without
// modifying it.
//
// Two layers of defence:
//
//   A. Server-driven path -- adds buttons + auto-reset so the existing
//      analytics dropdown gets populated by clearing the date filter:
//        - "📅 All Time" / "🔄 Reset & Refresh" buttons next to Apply.
//        - One-shot auto-reset when the dropdown is empty but lifetime
//          banner shows activity.
//        - Inline "Show All Time" helper under an empty dropdown.
//        - Auto-refresh after a successful quote save.
//
//   B. Live-data fallback -- if the server-side path still produces an
//      empty dropdown (date stored outside selected window, browser 304
//      cache, etc.), this patch fetches /api/bdm-entries directly,
//      computes period keys client-side using the same isoWeek / month /
//      quarter / year logic that api/bdm-analytics.js uses, and renders
//      its own "Live Period Summary" panel below the controls. The user
//      can switch the period dropdown there to see entries grouped by
//      week / month / quarter / year regardless of From/To.
//
// Loaded by bdm-po-patch.js's patch list AFTER bdm-analytics.js.

(function () {
    'use strict';
    if (window._bdmAnalyticsDropdownFixLoaded) return;
    window._bdmAnalyticsDropdownFixLoaded = true;

    // Per-visit guard so we don't keep auto-clearing if the user deliberately
    // narrows the range and gets an empty result.
    var autoResetDoneThisVisit = false;
    var liveDataCache = null;        // cached entries from /api/bdm-entries
    var liveDataFetching = false;
    var liveSelectedPeriod = null;

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
        allTime.title = 'Clear From/To and show every period that has activity';
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
        resetBtn.title = 'Wipe filters and reload analytics from server';
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
        helper.style.cssText =
            'margin-top:0.5rem; padding:0.6rem 0.85rem; background:#fef3c7;' +
            ' border-left:4px solid #f59e0b; border-radius:6px; font-size:0.85rem;' +
            ' color:#7c5d10;';
        helper.innerHTML =
            'No periods to show with the current From/To filter. ' +
            '<button type="button" id="bdmAnEmptyHelperBtn" ' +
            'style="margin-left:0.5rem; padding:0.3rem 0.7rem; background:#0ea5e9; color:#fff; ' +
            'border:none; border-radius:5px; cursor:pointer; font-weight:600;">Show All Time</button>';
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
        if (!hasLifetimeActivity()) return;
        autoResetDoneThisVisit = true;
        console.log('[bdm-analytics-dropdown-fix] period dropdown empty but lifetime has activity — auto-clearing date filter');
        clearFiltersAndApply();
    }

    // ── Layer B: live-data fallback ────────────────────────────────────────
    // FX rates mirror api/bdm-analytics.js so client-side INR figures match.
    var FX = {
        INR: 1, USD: 83.5, AUD: 55.0, NZD: 51.0, EUR: 90.0,
        GBP: 105.0, SGD: 62.0, AED: 22.7, CAD: 61.0, JPY: 0.55
    };

    function n(v) { var x = parseFloat(v); return isNaN(x) ? 0 : x; }
    function toInr(v, c) {
        var raw = n(v);
        if (!raw) return 0;
        var cur = String(c || 'INR').toUpperCase();
        var rate = FX[cur];
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
        if (granularity === 'quarter') {
            var qp = key.split('-Q'); return 'Q' + qp[1] + ' ' + qp[0];
        }
        if (granularity === 'month') {
            var mp = key.split('-');
            var d = new Date(parseInt(mp[0], 10), parseInt(mp[1], 10) - 1, 1);
            return d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
        }
        if (granularity === 'week') {
            var wp = key.split('-W'); return 'W' + wp[1] + ' ' + wp[0];
        }
        return key;
    }

    async function fetchAllEntries() {
        if (typeof window.apiCall !== 'function') return [];
        // bdm-entries supports ?type=quote|won|variation. Fire all three in
        // parallel and merge so the Live panel covers every kind of entry.
        var types = ['quote', 'won', 'variation'];
        var bust = '&_cb=' + Date.now();
        try {
            var results = await Promise.all(types.map(function (t) {
                return window.apiCall('bdm-entries?type=' + t + bust)
                    .then(function (resp) { return (resp && resp.success && resp.entries) || []; })
                    .catch(function () { return []; });
            }));
            return [].concat.apply([], results);
        } catch (e) {
            console.warn('[bdm-analytics-dropdown-fix] fetchAllEntries failed:', e);
            return [];
        }
    }

    async function refreshLiveData(force) {
        if (liveDataFetching) return;
        if (liveDataCache && !force) return renderLivePanel();
        liveDataFetching = true;
        try {
            liveDataCache = await fetchAllEntries();
            console.log('[bdm-analytics-dropdown-fix] live entries:', liveDataCache.length);
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
        // Insert above the tabs so it is the first thing the user sees.
        var parent = anchor.id === 'bdmAnalyticsTabs' ? anchor.parentNode : anchor.closest('.card').parentNode;
        var refNode = anchor.id === 'bdmAnalyticsTabs' ? anchor : anchor.closest('.card').nextSibling;
        if (refNode) parent.insertBefore(host, refNode); else parent.appendChild(host);
        return host;
    }

    function renderLivePanel() {
        var host = ensureLivePanelHost();
        if (!host) return;
        var entries = liveDataCache || [];
        var gran = currentGranularity();

        // Bucket entries by period key.
        var byPeriod = {};
        entries.forEach(function (e) {
            if (!e || !e.date) return;
            var k = periodKey(e.date, gran);
            if (!k) return;
            if (!byPeriod[k]) byPeriod[k] = [];
            byPeriod[k].push(e);
        });
        var keys = Object.keys(byPeriod).sort().reverse(); // most-recent first

        // Restore selection or default to latest period.
        if (!liveSelectedPeriod || keys.indexOf(liveSelectedPeriod) === -1) {
            liveSelectedPeriod = keys[0] || null;
        }

        if (keys.length === 0) {
            host.innerHTML =
                '<div class="card" style="padding:1rem; border-left:4px solid #94a3b8;">' +
                    '<h3 style="margin:0 0 0.5rem 0;">📊 Live Period Summary</h3>' +
                    '<div style="color:#64748b; font-size:0.9rem;">No manual entries found in /api/bdm-entries. ' +
                    'Save a quote from the "Upload Quote / Won" form and it will appear here.</div>' +
                '</div>';
            return;
        }

        var current = byPeriod[liveSelectedPeriod] || [];
        // Build per-BDM summary for the selected period.
        var perBdm = {};
        current.forEach(function (e) {
            var bdm = e.bdmName || e.bdmUid || 'Unknown';
            if (!perBdm[bdm]) {
                perBdm[bdm] = { bdmName: bdm, numQuotes: 0, quoteValueTotal: 0,
                    numProjectsWon: 0, projectValue: 0, variationValue: 0, totalValue: 0 };
            }
            var inr = toInr(e.value, e.currency);
            if (e.type === 'quote') {
                perBdm[bdm].numQuotes += 1;
                perBdm[bdm].quoteValueTotal += inr;
            } else if (e.type === 'won') {
                perBdm[bdm].numProjectsWon += 1;
                perBdm[bdm].projectValue += inr;
                perBdm[bdm].totalValue += inr;
            } else if (e.type === 'variation') {
                perBdm[bdm].variationValue += inr;
                perBdm[bdm].totalValue += inr;
            }
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
                '<td style="text-align:right;">' +
                    (e.currency || 'INR') + ' ' + (Number(e.value) || 0).toLocaleString() +
                '</td>' +
                '<td style="text-align:right; font-weight:600; color:#0f766e;">' +
                    fmtInr(toInr(e.value, e.currency)) +
                '</td>' +
            '</tr>';
        }).join('');

        var dropdownOpts = keys.map(function (k) {
            var sel = k === liveSelectedPeriod ? ' selected' : '';
            var count = byPeriod[k].length;
            return '<option value="' + k + '"' + sel + '>' +
                periodLabel(k, gran) + ' (' + count + ')' +
                '</option>';
        }).join('');

        host.innerHTML =
            '<div class="card" style="padding:1.1rem; border-left:4px solid #10b981; background:#f0fdf4;">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.75rem;">' +
                    '<h3 style="margin:0; color:#065f46;">📊 Live Period Summary <span style="font-weight:400; font-size:0.8rem; color:#64748b;">(client-side, from /api/bdm-entries — works regardless of From/To filter)</span></h3>' +
                    '<button type="button" id="bdmAnLiveRefresh" ' +
                    'style="padding:0.4rem 0.85rem; background:#10b981; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600;">' +
                    '🔄 Refresh Live Data</button>' +
                '</div>' +
                '<div style="display:flex; gap:0.75rem; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap;">' +
                    '<label style="font-weight:600;">Period (' + gran + '):</label>' +
                    '<select id="bdmAnLivePeriodSelect" style="padding:0.45rem 0.6rem; border:1px solid #ddd; border-radius:6px; min-width:200px;">' +
                        dropdownOpts +
                    '</select>' +
                    '<span style="font-size:0.85rem; color:#475569;">' + entries.length + ' total entries · ' + keys.length + ' periods</span>' +
                '</div>' +
                '<div style="overflow-x:auto; margin-bottom:0.85rem;">' +
                    '<table class="data-table" style="width:100%;">' +
                        '<thead><tr style="background:#ecfdf5;">' +
                            '<th>#</th><th>BDM</th>' +
                            '<th>Quotes</th><th style="text-align:right;">Quote ₹</th>' +
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
        // Lazily fetch live data the first time analytics becomes visible
        // and ensure the panel re-renders if granularity changed.
        if (!liveDataCache) refreshLiveData(false);
        else if (!document.getElementById('bdmAnLivePanel')) renderLivePanel();
    }

    setInterval(tick, 1000);

    // Re-render the live panel when the user changes granularity.
    document.addEventListener('change', function (ev) {
        if (ev.target && ev.target.id === 'bdmAnalyticsGranularity') {
            // Granularity change re-renders the whole analytics view, which
            // wipes our panel. Re-add it on the next tick.
            setTimeout(function () { if (liveDataCache) renderLivePanel(); }, 800);
        }
    }, true);

    window.addEventListener('bdm-quote-saved', function () {
        // Always force-refresh live data on save so the new entry is visible.
        refreshLiveData(true);
        if (!isAnalyticsVisible()) return;
        try {
            var b = document.getElementById('bdmAnalyticsApplyBtn');
            if (b) b.click();
        } catch (e) { /* ignore */ }
    });

    console.log('[bdm-analytics-dropdown-fix] loaded (server + live-data fallback)');
})();
