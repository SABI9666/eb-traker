// management-hub-patch.js
// COO / Director landing page — an executive "Command Center" hub.
//
// Instead of dropping management users into All Proposals, the portal opens
// on a bento-style grid of division cards (Business Development, Operations,
// Finance, Human Resources, ...). Clicking a card drills into that division's
// tools; clicking a tool navigates to its page. Nothing else is loaded until
// the user picks a destination.
//
// The hub is generated from the live sidebar DOM, so role visibility, badges
// and onclick handlers are always in sync with the real menu. The header
// logo becomes a "home" button in management mode.
// Loaded by bdm-po-patch.js. Only activates in top-menu-mode (COO/Director).

(function () {
    'use strict';

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isTopMode() {
        var app = document.getElementById('appContainer');
        return !!(app && app.classList.contains('top-menu-mode'));
    }

    // Read the live sidebar: visible departments and their visible items.
    function readMenu() {
        var out = [];
        document.querySelectorAll('.sidebar .nav-department').forEach(function (dept, di) {
            if (dept.style.display === 'none') return;
            var header = dept.querySelector('.nav-dept-header');
            if (!header) return;
            var icon = (header.querySelector('.dept-icon') || {}).textContent || '📁';
            var name = '';
            header.childNodes.forEach(function (n) { if (n.nodeType === 3) name += n.textContent; });
            name = name.trim() || header.textContent.replace(/[▼▲]/g, '').trim();

            var items = [];
            dept.querySelectorAll('.nav-dept-items > li').forEach(function (li, ii) {
                if (li.style.display === 'none') return;
                var a = li.querySelector('a');
                if (!a) return;
                var itemIcon = (a.querySelector('.nav-icon') || {}).textContent || '•';
                var badgeEl = a.querySelector('.notification-count, .nav-badge');
                var badge = (badgeEl && badgeEl.style.display !== 'none') ? badgeEl.textContent.trim() : '';
                var label = '';
                a.childNodes.forEach(function (n) { if (n.nodeType === 3) label += n.textContent; });
                label = label.trim() || a.textContent.trim();
                items.push({ icon: itemIcon.trim(), label: label, badge: badge, di: di, ii: ii });
            });
            if (items.length) out.push({ icon: icon.trim(), name: name, items: items, di: di });
        });
        return out;
    }

    function clickItem(di, ii) {
        var depts = document.querySelectorAll('.sidebar .nav-department');
        var dept = depts[di];
        if (!dept) return;
        var lis = dept.querySelectorAll('.nav-dept-items > li');
        var a = lis[ii] && lis[ii].querySelector('a');
        if (a) a.click();
    }

    function greeting() {
        var h = new Date().getHours();
        return h < 12 ? 'Good morning' : (h < 17 ? 'Good afternoon' : 'Good evening');
    }

    // ── Hub (level 1): bento grid of division cards ─────────────────────────
    window.showManagementHub = function () {
        var main = document.getElementById('mainContent');
        if (!main) return;
        if (!isTopMode()) { if (typeof window.showProposals === 'function') window.showProposals(); return; }

        var menu = readMenu();
        var today = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        var cards = menu.map(function (d, idx) {
            var featured = idx === 0;
            var totalBadges = d.items.reduce(function (s, it) { return s + (parseInt(it.badge, 10) || 0); }, 0);
            var preview = d.items.slice(0, featured ? 5 : 3).map(function (it) {
                return '<span style="display:inline-flex; align-items:center; gap:5px; font-size:0.72rem; color:#9fb0c4; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.07); padding:3px 9px; border-radius:20px;">' +
                    esc(it.icon) + ' ' + esc(it.label) + '</span>';
            }).join(' ');
            return '<div onclick="window._hubOpenDept(' + d.di + ')" ' +
                'style="grid-column: span ' + (featured ? 2 : 1) + '; cursor:pointer; position:relative; overflow:hidden; border-radius:18px; padding:1.4rem 1.5rem; ' +
                'background: radial-gradient(420px 200px at 15% 0%, rgba(34,199,240,0.14), transparent 60%), linear-gradient(150deg, #1f2a39 0%, #18212e 100%); ' +
                'border:1px solid rgba(255,255,255,0.08); box-shadow:0 18px 40px -22px rgba(10,16,26,0.7); transition:all 0.22s ease;" ' +
                'onmouseover="this.style.transform=\'translateY(-4px)\'; this.style.borderColor=\'rgba(34,199,240,0.55)\'; this.style.boxShadow=\'0 24px 48px -20px rgba(34,199,240,0.35)\';" ' +
                'onmouseout="this.style.transform=\'\'; this.style.borderColor=\'rgba(255,255,255,0.08)\'; this.style.boxShadow=\'0 18px 40px -22px rgba(10,16,26,0.7)\';">' +
                (totalBadges ? '<span style="position:absolute; top:14px; right:14px; background:#ef4444; color:#fff; font-size:0.7rem; font-weight:800; padding:2px 9px; border-radius:12px;">' + totalBadges + '</span>' : '') +
                '<div style="width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg,#22c7f0,#0e9ed1); display:flex; align-items:center; justify-content:center; font-size:1.5rem; box-shadow:0 10px 22px -8px rgba(34,199,240,0.55);">' + esc(d.icon) + '</div>' +
                '<div style="margin-top:0.9rem; color:#f5f8fc; font-size:1.12rem; font-weight:800; letter-spacing:-0.01em;">' + esc(d.name) + '</div>' +
                '<div style="color:#7d8ea3; font-size:0.75rem; margin:0.15rem 0 0.7rem;">' + d.items.length + ' tool' + (d.items.length > 1 ? 's' : '') + '</div>' +
                '<div style="display:flex; flex-wrap:wrap; gap:6px;">' + preview + '</div>' +
                '<div style="position:absolute; bottom:14px; right:16px; color:#22c7f0; font-size:0.85rem; font-weight:700;">Open →</div>' +
            '</div>';
        }).join('');

        var who = (document.getElementById('userRole') || {}).textContent || '';
        main.innerHTML =
            '<div style="max-width:1240px; margin:0 auto;">' +
                '<div style="margin:0.6rem 0 1.6rem;">' +
                    '<div style="color:#64748b; font-size:0.85rem; font-weight:600; letter-spacing:0.4px;">' + esc(today) + '</div>' +
                    '<h2 style="font-size:2rem; font-weight:800; color:#0f172a; margin:0.15rem 0 0.1rem;">' + greeting() + (who ? ', ' + esc(who) : '') + '</h2>' +
                    '<div style="color:#64748b; font-size:0.95rem;">Choose a division to get started.</div>' +
                '</div>' +
                '<div class="hub-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:1.1rem;">' + cards + '</div>' +
            '</div>' +
            '<style>@media (max-width:700px){ .hub-grid > div { grid-column: span 1 !important; } }</style>';
        main.scrollTop = 0;
    };

    // ── Drill (level 2): one division's tool tiles ──────────────────────────
    window._hubOpenDept = function (di) {
        var main = document.getElementById('mainContent');
        if (!main) return;
        var menu = readMenu();
        var d = null;
        menu.forEach(function (m) { if (m.di === di) d = m; });
        if (!d) { window.showManagementHub(); return; }

        var tiles = d.items.map(function (it) {
            return '<div onclick="window._hubGo(' + it.di + ',' + it.ii + ')" ' +
                'style="position:relative; cursor:pointer; background:#fff; border:1px solid #e6ebf2; border-radius:16px; padding:1.25rem 1rem; text-align:center; box-shadow:0 10px 26px -16px rgba(15,23,42,0.18); transition:all 0.2s ease;" ' +
                'onmouseover="this.style.transform=\'translateY(-4px)\'; this.style.borderColor=\'#22c7f0\'; this.style.boxShadow=\'0 18px 34px -16px rgba(34,199,240,0.45)\';" ' +
                'onmouseout="this.style.transform=\'\'; this.style.borderColor=\'#e6ebf2\'; this.style.boxShadow=\'0 10px 26px -16px rgba(15,23,42,0.18)\';">' +
                (it.badge ? '<span style="position:absolute; top:9px; right:11px; background:#ef4444; color:#fff; font-size:0.68rem; font-weight:800; padding:1px 8px; border-radius:11px;">' + esc(it.badge) + '</span>' : '') +
                '<div style="width:50px; height:50px; margin:0 auto; border-radius:13px; background:linear-gradient(135deg,#e6f9fe,#d2f3fc); display:flex; align-items:center; justify-content:center; font-size:1.45rem;">' + esc(it.icon) + '</div>' +
                '<div style="margin-top:0.7rem; font-size:0.86rem; font-weight:700; color:#0f172a; line-height:1.25;">' + esc(it.label) + '</div>' +
            '</div>';
        }).join('');

        main.innerHTML =
            '<div style="max-width:1240px; margin:0 auto;">' +
                '<div style="display:flex; align-items:center; gap:1rem; margin:0.6rem 0 1.5rem;">' +
                    '<button onclick="window.showManagementHub()" class="btn btn-outline btn-sm" style="white-space:nowrap;">← All Divisions</button>' +
                    '<div style="display:flex; align-items:center; gap:0.7rem;">' +
                        '<div style="width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg,#22c7f0,#0e9ed1); display:flex; align-items:center; justify-content:center; font-size:1.3rem;">' + esc(d.icon) + '</div>' +
                        '<h2 style="font-size:1.5rem; font-weight:800; color:#0f172a; margin:0;">' + esc(d.name) + '</h2>' +
                    '</div>' +
                '</div>' +
                '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:0.9rem;">' + tiles + '</div>' +
            '</div>';
        main.scrollTop = 0;
    };

    window._hubGo = function (di, ii) { clickItem(di, ii); };

    // Header logo -> home (management mode only). Bind once.
    function bindLogoHome() {
        var logo = document.querySelector('.header .logo');
        if (!logo || logo._hubBound) return;
        logo._hubBound = true;
        logo.style.cursor = 'pointer';
        logo.addEventListener('click', function () {
            if (isTopMode()) window.showManagementHub();
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindLogoHome);
    else bindLogoHome();
})();
