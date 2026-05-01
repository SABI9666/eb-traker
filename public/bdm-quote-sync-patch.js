// public/bdm-quote-sync-patch.js
// Companion to bdm-entries.js. Watches the BDM "Upload Quote / Won" form
// (rendered by window.showBdmEntries) and:
//
//   1. Adds a live ₹ preview underneath the Value field so the BDM sees
//      what the entered amount converts to in INR before saving.
//   2. Replaces the Save click handler so the submission goes to the new
//      /api/bdm-quote-sync endpoint, which locks the rupee conversion in
//      server-side before writing to the bdm_entries collection.
//   3. Falls back to the original /api/bdm-entries endpoint if the new one
//      is not available yet (e.g. backend redeploy lag) -- value is then
//      stored as-entered and BDM Analytics converts on read, same as
//      before this patch existed. No save is ever lost.
//   4. After a successful save, renders a "Saved" confirmation panel
//      showing the stored date, INR value, and the period key the entry
//      will land in (week / month / quarter / year) -- plus a one-click
//      "Open BDM Analytics" button that opens the report with the date
//      filter cleared so the entry is guaranteed to be visible.
//      This addresses the report flow where new entries only showed up in
//      "Lifetime" totals because the user's selected From/To range did not
//      include the entry's date.
//
// Existing files (bdm-entries.js, bdm-analytics.js front+back) are NOT
// modified. Loaded via bdm-po-patch.js's patch list.

(function () {
    'use strict';
    if (window._bdmQuoteSyncPatchLoaded) return;
    window._bdmQuoteSyncPatchLoaded = true;

    // Mirrors the table in api/bdm-quote-sync.js / api/bdm-analytics.js.
    // Refreshed from /api/bdm-quote-sync (GET) on first form open so the
    // preview always matches what the server will apply.
    var FX_RATES = {
        INR: 1, USD: 83.5, AUD: 55.0, NZD: 51.0, EUR: 90.0,
        GBP: 105.0, SGD: 62.0, AED: 22.7, CAD: 61.0, JPY: 0.55
    };
    var fxLoaded = false;

    // app1.js's apiCall wraps responses that don't carry a top-level `data`
    // key as `{success: true, data: <originalResponse>}`. Our backend
    // returns `{success, fxRates}` / `{success, id, entry, conversion}` /
    // `{success, entries, count, meta}` with no `data` field, so the actual
    // payload ends up nested under `resp.data`. Unwrap before reading.
    function unwrapApi(resp) {
        if (!resp || typeof resp !== 'object') return resp;
        if (resp.data && typeof resp.data === 'object' && !Array.isArray(resp.data)) {
            var inner = resp.data;
            if (inner.success !== undefined ||
                'entries' in inner || 'entry' in inner ||
                'fxRates' in inner || 'conversion' in inner ||
                'count' in inner || 'meta' in inner || 'id' in inner) {
                return inner;
            }
        }
        return resp;
    }

    function loadRates() {
        if (fxLoaded) return Promise.resolve(FX_RATES);
        if (typeof window.apiCall !== 'function') return Promise.resolve(FX_RATES);
        return window.apiCall('bdm-quote-sync').then(function (raw) {
            var resp = unwrapApi(raw);
            if (resp && resp.success && resp.fxRates) {
                FX_RATES = resp.fxRates;
                fxLoaded = true;
            }
            return FX_RATES;
        }).catch(function () { return FX_RATES; });
    }

    function toInr(value, currency) {
        var v = parseFloat(value);
        if (isNaN(v) || !v) return 0;
        var c = String(currency || 'INR').toUpperCase();
        var rate = FX_RATES[c];
        return rate != null ? v * rate : v;
    }

    function fmtInr(n) {
        var x = Number(n) || 0;
        return '₹ ' + x.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fmtDate(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    }

    // Mirror of api/bdm-analytics.js periodKey() so the user can see exactly
    // which bucket their entry will land in. Client-side preview only.
    function isoWeek(d) {
        var date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        var yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        var week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
        return { year: date.getUTCFullYear(), week: week };
    }

    function periodKeysFor(dateIso) {
        if (!dateIso) return null;
        var d = new Date(dateIso);
        if (isNaN(d.getTime())) return null;
        var y = d.getUTCFullYear();
        var m = d.getUTCMonth();
        var w = isoWeek(d);
        return {
            day: y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'),
            week: w.year + '-W' + String(w.week).padStart(2, '0'),
            month: y + '-' + String(m + 1).padStart(2, '0'),
            quarter: y + '-Q' + (Math.floor(m / 3) + 1),
            year: String(y)
        };
    }

    function ensurePreviewElement() {
        if (document.getElementById('be-inr-preview')) return;
        var valueInput = document.getElementById('be-value');
        if (!valueInput) return;
        var wrap = valueInput.parentElement;
        if (!wrap) return;
        var note = document.createElement('div');
        note.id = 'be-inr-preview';
        note.style.cssText = 'margin-top:0.3rem; font-size:0.78rem; color:#0f766e; font-weight:600;';
        note.textContent = 'Converted: ' + fmtInr(0);
        wrap.appendChild(note);
    }

    function updatePreview() {
        var note = document.getElementById('be-inr-preview');
        if (!note) return;
        var v = document.getElementById('be-value');
        var c = document.getElementById('be-cur');
        if (!v || !c) return;
        var inr = toInr(v.value, c.value);
        var rate = FX_RATES[String(c.value || '').toUpperCase()];
        note.textContent = 'Converted: ' + fmtInr(inr) +
            (rate != null ? '   (1 ' + c.value + ' = ₹ ' + rate + ')' : '   (rate unknown — stored as-is)');
    }

    function bindPreviewHandlers() {
        var v = document.getElementById('be-value');
        var c = document.getElementById('be-cur');
        if (!v || !c) return;
        if (v._bqsBound) return;
        v._bqsBound = true; c._bqsBound = true;
        v.addEventListener('input', updatePreview);
        c.addEventListener('change', updatePreview);
    }

    function isRouteMissing(err) {
        var msg = String((err && err.message) || err || '').toLowerCase();
        return msg.indexOf('does not exist') !== -1 ||
               msg.indexOf('not found') !== -1 ||
               msg.indexOf('404') !== -1;
    }

    async function trySync(body) {
        var resp = unwrapApi(await window.apiCall('bdm-quote-sync', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' }
        }));
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'Save failed');
        return resp;
    }

    async function fallbackToBdmEntries(body) {
        var resp = unwrapApi(await window.apiCall('bdm-entries', {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' }
        }));
        if (!resp || !resp.success) throw new Error((resp && resp.error) || 'Save failed');
        return resp;
    }

    // Click-handler used by the "Open BDM Analytics" button rendered after
    // each successful save. Clears the date filter so the entry is
    // guaranteed to fall within the visible window.
    window._bdmQuoteSyncOpenAnalytics = function () {
        try {
            // Reset the in-memory state of bdm-analytics.js so its first
            // render uses an empty filter (i.e. all-time, default backend
            // window of last 5 years).
            if (typeof window.showBdmAnalytics === 'function') {
                // The module keeps `state` private; the easiest reliable
                // reset is to wipe its loaded flag + reload.
                try {
                    var bdmAnState = window.__bdmAnState;
                    // Soft signal -- bdm-analytics.js does not expose state,
                    // so we rely on its rendered controls to be cleared
                    // post-render via a one-shot DOM tweak below.
                    if (bdmAnState) { bdmAnState.from = ''; bdmAnState.to = ''; }
                } catch (e) { /* ignore */ }
                window.showBdmAnalytics();
                // After render, clear any From/To inputs and click Apply so
                // the period dropdown re-populates from the full range.
                setTimeout(function () {
                    var f = document.getElementById('bdmAnalyticsFrom');
                    var t = document.getElementById('bdmAnalyticsTo');
                    var b = document.getElementById('bdmAnalyticsApplyBtn');
                    if (f) f.value = '';
                    if (t) t.value = '';
                    if (b) b.click();
                }, 250);
            } else {
                alert('BDM Analytics is only visible to COO and Director.');
            }
        } catch (e) {
            console.warn('[bdm-quote-sync] open analytics failed:', e);
        }
    };

    function renderSuccessPanel(opts) {
        // opts: { entryId, type, dateIso, originalValue, originalCurrency,
        //         valueInr, fxRate, granularityKeys, usedFallback }
        var host = document.getElementById('be-status');
        if (!host) return;

        var keys = opts.granularityKeys || {};
        var typeLabel = ({ quote: 'Quote uploaded', won: 'Project won', variation: 'Variation' })[opts.type] || opts.type;
        var html =
            '<div style="margin-top:0.4rem; padding:0.85rem 1rem; border:1px solid #10b981; border-left:5px solid #10b981; background:#ecfdf5; border-radius:8px; color:#065f46;">' +
                '<div style="font-weight:700; font-size:0.95rem; margin-bottom:0.4rem;">' +
                    (opts.usedFallback ? '✅ Entry saved (fallback path)' : '✅ Entry saved & locked to ₹') +
                '</div>' +
                '<div style="font-size:0.85rem; line-height:1.6;">' +
                    '<strong>Type:</strong> ' + typeLabel + '<br>' +
                    '<strong>Date:</strong> ' + fmtDate(opts.dateIso) + '<br>' +
                    '<strong>Entered:</strong> ' + opts.originalCurrency + ' ' +
                        Number(opts.originalValue || 0).toLocaleString() +
                    (opts.fxRate != null ? '   (1 ' + opts.originalCurrency + ' = ₹ ' + opts.fxRate + ')' : '') + '<br>' +
                    '<strong>Stored as:</strong> ' + fmtInr(opts.valueInr || 0) + '<br>' +
                    '<strong>Will appear under:</strong> ' +
                        'Week <code>' + (keys.week || '?') + '</code> · ' +
                        'Month <code>' + (keys.month || '?') + '</code> · ' +
                        'Quarter <code>' + (keys.quarter || '?') + '</code> · ' +
                        'Year <code>' + (keys.year || '?') + '</code>' +
                '</div>' +
                '<div style="margin-top:0.75rem; display:flex; gap:0.5rem; flex-wrap:wrap;">' +
                    '<button type="button" onclick="window._bdmQuoteSyncOpenAnalytics()" ' +
                        'style="padding:0.45rem 0.9rem; background:#2563eb; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:600;">' +
                        '📊 Open BDM Analytics (full range)' +
                    '</button>' +
                    '<span style="align-self:center; font-size:0.78rem; color:#475569;">Tip: clear From/To and click Apply to see all entries.</span>' +
                '</div>' +
            '</div>';
        host.innerHTML = html;
        host.style.color = '';
    }

    function escHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Build a row that visually matches both the old and new bdm-entries.js
    // table layouts. The old table has 9 columns (#, Date, BDM, Number,
    // Project, Client, Value, Notes, [delete]). The new one prepends a Type
    // column. We render 10 cells with colspan logic: the Type cell uses
    // display:none if the table has only 9 column headers in <thead>, so it
    // gracefully degrades on the cached build.
    function optimisticallyInjectRow(body, resp) {
        var host = document.getElementById('be-list');
        if (!host) return;
        var entry = (resp && resp.entry) || {};
        var conv  = (resp && resp.conversion) || {};
        var displayCurrency = entry.currency || (conv.valueInr != null ? 'INR' : (body.currency || 'INR'));
        var displayValue = entry.value != null ? entry.value
            : (conv.valueInr != null ? conv.valueInr : body.value);
        var dateIso = entry.date || (body.date ? new Date(body.date).toISOString() : new Date().toISOString());
        var bdmName = entry.bdmName || entry.createdByName || '';
        var rowFields = {
            date: fmtDate(dateIso),
            bdmName: bdmName,
            projectNumber: body.projectNumber || entry.projectNumber || '',
            projectName: body.projectName || entry.projectName || '',
            clientCompany: body.clientCompany || entry.clientCompany || '',
            value: (displayCurrency ? displayCurrency + ' ' : '') +
                   (Number(displayValue) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            notes: body.notes || entry.notes || ''
        };

        // Try to find an existing tbody. Headers vary between the old and
        // new bdm-entries.js builds, so detect the column count from <thead>.
        var table = host.querySelector('table');
        var tbody = table && table.querySelector('tbody');
        var headerCells = table ? table.querySelectorAll('thead th').length : 0;
        var hasTypeColumn = headerCells >= 10; // new layout has 10 columns

        var TYPE_LABELS = { quote: 'Quote', won: 'Won', variation: 'Variation' };
        var typeLabel = TYPE_LABELS[String(body.type || '').toLowerCase()] || (body.type || '');

        var rowHtml =
            '<tr class="bdm-quote-sync-just-saved" style="background:#ecfdf5;">' +
                '<td>•</td>' +
                (hasTypeColumn ? '<td><strong style="color:#059669;">' + escHtml(typeLabel) + '</strong></td>' : '') +
                '<td>' + escHtml(rowFields.date) + '</td>' +
                '<td><strong>' + escHtml(rowFields.bdmName) + '</strong></td>' +
                '<td>' + escHtml(rowFields.projectNumber) + '</td>' +
                '<td>' + escHtml(rowFields.projectName) + '</td>' +
                '<td>' + escHtml(rowFields.clientCompany) + '</td>' +
                '<td style="text-align:right;"><strong>' + escHtml(rowFields.value) + '</strong></td>' +
                '<td>' + escHtml(rowFields.notes) + '</td>' +
                (hasTypeColumn ? '<td></td>' : '<td></td>') +
            '</tr>';

        if (tbody) {
            // Wipe any "No entries yet" placeholder and prepend our row.
            var placeholder = tbody.querySelector('td[colspan]');
            if (placeholder) tbody.innerHTML = '';
            tbody.insertAdjacentHTML('afterbegin', rowHtml);
        } else {
            // No table at all (e.g. cached build's empty state div). Build
            // a minimal one so the saved entry is visible.
            host.innerHTML =
                '<table class="data-table" style="width:100%; border-collapse:collapse; font-size:0.88rem;">' +
                    '<thead><tr style="background:#f1f5f9;">' +
                        '<th style="padding:0.5rem; text-align:left;">#</th>' +
                        '<th style="padding:0.5rem; text-align:left;">Date</th>' +
                        '<th style="padding:0.5rem; text-align:left;">BDM</th>' +
                        '<th style="padding:0.5rem; text-align:left;">Number</th>' +
                        '<th style="padding:0.5rem; text-align:left;">Project</th>' +
                        '<th style="padding:0.5rem; text-align:left;">Client</th>' +
                        '<th style="padding:0.5rem; text-align:right;">Value</th>' +
                        '<th style="padding:0.5rem; text-align:left;">Notes</th>' +
                        '<th></th>' +
                    '</tr></thead>' +
                    '<tbody>' + rowHtml.replace('<td>•</td>', '<td>1</td>') + '</tbody>' +
                '</table>';
        }
    }

    async function newSaveHandler() {
        var btn = document.getElementById('be-save');
        var status = document.getElementById('be-status');
        if (!btn || !status) return;

        var body = {
            type: (document.getElementById('be-type') || {}).value || 'quote',
            date: (document.getElementById('be-date') || {}).value,
            projectNumber: ((document.getElementById('be-num') || {}).value || '').trim(),
            projectName: ((document.getElementById('be-proj') || {}).value || '').trim(),
            clientCompany: ((document.getElementById('be-client') || {}).value || '').trim(),
            value: (document.getElementById('be-value') || {}).value,
            currency: (document.getElementById('be-cur') || {}).value || 'INR',
            notes: ((document.getElementById('be-notes') || {}).value || '').trim()
        };
        if (!body.date || !body.value) {
            status.textContent = '⚠️ Date and Value are required';
            status.style.color = '#dc2626';
            return;
        }

        btn.disabled = true; btn.textContent = '⏳ Saving (converting to ₹)…';
        status.textContent = ''; status.style.color = '#64748b';

        var clientInr = toInr(body.value, body.currency);
        var clientFxRate = FX_RATES[String(body.currency).toUpperCase()];

        try {
            var resp;
            var usedFallback = false;
            try {
                resp = await trySync(body);
            } catch (primaryErr) {
                if (!isRouteMissing(primaryErr)) throw primaryErr;
                console.warn('[bdm-quote-sync] new endpoint unavailable, falling back to /api/bdm-entries');
                resp = await fallbackToBdmEntries(body);
                usedFallback = true;
            }

            var conv = (resp && resp.conversion) || {};
            var entry = (resp && resp.entry) || {};
            var dateIso = entry.date || (body.date ? new Date(body.date).toISOString() : new Date().toISOString());

            renderSuccessPanel({
                entryId: resp && resp.id,
                type: body.type,
                dateIso: dateIso,
                originalValue: conv.originalValue != null ? conv.originalValue : body.value,
                originalCurrency: conv.originalCurrency || body.currency,
                valueInr: conv.valueInr != null ? conv.valueInr : clientInr,
                fxRate: conv.fxRateApplied != null ? conv.fxRateApplied : clientFxRate,
                granularityKeys: periodKeysFor(dateIso),
                usedFallback: usedFallback
            });

            // Mirror the original UX -- clear throwaway fields, keep
            // type/date/currency for fast successive entry.
            ['be-value', 'be-num', 'be-notes'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.value = '';
            });
            updatePreview();

            // Refresh the recent-entries list and switch the filter to the
            // saved type so the user sees the new row appear immediately.
            if (typeof window._bdmEntriesReload === 'function') {
                try { await window._bdmEntriesReload(body.type); } catch (e) { /* ignore */ }
            } else {
                var filt = document.getElementById('be-filter');
                if (filt) {
                    if (body.type && filt.value !== body.type) filt.value = body.type;
                    try { filt.dispatchEvent(new Event('change')); } catch (e) { /* ignore */ }
                }
            }

            // Defensive optimistic injection. If the bdm-entries.js sitting
            // in the user's browser is a stale cached build (the reload
            // path above is a no-op or returns an empty list), the user
            // would still see "No entries yet" right after they just saved
            // one. To guarantee feedback, we directly inject the freshly
            // saved row into the Recent Entries table so it shows up no
            // matter what state the panel is in.
            try { optimisticallyInjectRow(body, resp); } catch (e) { /* ignore */ }
            // Broadcast so BDM Analytics (if currently rendered) refreshes
            // its Live Period Summary and period dropdown.
            try {
                window.dispatchEvent(new CustomEvent('bdm-quote-saved', {
                    detail: { type: body.type, entryId: resp && resp.id, entry: resp && resp.entry }
                }));
            } catch (e) { /* ignore */ }
        } catch (e) {
            status.textContent = '⚠️ ' + (e.message || e);
            status.style.color = '#dc2626';
        } finally {
            btn.disabled = false;
            btn.textContent = '💾 Save Entry';
        }
    }

    function attach() {
        var btn = document.getElementById('be-save');
        if (!btn) return false;
        ensurePreviewElement();
        bindPreviewHandlers();
        if (btn._bqsAttached) return true;
        btn._bqsAttached = true;
        btn.onclick = newSaveHandler;
        loadRates().then(updatePreview);
        console.log('[bdm-quote-sync] save handler attached, FX preview enabled');
        return true;
    }

    // The form is built lazily by bdm-entries.js's showBdmEntries. Poll until
    // the button appears, then keep an observer in case the user re-renders.
    var iv = setInterval(function () {
        if (attach()) {
            try {
                var obs = new MutationObserver(function () { attach(); });
                obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
            } catch (e) { /* ignore */ }
            clearInterval(iv);
        }
    }, 750);
    setTimeout(function () { clearInterval(iv); }, 180000);

    console.log('[bdm-quote-sync] patch loaded');
})();
