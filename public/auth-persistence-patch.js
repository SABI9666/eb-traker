// public/auth-persistence-patch.js
// Two purposes:
//
// 1. Force LOCAL Firebase Auth persistence — user stays logged in on each
//    device until they explicitly sign out (no surprise logouts on browser
//    close).
//
// 2. Suppress the brief login-screen flash on page load. The default render
//    sequence is: HTML loads → login form is visible → Firebase reports
//    "already signed in" → app swaps to dashboard. That ~300-800 ms flash
//    is bad when the screen is being shared in a Teams / Zoom / Meet call:
//    attendees can see the login fields. We hide #loginScreen until Firebase
//    has confirmed the auth state. If not signed in, we reveal it; if
//    signed in, the dashboard renders instead and the login form is never
//    shown at all.

(function () {
    'use strict';

    if (window._authPersistencePatchInstalled) return;
    window._authPersistencePatchInstalled = true;

    // ─── 1. Hide login UI immediately so it can't flash on shared screens ──
    // Inject a style block that keeps login containers invisible until we
    // explicitly mark <body> with `data-auth-resolved`. We add a small
    // privacy splash so the user / meeting attendees see a neutral loader
    // instead of a blank page.
    function injectStealthStyles() {
        if (document.getElementById('authStealthStyles')) return;
        var css =
            'body:not([data-auth-resolved]) #loginScreen,' +
            'body:not([data-auth-resolved]) .login-screen,' +
            'body:not([data-auth-resolved]) #loginForm,' +
            'body:not([data-auth-resolved]) .login-container { ' +
                'visibility: hidden !important; ' +
                'opacity: 0 !important; ' +
                'pointer-events: none !important; }' +
            'body:not([data-auth-resolved])::before { ' +
                'content:"\\1F4CB  Loading…"; ' +
                'position:fixed; inset:0; display:flex; align-items:center; justify-content:center; ' +
                'font:600 1.1rem system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; ' +
                'background:#f8fafc; color:#1e3a8a; z-index:9999; }';
        var style = document.createElement('style');
        style.id = 'authStealthStyles';
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }
    injectStealthStyles();

    function markResolved() {
        try { document.body.setAttribute('data-auth-resolved', '1'); } catch (e) {}
    }

    // Hard cap: never keep the splash visible for more than 6s, even if
    // Firebase fails to load. Better to show whatever the page would have
    // shown than to hang.
    var HARD_CAP_MS = 6000;
    setTimeout(markResolved, HARD_CAP_MS);

    // ─── 2. Configure Firebase persistence + reveal once auth is known ─────
    function applyPersistenceAndWatch() {
        try {
            if (typeof firebase === 'undefined' || !firebase.auth) return false;
            var auth = firebase.auth();
            var LOCAL = (firebase.auth.Auth && firebase.auth.Auth.Persistence && firebase.auth.Auth.Persistence.LOCAL)
                || 'local';

            auth.setPersistence(LOCAL).then(function () {
                console.log('[auth-persistence] LOCAL persistence set; sticky per-device login.');
            }).catch(function (e) {
                console.warn('[auth-persistence] setPersistence failed:', e && e.message);
            });

            // First auth-state event tells us whether the user is signed in.
            // We don't care which it is — we just need to reveal the page so
            // the right UI shows. If already signed in, app1.js will route
            // straight into the dashboard (no login form ever shown).
            var unsub = auth.onAuthStateChanged(function () {
                markResolved();
                if (typeof unsub === 'function') unsub();
            });

            return true;
        } catch (e) {
            console.warn('[auth-persistence] error during apply:', e && e.message);
            return false;
        }
    }

    if (applyPersistenceAndWatch()) return;
    var tries = 0;
    var iv = setInterval(function () {
        tries += 1;
        if (applyPersistenceAndWatch() || tries > 60) clearInterval(iv);
    }, 500);
})();
