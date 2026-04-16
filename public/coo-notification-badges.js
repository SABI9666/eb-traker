// public/coo-notification-badges.js
// COO/Director notification badge patch – self-injecting via DOM.
// Dynamically loaded by bdm-po-patch.js which is already included in index.html.
// Shows red number badges on nav items when the COO has unread notifications.
// Badge resets when the section is viewed (mark-as-read API call).
(function () {
    'use strict';

    // Guard: only run once
    if (window._cooNotificationBadgesPatchLoaded) return;
    window._cooNotificationBadgesPatchLoaded = true;

    var POLL_INTERVAL_MS = 60000; // re-check every 60 s (same as existing badges)
    var PROPOSAL_TYPES = [
        'estimation_complete',
        'subcontractor_assigned',
        'pricing_updated',
        'pricing_complete'
    ];

    // ── Inject a badge <span> next to a nav <a> element ────────────────────────
    function injectBadgeSpan(navId, badgeId) {
        var navEl = document.getElementById(navId);
        if (!navEl || document.getElementById(badgeId)) return; // already done
        var span = document.createElement('span');
        span.id = badgeId;
        span.className = 'notification-count';
        span.setAttribute('style', [
            'display:none',
            'margin-left:8px',
            'background:var(--danger,#dc2626)',
            'color:#fff',
            'min-width:18px',
            'height:18px',
            'padding:0 6px',
            'border-radius:9px',
            'font-size:0.75rem',
            'line-height:18px',
            'text-align:center',
            'font-weight:600',
            'vertical-align:middle',
            'display:none'
        ].join(';'));
        span.textContent = '0';
        navEl.appendChild(span);
    }

    function injectAllBadges() {
        // "All Proposals" link  (id set by index.html: id="nav-proposals")
        injectBadgeSpan('nav-proposals', 'cooProposalsBadge');
    }

    // ── Set a badge element's count (hide when zero) ────────────────────────────
    function setBadge(id, count) {
        var el = document.getElementById(id);
        if (!el) return;
        var n = Math.max(0, count);
        el.textContent = n > 99 ? '99+' : String(n);
        el.style.display = n > 0 ? 'inline-block' : 'none';
    }

    // ── Fetch unread counts from the notifications API ──────────────────────────
    async function updateCOOBadges() {
        var userRole = (window.currentUserRole || '').trim().toLowerCase();
        if (!['coo', 'director'].includes(userRole)) return;
        if (typeof window.apiCall !== 'function') return;

        try {
            var resp = await window.apiCall('notifications?unreadOnly=true&limit=200');
            if (!resp || !resp.success) return;
            var list = resp.data || [];

            var proposalCount = list.filter(function (n) {
                return PROPOSAL_TYPES.indexOf(n.type) !== -1;
            }).length;

            setBadge('cooProposalsBadge', proposalCount);
        } catch (e) {
            console.error('[COO badges] updateCOOBadges error:', e);
        }
    }

    // ── Mark ALL COO notifications as read (called when a section is viewed) ───
    async function markAllCOONotificationsRead() {
        if (typeof window.apiCall !== 'function') return;
        try {
            await window.apiCall('notifications?markAllRead=true', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
        } catch (e) {
            console.warn('[COO badges] markAllRead failed:', e.message);
        }
    }

    // ── Wrap a global function to fire a callback after it runs ────────────────
    function wrapFunction(name, afterFn) {
        if (typeof window[name] !== 'function') return false;
        if (window[name]['_cooHooked']) return true; // already wrapped
        var orig = window[name];
        window[name] = function () {
            var result = orig.apply(this, arguments);
            try { afterFn(); } catch (e) {}
            return result;
        };
        window[name]['_cooHooked'] = true;
        return true;
    }

    // ── Install hooks on nav show-functions ────────────────────────────────────
    function hookNavFunctions() {
        // showProposals → mark read, then refresh badge
        wrapFunction('showProposals', function () {
            markAllCOONotificationsRead().then(function () {
                setTimeout(updateCOOBadges, 400);
            }).catch(function () {});
        });
    }

    // ── Bootstrap: poll until auth + apiCall are ready ─────────────────────────
    var _started = false;
    var _pollInterval = null;

    function tryStart() {
        if (_started) return;
        var userRole = (window.currentUserRole || '').trim().toLowerCase();
        // Not ready: auth hasn't completed yet
        if (!userRole || typeof window.apiCall !== 'function') return;

        _started = true;
        if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }

        // Only relevant for COO / Director role
        if (!['coo', 'director'].includes(userRole)) {
            console.log('[COO badges] role is', userRole, '– badges not needed');
            return;
        }

        injectAllBadges();
        hookNavFunctions();
        updateCOOBadges();
        setInterval(updateCOOBadges, POLL_INTERVAL_MS);

        console.log('[COO badges] initialised for role:', userRole);
    }

    // Poll every 2 s until the app's auth resolves (gives up after 2 min)
    _pollInterval = setInterval(tryStart, 2000);
    setTimeout(function () {
        if (!_started && _pollInterval) {
            clearInterval(_pollInterval);
            _pollInterval = null;
            console.warn('[COO badges] timed out waiting for auth');
        }
    }, 120000);

    // Immediate attempt in case the script loads after auth is already done
    tryStart();

    console.log('[COO badges] patch loaded, waiting for auth...');
})();
