// tekla-reports-patch.js
// COO / Director "Tekla Reports" view — renders model data pushed from Tekla
// Structures workstations (see EB-Backend/TEKLA_INTEGRATION.md).
//
// Data source: /api/tekla-reports (GET list + summary, GET ?id= detail,
// POST manual/CSV entries, DELETE for COO/Director).
// Loaded by bdm-po-patch.js's patch loader. Uses window.apiCall from app1.js.

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

    var _cache = { reports: [], models: [], summary: {} };

    window.showTeklaReports = async function () {
        var main = document.getElementById('mainContent');
        if (!main) return;
        if (typeof window.setActiveNav === 'function') { try { window.setActiveNav('nav-tekla-reports'); } catch (e) {} }

        main.innerHTML =
            '<div class="page-header">' +
                '<h2>📐 Tekla Reports</h2>' +
                '<p class="subtitle">Model data pushed from Tekla Structures workstations — tonnage, assemblies, parts and drawing status.</p>' +
            '</div>' +
            '<div class="card" style="text-align:center; padding:2.5rem;">⏳ Loading Tekla reports…</div>';

        var resp;
        try {
            resp = await window.apiCall('tekla-reports');
        } catch (e) {
            main.innerHTML += '';
            renderError(main, e.message);
            return;
        }
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
        var drawings = (s.drawingsIssued || 0) + ' / ' + (s.drawingsTotal || 0);

        main.innerHTML =
            '<div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:1rem;">' +
                '<div>' +
                    '<h2>📐 Tekla Reports</h2>' +
                    '<p class="subtitle">Model data pushed from Tekla Structures — latest report per model drives the totals.</p>' +
                '</div>' +
                '<div style="display:flex; gap:0.5rem; flex-wrap:wrap;">' +
                    '<button class="btn btn-primary btn-sm" onclick="window._teklaShowAdd()">➕ Add Report</button>' +
                    '<button class="btn btn-outline btn-sm" onclick="document.getElementById(\'teklaCsvInput\').click()">⬆ Import CSV</button>' +
                    '<input type="file" id="teklaCsvInput" accept=".csv" style="display:none" onchange="window._teklaImportCsv(this)">' +
                    '<button class="btn btn-outline btn-sm" onclick="showTeklaReports()">🔄 Refresh</button>' +
                '</div>' +
            '</div>' +

            '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:1rem; margin-bottom:1.25rem;">' +
                statCard(s.modelCount || 0, '🏗️ Models Reported') +
                statCard(fmtTon(s.totalTonnage), '⚖️ Total Tonnage', (s.totalTonnage || 0) + ' tonnes') +
                statCard((s.totalAssemblies || 0).toLocaleString(), '🔩 Assemblies') +
                statCard(drawings, '📄 Drawings Issued / Total') +
                statCard(s.reportCount || 0, '🗂️ Reports Received') +
            '</div>' +

            '<div class="card" style="padding:1.25rem;">' +
                '<div style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-bottom:1rem; align-items:center;">' +
                    '<input id="teklaFilterText" class="form-control" placeholder="🔍 Filter by project / model…" style="max-width:280px;" oninput="window._teklaFilter()">' +
                    '<select id="teklaFilterType" class="form-control" style="max-width:200px;" onchange="window._teklaFilter()">' +
                        '<option value="">All report types</option>' +
                        '<option value="model_summary">Model Summary</option>' +
                        '<option value="drawing_status">Drawing Status</option>' +
                        '<option value="material_list">Material List</option>' +
                        '<option value="phase_report">Phase Report</option>' +
                        '<option value="other">Other</option>' +
                    '</select>' +
                '</div>' +
                '<div style="overflow-x:auto;">' +
                    '<table class="data-table"><thead><tr>' +
                        '<th>Date</th><th>Project</th><th>Model</th><th>Phase</th>' +
                        '<th style="text-align:right;">Tonnage</th>' +
                        '<th style="text-align:right;">Assemblies</th>' +
                        '<th style="text-align:right;">Parts</th>' +
                        '<th style="text-align:right;">Drawings</th>' +
                        '<th>Source</th><th>Reported By</th><th></th>' +
                    '</tr></thead><tbody id="teklaRows"></tbody></table>' +
                '</div>' +
            '</div>';

        renderRows(_cache.reports);
    }

    function renderRows(list) {
        var tbody = document.getElementById('teklaRows');
        if (!tbody) return;
        if (!list.length) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:#64748b; padding:2rem;">' +
                'No Tekla reports yet. Push one from a workstation (see TEKLA_INTEGRATION.md) or use ➕ Add Report.</td></tr>';
            return;
        }
        var mgmt = isMgmt();
        tbody.innerHTML = list.map(function (r) {
            var m = r.metrics || {};
            var dr = (m.drawingsTotal || m.drawingsIssued) ? ((m.drawingsIssued || 0) + '/' + (m.drawingsTotal || 0)) : '—';
            var src = r.source === 'tekla-plugin' ? '🤖 Plugin' : (r.source === 'csv-import' ? '📄 CSV' : '👤 Portal');
            return '<tr style="cursor:pointer;" onclick="window._teklaDetail(\'' + esc(r.id) + '\')">' +
                '<td style="white-space:nowrap;">' + fmtDate(r.createdAt) + '</td>' +
                '<td><strong>' + esc(r.projectNumber || '—') + '</strong>' + (r.projectName ? '<div style="font-size:0.75rem; color:#64748b;">' + esc(r.projectName) + '</div>' : '') + '</td>' +
                '<td>' + esc(r.modelName || '—') + '</td>' +
                '<td>' + esc(r.phase || '—') + '</td>' +
                '<td style="text-align:right; font-weight:600;">' + (m.tonnage ? fmtTon(m.tonnage) : '—') + '</td>' +
                '<td style="text-align:right;">' + (m.assemblies || '—') + '</td>' +
                '<td style="text-align:right;">' + (m.parts || '—') + '</td>' +
                '<td style="text-align:right;">' + dr + '</td>' +
                '<td>' + src + '</td>' +
                '<td>' + esc(r.reportedByName || '—') + '</td>' +
                '<td>' + (mgmt ? '<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); window._teklaDelete(\'' + esc(r.id) + '\')">🗑️</button>' : '') + '</td>' +
            '</tr>';
        }).join('');
    }

    window._teklaFilter = function () {
        var q = (document.getElementById('teklaFilterText') || {}).value || '';
        var t = (document.getElementById('teklaFilterType') || {}).value || '';
        q = q.toLowerCase();
        renderRows(_cache.reports.filter(function (r) {
            var hit = !q || (String(r.projectNumber || '') + ' ' + String(r.projectName || '') + ' ' + String(r.modelName || '')).toLowerCase().indexOf(q) !== -1;
            return hit && (!t || r.reportType === t);
        }));
    };

    // ── Detail modal ────────────────────────────────────────────────────────
    window._teklaDetail = async function (id) {
        var resp;
        try { resp = await window.apiCall('tekla-reports?id=' + encodeURIComponent(id)); }
        catch (e) { alert('Failed to load report: ' + e.message); return; }
        if (!resp || !resp.success) { alert('Failed to load report'); return; }
        var r = resp.data, m = r.metrics || {};

        var rowsHtml = '';
        if (Array.isArray(r.rows) && r.rows.length) {
            var cols = Object.keys(r.rows[0]);
            rowsHtml = '<h4 style="margin:1rem 0 0.5rem;">Detail Rows (' + r.rows.length + ')</h4>' +
                '<div style="max-height:280px; overflow:auto;"><table class="data-table"><thead><tr>' +
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
                    '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px,1fr)); gap:0.75rem; margin-bottom:1rem;">' +
                        statCard(m.tonnage ? fmtTon(m.tonnage) : '—', 'Tonnage') +
                        statCard(m.assemblies || 0, 'Assemblies') +
                        statCard(m.parts || 0, 'Parts') +
                        statCard(m.bolts || 0, 'Bolts') +
                        statCard((m.drawingsIssued || 0) + ' / ' + (m.drawingsTotal || 0), 'Drawings') +
                    '</div>' +
                    '<p><strong>Project:</strong> ' + esc(r.projectNumber || '—') + (r.projectName ? ' — ' + esc(r.projectName) : '') + '</p>' +
                    '<p><strong>Phase:</strong> ' + esc(r.phase || '—') + ' &nbsp; <strong>Type:</strong> ' + esc(r.reportType) + '</p>' +
                    '<p><strong>Source:</strong> ' + esc(r.source) + (r.teklaVersion ? ' (Tekla ' + esc(r.teklaVersion) + ')' : '') + '</p>' +
                    '<p><strong>Reported by:</strong> ' + esc(r.reportedByName) + ' · ' + fmtDate(r.createdAt) + '</p>' +
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

    // ── Add report (manual entry) ───────────────────────────────────────────
    window._teklaShowAdd = function () {
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
        var f = function (id, label, type, ph) {
            return '<div class="form-group"><label>' + label + '</label>' +
                '<input id="' + id + '" type="' + (type || 'text') + '" class="form-control" placeholder="' + (ph || '') + '"' + (type === 'number' ? ' min="0" step="0.01"' : '') + '></div>';
        };
        overlay.innerHTML =
            '<div class="modal-content" style="max-width:640px; max-height:88vh; overflow-y:auto;">' +
                '<div class="modal-header"><h2>➕ Add Tekla Report</h2>' +
                '<span class="close-modal" onclick="this.closest(\'.modal-overlay\').remove()">&times;</span></div>' +
                '<div style="padding:1.25rem;">' +
                    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">' +
                        f('tkProject', 'Project Number *', 'text', 'e.g. ABC26-123') +
                        f('tkProjectName', 'Project Name') +
                        f('tkModel', 'Model Name *', 'text', 'e.g. warehouse-A.db1') +
                        f('tkPhase', 'Phase', 'text', 'e.g. Phase 2') +
                        f('tkTonnage', 'Tonnage (T)', 'number') +
                        f('tkAssemblies', 'Assemblies', 'number') +
                        f('tkParts', 'Parts', 'number') +
                        f('tkBolts', 'Bolts', 'number') +
                        f('tkDrTotal', 'Drawings Total', 'number') +
                        f('tkDrIssued', 'Drawings Issued', 'number') +
                    '</div>' +
                    '<div class="form-group"><label>Notes</label><textarea id="tkNotes" class="form-control" rows="2"></textarea></div>' +
                    '<div style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:1rem;">' +
                        '<button class="btn btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button>' +
                        '<button class="btn btn-success" onclick="window._teklaSubmitAdd(this)">Save Report</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);
    };

    window._teklaSubmitAdd = async function (btn) {
        var g = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
        var project = g('tkProject'), model = g('tkModel');
        if (!project && !model) { alert('Enter a Project Number or Model Name.'); return; }
        btn.disabled = true;
        try {
            var resp = await window.apiCall('tekla-reports', {
                method: 'POST',
                body: JSON.stringify({
                    projectNumber: project,
                    projectName: g('tkProjectName'),
                    modelName: model,
                    phase: g('tkPhase'),
                    reportType: 'model_summary',
                    source: 'portal',
                    notes: g('tkNotes'),
                    metrics: {
                        tonnage: g('tkTonnage'), assemblies: g('tkAssemblies'),
                        parts: g('tkParts'), bolts: g('tkBolts'),
                        drawingsTotal: g('tkDrTotal'), drawingsIssued: g('tkDrIssued')
                    }
                })
            });
            if (resp && resp.success) {
                btn.closest('.modal-overlay').remove();
                window.showTeklaReports();
            } else { alert('Save failed: ' + ((resp && resp.error) || 'unknown')); btn.disabled = false; }
        } catch (e) { alert('Save failed: ' + e.message); btn.disabled = false; }
    };

    // ── CSV import (columns per TEKLA_INTEGRATION.md Option B) ─────────────
    window._teklaImportCsv = function (input) {
        var file = input.files && input.files[0];
        input.value = '';
        if (!file) return;
        var reader = new FileReader();
        reader.onload = async function () {
            var lines = String(reader.result || '').split(/\r?\n/).filter(function (l) { return l.trim(); });
            if (lines.length < 2) { alert('CSV needs a header row + data rows.'); return; }
            var header = lines[0].split(',').map(function (h) { return h.trim().toUpperCase(); });
            var idx = function (name) { return header.indexOf(name); };
            if (idx('PROJECT') === -1 && idx('MODEL') === -1) {
                alert('CSV header must contain PROJECT and/or MODEL columns.\nExpected: PROJECT,PROJECT_NAME,MODEL,PHASE,TONNAGE,ASSEMBLIES,PARTS,BOLTS,DRAWINGS_TOTAL,DRAWINGS_ISSUED');
                return;
            }
            var ok = 0, fail = 0;
            for (var i = 1; i < lines.length; i++) {
                var c = lines[i].split(',');
                var get = function (name) { var j = idx(name); return j === -1 ? '' : (c[j] || '').trim(); };
                try {
                    var resp = await window.apiCall('tekla-reports', {
                        method: 'POST',
                        body: JSON.stringify({
                            projectNumber: get('PROJECT'),
                            projectName: get('PROJECT_NAME'),
                            modelName: get('MODEL'),
                            phase: get('PHASE'),
                            reportType: 'model_summary',
                            source: 'csv-import',
                            metrics: {
                                tonnage: get('TONNAGE'), assemblies: get('ASSEMBLIES'),
                                parts: get('PARTS'), bolts: get('BOLTS'),
                                drawingsTotal: get('DRAWINGS_TOTAL'), drawingsIssued: get('DRAWINGS_ISSUED')
                            }
                        })
                    });
                    if (resp && resp.success) ok++; else fail++;
                } catch (e) { fail++; }
            }
            alert('CSV import finished: ' + ok + ' saved' + (fail ? ', ' + fail + ' failed' : ''));
            window.showTeklaReports();
        };
        reader.readAsText(file);
    };
})();
