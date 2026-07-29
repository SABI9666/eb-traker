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
        setNav('hub');

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
        main.setAttribute('data-hub-view', 'hub');
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
        setNav('phase', { key: p.key, name: p.name, icon: p.icon });

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
        main.setAttribute('data-hub-view', 'phase');
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
            '<div class="hub-banner__lead">' +
                '<div class="hub-banner__icon">📊</div>' +
                '<div style="min-width:0;">' +
                    '<div style="color:#f5f8fc; font-size:1.25rem; font-weight:800;">Reports Center</div>' +
                    '<div style="color:#9fb0c4; font-size:0.82rem; margin-top:0.15rem;">All analytics &amp; reports across every phase — in one place.</div>' +
                '</div>' +
            '</div>' +
            '<div class="hub-banner__meta">' +
                '<span style="background:rgba(34,199,240,0.15); border:1px solid rgba(34,199,240,0.35); color:#22c7f0; font-size:0.78rem; font-weight:700; padding:4px 12px; border-radius:20px; white-space:nowrap;">' + n + ' reports</span>' +
                '<span style="color:#22c7f0; font-size:0.95rem; font-weight:700; white-space:nowrap;">Open →</span>' +
            '</div>' +
        '</div>';
    }

    // ── Reports Center: every report/analytics view, grouped ────────────────
    window.showReportsCenter = function () {
        var main = document.getElementById('mainContent');
        if (!main) return;
        if (!isTopMode()) { if (typeof window.showProposals === 'function') window.showProposals(); return; }
        setNav('reports');
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
        main.setAttribute('data-hub-view', 'reports');
        main.scrollTop = 0;
    };

    window._hubGo = function (di, ii) {
        var label = null;
        try {
            var depts = document.querySelectorAll('.sidebar .nav-department');
            var lis = depts[di] && depts[di].querySelectorAll('.nav-dept-items > li');
            var a = lis && lis[ii] && lis[ii].querySelector('a');
            if (a) {
                label = '';
                a.childNodes.forEach(function (n) { if (n.nodeType === 3) label += n.textContent; });
                label = label.trim() || a.textContent.trim();
            }
        } catch (e) {}
        setNav('tool', { label: label });
        clickItem(di, ii);
    };

    // ═══════════════════════════════════════════════════════════════════
    // BACK NAVIGATION
    // A fixed "back" pill lives outside #mainContent, so tool pages that
    // replace innerHTML can never wipe it. Level is tracked so Back always
    // returns one step up (tool → phase → hub). Browser/OS back is wired
    // through the History API, which also enables the iOS Safari swipe-back
    // gesture and the Android hardware back button.
    // ═══════════════════════════════════════════════════════════════════
    var _nav = { level: 'hub', phaseKey: null, phaseName: null, phaseIcon: null, label: null };
    var _suppressPush = false;
    var _navSeq = 0;   // bumped on every navigation; guards the back fallback

    function setNav(level, opts) {
        opts = opts || {};
        _navSeq++;
        if (level === 'hub') {
            _nav = { level: 'hub', phaseKey: null, phaseName: null, phaseIcon: null, label: null };
        } else if (level === 'phase') {
            _nav = { level: 'phase', phaseKey: opts.key, phaseName: opts.name, phaseIcon: opts.icon, label: null };
        } else if (level === 'reports') {
            _nav = { level: 'reports', phaseKey: null, phaseName: 'Reports Center', phaseIcon: '📊', label: null };
        } else if (level === 'tool') {
            _nav = {
                level: 'tool',
                phaseKey: _nav.phaseKey, phaseName: _nav.phaseName, phaseIcon: _nav.phaseIcon,
                fromReports: _nav.level === 'reports',
                label: opts.label || null
            };
        }
        // Tag the DOM immediately so state and view agree with no flicker.
        // (Each render re-applies the tag after its innerHTML wipe.)
        var _m = document.getElementById('mainContent');
        if (_m) {
            if (level === 'tool') _m.removeAttribute('data-hub-view');
            else _m.setAttribute('data-hub-view', level);
        }
        syncBackBar();
        if (!_suppressPush) {
            try { history.pushState({ hubLevel: _nav.level, hubNav: JSON.parse(JSON.stringify(_nav)) }, ''); } catch (e) {}
        }
    }

    // The rendered DOM is the source of truth. Hub views tag #mainContent with
    // data-hub-view; any other render (a tool page) clears it via innerHTML.
    // This way the pill also appears for pages reached WITHOUT a hub tile —
    // deep links from email, in-page buttons, role routing, etc.
    function currentLevel() {
        var main = document.getElementById('mainContent');
        var v = main && main.getAttribute('data-hub-view');
        if (v === 'hub' || v === 'phase' || v === 'reports') return v;
        return 'tool';
    }

    // Where does "back" go from here, and what should it be called?
    function backTarget() {
        var lvl = currentLevel();
        if (lvl !== _nav.level) { _nav.level = lvl; }   // reconcile with reality
        if (_nav.level === 'tool') {
            if (_nav.fromReports) return { text: 'Reports Center', icon: '📊', run: function () { window.showReportsCenter(); } };
            if (_nav.phaseKey)   return { text: _nav.phaseName, icon: _nav.phaseIcon, run: function () { window._hubOpenPhase(_nav.phaseKey); } };
            return { text: 'Home', icon: '⌂', run: function () { window.showManagementHub(); } };
        }
        if (_nav.level === 'phase' || _nav.level === 'reports') {
            return { text: 'Home', icon: '⌂', run: function () { window.showManagementHub(); } };
        }
        return null; // on the hub — nothing to go back to
    }

    window._hubBack = function () {
        var t = backTarget();
        if (!t) return;
        // Prefer the real history entry so the URL stack stays in sync.
        var seq = _navSeq;
        try { history.back(); } catch (e) { t.run(); }
        // Fallback for in-app browsers where popstate never fires. Guarded by
        // the navigation token: if ANY navigation happened meanwhile (popstate
        // landing, or the user tapping another tool), this must not fire —
        // otherwise it would yank them back off the page they just opened.
        setTimeout(function () {
            if (_navSeq !== seq) return;          // something already navigated
            _suppressPush = true; t.run(); _suppressPush = false;
        }, 220);
    };

    function ensureBackBar() {
        var el = document.getElementById('hubBackBar');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'hubBackBar';
        el.setAttribute('role', 'navigation');
        el.innerHTML =
            '<button type="button" id="hubBackBtn" aria-label="Go back">' +
                '<span class="hb-ar" aria-hidden="true">‹</span>' +
                '<span class="hb-tx"></span>' +
            '</button>';
        (document.body || document.documentElement).appendChild(el);
        el.querySelector('#hubBackBtn').addEventListener('click', function (e) {
            e.preventDefault(); window._hubBack();
        });
        injectBackStyles();
        return el;
    }

    function syncBackBar() {
        var el = ensureBackBar();
        var t = (isTopMode() ? backTarget() : null);
        var app = document.getElementById('appContainer');
        if (!t) {
            el.classList.remove('show');
            if (app) app.classList.remove('hub-back-on');
            return;
        }
        el.querySelector('.hb-tx').textContent = 'Back to ' + t.text;
        el.classList.add('show');
        if (app) app.classList.add('hub-back-on');
    }

    function injectBackStyles() {
        if (document.getElementById('hubBackStyles')) return;
        var s = document.createElement('style');
        s.id = 'hubBackStyles';
        s.textContent =
            '#hubBackBar{position:fixed;z-index:1200;left:max(1rem,env(safe-area-inset-left));' +
            'top:calc(var(--hub-header-h,86px) + 0.7rem);opacity:0;visibility:hidden;transform:translateY(-6px);' +
            'transition:opacity .18s ease,transform .18s ease,visibility .18s;pointer-events:none;}' +
            '#hubBackBar.show{opacity:1;visibility:visible;transform:none;pointer-events:auto;}' +
            '#hubBackBtn{display:inline-flex;align-items:center;gap:.5rem;cursor:pointer;' +
            'padding:.6rem 1.05rem .6rem .85rem;border-radius:999px;border:1px solid rgba(34,199,240,.35);' +
            'background:linear-gradient(180deg,#1f2a39,#18212e);color:#e9f2f8;font-weight:700;font-size:.85rem;' +
            'font-family:inherit;box-shadow:0 10px 26px -12px rgba(0,0,0,.65);' +
            '-webkit-tap-highlight-color:transparent;-webkit-appearance:none;appearance:none;' +
            'transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease;}' +
            '#hubBackBtn:hover{transform:translateX(-2px);border-color:rgba(34,199,240,.75);' +
            'box-shadow:0 14px 30px -12px rgba(34,199,240,.5);}' +
            '#hubBackBtn:active{transform:scale(.97);}' +
            '#hubBackBtn:focus-visible{outline:2px solid #22c7f0;outline-offset:3px;}' +
            '#hubBackBtn .hb-ar{font-size:1.25rem;line-height:1;color:#22c7f0;margin-top:-2px;}' +
            /* Mobile / iOS Safari: move to the thumb zone, clear the home bar */
            '@media (max-width:768px){' +
            '#hubBackBar{top:auto;bottom:calc(1rem + env(safe-area-inset-bottom));' +
            'left:50%;transform:translate(-50%,8px);}' +
            '#hubBackBar.show{transform:translate(-50%,0);}' +
            '#hubBackBtn{padding:.72rem 1.25rem .72rem 1rem;font-size:.9rem;' +
            'box-shadow:0 12px 30px -8px rgba(0,0,0,.55);}' +
            '#hubBackBtn:hover{transform:none;}}' +
            /* Give the page room so the pill never covers content */
            '.hub-back-on .main-content{padding-top:4.2rem;}' +
            '@media (max-width:768px){.hub-back-on .main-content{padding-top:1rem;' +
            'padding-bottom:calc(5.5rem + env(safe-area-inset-bottom));}}' +
            '@media (prefers-reduced-motion:reduce){#hubBackBar,#hubBackBtn{transition:none;}}' +
            '@media print{#hubBackBar{display:none !important;}' +
            '.hub-back-on .main-content{padding-top:0;padding-bottom:0;}}';
        (document.head || document.documentElement).appendChild(s);
    }

    // Re-evaluate whenever #mainContent is re-rendered by ANY view, so the
    // pill is correct on every page without each view having to call us.
    function watchMain() {
        var main = document.getElementById('mainContent');
        if (!main || main._hubWatched || typeof MutationObserver === 'undefined') return;
        main._hubWatched = true;
        var pending = null;
        new MutationObserver(function () {
            clearTimeout(pending);
            pending = setTimeout(syncBackBar, 60);   // coalesce burst re-renders
        }).observe(main, { childList: true });
    }

    // Keep the desktop pill clear of the sticky header, whatever its height.
    function measureHeader() {
        var h = document.querySelector('.header');
        if (h) document.documentElement.style.setProperty('--hub-header-h', h.offsetHeight + 'px');
    }

    window.addEventListener('popstate', function (ev) {
        if (!isTopMode()) return;
        var st = ev.state && ev.state.hubNav;
        _suppressPush = true;
        try {
            if (!st || st.level === 'hub') { _nav = { level: 'hub' }; window.showManagementHub(); }
            else if (st.level === 'reports') { _nav = st; window.showReportsCenter(); }
            else if (st.level === 'phase' && st.phaseKey) { _nav = st; window._hubOpenPhase(st.phaseKey); }
            else { _nav = st; syncBackBar(); }
        } finally { _suppressPush = false; }
    });

    // Header logo -> home (management mode only). Bind once.
    function bindLogoHome() {
        measureHeader();
        window.addEventListener('resize', measureHeader);
        ensureBackBar();
        watchMain();
        syncBackBar();
        // Role/mode is applied asynchronously after login — re-check briefly.
        [400, 1200, 2500].forEach(function (ms) {
            setTimeout(function () { watchMain(); syncBackBar(); measureHeader(); }, ms);
        });
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
