// public/auth-persistence-patch.js
// Force LOCAL Firebase Auth persistence so login STAYS on the same device
// across browser sessions (closing/reopening the browser keeps you signed
// in). Login still does not cross devices unless a true SSO provider
// (Google/Apple/etc.) is wired in — that requires a different change.
//
// Why this patch exists:
//   - The default in some Firebase SDK setups can be SESSION (cleared on
//     tab close), which felt unprofessional on this site.
//   - We want every authenticated user to stay signed in on each device
//     they have used to log in, until they explicitly sign out.

(function () {
    'use strict';

    if (window._authPersistencePatchInstalled) return;
    window._authPersistencePatchInstalled = true;

    function applyPersistence() {
        try {
            if (typeof firebase === 'undefined' || !firebase.auth) return false;
            var auth = firebase.auth();
            var LOCAL = (firebase.auth.Auth && firebase.auth.Auth.Persistence && firebase.auth.Auth.Persistence.LOCAL)
                || 'local';
            auth.setPersistence(LOCAL).then(function () {
                console.log('[auth-persistence] Firebase Auth persistence set to LOCAL (sticky per-device login).');
            }).catch(function (e) {
                console.warn('[auth-persistence] setPersistence failed:', e && e.message);
            });
            return true;
        } catch (e) {
            console.warn('[auth-persistence] error during apply:', e && e.message);
            return false;
        }
    }

    if (applyPersistence()) return;
    var tries = 0;
    var iv = setInterval(function () {
        tries += 1;
        if (applyPersistence() || tries > 60) clearInterval(iv);
    }, 500);
})();
