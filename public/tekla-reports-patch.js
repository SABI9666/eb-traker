// tekla-reports-patch.js
// COO / Director "Software Report" view — model progress pushed automatically
// from Tekla Structures workstations (see EB-Backend/TEKLA_INTEGRATION.md).
//
// STRICT BY DESIGN:
//   - View is COO/Director only (backend enforces; nav item is management-only).
//   - There is NO manual entry or CSV upload in the portal. Reports are
//     accepted exclusively from the Tekla plugin/watcher via the machine API
//     key, so designers cannot type or manipulate figures.
//
// Data source: /api/tekla-reports (GET list + summary, GET ?id= detail,
// DELETE for COO/Director). Loaded by bdm-po-patch.js. Uses window.apiCall.

(function () {
    'use strict';

    var ACCENT = '#0e7490'; // uniform stat accent (matches BDM Analytics tiles)

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

    function fmtTon(v) {
        var n = num(v);
        return n.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' T';
    }
    function fmtDate(iso) {
        if (!iso) return '—';
        var d = new Date(iso);
        if (isNaN(d)) return '—';
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' }) +
            ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }

    function role() {
        var el = document.getElementById('userRole');
        return el ? String(el.textContent || '').trim().toLowerCase() : '';
    }
    function isMgmt() { var r = role(); return r === 'coo' || r === 'director'; }

    function statCard(value, label, titleFull) {
        var t = titleFull ? ' title="' + esc(titleFull) + '"' : '';
        return '<div' + t + ' style="border-top:3px solid ' + ACCENT + '; padding:1.15rem 1.1rem; background:#fff; border:1px solid #e6ebf2; border-radius:14px; box-shadow:0 10px 28px -14px rgba(15,23,42,0.18);">' +
            '<div style="color:' + ACCENT + '; font-size:1.5rem; font-weight:800; line-height:1.15;">' + value + '</div>' +
            '<div style="font-size:0.72rem; letter-spacing:0.6px; text-transform:uppercase; color:#64748b; margin-top:0.4rem; font-weight:600;">' + label + '</div>' +
        '</div>';
    }

    // Professional progress bar. Color communicates health:
    // <40% amber-red, 40-79% amber, >=80% green; unknown -> neutral dash.
    function progressBar(percent, width) {
        if (percent === null || percent === undefined) {
            return '<span style="color:#94a3b8;">—</span>';
        }
        var p = Math.max(0, Math.min(100, num(percent)));
        var color = p >= 80 ? '#10b981' : (p >= 40 ? '#f59e0b' : '#ef4444');
        return '<div style="display:flex; align-items:center; gap:8px; min-width:' + (width || 120) + 'px;">' +
            '<div style="flex:1; height:8px; background:#e8edf4; border-radius:6px; overflow:hidden;">' +
                '<div style="width:' + p + '%; height:100%; background:' + color + '; border-radius:6px;"></div>' +
            '</div>' +
            '<span style="font-size:0.75rem; font-weight:700; color:' + color + '; min-width:38px; text-align:right;">' + p.toFixed(0) + '%</span>' +
        '</div>';
    }

    function pendingSummary(r) {
        var items = [];
        if (Array.isArray(r.pendingItems)) items = items.concat(r.pendingItems);
        if (r.progress && Array.isArray(r.progress.derivedPending)) items = items.concat(r.progress.derivedPending);
        return items;
    }

    // Same normalization as the server's planDocId()
    function planKey(projectNumber) {
        return String(projectNumber || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    }
    function planFor(projectNumber) {
        return (_cache.plans || {})[planKey(projectNumber)] || null;
    }

    var _cache = { reports: [], models: [], summary: {} };

    window.showTeklaReports = async function () {
        var main = document.getElementById('mainContent');
        if (!main) return;
        if (typeof window.setActiveNav === 'function') { try { window.setActiveNav('nav-tekla-reports'); } catch (e) {} }

        if (!isMgmt()) {
            main.innerHTML =
                '<div class="page-header"><h2>📐 Software Report</h2></div>' +
                '<div class="card" style="padding:2rem; text-align:center; color:#b91c1c;">🔒 The Software Report is visible to COO and Director only.</div>';
            return;
        }

        main.innerHTML =
            '<div class="page-header">' +
                '<h2>📐 Software Report</h2>' +
                '<p class="subtitle">Live modeling progress from Tekla Structures workstations — automated push only, no manual entry.</p>' +
            '</div>' +
            '<div class="card" style="text-align:center; padding:2.5rem;">⏳ Loading software report…</div>';

        var resp;
        try {
            resp = await window.apiCall('tekla-reports');
        } catch (e) { renderError(main, e.message); return; }
        if (!resp || !resp.success) { renderError(main, (resp && resp.error) || 'Failed to load'); return; }

        _cache = resp.data || { reports: [], models: [], summary: {} };
        renderView(main);
    };

    function renderError(main, msg) {
        main.innerHTML =
            '<div class="page-header"><h2>📐 Software Report</h2></div>' +
            '<div class="card" style="padding:2rem; text-align:center;">' +
                '<p style="color:#b91c1c; margin-bottom:1rem;">⚠️ ' + esc(msg) + '</p>' +
                '<button class="btn btn-primary" onclick="showTeklaReports()">🔄 Retry</button>' +
            '</div>';
    }

    function renderView(main) {
        var s = _cache.summary || {};
        var models = _cache.models || [];
        var drawings = (s.drawingsIssued || 0) + ' / ' + (s.drawingsTotal || 0);
        var avg = (s.avgCompletion === null || s.avgCompletion === undefined) ? '—' : s.avgCompletion + '%';

        main.innerHTML =
            '<div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:1rem;">' +
                '<div>' +
                    '<h2>📐 Software Report</h2>' +
                    '<p class="subtitle">Live modeling progress pushed automatically from Tekla Structures. Latest report per model drives the totals.</p>' +
                    '<div style="margin-top:0.45rem;">' + capabilityChip() + '</div>' +
                '</div>' +
                '<button class="btn btn-outline btn-sm" onclick="showTeklaReports()">🔄 Refresh</button>' +
            '</div>' +

            '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(175px, 1fr)); gap:1rem; margin-bottom:1.25rem;">' +
                statCard(avg, '📊 Avg Completion') +
                statCard(s.modelCount || 0, '🏗️ Models Tracked') +
                statCard((s.pendingModels || 0), '⏳ Models With Pending Work') +
                statCard(fmtTon(s.totalTonnage), '⚖️ Modeled Tonnage', (s.totalTonnage || 0) + ' tonnes') +
                statCard(drawings, '📄 Drawings Issued / Total') +
            '</div>' +

            statusBuilderHtml() +
            '<div id="teklaStatusOut"></div>' +

            renderModelProgress(models) +

            '<div class="card" style="padding:1.25rem;">' +
                '<h3 style="margin:0 0 1rem;">Report History</h3>' +
                '<div style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-bottom:1rem; align-items:center;">' +
                    '<input id="teklaFilterText" class="form-control" placeholder="🔍 Filter by project / model…" style="max-width:280px;" oninput="window._teklaFilter()">' +
                '</div>' +
                '<div style="overflow-x:auto;">' +
                    '<table class="data-table"><thead><tr>' +
                        '<th>Date</th><th>Project</th><th>Model</th><th>Phase</th>' +
                        '<th style="min-width:150px;">Completion</th>' +
                        '<th style="text-align:right;">Tonnage</th>' +
                        '<th style="text-align:right;">Drawings</th>' +
                        '<th>Workstation</th><th></th>' +
                    '</tr></thead><tbody id="teklaRows"></tbody></table>' +
                '</div>' +
            '</div>';

        renderRows(_cache.reports);
    }

    // ═════════════════════════════════════════════════════════════════════
    // PROJECT STATUS REPORT BUILDER
    // Pick a project → work type (Steel / Rebar) → activities → generate a
    // per-activity status report. UI phase: Modeling & Drawing status come
    // from the live Tekla push; other activities show as awaiting data until
    // the per-activity backend feed is enabled.
    // ═════════════════════════════════════════════════════════════════════
    var ACTIVITIES = {
        steel: [
            { key: 'modeling',   icon: '🧩', label: '3D Modeling' },
            { key: 'connection', icon: '🔩', label: 'Connection Design' },
            { key: 'detailing',  icon: '📐', label: 'Detailing' },
            { key: 'drafting',   icon: '📄', label: 'Drawing Production' },
            { key: 'checking',   icon: '✅', label: 'Checking' },
            { key: 'revisions',  icon: '♻️', label: 'Revisions' },
            { key: 'nc',         icon: '⚙️', label: 'NC / DSTV Files' },
            { key: 'ifc',        icon: '📤', label: 'IFC / Issue' }
        ],
        rebar: [
            { key: 'modeling',  icon: '🧩', label: '3D Modeling' },
            { key: 'detailing', icon: '📐', label: 'Detailing' },
            { key: 'bbs',       icon: '🧾', label: 'Bar Bending Schedule' },
            { key: 'drafting',  icon: '📄', label: 'Drawing Production' },
            { key: 'checking',  icon: '✅', label: 'Checking' },
            { key: 'revisions', icon: '♻️', label: 'Revisions' },
            { key: 'ifc',       icon: '📤', label: 'IFC / Issue' }
        ]
    };
    var _sel = { workType: 'steel' };

    function distinctProjects() {
        var seen = {}, out = [];
        (_cache.reports || []).forEach(function (r) {
            var pn = String(r.projectNumber || '').trim();
            if (!pn || seen[pn]) return;
            seen[pn] = 1;
            out.push({ number: pn, name: String(r.projectName || '').trim() });
        });
        return out;
    }

    function statusBuilderHtml() {
        var projects = distinctProjects();
        var opts = projects.length
            ? '<option value="">Select a project…</option>' + projects.map(function (p) {
                return '<option value="' + esc(p.number) + '">' + esc(p.number) + (p.name ? ' — ' + esc(p.name) : '') + '</option>';
              }).join('')
            : '<option value="">No projects reported yet</option>';

        return '<div class="card" style="padding:1.4rem 1.5rem; margin-bottom:1.25rem; border-top:3px solid ' + ACCENT + ';">' +
            '<div style="display:flex; align-items:center; gap:0.7rem; margin-bottom:0.35rem;">' +
                '<div style="width:40px; height:40px; border-radius:11px; background:linear-gradient(135deg,#22c7f0,#0e9ed1); display:flex; align-items:center; justify-content:center; font-size:1.2rem; color:#fff;">📋</div>' +
                '<div><h3 style="margin:0; font-size:1.1rem;">Project Status Report</h3>' +
                '<div style="color:#64748b; font-size:0.78rem;">Select project → work type → activities, then generate the status report.</div></div>' +
            '</div>' +
            '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:0.9rem; margin-top:1rem; align-items:end;">' +
                '<div><label style="display:block; font-size:0.7rem; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; color:#64748b; margin-bottom:0.35rem;">1 · Project</label>' +
                    '<select id="tkStProject" class="form-control">' + opts + '</select></div>' +
                '<div><label style="display:block; font-size:0.7rem; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; color:#64748b; margin-bottom:0.35rem;">2 · Work Type</label>' +
                    '<div style="display:flex; border:1px solid #e6ebf2; border-radius:10px; overflow:hidden;">' +
                        workTypeBtn('steel', '🏗️ Steel') + workTypeBtn('rebar', '🧱 Rebar') +
                    '</div></div>' +
            '</div>' +
            '<div style="margin-top:1rem;">' +
                '<div style="display:flex; align-items:center; gap:0.8rem; margin-bottom:0.45rem;">' +
                    '<label style="font-size:0.7rem; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; color:#64748b;">3 · Activities</label>' +
                    '<a href="#" onclick="window._tkStAll(true); return false;" style="font-size:0.72rem; color:' + ACCENT + '; font-weight:600;">Select all</a>' +
                    '<a href="#" onclick="window._tkStAll(false); return false;" style="font-size:0.72rem; color:#94a3b8; font-weight:600;">Clear</a>' +
                '</div>' +
                '<div id="tkStActs" style="display:flex; flex-wrap:wrap; gap:0.45rem;">' + actChipsHtml() + '</div>' +
            '</div>' +
            '<div style="margin-top:1.15rem; display:flex; gap:0.7rem; flex-wrap:wrap;">' +
                '<button class="btn btn-primary" onclick="window._tkStGenerate()">📊 Generate Status Report</button>' +
            '</div>' +
        '</div>';
    }

    function workTypeBtn(type, label) {
        var on = _sel.workType === type;
        return '<button type="button" onclick="window._tkStType(\'' + type + '\')" style="flex:1; padding:0.62rem 0.6rem; border:none; cursor:pointer; font-weight:700; font-size:0.85rem; ' +
            (on ? 'background:linear-gradient(135deg,#22c7f0,#0e9ed1); color:#fff;' : 'background:#f5f8fb; color:#475569;') + '">' + label + '</button>';
    }

    function actChipsHtml() {
        return ACTIVITIES[_sel.workType].map(function (a) {
            return '<div data-act="' + a.key + '" data-on="1" onclick="window._tkStToggle(this)" style="' + chipStyle(true) + '">' +
                a.icon + ' ' + a.label + '</div>';
        }).join('');
    }
    function chipStyle(on) {
        return 'cursor:pointer; user-select:none; font-size:0.8rem; font-weight:600; padding:0.42rem 0.8rem; border-radius:20px; transition:all .15s;' +
            (on ? 'background:rgba(34,199,240,0.12); border:1.5px solid ' + ACCENT + '; color:#0e7490;'
                : 'background:#f5f8fb; border:1.5px solid #e6ebf2; color:#7c8aa0;');
    }

    window._tkStType = function (type) {
        _sel.workType = type;
        var host = document.getElementById('tkStActs');
        if (host) host.innerHTML = actChipsHtml();
        // re-render the two segment buttons
        var seg = host && host.closest('.card').querySelectorAll('button[onclick^="window._tkStType"]');
        if (seg && seg.length === 2) {
            seg[0].outerHTML = workTypeBtn('steel', '🏗️ Steel');
            seg[1].outerHTML = workTypeBtn('rebar', '🧱 Rebar');
        }
    };
    window._tkStToggle = function (el) {
        var on = el.getAttribute('data-on') === '1' ? '0' : '1';
        el.setAttribute('data-on', on);
        el.style.cssText = chipStyle(on === '1');
    };
    window._tkStAll = function (on) {
        document.querySelectorAll('#tkStActs [data-act]').forEach(function (el) {
            el.setAttribute('data-on', on ? '1' : '0');
            el.style.cssText = chipStyle(on);
        });
    };

    function latestForProject(pn) {
        var hit = null;
        (_cache.reports || []).forEach(function (r) {
            if (hit) return;
            if (String(r.projectNumber || '').trim() === pn) hit = r; // list is newest-first
        });
        return hit;
    }

    // Does the DEPLOYED api accept per-process figures? It says so on every
    // GET; an older revision sends no capabilities block at all.
    function backendSupportsActivities() {
        var c = _cache.capabilities;
        return !!(c && c.activities);
    }

    // The macro always sends an `activities` block. A stored report without
    // one has exactly two causes, and they need different fixes — so name
    // which one it is rather than showing eight "awaiting data" rows that
    // look like the designer never pushed.
    function staleBackendWarning(rep) {
        if (!rep) return '';
        if (Object.keys(rep.activities || {}).length) return '';

        var box = 'margin-bottom:0.9rem; padding:0.85rem 1.05rem; border-radius:12px; font-size:0.8rem; line-height:1.5;';

        if (!backendSupportsActivities()) {
            // Cause 1: the running API cannot store per-process data at all.
            return '<div style="' + box + ' background:rgba(239,68,68,0.09); border:1px solid rgba(239,68,68,0.35); color:#b91c1c;">' +
                '<strong>⚠️ The backend cannot store per-process data yet.</strong><br>' +
                'The deployed API is an older revision — it keeps model totals (tonnage, parts, assemblies) but discards the ' +
                'per-process percentages the macro sends. Redeploy <code>west-epcm-backend</code> from the latest <code>main</code>, ' +
                'then push again from Tekla. <b>Reports already stored cannot be repaired</b> — the figures were dropped on arrival.' +
            '</div>';
        }
        // Cause 2: backend is current; this report was written before it was.
        return '<div style="' + box + ' background:rgba(245,158,11,0.10); border:1px solid rgba(245,158,11,0.35); color:#92400e;">' +
            '<strong>⚠️ This report predates the per-process update.</strong><br>' +
            'The backend now accepts per-process figures, but this push was stored before it did, so its percentages are gone for good. ' +
            'Open the model in Tekla and run <b>PushDailyStatus</b> once more — the next push will carry every process.' +
        '</div>';
    }

    // Header chip: is per-process reporting live end to end, right now?
    function capabilityChip() {
        var ok = backendSupportsActivities();
        var style = 'display:inline-flex; align-items:center; gap:6px; font-size:0.7rem; font-weight:700; letter-spacing:0.4px; padding:4px 10px; border-radius:20px;';
        return ok
            ? '<span title="The deployed API accepts per-process percentages from the Tekla macro" style="' + style + ' background:rgba(16,185,129,0.13); color:#059669;">● Per-process reporting live</span>'
            : '<span title="The deployed API is an older revision and discards per-process percentages" style="' + style + ' background:rgba(239,68,68,0.11); color:#b91c1c;">● Backend needs redeploy</span>';
    }

    // Computed by the macro from the model vs. typed by the designer —
    // management asked to be able to tell the two apart at a glance.
    function srcTag(src) {
        if (src === 'auto') {
            return '<span title="Calculated from the model by the Tekla macro" style="margin-left:0.45rem; font-size:0.55rem; font-weight:800; letter-spacing:0.7px; padding:2px 6px; border-radius:8px; background:rgba(6,182,212,0.14); color:#0e7490; vertical-align:middle;">AUTO</span>';
        }
        if (src === 'manual') {
            return '<span title="Entered by the designer" style="margin-left:0.45rem; font-size:0.55rem; font-weight:800; letter-spacing:0.7px; padding:2px 6px; border-radius:8px; background:#eef2f7; color:#94a3b8; vertical-align:middle;">TYPED</span>';
        }
        return '';
    }

    // Map an activity to live data where the Tekla push already provides it.
    function activityStatus(key, rep) {
        var pr = (rep && rep.progress) || {};
        var m = (rep && rep.metrics) || {};
        var acts = (rep && rep.activities) || {};
        var a = acts[key];

        // 1) Per-activity figures pushed from the Tekla workstation (daily
        //    status push) — the authoritative source for every process.
        if (a && a.percent !== null && a.percent !== undefined) {
            var bits = [];
            if (a.total > 0) bits.push(a.done + ' / ' + a.total + (a.unit ? ' ' + a.unit : ''));
            if (a.note) bits.push(a.note);
            if (!bits.length && key === 'modeling' && m.tonnage) bits.push(fmtTon(m.tonnage) + ' modeled');
            return { pct: a.percent, meta: bits.join(' · ') || null, live: true, src: a.source || 'manual' };
        }

        // 2) Fall back to figures derived from the raw model metrics.
        if (key === 'modeling') {
            return { pct: pr.modelingPercent, meta: (m.tonnage ? fmtTon(m.tonnage) + ' modeled' : null), live: true };
        }
        if (key === 'drafting') {
            var dr = (m.drawingsTotal || m.drawingsIssued) ? ((m.drawingsIssued || 0) + ' / ' + (m.drawingsTotal || 0) + ' drawings issued') : null;
            return { pct: pr.drawingPercent, meta: dr, live: true };
        }
        return { pct: null, meta: null, live: false };
    }

    window._tkStGenerate = function () {
        var out = document.getElementById('teklaStatusOut');
        var sel = document.getElementById('tkStProject');
        if (!out) return;
        var pn = sel ? sel.value : '';
        if (!pn) { alert('Please select a project first.'); return; }

        var acts = [];
        document.querySelectorAll('#tkStActs [data-act]').forEach(function (el) {
            if (el.getAttribute('data-on') === '1') acts.push(el.getAttribute('data-act'));
        });
        if (!acts.length) { alert('Select at least one activity.'); return; }

        var defs = ACTIVITIES[_sel.workType].filter(function (a) { return acts.indexOf(a.key) !== -1; });
        var rep = latestForProject(pn);
        var pname = rep && rep.projectName ? rep.projectName : '';
        var wt = _sel.workType === 'steel' ? '🏗️ Steel' : '🧱 Rebar';

        var doneCt = 0, progCt = 0, waitCt = 0;
        var rows = defs.map(function (a) {
            var st = activityStatus(a.key, rep);
            var pill, pillStyle;
            if (st.pct !== null && st.pct !== undefined) {
                if (st.pct >= 100) { pill = 'COMPLETE'; pillStyle = 'background:rgba(16,185,129,0.14); color:#059669;'; doneCt++; }
                else if (st.pct > 0) { pill = 'IN PROGRESS'; pillStyle = 'background:rgba(245,158,11,0.16); color:#b45309;'; progCt++; }
                else { pill = 'NOT STARTED'; pillStyle = 'background:rgba(239,68,68,0.12); color:#dc2626;'; waitCt++; }
            } else {
                pill = 'AWAITING DATA'; pillStyle = 'background:#eef2f7; color:#94a3b8;'; waitCt++;
            }
            return '<div style="display:grid; grid-template-columns:minmax(170px,220px) 110px 1fr minmax(140px,200px); gap:0.9rem; align-items:center; padding:0.85rem 1.1rem; background:#fff; border:1px solid #e6ebf2; border-radius:12px;">' +
                '<div style="font-weight:700; color:#0f172a; font-size:0.9rem;">' + a.icon + ' ' + a.label + srcTag(st.src) + '</div>' +
                '<span style="justify-self:start; font-size:0.62rem; font-weight:800; letter-spacing:0.6px; padding:3px 9px; border-radius:10px; ' + pillStyle + '">' + pill + '</span>' +
                progressBar(st.pct, 140) +
                '<div style="font-size:0.74rem; color:#64748b; text-align:right;">' +
                    (st.meta ? esc(st.meta) : (st.live ? '—' : 'Awaiting workstation data')) +
                '</div>' +
            '</div>';
        }).join('');

        out.innerHTML =
            '<div class="card" style="padding:1.4rem 1.5rem; margin-bottom:1.25rem;" id="tkStReport">' +
                '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; flex-wrap:wrap; margin-bottom:1rem;">' +
                    '<div>' +
                        '<div style="font-size:0.68rem; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:#94a3b8;">Status Report · ' + wt + '</div>' +
                        '<h3 style="margin:0.15rem 0 0.1rem; font-size:1.25rem;">' + esc(pn) + (pname ? ' — ' + esc(pname) : '') + '</h3>' +
                        '<div style="color:#64748b; font-size:0.78rem;">Generated ' + fmtDate(new Date().toISOString()) +
                            (rep ? ' · latest Tekla push ' + fmtDate(rep.createdAt) : ' · no Tekla data received for this project yet') + '</div>' +
                    '</div>' +
                    '<div style="display:flex; gap:0.5rem;">' +
                        '<button class="btn btn-outline btn-sm" onclick="window.print()">🖨️ Print / PDF</button>' +
                    '</div>' +
                '</div>' +
                '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:0.7rem; margin-bottom:1.1rem;">' +
                    statCard(defs.length, 'Activities') +
                    statCard(doneCt, '✔ Complete') +
                    statCard(progCt, '⏳ In Progress') +
                    statCard(waitCt, '○ Pending / No Data') +
                '</div>' +
                staleBackendWarning(rep) +
                '<div style="display:flex; flex-direction:column; gap:0.55rem; overflow-x:auto;">' + rows + '</div>' +
                '<div style="margin-top:0.9rem; font-size:0.72rem; color:#94a3b8;">Percentages marked AUTO are calculated by the macro from the model itself. Processes with no reliable signal in the model (checking, revisions, connection design) are reported by the designer.</div>' +
            '</div>';
        out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Model progress board: one card per model (latest report) with modeling %,
    // drawing % and the outstanding work list — the "what's pending" view.
    function renderModelProgress(models) {
        if (!models.length) {
            return '<div class="card" style="padding:2rem; text-align:center; color:#64748b; margin-bottom:1.25rem;">' +
                'No models reported yet. Once the Tekla workstations start pushing (TEKLA_INTEGRATION.md), progress appears here automatically.</div>';
        }
        var cards = models.map(function (r) {
            var pr = r.progress || {};
            var pend = pendingSummary(r);
            var plan = planFor(r.projectNumber);
            var hasPlan = plan && (Number(plan.plannedTonnage) > 0 || Number(plan.targetDrawings) > 0);
            var pendHtml;
            if (pend.length) {
                pendHtml = '<ul style="margin:0.5rem 0 0; padding-left:1.1rem; color:#b45309; font-size:0.78rem;">' +
                    pend.slice(0, 6).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') +
                    (pend.length > 6 ? '<li>+' + (pend.length - 6) + ' more…</li>' : '') +
                  '</ul>';
            } else if (hasPlan || pr.overallPercent !== null) {
                pendHtml = '<div style="margin-top:0.5rem; color:#059669; font-size:0.78rem; font-weight:600;">✔ No pending work</div>';
            } else {
                pendHtml = '<div style="margin-top:0.5rem; color:#b45309; font-size:0.78rem;">⚠ Set the plan targets to see completion % and pending work.</div>';
            }
            var planLine = hasPlan
                ? '<div style="margin-top:0.45rem; font-size:0.72rem; color:#64748b;">🎯 Plan: ' +
                    (Number(plan.plannedTonnage) > 0 ? Number(plan.plannedTonnage).toLocaleString() + ' T' : '—') +
                    ' · ' + (Number(plan.targetDrawings) > 0 ? plan.targetDrawings + ' drawings' : '— drawings') + '</div>'
                : '';
            return '<div class="card" style="padding:1.1rem 1.2rem; margin:0;">' +
                '<div style="display:flex; justify-content:space-between; align-items:baseline; gap:0.5rem; flex-wrap:wrap;">' +
                    '<div><strong>' + esc(r.modelName || r.projectNumber || 'Model') + '</strong>' +
                        '<span style="color:#64748b; font-size:0.78rem;"> &nbsp;' + esc(r.projectNumber || '') + (r.phase ? ' · ' + esc(r.phase) : '') + '</span></div>' +
                    '<span style="color:#94a3b8; font-size:0.72rem;">' + fmtDate(r.createdAt) + '</span>' +
                '</div>' +
                '<div style="display:grid; grid-template-columns:auto 1fr; gap:0.35rem 0.8rem; margin-top:0.7rem; align-items:center;">' +
                    '<span style="font-size:0.72rem; color:#64748b; font-weight:600;">MODELING</span>' + progressBar(pr.modelingPercent, 160) +
                    '<span style="font-size:0.72rem; color:#64748b; font-weight:600;">DRAWINGS</span>' + progressBar(pr.drawingPercent, 160) +
                    '<span style="font-size:0.72rem; color:#0f172a; font-weight:800;">OVERALL</span>' + progressBar(pr.overallPercent, 160) +
                '</div>' +
                planLine +
                pendHtml +
                '<div style="margin-top:0.65rem;">' +
                    '<button class="btn btn-outline btn-sm" onclick="window._teklaSetPlan(\'' + esc(r.projectNumber || '') + '\')">🎯 ' + (hasPlan ? 'Edit Plan' : 'Set Plan') + '</button>' +
                '</div>' +
            '</div>';
        }).join('');
        return '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:1rem; margin-bottom:1.25rem;">' + cards + '</div>';
    }

    function renderRows(list) {
        var tbody = document.getElementById('teklaRows');
        if (!tbody) return;
        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#64748b; padding:2rem;">No reports received yet.</td></tr>';
            return;
        }
        tbody.innerHTML = list.map(function (r) {
            var m = r.metrics || {}, pr = r.progress || {};
            var dr = (m.drawingsTotal || m.drawingsIssued) ? ((m.drawingsIssued || 0) + '/' + (m.drawingsTotal || 0)) : '—';
            return '<tr style="cursor:pointer;" onclick="window._teklaDetail(\'' + esc(r.id) + '\')">' +
                '<td style="white-space:nowrap;">' + fmtDate(r.createdAt) + '</td>' +
                '<td><strong>' + esc(r.projectNumber || '—') + '</strong>' + (r.projectName ? '<div style="font-size:0.75rem; color:#64748b;">' + esc(r.projectName) + '</div>' : '') + '</td>' +
                '<td>' + esc(r.modelName || '—') + '</td>' +
                '<td>' + esc(r.phase || '—') + '</td>' +
                '<td>' + progressBar(pr.overallPercent, 130) + '</td>' +
                '<td style="text-align:right; font-weight:600;">' + (m.tonnage ? fmtTon(m.tonnage) : '—') + '</td>' +
                '<td style="text-align:right;">' + dr + '</td>' +
                '<td style="font-size:0.8rem;">' + esc(r.reportedByName || '—') + '</td>' +
                '<td><button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); window._teklaDelete(\'' + esc(r.id) + '\')">🗑️</button></td>' +
            '</tr>';
        }).join('');
    }

    window._teklaFilter = function () {
        var q = ((document.getElementById('teklaFilterText') || {}).value || '').toLowerCase();
        renderRows(_cache.reports.filter(function (r) {
            return !q || (String(r.projectNumber || '') + ' ' + String(r.projectName || '') + ' ' + String(r.modelName || '')).toLowerCase().indexOf(q) !== -1;
        }));
    };

    // Exactly what the workstation reported, process by process — the place
    // to look when a figure in the status report is questioned.
    function activityTableHtml(r) {
        var acts = (r && r.activities) || {};
        var keys = Object.keys(acts);
        if (!keys.length) {
            return '<h4 style="margin:0.5rem 0;">🧩 Process Progress</h4>' +
                '<p style="color:#b45309; font-size:0.85rem; margin:0 0 1rem;">This push carried no per-process data — see the warning in the status report.</p>';
        }
        var labelOf = {};
        ['steel', 'rebar'].forEach(function (t) {
            ACTIVITIES[t].forEach(function (a) { labelOf[a.key] = a.icon + ' ' + a.label; });
        });
        var body = keys.map(function (k) {
            var a = acts[k] || {};
            return '<tr>' +
                '<td>' + esc(labelOf[k] || k) + srcTag(a.source) + '</td>' +
                '<td style="min-width:150px;">' + progressBar(a.percent, 130) + '</td>' +
                '<td style="text-align:right;">' + (a.total > 0 ? esc(a.done + ' / ' + a.total + (a.unit ? ' ' + a.unit : '')) : '—') + '</td>' +
                '<td style="font-size:0.78rem; color:#64748b;">' + esc(a.note || '') + '</td>' +
            '</tr>';
        }).join('');
        return '<h4 style="margin:0.5rem 0;">🧩 Process Progress</h4>' +
            '<div style="overflow-x:auto; margin-bottom:1rem;"><table class="data-table"><thead><tr>' +
            '<th>Process</th><th>Complete</th><th style="text-align:right;">Done / Total</th><th>Basis</th>' +
            '</tr></thead><tbody>' + body + '</tbody></table></div>';
    }

    // ── Detail modal ────────────────────────────────────────────────────────
    window._teklaDetail = async function (id) {
        var resp;
        try { resp = await window.apiCall('tekla-reports?id=' + encodeURIComponent(id)); }
        catch (e) { alert('Failed to load report: ' + e.message); return; }
        if (!resp || !resp.success) { alert('Failed to load report'); return; }
        var r = resp.data, m = r.metrics || {}, pr = r.progress || {};
        var pend = pendingSummary(r);

        var rowsHtml = '';
        if (Array.isArray(r.rows) && r.rows.length) {
            var cols = Object.keys(r.rows[0]);
            rowsHtml = '<h4 style="margin:1rem 0 0.5rem;">Detail Rows (' + r.rows.length + ')</h4>' +
                '<div style="max-height:260px; overflow:auto;"><table class="data-table"><thead><tr>' +
                cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') +
                '</tr></thead><tbody>' +
                r.rows.map(function (row) {
                    return '<tr>' + cols.map(function (c) { return '<td>' + esc(row[c]) + '</td>'; }).join('') + '</tr>';
                }).join('') + '</tbody></table></div>';
        }

        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML =
            '<div class="modal-content" style="max-width:720px; max-height:88vh; overflow-y:auto;">' +
                '<div class="modal-header"><h2>📐 ' + esc(r.modelName || r.projectNumber) + '</h2>' +
                '<span class="close-modal" onclick="this.closest(\'.modal-overlay\').remove()">&times;</span></div>' +
                '<div style="padding:1.25rem;">' +
                    '<div style="display:grid; grid-template-columns:auto 1fr; gap:0.4rem 0.9rem; margin-bottom:1rem; align-items:center; max-width:420px;">' +
                        '<span style="font-size:0.75rem; color:#64748b; font-weight:600;">MODELING</span>' + progressBar(pr.modelingPercent, 200) +
                        '<span style="font-size:0.75rem; color:#64748b; font-weight:600;">DRAWINGS</span>' + progressBar(pr.drawingPercent, 200) +
                        '<span style="font-size:0.75rem; color:#0f172a; font-weight:800;">OVERALL</span>' + progressBar(pr.overallPercent, 200) +
                    '</div>' +
                    '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px,1fr)); gap:0.75rem; margin-bottom:1rem;">' +
                        statCard(m.tonnage ? fmtTon(m.tonnage) : '—', 'Modeled Tonnage') +
                        statCard((pr.plannedTonnage || m.plannedTonnage) ? fmtTon(pr.plannedTonnage || m.plannedTonnage) : '—', 'Planned Tonnage') +
                        statCard(m.assemblies || 0, 'Assemblies') +
                        statCard(m.parts || 0, 'Parts') +
                        statCard((m.drawingsIssued || 0) + ' / ' + (m.drawingsTotal || 0), 'Drawings') +
                    '</div>' +
                    activityTableHtml(r) +
                    (pend.length
                        ? '<h4 style="margin:0.5rem 0;">⏳ Pending Work</h4><ul style="margin:0 0 1rem; padding-left:1.2rem; color:#b45309;">' +
                            pend.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>'
                        : '<p style="color:#059669; font-weight:600;">✔ No pending work reported</p>') +
                    '<p><strong>Project:</strong> ' + esc(r.projectNumber || '—') + (r.projectName ? ' — ' + esc(r.projectName) : '') + '</p>' +
                    '<p><strong>Phase:</strong> ' + esc(r.phase || '—') + ' &nbsp; <strong>Type:</strong> ' + esc(r.reportType) + '</p>' +
                    '<p><strong>Workstation:</strong> ' + esc(r.reportedByName) + (r.teklaVersion ? ' (Tekla ' + esc(r.teklaVersion) + ')' : '') + ' · ' + fmtDate(r.createdAt) + '</p>' +
                    (r.notes ? '<p><strong>Notes:</strong> ' + esc(r.notes) + '</p>' : '') +
                    rowsHtml +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);
    };

    // ── Plan targets (COO/Director): planned tonnage + target drawings ─────
    window._teklaSetPlan = function (projectNumber) {
        if (!projectNumber) { alert('This report has no project number, so a plan cannot be attached.'); return; }
        var plan = planFor(projectNumber) || {};
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML =
            '<div class="modal-content" style="max-width:460px;">' +
                '<div class="modal-header"><h2>🎯 Plan — ' + esc(projectNumber) + '</h2>' +
                '<span class="close-modal" onclick="this.closest(\'.modal-overlay\').remove()">&times;</span></div>' +
                '<div style="padding:1.25rem;">' +
                    '<p style="color:#64748b; font-size:0.85rem; margin-bottom:1rem;">These are the contract targets that the Tekla actuals are measured against. Only COO/Director can set them.</p>' +
                    '<div class="form-group"><label>Planned Tonnage (T)</label>' +
                        '<input id="tkPlanTonnage" type="number" min="0" step="0.1" class="form-control" value="' + (Number(plan.plannedTonnage) > 0 ? plan.plannedTonnage : '') + '" placeholder="e.g. 4500"></div>' +
                    '<div class="form-group"><label>Target Drawings (count)</label>' +
                        '<input id="tkPlanDrawings" type="number" min="0" step="1" class="form-control" value="' + (Number(plan.targetDrawings) > 0 ? plan.targetDrawings : '') + '" placeholder="e.g. 120"></div>' +
                    '<div style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:1.25rem;">' +
                        '<button class="btn btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button>' +
                        '<button class="btn btn-success" onclick="window._teklaSubmitPlan(this, \'' + esc(projectNumber) + '\')">Save Plan</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);
    };

    window._teklaSubmitPlan = async function (btn, projectNumber) {
        var tEl = document.getElementById('tkPlanTonnage');
        var dEl = document.getElementById('tkPlanDrawings');
        btn.disabled = true;
        try {
            var resp = await window.apiCall('tekla-reports', {
                method: 'PUT',
                body: JSON.stringify({
                    projectNumber: projectNumber,
                    plannedTonnage: tEl ? tEl.value : 0,
                    targetDrawings: dEl ? dEl.value : 0
                })
            });
            if (resp && resp.success) {
                btn.closest('.modal-overlay').remove();
                window.showTeklaReports();
            } else { alert('Save failed: ' + ((resp && resp.error) || 'unknown')); btn.disabled = false; }
        } catch (e) { alert('Save failed: ' + e.message); btn.disabled = false; }
    };

    window._teklaDelete = async function (id) {
        if (!confirm('Delete this Tekla report?')) return;
        try {
            var resp = await window.apiCall('tekla-reports?id=' + encodeURIComponent(id), { method: 'DELETE' });
            if (resp && resp.success) window.showTeklaReports();
            else alert('Delete failed: ' + ((resp && resp.error) || 'unknown'));
        } catch (e) { alert('Delete failed: ' + e.message); }
    };
})();
