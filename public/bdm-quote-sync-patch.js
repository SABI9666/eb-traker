// public/bdm-quote-sync-patch.js
// Companion to bdm-entries.js. Watches the BDM "Upload Quote / Won" form
// (rendered by window.showBdmEntries) and:
//
//   1. Adds a live ₹ preview underneath the Value field so the BDM sees
//      what the entered amount converts to in INR before saving.
//   2. Replaces the Save click handler so the submission goes to the new
//      /api/bdm-quote-sync endpoint, which locks the rupee conversion in
//      server-side before writing to the bdm_entries collection.
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

    function loadRates() {
        if (fxLoaded) return Promise.resolve(FX_RATES);
        if (typeof window.apiCall !== 'function') return Promise.resolve(FX_RATES);
        return window.apiCall('bdm-quote-sync').then(function (resp) {
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
        try {
            var resp = await window.apiCall('bdm-quote-sync', {
                method: 'POST',
                body: JSON.stringify(body),
                headers: { 'Content-Type': 'application/json' }
            });
            if (!resp || !resp.success) throw new Error((resp && resp.error) || 'Save failed');
            var conv = resp.conversion || {};
            status.textContent = '✅ Saved as ' + fmtInr(conv.valueInr || 0) +
                ' (from ' + (conv.originalCurrency || body.currency) + ' ' + (conv.originalValue || body.value) +
                '). Reflects in BDM Analytics.';
            status.style.color = '#059669';

            // Mirror the original UX -- clear throwaway fields, keep
            // type/date/currency for fast successive entry.
            ['be-value', 'be-num', 'be-notes'].forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.value = '';
            });
            updatePreview();

            // Soft-refresh the recent-entries list by re-firing the filter
            // change event (existing module reloads on filter change).
            var filt = document.getElementById('be-filter');
            if (filt) {
                try { filt.dispatchEvent(new Event('change')); } catch (e) { /* ignore */ }
            }
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
