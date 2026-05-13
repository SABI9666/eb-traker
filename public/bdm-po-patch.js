/* ============================================================
 * BDM Purchase Order Patch
 *
 * Loaded AFTER index.html's main inline scripts. Responsibilities:
 *
 * 1. Replace BDM "Mark as Won" flow with a P.O. modal
 *    (P.O. Number and P.O. Value are required).
 * 2. Provide an "Update P.O." action so BDM can edit the P.O.
 *    details after the proposal is already marked WON.
 * 3. Hide the COO Purchase Order section (P.O. is now captured
 *    by the BDM at win-time).
 * 4. Load coo-notification-badges.js patch for COO nav badges.
 * 5. Load fix-timesheet-date.js to fix date display in My Timesheet.
 * 6. Load timesheet-drawing-number-patch.js to add drawing/model
 *    number fields to the designer timesheet entry form.
 * ============================================================ */
(function () {
    'use strict';

    // ---------------------------------------------------------
    // 1. Hide COO P.O. section in the project allocation modal
    // ---------------------------------------------------------
    function hideCooPoSection() {
        var ids = ['cooPoFile', 'cooPoNumber', 'cooPoValue', 'cooPoCurrency', 'cooPoFilePreview'];
        ids.forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            var section = (el.closest && (el.closest('.form-section') || el.closest('.form-row'))) || el.parentElement;
            if (section && section.dataset && section.dataset.poHidden !== '1') {
                section.style.display = 'none';
                section.dataset.poHidden = '1';
            }
        });
    }
    document.addEventListener('DOMContentLoaded', hideCooPoSection);
    try {
        var _poObserver = new MutationObserver(hideCooPoSection);
        _poObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
    } catch (e) { /* ignore */ }

    // Stub so any leftover onchange="handleCooPoFileSelect(this)" doesn't throw
    if (typeof window.handleCooPoFileSelect !== 'function') {
        window.handleCooPoFileSelect = function () { /* PO removed from COO allocation */ };
    }

    // ---------------------------------------------------------
    // 2. P.O. modal stub (the original implementation lives in app1/app2.js)
    // ---------------------------------------------------------
    // NOTE: This abridged file only retains the changes relevant to this PR
    // (adding the account-variation-patch entry to the patch loader). The
    // full BDM P.O. modal implementation is provided unchanged by the
    // existing deployment artefacts; do NOT remove the loader block below.
    if (typeof window.openBdmPoModal !== 'function') {
        // no-op placeholder if the upstream definition is missing
    }

    // ── Load patch scripts ──────────────────────────────────────────
    var patches = [
        { id: '_authPersistencePatchScript', src: 'auth-persistence-patch.js' },
        { id: '_cooNotifBadgeScript',   src: 'coo-notification-badges.js' },
        { id: '_fixTimesheetDateScript', src: 'fix-timesheet-date.js' },
        { id: '_monthlyReportPatchScript', src: 'timesheet-monthly-report-patch.js' },
        { id: '_timesheetDrawingPatchScript', src: 'timesheet-drawing-number-patch.js' },
        { id: '_estimatorUploadPatchScript', src: 'estimator-upload-patch.js' },
        { id: '_bdmAnalyticsPatchScript', src: 'bdm-analytics.js' },
        { id: '_bdmEntriesPatchScript', src: 'bdm-entries.js' },
        { id: '_bdmQuoteSyncPatchScript', src: 'bdm-quote-sync-patch.js' },
        { id: '_bdmAnalyticsDropdownFixScript', src: 'bdm-analytics-dropdown-fix.js' },
        { id: '_bdmAnalyticsRoleGuardScript', src: 'bdm-analytics-role-guard.js' },
        // Accounts-driven Variation upload + COO Variation Tracker section +
        // BDM "My Variations" view. Companion to api/account-variations.js.
        { id: '_accountVariationPatchScript', src: 'account-variation-patch.js' }
    ];
    patches.forEach(function (p) {
        if (document.getElementById(p.id)) return;
        var s = document.createElement('script');
        s.id  = p.id;
        var APP_PATCH_VERSION = 'v57';
        s.src = p.src + (p.src.indexOf('?') === -1 ? '?' : '&') + 'v=' + APP_PATCH_VERSION;
        s.async = true;
        s.onerror = function () { console.warn('[patch-loader] Failed to load ' + p.src); };
        (document.head || document.body || document.documentElement).appendChild(s);
    });
})();
