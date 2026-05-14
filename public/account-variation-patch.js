/* ============================================================
 * Account Variation Patch  (rev 2)
 *
 * Accounts-driven Variation uploads + COO Tracker section + BDM "My
 * Variations" page. Resilient nav injection with MutationObserver.
 *
 * Backend endpoints used (eb-backend):
 *   POST   /api/account-variations    (multipart/form-data)
 *   GET    /api/account-variations
 *   DELETE /api/account-variations?id=<id>
 * ============================================================ */
(function () {
    'use strict';

    if (window._accountVariationPatchLoaded) return;
    window._accountVariationPatchLoaded = true;

    var TAG = '[account-variation]';
    var STYLE_ID = 'account-variation-patch-styles';
    var MODAL_ID = 'accountVariationModal';
    var PAGE_ID = 'accountVariationsPage';
    var BDM_PAGE_ID = 'myAccountVariationsPage';
    var COO_SECTION_ID = 'cooAccountVariationsSection';

    var NAV_IDS = {
        accounts: 'accountVariationsNavItem',
        coo: 'cooAccountVariationsNavItem',
        bdm: 'bdmAccountVariationsNavItem'
    };

    console.log(TAG, 'script loaded');

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = [
            '.av-table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);}',
            '.av-table th,.av-table td{padding:0.6rem 0.8rem;text-align:left;border-bottom:1px solid #e5e7eb;font-size:0.9rem;vertical-align:top;}',
            '.av-table th{background:#f8fafc;font-weight:600;color:#1e293b;}',
            '.av-table tr:last-child td{border-bottom:none;}',
            '.av-empty{padding:2rem;text-align:center;color:#64748b;background:#fff;border-radius:8px;}',
            '.av-btn{padding:6px 12px;border-radius:6px;border:none;cursor:pointer;font-size:0.85rem;font-weight:500;}',
            '.av-btn-primary{background:#2563eb;color:#fff;}',
            '.av-btn-danger{background:#dc2626;color:#fff;}',
            '.av-btn-outline{background:#fff;color:#2563eb;border:1px solid #2563eb;}',
            '.av-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10001;display:flex;align-items:center;justify-content:center;padding:1rem;}',
            '.av-modal{background:#fff;max-width:640px;width:100%;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,0.3);max-height:95vh;overflow-y:auto;}',
            '.av-modal-header{padding:1rem 1.25rem;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;}',
            '.av-modal-header h2{margin:0;font-size:1.15rem;}',
            '.av-modal-body{padding:1rem 1.25rem;}',
            '.av-modal-footer{padding:0.85rem 1.25rem;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:0.5rem;}',
            '.av-field{margin-bottom:0.9rem;}',
            '.av-field label{display:block;font-size:0.85rem;font-weight:600;margin-bottom:0.25rem;color:#1e293b;}',
            '.av-field input,.av-field select,.av-field textarea{width:100%;padding:0.5rem 0.65rem;border:1px solid #cbd5e1;border-radius:6px;font-size:0.9rem;font-family:inherit;}',
            '.av-row{display:flex;gap:0.75rem;}',
            '.av-row .av-field{flex:1;}',
            '.av-required{color:#dc2626;}',
            '.av-page-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.75rem;}',
            '.av-page-header h2{margin:0;}'
        ].join('\n');
        document.head.appendChild(s);
    }

    function role() {
        var candidates = [
            window.currentUserRole, window.userRole,
            window.currentUser && window.currentUser.role,
            window.appUser && window.appUser.role,
            window.currentRole
        ];
        for (var i = 0; i < candidates.length; i++) {
            if (candidates[i]) return String(candidates[i]).trim().toLowerCase();
        }
        return '';
    }

    function fmtMoney(value, currency) {
        if (value === null || value === undefined || value === '') return '—';
        var n = Number(value); if (isNaN(n)) return String(value);
        var c = (currency || '').toString().toUpperCase();
        try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c || 'INR', maximumFractionDigits: 2 }).format(n); }
        catch (e) { return (c ? c + ' ' : '') + n.toLocaleString(); }
    }
    function fmtDate(ts) {
        if (!ts) return '—';
        try {
            var d;
            if (typeof ts === 'object' && ts._seconds) d = new Date(ts._seconds * 1000);
            else if (typeof ts === 'object' && typeof ts.toDate === 'function') d = ts.toDate();
            else d = new Date(ts);
            if (isNaN(d.getTime())) return '—';
            return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) { return '—'; }
    }
    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function getMainContent() {
        return document.getElementById('mainContent') || document.getElementById('main-content')
            || document.getElementById('appMainContent') || document.querySelector('.main-content')
            || document.querySelector('main') || document.body;
    }
    function authToken() {
        try {
            var u = firebase && firebase.auth && firebase.auth().currentUser;
            return u ? u.getIdToken() : Promise.resolve(null);
        } catch (e) { return Promise.resolve(null); }
    }
    function apiBase() { return (window.API_BASE_URL || window.apiBaseUrl || '').replace(/\/$/, ''); }

    async function uploadAccountVariation(formData) {
        var token = await authToken();
        var res = await fetch(apiBase() + '/api/account-variations', {
            method: 'POST',
            headers: token ? { Authorization: 'Bearer ' + token } : {},
            body: formData
        });
        var json; try { json = await res.json(); } catch (e) { json = {}; }
        if (!res.ok || json.success === false) {
            throw new Error(json.error || json.message || ('Upload failed: HTTP ' + res.status));
        }
        return json;
    }
    async function fetchAccountVariations() {
        if (typeof window.apiCall === 'function') {
            var resp = await window.apiCall('account-variations');
            if (!resp || resp.success === false) throw new Error((resp && resp.error) || 'Failed to load');
            return resp.data || [];
        }
        var token = await authToken();
        var res = await fetch(apiBase() + '/api/account-variations', {
            headers: token ? { Authorization: 'Bearer ' + token } : {}
        });
        var json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Load failed');
        return json.data || [];
    }
    async function deleteAccountVariation(id) {
        if (typeof window.apiCall === 'function') {
            var resp = await window.apiCall('account-variations?id=' + encodeURIComponent(id), { method: 'DELETE' });
            if (!resp || resp.success === false) throw new Error((resp && resp.error) || 'Delete failed');
            return resp;
        }
        var token = await authToken();
        var res = await fetch(apiBase() + '/api/account-variations?id=' + encodeURIComponent(id), {
            method: 'DELETE', headers: token ? { Authorization: 'Bearer ' + token } : {}
        });
        var json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Delete failed');
        return json;
    }
    async function fetchBDMs() {
        if (typeof window.apiCall === 'function') {
            var resp = await window.apiCall('users?role=bdm');
            if (resp && resp.success && Array.isArray(resp.data)) return resp.data;
        }
        var token = await authToken();
        var res = await fetch(apiBase() + '/api/users?role=bdm', {
            headers: token ? { Authorization: 'Bearer ' + token } : {}
        });
        var json = await res.json();
        return (json && json.data) || [];
    }

    function buildModal() {
        var existing = document.getElementById(MODAL_ID);
        if (existing) existing.remove();
        var overlay = document.createElement('div');
        overlay.id = MODAL_ID;
        overlay.className = 'av-modal-overlay';
        overlay.innerHTML = ''
            + '<div class="av-modal">'
            + '  <div class="av-modal-header">'
            + '    <h2>📤 Upload Variation</h2>'
            + '    <span style="cursor:pointer;font-size:1.5rem;color:#64748b;" onclick="closeAccountVariationModal()">&times;</span>'
            + '  </div>'
            + '  <div class="av-modal-body">'
            + '    <form id="accountVariationForm" onsubmit="return false;">'
            + '      <div class="av-field"><label>BDM <span class="av-required">*</span></label>'
            + '        <select id="avBdmSelect" required><option value="">Loading BDMs…</option></select></div>'
            + '      <div class="av-row">'
            + '        <div class="av-field"><label>Variation Value <span class="av-required">*</span></label>'
            + '          <input type="number" id="avValue" step="0.01" min="0" placeholder="e.g. 25000.00" required /></div>'
            + '        <div class="av-field" style="max-width:140px;"><label>Currency</label>'
            + '          <select id="avCurrency">'
            + '            <option value="INR" selected>INR</option><option value="USD">USD</option>'
            + '            <option value="AUD">AUD</option><option value="GBP">GBP</option>'
            + '            <option value="CAD">CAD</option><option value="EUR">EUR</option>'
            + '          </select></div>'
            + '      </div>'
            + '      <div class="av-field"><label>Reference / Project Name (optional)</label>'
            + '        <input type="text" id="avProjectName" placeholder="e.g. Acme Towers — Stage 3" /></div>'
            + '      <div class="av-field"><label>Description / Notes (optional)</label>'
            + '        <textarea id="avDescription" rows="3" placeholder="Short summary…"></textarea></div>'
            + '      <div class="av-field"><label>Variation File (PDF / Word / Excel / Image)</label>'
            + '        <input type="file" id="avFile" accept=".pdf,.doc,.docx,.xls,.xlsx,image/png,image/jpeg" />'
            + '        <small style="color:#64748b;">Max 50&nbsp;MB. Optional.</small></div>'
            + '    </form>'
            + '  </div>'
            + '  <div class="av-modal-footer">'
            + '    <button type="button" class="av-btn av-btn-outline" onclick="closeAccountVariationModal()">Cancel</button>'
            + '    <button type="button" class="av-btn av-btn-primary" id="avSubmitBtn" onclick="submitAccountVariation()">Upload</button>'
            + '  </div>'
            + '</div>';
        document.body.appendChild(overlay);
        return overlay;
    }

    window.openAccountVariationModal = async function () {
        injectStyles();
        var modal = buildModal();
        var sel = modal.querySelector('#avBdmSelect');
        try {
            var bdms = await fetchBDMs();
            if (!bdms.length) { sel.innerHTML = '<option value="">No active BDMs found</option>'; return; }
            sel.innerHTML = '<option value="">— Select BDM —</option>' + bdms.map(function (b) {
                var label = escapeHtml(b.name || b.email || b.uid);
                if (b.email) label += ' (' + escapeHtml(b.email) + ')';
                return '<option value="' + escapeHtml(b.uid) + '"'
                    + ' data-name="' + escapeHtml(b.name || '') + '"'
                    + ' data-email="' + escapeHtml(b.email || '') + '">' + label + '</option>';
            }).join('');
        } catch (e) {
            sel.innerHTML = '<option value="">Failed to load BDMs</option>';
            console.error(TAG, 'Failed to load BDMs', e);
        }
    };
    window.closeAccountVariationModal = function () {
        var m = document.getElementById(MODAL_ID); if (m) m.remove();
    };
    window.submitAccountVariation = async function () {
        var sel = document.getElementById('avBdmSelect');
        var bdmUid = sel && sel.value;
        var opt = sel && sel.options[sel.selectedIndex];
        var bdmName = opt && opt.getAttribute('data-name');
        var bdmEmail = opt && opt.getAttribute('data-email');
        var value = document.getElementById('avValue').value;
        var currency = document.getElementById('avCurrency').value;
        var description = document.getElementById('avDescription').value.trim();
        var projectName = document.getElementById('avProjectName').value.trim();
        var fileInput = document.getElementById('avFile');
        var file = fileInput && fileInput.files && fileInput.files[0];
        if (!bdmUid) { alert('Please select a BDM.'); return; }
        if (!value || isNaN(parseFloat(value)) || parseFloat(value) < 0) { alert('Please enter a valid variation value.'); return; }
        var btn = document.getElementById('avSubmitBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }
        try {
            var fd = new FormData();
            fd.append('bdmUid', bdmUid);
            fd.append('bdmName', bdmName || '');
            if (bdmEmail) fd.append('bdmEmail', bdmEmail);
            fd.append('variationValue', value);
            fd.append('currency', currency || 'INR');
            if (description) fd.append('description', description);
            if (projectName) fd.append('projectName', projectName);
            if (file) fd.append('variationFile', file);
            await uploadAccountVariation(fd);
            alert('✅ Variation uploaded successfully.');
            window.closeAccountVariationModal();
            if (document.getElementById(PAGE_ID) && document.getElementById(PAGE_ID).style.display !== 'none') {
                window.showAccountVariations();
            }
            var sec = document.getElementById(COO_SECTION_ID);
            if (sec) renderCOOSection(sec);
        } catch (e) {
            console.error(TAG, e);
            alert('Upload failed: ' + (e.message || e));
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Upload'; }
        }
    };

    function renderTable(list, opts) {
        opts = opts || {};
        var canDelete = !!opts.canDelete;
        var hideBdmColumn = !!opts.hideBdmColumn;
        if (!list || !list.length) return '<div class="av-empty">No account variations to show.</div>';
        var head = '<tr>'
            + (hideBdmColumn ? '' : '<th>BDM</th>')
            + '<th>Project / Ref</th><th>Value</th><th>Description</th><th>File</th>'
            + '<th>Uploaded By</th><th>Uploaded At</th>' + (canDelete ? '<th></th>' : '') + '</tr>';
        var rows = list.map(function (v) {
            var fileCell = v.fileUrl
                ? '<a href="' + escapeHtml(v.fileUrl) + '" target="_blank" rel="noopener">📎 ' + escapeHtml(v.fileOriginalName || 'view') + '</a>'
                : '<span style="color:#94a3b8;">—</span>';
            var del = canDelete
                ? '<td><button class="av-btn av-btn-danger" onclick="deleteAccountVariationConfirm(\'' + escapeHtml(v.id) + '\')">Delete</button></td>'
                : '';
            return '<tr>'
                + (hideBdmColumn ? '' : '<td><strong>' + escapeHtml(v.bdmName || '—') + '</strong>'
                    + (v.bdmEmail ? '<div style="font-size:0.8rem;color:#64748b;">' + escapeHtml(v.bdmEmail) + '</div>' : '') + '</td>')
                + '<td>' + escapeHtml(v.projectName || v.referenceCode || '—') + '</td>'
                + '<td><strong>' + escapeHtml(fmtMoney(v.variationValue, v.currency)) + '</strong></td>'
                + '<td style="max-width:280px;white-space:pre-wrap;">' + escapeHtml(v.description || '—') + '</td>'
                + '<td>' + fileCell + '</td>'
                + '<td>' + escapeHtml(v.uploadedByName || '—') + '</td>'
                + '<td>' + escapeHtml(fmtDate(v.createdAt)) + '</td>' + del + '</tr>';
        }).join('');
        return '<table class="av-table"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table>';
    }

    window.deleteAccountVariationConfirm = async function (id) {
        if (!confirm('Delete this account variation?')) return;
        try {
            await deleteAccountVariation(id);
            if (document.getElementById(PAGE_ID) && document.getElementById(PAGE_ID).style.display !== 'none') {
                window.showAccountVariations();
            }
            var sec = document.getElementById(COO_SECTION_ID);
            if (sec) renderCOOSection(sec);
        } catch (e) { alert('Delete failed: ' + (e.message || e)); }
    };

    function ensurePage(pageId, title, headerExtraHtml) {
        var main = getMainContent();
        var page = document.getElementById(pageId);
        if (!page) {
            page = document.createElement('div');
            page.id = pageId;
            page.className = 'page-section content-section';
            page.style.padding = '1.25rem';
            main.appendChild(page);
        }
        page.innerHTML = '<div class="av-page-header"><h2>' + title + '</h2>'
            + '<div>' + (headerExtraHtml || '') + '</div></div>'
            + '<div id="' + pageId + '-content"><div class="av-empty">Loading…</div></div>';
        return page;
    }
    function tryHideOtherPages() {
        var main = getMainContent(); if (!main) return;
        Array.prototype.forEach.call(main.children, function (child) {
            if (child.id === PAGE_ID || child.id === BDM_PAGE_ID) return;
            if (child.classList && (child.classList.contains('page-section') || child.classList.contains('content-section'))) {
                child.style.display = 'none';
            }
        });
    }

    window.showAccountVariations = async function () {
        injectStyles();
        var r = role();
        var headerExtra = (r === 'accounts') ? '<button class="av-btn av-btn-primary" onclick="openAccountVariationModal()">+ Upload Variation</button>' : '';
        tryHideOtherPages();
        var page = ensurePage(PAGE_ID, '📑 Account Variations', headerExtra);
        page.style.display = 'block';
        var holder = document.getElementById(PAGE_ID + '-content');
        try {
            var list = await fetchAccountVariations();
            holder.innerHTML = renderTable(list, { canDelete: ['accounts', 'coo', 'director'].includes(r) });
        } catch (e) {
            holder.innerHTML = '<div class="av-empty" style="color:#dc2626;">Failed to load: ' + escapeHtml(e.message || e) + '</div>';
        }
    };
    window.showMyAccountVariations = async function () {
        injectStyles();
        tryHideOtherPages();
        var page = ensurePage(BDM_PAGE_ID, '📑 My Variations (from Accounts)', '');
        page.style.display = 'block';
        var holder = document.getElementById(BDM_PAGE_ID + '-content');
        try {
            var list = await fetchAccountVariations();
            holder.innerHTML = renderTable(list, { canDelete: false, hideBdmColumn: true });
        } catch (e) {
            holder.innerHTML = '<div class="av-empty" style="color:#dc2626;">Failed to load: ' + escapeHtml(e.message || e) + '</div>';
        }
    };

    async function renderCOOSection(container) {
        injectStyles();
        container.innerHTML = '<h3 style="margin-top:2rem;">📥 Account-uploaded Variations</h3>'
            + '<div id="cooAccountVarTableHolder"><div class="av-empty">Loading…</div></div>';
        try {
            var list = await fetchAccountVariations();
            document.getElementById('cooAccountVarTableHolder').innerHTML = renderTable(list, { canDelete: true });
        } catch (e) {
            document.getElementById('cooAccountVarTableHolder').innerHTML =
                '<div class="av-empty" style="color:#dc2626;">Failed to load: ' + escapeHtml(e.message || e) + '</div>';
        }
    }
    function injectIntoCOOTracker() {
        var r = role();
        if (!['coo', 'director'].includes(r)) return;
        var candidates = [
            document.getElementById('cooVariationTrackingPage'),
            document.getElementById('cooVariationsPage'),
            document.getElementById('variationTrackingPage'),
            document.getElementById('variationsPage')
        ].filter(Boolean);
        var host = candidates[0];
        if (!host) {
            var headings = document.querySelectorAll('h1, h2, h3');
            for (var i = 0; i < headings.length; i++) {
                if (/variation\s*track/i.test(headings[i].textContent || '')) {
                    host = headings[i].closest('.page-section, .content-section, section, div');
                    if (host) break;
                }
            }
        }
        if (!host) return;
        if (document.getElementById(COO_SECTION_ID)) return;
        var sec = document.createElement('div');
        sec.id = COO_SECTION_ID;
        sec.style.marginTop = '2rem';
        host.appendChild(sec);
        renderCOOSection(sec);
    }
    function hookCOOVariationTracking() {
        if (typeof window.showCOOVariationTracking !== 'function') return false;
        if (window.showCOOVariationTracking._avHooked) return true;
        var orig = window.showCOOVariationTracking;
        window.showCOOVariationTracking = function () {
            var result = orig.apply(this, arguments);
            setTimeout(injectIntoCOOTracker, 400);
            setTimeout(injectIntoCOOTracker, 1500);
            return result;
        };
        window.showCOOVariationTracking._avHooked = true;
        return true;
    }

    function makeNavLi(id, iconChar, label, onclick) {
        var li = document.createElement('li');
        li.id = id;
        li.style.display = '';
        li.innerHTML = '<a href="#" onclick="' + onclick + '"><span class="nav-icon">'
            + iconChar + '</span>' + escapeHtml(label) + '</a>';
        return li;
    }
    function findDeptUL(deptId, headingRegex) {
        var dept = document.getElementById(deptId);
        if (dept) {
            var ul = dept.querySelector('ul.nav-dept-items, ul');
            if (ul) return ul;
        }
        if (headingRegex) {
            var headers = document.querySelectorAll('.nav-dept-header, .sidebar h3, nav h3, aside h3, .sidebar .dept-name');
            for (var i = 0; i < headers.length; i++) {
                if (headingRegex.test((headers[i].textContent || '').trim())) {
                    var parent = headers[i].closest('li, .nav-department, .sidebar-section') || headers[i].parentElement;
                    if (parent) {
                        var u = parent.querySelector('ul');
                        if (u) return u;
                    }
                }
            }
        }
        return null;
    }
    function injectNavItems() {
        var r = role();
        if (!r) return false;
        var injected = false;
        if (r === 'accounts' && !document.getElementById(NAV_IDS.accounts)) {
            var ul = findDeptUL('deptFinance', /finance|accounts/i);
            if (ul) {
                ul.appendChild(makeNavLi(NAV_IDS.accounts, '📑', 'Account Variations',
                    "showAccountVariations(); return false;"));
                injected = true;
                console.log(TAG, 'injected Accounts nav item under Finance');
            } else {
                console.warn(TAG, 'could not find Finance dept UL for accounts user');
            }
        }
        if (['coo', 'director'].includes(r) && !document.getElementById(NAV_IDS.coo)) {
            var opsUl = findDeptUL('deptOperations', /operations|management/i);
            if (opsUl) {
                opsUl.appendChild(makeNavLi(NAV_IDS.coo, '📑', 'Account Variations',
                    "showAccountVariations(); return false;"));
                injected = true;
                console.log(TAG, 'injected COO nav item under Operations');
            }
        }
        if (r === 'bdm' && !document.getElementById(NAV_IDS.bdm)) {
            var bdmUl = findDeptUL('deptBDM', /business\s*development|bdm/i);
            if (bdmUl) {
                bdmUl.appendChild(makeNavLi(NAV_IDS.bdm, '📑', 'My Variations',
                    "showMyAccountVariations(); return false;"));
                injected = true;
                console.log(TAG, 'injected BDM nav item under Business Development');
            }
        }
        return injected;
    }
    window.installAccountVariationsNav = injectNavItems;

    var _observer = null;
    var _started = false;
    var _retryCount = 0;
    var MAX_RETRIES = 30;

    function tryStart() {
        var r = role();
        if (!r) {
            if (_retryCount++ > MAX_RETRIES) console.warn(TAG, 'role still unknown after retries');
            return;
        }
        if (!_started) {
            _started = true;
            console.log(TAG, 'starting for role:', r);
            injectStyles();
            hookCOOVariationTracking();
            try {
                _observer = new MutationObserver(function () { injectNavItems(); });
                var target = document.querySelector('nav, aside, .sidebar') || document.body;
                _observer.observe(target, { childList: true, subtree: true });
            } catch (e) {}
        }
        injectNavItems();
    }
    var _interval = setInterval(function () {
        tryStart();
        if (_retryCount++ > MAX_RETRIES) clearInterval(_interval);
    }, 2000);
    setTimeout(function () { try { clearInterval(_interval); } catch (e) {} }, 120000);
    document.addEventListener('DOMContentLoaded', tryStart);
    tryStart();
    setTimeout(tryStart, 500);
    setTimeout(tryStart, 1500);
    setTimeout(tryStart, 4000);
    setTimeout(tryStart, 8000);
})();
