// public/bdm-analytics-role-guard.js
// Defensive guard that ensures the BDM Analytics nav item and entry
// point are accessible ONLY to COO and Director, regardless of what
// other patches do.
//
// Why this exists:
//   - bdm-analytics.js is supposed to unhide the nav item only for
//     COO/Director, but if any other code or cached state leaves the
//     <li id="bdmAnalyticsNavItem"> visible, this patch forcibly hides
//     it for any role outside the allow-list.
//   - Also wraps window.showBdmAnalytics so direct calls from other UI
//     paths cannot bypass the role check.
//   - Re-applies on every DOM mutation (sidebar re-renders, role
//     changes after login, etc.).
//
// Loaded by bdm-po-patch.js's patch list AFTER bdm-analytics.js.

(function () {
    'use strict';
    if (window._bdmAnalyticsRoleGuardLoaded) return;
    window._bdmAnalyticsRoleGuardLoaded = true;

    var ALLOWED_ROLES = ['coo', 'director'];

    function getCurrentRole() {
        var role = '';
        try {
            // app1.js declares currentUserRole at top level (let).
            // eslint-disable-next-line no-undef
            if (typeof currentUserRole !== 'undefined' && currentUserRole) role = currentUserRole;
        } catch (e) { /* ReferenceError before app1.js parses */ }
        if (!role && window.currentUserRole) role = window.currentUserRole;
        if (!role) {
            var label = document.getElementById('userRole');
            if (label && label.textContent) role = label.textContent;
        }
        return String(role || '').trim().toLowerCase();
    }

    function isAllowed() {
        return ALLOWED_ROLES.indexOf(getCurrentRole()) !== -1;
    }

    function enforceNavVisibility() {
        var li = document.getElementById('bdmAnalyticsNavItem');
        if (!li) return;
        if (isAllowed()) {
            // bdm-analytics.js is responsible for unhiding for allowed
            // roles. Don't fight it -- only act on the disallowed branch.
            return;
        }
        if (li.style.display !== 'none') {
            li.style.display = 'none';
        }
        // Also drop the click handler / href so direct DOM hacking
        // (e.g. devtools "display:block") doesn't open the report.
        var link = li.querySelector('a');
        if (link && !link._roleGuarded) {
            link._roleGuarded = true;
            link.addEventListener('click', function (ev) {
                if (!isAllowed()) {
                    ev.preventDefault();
                    ev.stopImmediatePropagation();
                }
            }, true);
        }
    }

    // Wrap window.showBdmAnalytics so any direct call from another
    // module is gated. Wait for it to be defined, then patch.
    function wrapShowFn() {
        if (typeof window.showBdmAnalytics !== 'function') return false;
        if (window.showBdmAnalytics._roleGuardWrapped) return true;
        var orig = window.showBdmAnalytics;
        var wrapped = function () {
            if (!isAllowed()) {
                console.warn('[bdm-analytics-role-guard] showBdmAnalytics blocked for role: ' + getCurrentRole());
                if (typeof window.alert === 'function') {
                    window.alert('BDM Analytics is only available for COO and Director.');
                }
                return;
            }
            return orig.apply(this, arguments);
        };
        wrapped._roleGuardWrapped = true;
        window.showBdmAnalytics = wrapped;
        return true;
    }

    // Initial pass + react to role becoming known and to sidebar
    // re-renders done by app1.js.
    enforceNavVisibility();
    wrapShowFn();

    var iv = setInterval(function () {
        enforceNavVisibility();
        wrapShowFn();
    }, 1500);
    setTimeout(function () { clearInterval(iv); }, 600000); // 10 minutes

    try {
        var obs = new MutationObserver(function () {
            enforceNavVisibility();
        });
        obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
    } catch (e) { /* ignore */ }

    console.log('[bdm-analytics-role-guard] loaded; allowed roles:', ALLOWED_ROLES.join(', '));
})();
