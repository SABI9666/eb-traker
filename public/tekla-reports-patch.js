// tekla-reports-patch.js
// COO / Director "Tekla Reports" view — model progress pushed automatically
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

    var _cache = { reports: [], models: [], summary: {} };

    window.showTeklaReports = async function () {
        var main = document.getElementById('mainContent');
        if (!main) return;
        if (typeof window.setActiveNav === 'function') { try { window.setActiveNav('nav-tekla-reports'); } catch (e) {} }

        if (!isMgmt()) {
            main.innerHTML =
                '<div class="page-header"><h2>📐 Tekla Reports</h2></div>' +
                '<div class="card" style="padding:2rem; text-align:center; color:#b91c1c;">🔒 Tekla Reports are visible to COO and Director only.</div>';
            return;
        }

        main.innerHTML =
            '<div class="page-header">' +
                '<h2>📐 Tekla Reports</h2>' +
                '<p class="subtitle">Live modeling progress from Tekla Structures workstations — automated push only, no manual entry.</p>' +
            '</div>' +
            '<div class="card" style="text-align:center; padding:2.5rem;">⏳ Loading Tekla reports…</div>';

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
            '<div class="page-header"><h2>📐 Tekla Reports</h2></div>' +
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
                    '<h2>📐 Tekla Reports</h2>' +
                    '<p class="subtitle">Live modeling progress pushed automatically from Tekla Structures. Latest report per model drives the totals.</p>' +
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
            var pendHtml = pend.length
                ? '<ul style="margin:0.5rem 0 0; padding-left:1.1rem; color:#b45309; font-size:0.78rem;">' +
                    pend.slice(0, 6).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') +
                    (pend.length > 6 ? '<li>+' + (pend.length - 6) + ' more…</li>' : '') +
                  '</ul>'
                : '<div style="margin-top:0.5rem; color:#059669; font-size:0.78rem; font-weight:600;">✔ No pending work reported</div>';
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
                pendHtml +
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
                        statCard(m.plannedTonnage ? fmtTon(m.plannedTonnage) : '—', 'Planned Tonnage') +
                        statCard(m.assemblies || 0, 'Assemblies') +
                        statCard(m.parts || 0, 'Parts') +
                        statCard((m.drawingsIssued || 0) + ' / ' + (m.drawingsTotal || 0), 'Drawings') +
                    '</div>' +
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

    window._teklaDelete = async function (id) {
        if (!confirm('Delete this Tekla report?')) return;
        try {
            var resp = await window.apiCall('tekla-reports?id=' + encodeURIComponent(id), { method: 'DELETE' });
            if (resp && resp.success) window.showTeklaReports();
            else alert('Delete failed: ' + ((resp && resp.error) || 'unknown'));
        } catch (e) { alert('Delete failed: ' + e.message); }
    };
})();
