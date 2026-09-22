// Isolate Purchase navigation even when older async menu patches finish late.
(function () {
    'use strict';
    if (window._purchasePortalNavigationLoaded) return;
    window._purchasePortalNavigationLoaded = true;
    const emails = ['anwar@edanbrook.in', 'anwar1@edanbrook.in'];
    let purchaseSession = false;
    let frame = null;
    let started = false;

    function reconcile() {
        frame = null;
        const app = document.getElementById('appContainer');
        if (!app) return;
        if (app.classList.contains('purchase-portal') !== purchaseSession) {
            app.classList.toggle('purchase-portal', purchaseSession);
        }
        if (!purchaseSession) return;
        if (app.classList.contains('top-menu-mode')) app.classList.remove('top-menu-mode');
        const link = document.getElementById('nav-purchase-management');
        if (link) {
            if (!link.classList.contains('active')) link.classList.add('active');
            link.setAttribute('aria-current', 'page');
        }
        const main = document.getElementById('mainContent');
        // A pending legacy dashboard request must not replace the purchase screen.
        if (app.style.display !== 'none' && main && !main.querySelector('.pm') &&
            typeof window.showPurchaseManagement === 'function') {
            window.showPurchaseManagement();
        }
    }
    function schedule() {
        if (frame === null) frame = requestAnimationFrame(reconcile);
    }
    function start() {
        if (started || !window.firebase || !firebase.apps.length) return;
        started = true;
        firebase.auth().onAuthStateChanged(function (user) {
            purchaseSession = !!user && emails.includes((user.email || '').trim().toLowerCase());
            if (!purchaseSession) {
                document.getElementById('pmModal')?.remove();
                document.getElementById('nav-purchase-management')?.removeAttribute('aria-current');
            }
            schedule();
        });
        const app = document.getElementById('appContainer');
        if (app) new MutationObserver(function () {
            if (purchaseSession) schedule();
        }).observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
        const link = document.getElementById('nav-purchase-management');
        if (link) link.addEventListener('click', function (event) {
            event.preventDefault();
            if (purchaseSession && typeof window.showPurchaseManagement === 'function') window.showPurchaseManagement();
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
