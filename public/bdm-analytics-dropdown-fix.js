// public/bdm-analytics-dropdown-fix.js
// Guarantees the BDM Analytics period dropdown is populated whenever
// there is ANY activity to show. Sits on top of bdm-analytics.js without
// modifying it.
//
// Why this exists:
//   bdm-analytics.js builds the period-summary dropdown from
//   `data.periodKeys`, which the backend computes ONLY for entries that
//   fall inside the selected From/To window. If the user has a narrow
//   filter (e.g. a 5-day range) that excludes their saved entries, the
//   dropdown is empty even though entries exist and are visible in
//   "Lifetime totals". This patch:
//
//   1. Watches every render of the BDM Analytics page.
//   2. Adds two extra control buttons next to Apply:
//        - "📅 All Time" — wipes From/To and re-applies.
//        - "🔄 Reset & Refresh" — same, plus forces a reload.
//   3. If after a fresh render the period dropdown is empty AND lifetime
//      data clearly shows there IS activity, automatically clears the
//      filter once and re-applies (one-shot per visit, so the user can
//      still narrow the range if they want).
//   4. Listens for the `bdm-quote-saved` event fired by
//      bdm-quote-sync-patch.js after each successful save and triggers a
//      fresh analytics reload if the analytics view is currently visible.
//
// Loaded by bdm-po-patch.js's patch list AFTER bdm-analytics.js.

(function () {
    'use strict';
    if (window._bdmAnalyticsDropdownFixLoaded) return;
    window._bdmAnalyticsDropdownFixLoaded = true;

    // Per-visit guard so we don't keep auto-clearing if the user deliberately
    // narrows the range and gets an empty result.
    var autoResetDoneThisVisit = false;

    function isAnalyticsVisible() {
        return !!document.getElementById('bdmAnalyticsApplyBtn');
    }

    function hasLifetimeActivity() {
        // The lifetime banner renders mini-metric tiles. If any tile shows
        // a non-zero / non-empty count or rupee value, there IS activity
        // somewhere in the database. We only auto-reset in that case so we
        // don't pester users on empty workspaces.
        var banner = document.querySelector('h3') &&
            Array.prototype.find.call(
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
        if (!sel) return false; // dropdown not rendered yet
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

    function tick() {
        if (!isAnalyticsVisible()) {
            // Re-arm auto-reset for the next visit so the helper triggers
            // again if the user navigates away and back.
            autoResetDoneThisVisit = false;
            return;
        }
        injectButtons();
        ensureEmptyStateHelper();
        maybeAutoReset();
    }

    // Light DOM polling — cheap, robust, doesn't depend on the IIFE-private
    // state inside bdm-analytics.js.
    setInterval(tick, 1000);

    // After a successful quote save, refresh analytics if it is on screen.
    window.addEventListener('bdm-quote-saved', function () {
        if (!isAnalyticsVisible()) return;
        try {
            var b = document.getElementById('bdmAnalyticsApplyBtn');
            if (b) b.click();
        } catch (e) { /* ignore */ }
    });

    console.log('[bdm-analytics-dropdown-fix] loaded');
})();
