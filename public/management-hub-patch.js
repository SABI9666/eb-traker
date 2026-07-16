// management-hub-patch.js
// COO / Director landing page — an EPCM "Command Center" hub.
//
// The portal opens on 4 standard EPCM phase cards:
//   Engineering · Procurement · Construction · Corporate
// Clicking a phase drills into its tools (pulled from the existing division
// menus per the mapping below); clicking a tool navigates to its page.
// Nothing else loads until the user picks a destination.
//
// The hub is generated from the live sidebar DOM, so role visibility, badges
// and onclick handlers stay in sync with the real menu. The header logo acts
// as "home" in management mode.
// Loaded by bdm-po-patch.js. Only activates in top-menu-mode (COO/Director).

(function () {
    'use strict';

    // ── EPCM phase mapping ──────────────────────────────────────────────────
    // Each phase pulls in whole divisions (by their sidebar name). Individual
    // tools can be re-homed with ITEM_OVERRIDES (label -> phase key).
    var PHASES = [
        { key: 'engineering',  name: 'Engineering',  icon: '📐', tag: 'Design · Detailing · Drawings',
          divisions: ['Design & Engineering', 'Estimation & Workflow', 'Document Control'] },
        { key: 'procurement',  name: 'Procurement',  icon: '🛒', tag: 'Vendors · POs · Accounts',
          divisions: ['Finance & Accounts'] },
        { key: 'construction', name: 'Construction', icon: '🏗️', tag: 'Projects · Allocation · Delivery',
          divisions: ['Operations & Management'] },
        { key: 'corporate',    name: 'Corporate',    icon: '🏛️', tag: 'Sales · HR · IT · Admin',
          divisions: ['Business Development', 'Human Resources', 'Information Technology', 'Administration'] }
    ];
    // Move a specific tool to a phase regardless of which division it lives in.
    var ITEM_OVERRIDES = {
        'Tekla Reports': 'engineering'   // engineering progress belongs under Engineering
    };

    // Tools that are reports/analytics — surfaced together in the Reports
    // Center (a separate menu), while still living in their phase too.
    var REPORT_LABELS = {
        'Analytics': 1, 'BDM Analytics': 1, 'Project Dashboard': 1,
        'Designer Hours': 1, 'File Analytics': 1, 'Reports': 1,
        'Tekla Reports': 1, 'Leave Reports': 1, 'IT Overview': 1, 'Activities': 1
    };
    function isReport(label) {
        return !!REPORT_LABELS[label] || /report|analytic|dashboard/i.test(label);
    }

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

    // Group the live menu into the 4 EPCM phases (respecting overrides).
    function buildPhases() {
        var menu = readMenu();
        var byName = {};
        menu.forEach(function (d) { byName[d.name] = d; });

        return PHASES.map(function (p) {
            var items = [];
            // whole divisions assigned to this phase
            p.divisions.forEach(function (dn) {
                var d = byName[dn];
                if (!d) return;
                d.items.forEach(function (it) {
                    var ov = ITEM_OVERRIDES[it.label];
                    if (ov && ov !== p.key) return;   // moved out to another phase
                    items.push(it);
                });
            });
            // tools moved INTO this phase from other divisions
            menu.forEach(function (d) {
                if (p.divisions.indexOf(d.name) !== -1) return;
                d.items.forEach(function (it) {
                    if (ITEM_OVERRIDES[it.label] === p.key) items.push(it);
                });
            });
            return { key: p.key, name: p.name, icon: p.icon, tag: p.tag, items: items };
        }).filter(function (p) { return p.items.length; });
    }

    // Collect every report/analytics tool, grouped by its source division.
    function buildReports() {
        var menu = readMenu();
        var groups = [];
        menu.forEach(function (d) {
            var items = d.items.filter(function (it) { return isReport(it.label); });
            if (items.length) groups.push({ name: d.name, icon: d.icon, items: items });
        });
        return groups;
    }
    function reportCount() {
        return buildReports().reduce(function (s, g) { return s + g.items.length; }, 0);
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

    // ── Hub (level 1): 4 EPCM phase cards ───────────────────────────────────
    window.showManagementHub = function () {
        var main = document.getElementById('mainContent');
        if (!main) return;
        if (!isTopMode()) { if (typeof window.showProposals === 'function') window.showProposals(); return; }

        var phases = buildPhases();
        var today = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        var cards = phases.map(function (p) {
            var totalBadges = p.items.reduce(function (s, it) { return s + (parseInt(it.badge, 10) || 0); }, 0);
            var preview = p.items.slice(0, 5).map(function (it) {
                return '<span class="hub-chip">' + esc(it.icon) + ' ' + esc(it.label) + '</span>';
            }).join(' ');
            return '<div class="glass-surface hub-phase" onclick="window._hubOpenPhase(\'' + p.key + '\')">' +
                '<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:0.8rem;">' +
                    '<div class="hub-phase__icon">' + esc(p.icon) + '</div>' +
                    (totalBadges ? '<span class="hub-badge">' + totalBadges + '</span>' : '') +
                '</div>' +
                '<div style="margin-top:1rem; color:#f5f8fc; font-size:1.3rem; font-weight:800; letter-spacing:-0.01em;">' + esc(p.name) + '</div>' +
                '<div style="color:#8698ad; font-size:0.76rem; margin:0.2rem 0 0.9rem; letter-spacing:0.3px; text-transform:uppercase;">' + esc(p.tag) + '</div>' +
                '<div style="display:flex; flex-wrap:wrap; gap:6px;">' + preview +
                    (p.items.length > 5 ? '<span style="font-size:0.72rem; color:#8698ad; padding:3px 4px;">+' + (p.items.length - 5) + ' more</span>' : '') +
                '</div>' +
                '<div style="margin-top:1.1rem; color:#22c7f0; font-size:0.9rem; font-weight:700;">Open →</div>' +
            '</div>';
        }).join('');

        var who = (document.getElementById('userRole') || {}).textContent || '';
        main.innerHTML =
            '<div class="mgmt-hub"><div class="mgmt-hub__inner">' +
                '<div style="margin:0.2rem 0 1.6rem;">' +
                    '<div style="color:#7f93aa; font-size:0.82rem; font-weight:600; letter-spacing:0.5px;">' + esc(today) + '</div>' +
                    '<h2 style="font-size:2rem; font-weight:800; color:#f5f8fc; margin:0.2rem 0 0.15rem; letter-spacing:-0.01em;">' + greeting() + (who ? ', ' + esc(who) : '') + '</h2>' +
                    '<div style="color:#9fb0c4; font-size:0.95rem;">Select an EPCM phase, or open the Reports Center.</div>' +
                '</div>' +
                reportsBanner() +
                '<div class="hub-eyebrow"><span class="label">EPCM Phases</span><span class="rule"></span></div>' +
                '<div class="hub-grid">' + cards + '</div>' +
            '</div></div>';
        main.scrollTop = 0;
    };

    // ── Drill (level 2): one phase's tool tiles ─────────────────────────────
    window._hubOpenPhase = function (key) {
        var main = document.getElementById('mainContent');
        if (!main) return;
        var phases = buildPhases();
        var p = null;
        phases.forEach(function (x) { if (x.key === key) p = x; });
        if (!p) { window.showManagementHub(); return; }

        var tiles = p.items.map(function (it) { return hubTile(it); }).join('');

        main.innerHTML =
            '<div class="mgmt-hub"><div class="mgmt-hub__inner">' +
                '<div style="display:flex; align-items:center; gap:1rem; margin:0.2rem 0 1.6rem; flex-wrap:wrap;">' +
                    '<button onclick="window.showManagementHub()" class="hub-back">← All Phases</button>' +
                    '<div style="display:flex; align-items:center; gap:0.7rem;">' +
                        '<div class="hub-phase__icon" style="width:46px; height:46px; border-radius:12px; font-size:1.4rem;">' + esc(p.icon) + '</div>' +
                        '<div><h2 style="font-size:1.5rem; font-weight:800; color:#f5f8fc; margin:0;">' + esc(p.name) + '</h2>' +
                        '<div style="color:#9fb0c4; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.4px;">' + esc(p.tag) + '</div></div>' +
                    '</div>' +
                '</div>' +
                '<div class="hub-tilegrid">' + tiles + '</div>' +
            '</div></div>';
        main.scrollTop = 0;
    };

    // Shared frosted-glass tool tile (drill-down + reports center).
    function hubTile(it) {
        return '<div class="glass-surface hub-tile" onclick="window._hubGo(' + it.di + ',' + it.ii + ')">' +
            (it.badge ? '<span class="hub-badge" style="position:absolute; top:10px; right:10px;">' + esc(it.badge) + '</span>' : '') +
            '<div class="hub-tile__icon">' + esc(it.icon) + '</div>' +
            '<div class="hub-tile__label">' + esc(it.label) + '</div>' +
        '</div>';
    }

    // Separate, prominent Reports banner on the hub.
    function reportsBanner() {
        var n = reportCount();
        if (!n) return '';
        return '<div class="glass-surface hub-banner" onclick="window.showReportsCenter()">' +
            '<div class="hub-banner__icon">📊</div>' +
            '<div style="flex:1; min-width:0;">' +
                '<div style="color:#f5f8fc; font-size:1.25rem; font-weight:800;">Reports Center</div>' +
                '<div style="color:#9fb0c4; font-size:0.82rem; margin-top:0.15rem;">All analytics &amp; reports across every phase — in one place.</div>' +
            '</div>' +
            '<div style="flex:none; display:flex; align-items:center; gap:0.9rem;">' +
                '<span style="background:rgba(34,199,240,0.15); border:1px solid rgba(34,199,240,0.35); color:#22c7f0; font-size:0.78rem; font-weight:700; padding:4px 12px; border-radius:20px;">' + n + ' reports</span>' +
                '<span style="color:#22c7f0; font-size:0.95rem; font-weight:700; white-space:nowrap;">Open →</span>' +
            '</div>' +
        '</div>';
    }

    // ── Reports Center: every report/analytics view, grouped ────────────────
    window.showReportsCenter = function () {
        var main = document.getElementById('mainContent');
        if (!main) return;
        if (!isTopMode()) { if (typeof window.showProposals === 'function') window.showProposals(); return; }
        var groups = buildReports();

        var sections = groups.map(function (g) {
            var tiles = g.items.map(function (it) { return hubTile(it); }).join('');
            return '<div style="margin-bottom:1.8rem;">' +
                '<div class="hub-eyebrow">' +
                    '<span style="font-size:1.1rem;">' + esc(g.icon) + '</span>' +
                    '<span class="label">' + esc(g.name) + '</span>' +
                    '<span class="rule"></span>' +
                '</div>' +
                '<div class="hub-tilegrid">' + tiles + '</div>' +
            '</div>';
        }).join('');

        main.innerHTML =
            '<div class="mgmt-hub"><div class="mgmt-hub__inner">' +
                '<div style="display:flex; align-items:center; gap:1rem; margin:0.2rem 0 1.6rem; flex-wrap:wrap;">' +
                    '<button onclick="window.showManagementHub()" class="hub-back">← Home</button>' +
                    '<div style="display:flex; align-items:center; gap:0.7rem;">' +
                        '<div class="hub-banner__icon" style="width:46px; height:46px; border-radius:12px; font-size:1.4rem;">📊</div>' +
                        '<div><h2 style="font-size:1.5rem; font-weight:800; color:#f5f8fc; margin:0;">Reports Center</h2>' +
                        '<div style="color:#9fb0c4; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.4px;">All analytics &amp; reports</div></div>' +
                    '</div>' +
                '</div>' +
                (sections || '<div class="glass-surface" style="padding:2rem; text-align:center; color:#9fb0c4; border-radius:18px;">No reports available for your role.</div>') +
            '</div></div>';
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
