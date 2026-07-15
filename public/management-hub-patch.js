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
                return '<span style="display:inline-flex; align-items:center; gap:5px; font-size:0.72rem; color:#9fb0c4; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.07); padding:3px 9px; border-radius:20px;">' +
                    esc(it.icon) + ' ' + esc(it.label) + '</span>';
            }).join(' ');
            return '<div onclick="window._hubOpenPhase(\'' + p.key + '\')" ' +
                'style="cursor:pointer; position:relative; overflow:hidden; border-radius:20px; padding:1.6rem 1.6rem; ' +
                'background: radial-gradient(460px 220px at 12% 0%, rgba(34,199,240,0.16), transparent 60%), linear-gradient(150deg, #1f2a39 0%, #18212e 100%); ' +
                'border:1px solid rgba(255,255,255,0.08); box-shadow:0 20px 44px -22px rgba(10,16,26,0.75); transition:all 0.22s ease;" ' +
                'onmouseover="this.style.transform=\'translateY(-5px)\'; this.style.borderColor=\'rgba(34,199,240,0.6)\'; this.style.boxShadow=\'0 28px 54px -20px rgba(34,199,240,0.4)\';" ' +
                'onmouseout="this.style.transform=\'\'; this.style.borderColor=\'rgba(255,255,255,0.08)\'; this.style.boxShadow=\'0 20px 44px -22px rgba(10,16,26,0.75)\';">' +
                (totalBadges ? '<span style="position:absolute; top:16px; right:16px; background:#ef4444; color:#fff; font-size:0.72rem; font-weight:800; padding:2px 10px; border-radius:12px;">' + totalBadges + '</span>' : '') +
                '<div style="width:58px; height:58px; border-radius:16px; background:linear-gradient(135deg,#22c7f0,#0e9ed1); display:flex; align-items:center; justify-content:center; font-size:1.7rem; box-shadow:0 12px 26px -8px rgba(34,199,240,0.55);">' + esc(p.icon) + '</div>' +
                '<div style="margin-top:1rem; color:#f5f8fc; font-size:1.3rem; font-weight:800; letter-spacing:-0.01em;">' + esc(p.name) + '</div>' +
                '<div style="color:#7d8ea3; font-size:0.76rem; margin:0.2rem 0 0.9rem; letter-spacing:0.3px; text-transform:uppercase;">' + esc(p.tag) + '</div>' +
                '<div style="display:flex; flex-wrap:wrap; gap:6px;">' + preview +
                    (p.items.length > 5 ? '<span style="font-size:0.72rem; color:#7d8ea3; padding:3px 4px;">+' + (p.items.length - 5) + ' more</span>' : '') +
                '</div>' +
                '<div style="position:absolute; bottom:16px; right:18px; color:#22c7f0; font-size:0.9rem; font-weight:700;">Open →</div>' +
            '</div>';
        }).join('');

        var who = (document.getElementById('userRole') || {}).textContent || '';
        main.innerHTML =
            '<div style="max-width:1240px; margin:0 auto;">' +
                '<div style="margin:0.6rem 0 1.4rem;">' +
                    '<div style="color:#64748b; font-size:0.85rem; font-weight:600; letter-spacing:0.4px;">' + esc(today) + '</div>' +
                    '<h2 style="font-size:2rem; font-weight:800; color:#0f172a; margin:0.15rem 0 0.1rem;">' + greeting() + (who ? ', ' + esc(who) : '') + '</h2>' +
                    '<div style="color:#64748b; font-size:0.95rem;">Select an EPCM phase, or open the Reports Center.</div>' +
                '</div>' +
                reportsBanner() +
                '<div style="display:flex; align-items:center; gap:0.6rem; margin:0 0 0.8rem;">' +
                    '<span style="font-size:0.72rem; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; color:#94a3b8;">EPCM Phases</span>' +
                    '<span style="flex:1; height:1px; background:#e2e8f0;"></span>' +
                '</div>' +
                '<div class="hub-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(270px, 1fr)); gap:1.2rem;">' + cards + '</div>' +
            '</div>';
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

        var tiles = p.items.map(function (it) {
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
                '<div style="display:flex; align-items:center; gap:1rem; margin:0.6rem 0 1.5rem; flex-wrap:wrap;">' +
                    '<button onclick="window.showManagementHub()" class="btn btn-outline btn-sm" style="white-space:nowrap;">← All Phases</button>' +
                    '<div style="display:flex; align-items:center; gap:0.7rem;">' +
                        '<div style="width:46px; height:46px; border-radius:12px; background:linear-gradient(135deg,#22c7f0,#0e9ed1); display:flex; align-items:center; justify-content:center; font-size:1.4rem;">' + esc(p.icon) + '</div>' +
                        '<div><h2 style="font-size:1.5rem; font-weight:800; color:#0f172a; margin:0;">' + esc(p.name) + '</h2>' +
                        '<div style="color:#64748b; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.4px;">' + esc(p.tag) + '</div></div>' +
                    '</div>' +
                '</div>' +
                '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:0.9rem;">' + tiles + '</div>' +
            '</div>';
        main.scrollTop = 0;
    };

    // Separate, prominent Reports banner on the hub.
    function reportsBanner() {
        var n = reportCount();
        if (!n) return '';
        return '<div onclick="window.showReportsCenter()" ' +
            'style="cursor:pointer; position:relative; overflow:hidden; display:flex; align-items:center; gap:1.2rem; padding:1.3rem 1.6rem; margin-bottom:1.5rem; border-radius:18px; ' +
            'background: radial-gradient(500px 200px at 90% 0%, rgba(201,162,39,0.18), transparent 60%), linear-gradient(120deg, #12202e 0%, #17384a 100%); ' +
            'border:1px solid rgba(34,199,240,0.30); box-shadow:0 20px 44px -24px rgba(34,199,240,0.45); transition:all 0.2s ease;" ' +
            'onmouseover="this.style.transform=\'translateY(-3px)\'; this.style.borderColor=\'rgba(34,199,240,0.6)\';" ' +
            'onmouseout="this.style.transform=\'\'; this.style.borderColor=\'rgba(34,199,240,0.30)\';">' +
            '<div style="width:56px; height:56px; flex:none; border-radius:15px; background:linear-gradient(135deg,#f4c04e,#e0932a); display:flex; align-items:center; justify-content:center; font-size:1.7rem; box-shadow:0 12px 24px -8px rgba(224,147,42,0.55);">📊</div>' +
            '<div style="flex:1; min-width:0;">' +
                '<div style="color:#f5f8fc; font-size:1.25rem; font-weight:800;">Reports Center</div>' +
                '<div style="color:#9fb0c4; font-size:0.82rem; margin-top:0.15rem;">All analytics &amp; reports across every phase — in one place.</div>' +
            '</div>' +
            '<div style="flex:none; display:flex; align-items:center; gap:0.9rem;">' +
                '<span style="background:rgba(34,199,240,0.15); border:1px solid rgba(34,199,240,0.35); color:#22c7f0; font-size:0.78rem; font-weight:700; padding:4px 12px; border-radius:20px;">' + n + ' reports</span>' +
                '<span style="color:#22c7f0; font-size:0.95rem; font-weight:700;">Open →</span>' +
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
            var tiles = g.items.map(function (it) {
                return '<div onclick="window._hubGo(' + it.di + ',' + it.ii + ')" ' +
                    'style="position:relative; cursor:pointer; background:#fff; border:1px solid #e6ebf2; border-radius:16px; padding:1.25rem 1rem; text-align:center; box-shadow:0 10px 26px -16px rgba(15,23,42,0.18); transition:all 0.2s ease;" ' +
                    'onmouseover="this.style.transform=\'translateY(-4px)\'; this.style.borderColor=\'#22c7f0\'; this.style.boxShadow=\'0 18px 34px -16px rgba(34,199,240,0.45)\';" ' +
                    'onmouseout="this.style.transform=\'\'; this.style.borderColor=\'#e6ebf2\'; this.style.boxShadow=\'0 10px 26px -16px rgba(15,23,42,0.18)\';">' +
                    (it.badge ? '<span style="position:absolute; top:9px; right:11px; background:#ef4444; color:#fff; font-size:0.68rem; font-weight:800; padding:1px 8px; border-radius:11px;">' + esc(it.badge) + '</span>' : '') +
                    '<div style="width:50px; height:50px; margin:0 auto; border-radius:13px; background:linear-gradient(135deg,#e6f9fe,#d2f3fc); display:flex; align-items:center; justify-content:center; font-size:1.45rem;">' + esc(it.icon) + '</div>' +
                    '<div style="margin-top:0.7rem; font-size:0.86rem; font-weight:700; color:#0f172a; line-height:1.25;">' + esc(it.label) + '</div>' +
                '</div>';
            }).join('');
            return '<div style="margin-bottom:1.6rem;">' +
                '<div style="display:flex; align-items:center; gap:0.6rem; margin:0 0 0.8rem;">' +
                    '<span style="font-size:1.1rem;">' + esc(g.icon) + '</span>' +
                    '<span style="font-size:0.78rem; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#475569;">' + esc(g.name) + '</span>' +
                    '<span style="flex:1; height:1px; background:#e2e8f0;"></span>' +
                '</div>' +
                '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:0.9rem;">' + tiles + '</div>' +
            '</div>';
        }).join('');

        main.innerHTML =
            '<div style="max-width:1240px; margin:0 auto;">' +
                '<div style="display:flex; align-items:center; gap:1rem; margin:0.6rem 0 1.5rem; flex-wrap:wrap;">' +
                    '<button onclick="window.showManagementHub()" class="btn btn-outline btn-sm" style="white-space:nowrap;">← Home</button>' +
                    '<div style="display:flex; align-items:center; gap:0.7rem;">' +
                        '<div style="width:46px; height:46px; border-radius:12px; background:linear-gradient(135deg,#f4c04e,#e0932a); display:flex; align-items:center; justify-content:center; font-size:1.4rem;">📊</div>' +
                        '<div><h2 style="font-size:1.5rem; font-weight:800; color:#0f172a; margin:0;">Reports Center</h2>' +
                        '<div style="color:#64748b; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.4px;">All analytics &amp; reports</div></div>' +
                    '</div>' +
                '</div>' +
                (sections || '<div class="card" style="padding:2rem; text-align:center; color:#64748b;">No reports available for your role.</div>') +
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
