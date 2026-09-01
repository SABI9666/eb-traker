// sample-projects-patch.js
// Sample Projects gallery — BDM uploads self-contained HTML showcase
// pages; BDM, COO and Director browse the shared gallery and view any
// sample full-page. Companion to api/sample-projects.js.
//
// SAFETY: uploaded pages are served from storage.googleapis.com (a
// different origin from the portal) and rendered inside a sandboxed
// iframe, so an uploaded page can never touch portal cookies or tokens.
// Loaded by bdm-po-patch.js. Uses window.apiCall.

(function () {
    'use strict';

    var TAG = '[sample-projects]';
    var ACCENT = '#0e7490';

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    function fmtDate(iso) {
        if (!iso) return '—';
        var d = new Date(iso);
        if (isNaN(d)) return '—';
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    }
    function fmtSize(bytes) {
        var n = parseFloat(bytes) || 0;
        if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
        if (n >= 1024) return Math.round(n / 1024) + ' KB';
        return n + ' B';
    }
    function role() {
        var el = document.getElementById('userRole');
        return el ? String(el.textContent || '').trim().toLowerCase() : '';
    }
    function canSee() { return ['bdm', 'coo', 'director'].includes(role()); }
    function uid() {
        try { return (window.currentUser && (window.currentUser.uid || window.currentUser.id)) || ''; }
        catch (e) { return ''; }
    }

    var _cache = { samples: [], workProfiles: [] };

    // ── Main view ───────────────────────────────────────────────────────
    window.showSampleProjects = async function () {
        var main = document.getElementById('mainContent');
        if (!main) return;
        if (typeof window.setActiveNav === 'function') { try { window.setActiveNav('nav-sample-projects'); } catch (e) {} }

        if (!canSee()) {
            main.innerHTML = '<div class="page-header"><h2>🖼️ Sample Projects</h2></div>' +
                '<div class="card" style="padding:2rem; text-align:center; color:#b91c1c;">🔒 Sample Projects are visible to BDM, COO and Director only.</div>';
            return;
        }

        main.innerHTML = '<div class="page-header"><h2>🖼️ Sample Projects</h2></div>' +
            '<div class="card" style="text-align:center; padding:2.5rem;">⏳ Loading sample projects…</div>';

        var resp;
        try { resp = await window.apiCall('sample-projects'); }
        catch (e) { renderError(main, e.message); return; }
        if (!resp || !resp.success) { renderError(main, (resp && resp.error) || 'Failed to load'); return; }

        _cache = resp.data || { samples: [], workProfiles: [] };
        renderView(main);
    };

    function renderError(main, msg) {
        main.innerHTML = '<div class="page-header"><h2>🖼️ Sample Projects</h2></div>' +
            '<div class="card" style="padding:2rem; text-align:center;">' +
                '<p style="color:#b91c1c; margin-bottom:1rem;">⚠️ ' + esc(msg) + '</p>' +
                '<button class="btn btn-primary" onclick="showSampleProjects()">🔄 Retry</button>' +
            '</div>';
    }

    function renderView(main) {
        var isBdm = role() === 'bdm';
        var samples = _cache.samples || [];
        main.innerHTML =
            '<div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:1rem;">' +
                '<div><h2>🖼️ Sample Projects</h2>' +
                '<p class="subtitle">Showcase pages for prospects — uploaded by the BDM team, viewable by management.</p></div>' +
                '<div style="display:flex; gap:0.6rem;">' +
                    '<button class="btn btn-outline btn-sm" onclick="showSampleProjects()">🔄 Refresh</button>' +
                    (isBdm ? '<button class="btn btn-primary" onclick="window._spForm()">⬆️ Upload Sample</button>' : '') +
                '</div>' +
            '</div>' +
            '<div style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-bottom:1.25rem; align-items:center;">' +
                '<input id="spFilter" class="form-control" placeholder="🔍 Filter by title / profile / BDM…" style="max-width:300px;" oninput="window._spFilter()">' +
                '<span style="font-size:0.78rem; color:#64748b;">' + samples.length + ' sample' + (samples.length === 1 ? '' : 's') + '</span>' +
            '</div>' +
            '<div id="spGallery"></div>';
        renderGallery(samples);
    }

    function filtered() {
        var q = ((document.getElementById('spFilter') || {}).value || '').toLowerCase();
        return (_cache.samples || []).filter(function (p) {
            return !q || (p.title + ' ' + p.workProfile + ' ' + p.createdByName + ' ' + p.description).toLowerCase().indexOf(q) !== -1;
        });
    }
    window._spFilter = function () { renderGallery(filtered()); };

    function canDelete(p) {
        var r = role();
        if (r === 'coo' || r === 'director') return true;
        return r === 'bdm' && (!uid() || p.createdByUid === uid());
    }

    function renderGallery(list) {
        var host = document.getElementById('spGallery');
        if (!host) return;
        if (!list.length) {
            host.innerHTML = '<div class="card" style="padding:2.5rem; text-align:center; color:#64748b;">' +
                (role() === 'bdm'
                    ? 'No sample projects yet. Click ⬆️ Upload Sample to add the first showcase page.'
                    : 'No sample projects uploaded by the BDM team yet.') + '</div>';
            return;
        }
        host.innerHTML = '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:1.1rem;">' +
            list.map(function (p) {
                return '<div class="card" style="padding:0; overflow:hidden; display:flex; flex-direction:column;">' +
                    '<div style="height:96px; background:linear-gradient(135deg, #0b1526, #123047); position:relative; display:flex; align-items:center; justify-content:center;">' +
                        '<span style="font-size:2.2rem;">🏗️</span>' +
                        (p.workProfile ? '<span style="position:absolute; top:10px; left:10px; font-size:0.62rem; font-weight:800; letter-spacing:0.5px; padding:3px 9px; border-radius:10px; background:rgba(34,199,240,0.18); color:#7fe3ff;">' + esc(p.workProfile.toUpperCase()) + '</span>' : '') +
                        '<span style="position:absolute; bottom:10px; right:10px; font-size:0.66rem; color:#9fb0c4;">' + fmtSize(p.fileSize) + ' · HTML</span>' +
                    '</div>' +
                    '<div style="padding:1rem 1.15rem 1.1rem; flex:1; display:flex; flex-direction:column; gap:0.4rem;">' +
                        '<div style="font-weight:800; color:#0f172a; font-size:0.98rem; line-height:1.3;">' + esc(p.title) + '</div>' +
                        (p.description ? '<div style="font-size:0.78rem; color:#64748b; line-height:1.5; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">' + esc(p.description) + '</div>' : '') +
                        '<div style="font-size:0.72rem; color:#94a3b8; margin-top:auto;">👤 ' + esc(p.createdByName || '—') + ' · ' + fmtDate(p.createdAt) + '</div>' +
                        '<div style="display:flex; gap:0.45rem; margin-top:0.55rem;">' +
                            '<button class="btn btn-primary btn-sm" style="flex:1;" onclick="window._spView(\'' + esc(p.id) + '\')">👁️ View</button>' +
                            '<a class="btn btn-outline btn-sm" href="' + esc(p.fileUrl) + '" target="_blank" rel="noopener" title="Open in a new tab">⧉</a>' +
                            (canDelete(p) ? '<button class="btn btn-danger btn-sm" title="Delete" onclick="window._spDelete(\'' + esc(p.id) + '\')">🗑️</button>' : '') +
                        '</div>' +
                    '</div>' +
                '</div>';
            }).join('') + '</div>';
    }

    // ── Full-page viewer (sandboxed iframe) ─────────────────────────────
    window._spView = function (id) {
        var p = null;
        (_cache.samples || []).forEach(function (x) { if (x.id === id) p = x; });
        if (!p) { alert('Sample not found — refresh and try again.'); return; }
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = 'position:fixed; inset:0; background:rgba(8,15,26,0.78); z-index:10000; display:flex; align-items:center; justify-content:center; padding:1.2rem;';
        overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML =
            '<div style="background:#fff; width:min(1200px, 96vw); height:min(860px, 92vh); border-radius:16px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 30px 80px -20px rgba(0,0,0,0.6);">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; padding:0.8rem 1.2rem; background:linear-gradient(135deg, #0b1526, #123047);">' +
                    '<div style="min-width:0;"><div style="font-weight:800; color:#f5f8fc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">🖼️ ' + esc(p.title) + '</div>' +
                    '<div style="font-size:0.7rem; color:#9fb0c4;">' + esc(p.createdByName || '') + (p.workProfile ? ' · ' + esc(p.workProfile) : '') + '</div></div>' +
                    '<div style="display:flex; gap:0.5rem; flex-shrink:0;">' +
                        '<a class="btn btn-outline btn-sm" href="' + esc(p.fileUrl) + '" target="_blank" rel="noopener" style="color:#e6f7ff; border-color:rgba(255,255,255,0.35);">⧉ Full Screen</a>' +
                        '<button class="btn btn-outline btn-sm" style="color:#e6f7ff; border-color:rgba(255,255,255,0.35);" onclick="this.closest(\'.modal-overlay\').remove()">✕ Close</button>' +
                    '</div>' +
                '</div>' +
                '<iframe src="' + esc(p.fileUrl) + '" sandbox="allow-scripts allow-popups" style="flex:1; width:100%; border:0; background:#fff;" title="' + esc(p.title) + '"></iframe>' +
            '</div>';
        document.body.appendChild(overlay);
    };

    // ── Upload modal (BDM) ──────────────────────────────────────────────
    window._spForm = function () {
        var profiles = _cache.workProfiles && _cache.workProfiles.length ? _cache.workProfiles : ['Other'];
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML =
            '<div class="modal-content" style="max-width:520px;">' +
                '<div class="modal-header"><h2>⬆️ Upload Sample Project</h2>' +
                '<span class="close-modal" onclick="this.closest(\'.modal-overlay\').remove()">&times;</span></div>' +
                '<div style="padding:1.25rem;">' +
                    '<div class="form-group"><label>Title *</label>' +
                        '<input id="spTitle" class="form-control" maxlength="160" placeholder="e.g. 450T Warehouse — Structural Package"></div>' +
                    '<div class="form-group"><label>Work Profile</label>' +
                        '<select id="spProfile" class="form-control"><option value="">Select profile…</option>' +
                            profiles.map(function (w) { return '<option value="' + esc(w) + '">' + esc(w) + '</option>'; }).join('') +
                        '</select></div>' +
                    '<div class="form-group"><label>Short Description</label>' +
                        '<textarea id="spDesc" class="form-control" rows="2" maxlength="500" placeholder="What this sample shows the client…"></textarea></div>' +
                    '<div class="form-group"><label>📄 HTML File *</label>' +
                        '<input id="spFile" class="form-control" type="file" accept=".html,.htm">' +
                        '<div style="font-size:0.72rem; color:#64748b; margin-top:0.3rem;">One self-contained .html page, up to 15 MB. COO &amp; Director view it full-page from their portal.</div></div>' +
                    '<div style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:1.25rem;">' +
                        '<button class="btn btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button>' +
                        '<button class="btn btn-success" onclick="window._spSubmit(this)">Upload</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);
        document.getElementById('spTitle').focus();
    };

    window._spSubmit = async function (btn) {
        var title = (document.getElementById('spTitle') || {}).value || '';
        var fileEl = document.getElementById('spFile');
        if (!title.trim()) { alert('Please enter a title.'); return; }
        if (!fileEl || !fileEl.files || !fileEl.files.length) { alert('Please choose an HTML file.'); return; }
        var f = fileEl.files[0];
        if (!/\.html?$/i.test(f.name)) { alert('Only .html or .htm files are allowed.'); return; }

        var fd = new FormData();
        fd.append('title', title.trim());
        fd.append('workProfile', (document.getElementById('spProfile') || {}).value || '');
        fd.append('description', ((document.getElementById('spDesc') || {}).value || '').trim());
        fd.append('htmlFile', f);

        btn.disabled = true;
        try {
            var resp = await window.apiCall('sample-projects', { method: 'POST', body: fd });
            if (resp && resp.success) {
                btn.closest('.modal-overlay').remove();
                window.showSampleProjects();
            } else { alert('Upload failed: ' + ((resp && resp.error) || 'unknown')); btn.disabled = false; }
        } catch (e) { alert('Upload failed: ' + e.message); btn.disabled = false; }
    };

    window._spDelete = async function (id) {
        if (!confirm('Delete this sample project?')) return;
        try {
            var resp = await window.apiCall('sample-projects?id=' + encodeURIComponent(id), { method: 'DELETE' });
            if (resp && resp.success) window.showSampleProjects();
            else alert('Delete failed: ' + ((resp && resp.error) || 'unknown'));
        } catch (e) { alert('Delete failed: ' + e.message); }
    };

    // ── Nav injection (Business Development section, all three roles) ───
    function findDeptUL(deptId, headingRegex) {
        var dept = document.getElementById(deptId);
        if (dept) { var ul = dept.querySelector('ul.nav-dept-items, ul'); if (ul) return ul; }
        var headers = document.querySelectorAll('.nav-dept-header, .sidebar h3, nav h3, aside h3, .sidebar .dept-name');
        for (var i = 0; i < headers.length; i++) {
            if (headingRegex.test((headers[i].textContent || '').trim())) {
                var parent = headers[i].closest('li, .nav-department, .sidebar-section') || headers[i].parentElement;
                if (parent) { var u = parent.querySelector('ul'); if (u) return u; }
            }
        }
        return null;
    }

    function injectNav() {
        if (!canSee()) return false;
        if (document.getElementById('sampleProjectsNavItem')) return true;
        var ul = findDeptUL('deptBDM', /business\s*development|bdm/i);
        if (!ul) return false;
        var li = document.createElement('li');
        li.id = 'sampleProjectsNavItem';
        li.style.display = 'block';
        li.innerHTML = '<a href="#" id="nav-sample-projects" onclick="showSampleProjects(); return false;">' +
            '<span class="nav-icon">🖼️</span>Sample Projects</a>';
        ul.appendChild(li);
        console.log(TAG, 'nav injected');
        return true;
    }

    var _retry = 0;
    var _iv = setInterval(function () {
        if (injectNav() || _retry++ > 120) clearInterval(_iv);
    }, 500);
    document.addEventListener('DOMContentLoaded', injectNav);
    injectNav();
})();
