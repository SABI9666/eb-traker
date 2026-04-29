// public/auth-persistence-patch.js
// Force per-device login: switch Firebase Auth to SESSION persistence.
//
// Default Firebase persistence is LOCAL — login state lives in IndexedDB and
// (on some browsers / when synced) carries across devices. Concretely: a BDM
// who signs in on their phone may find that opening the same site on their
// desktop auto-authenticates without re-entering the password.
//
// SESSION persistence:
//   - Each browser tab/window keeps its own auth state
//   - Login does NOT survive a browser/window close
//   - Cross-device sync is impossible (sessionStorage is never synced)
//
// This matches the requested behaviour: "any device can log in, but every
// device must log in on its own — opening on phone shouldn't auto-open on
// desktop".

(function () {
    'use strict';

    if (window._authPersistencePatchInstalled) return;
    window._authPersistencePatchInstalled = true;

    function applyPersistence() {
        try {
            if (typeof firebase === 'undefined' || !firebase.auth) return false;
            var auth = firebase.auth();
            var SESSION = (firebase.auth.Auth && firebase.auth.Auth.Persistence && firebase.auth.Auth.Persistence.SESSION)
                || 'session';
            auth.setPersistence(SESSION).then(function () {
                console.log('[auth-persistence] Firebase Auth persistence set to SESSION (per-device login).');
            }).catch(function (e) {
                console.warn('[auth-persistence] setPersistence failed:', e && e.message);
            });
            return true;
        } catch (e) {
            console.warn('[auth-persistence] error during apply:', e && e.message);
            return false;
        }
    }

    // Try once now, then poll for up to 30s in case Firebase loads late.
    if (applyPersistence()) return;
    var tries = 0;
    var iv = setInterval(function () {
        tries += 1;
        if (applyPersistence() || tries > 60) clearInterval(iv);
    }, 500);
})();
