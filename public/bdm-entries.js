// public/bdm-entries.js
// Manual quote / project-won upload form for BDMs.
// Adds a "Upload Quote Entry" nav item under Business Development.
// Writes go to /api/bdm-entries; results show up in BDM Analytics.

(function () {
    'use strict';
    if (window._bdmEntriesPatchLoaded) return;
    window._bdmEntriesPatchLoaded = true;

    var ALLOWED_ROLES = ['bdm', 'coo', 'director'];

    function getCurrentRole() {
        var r = '';
        try { if (typeof currentUserRole !== 'undefined' && currentUserRole) r = currentUserRole; } catch (e) {}
        if (!r && window.currentUserRole) r = window.currentUserRole;
        return String(r || '').trim().toLowerCase();
    }

    function injectNavItem() {
        var role = getCurrentRole();
        if (ALLOWED_ROLES.indexOf(role) === -1) return false;
        if (document.getElementById('bdmEntriesNavItem')) return true;
        var dept = document.getElementById('deptBDM');
        if (!dept) return false;
        var ul = dept.querySelector('ul.nav-dept-items');
        if (!ul) return false;
        var li = document.createElement('li');
        li.id = 'bdmEntriesNavItem';
        li.innerHTML = '<a href="#" id="nav-bdm-entries"><span class="nav-icon">📝</span>Upload Quote / Won</a>';
        ul.appendChild(li);
        li.querySelector('a').addEventListener('click', function (e) {
            e.preventDefault();
            window.showBdmEntries();
        });
        return true;
    }
    var iv = setInterval(function () { if (injectNavItem()) clearInterval(iv); }, 1500);
    setTimeout(function () { clearInterval(iv); }, 120000);
    injectNavItem();

    function fmtMoney(v, cur) {
        var n = Number(v) || 0;
        return (cur ? cur + ' ' : '') + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function fmtDate(iso) {
        var d = new Date(iso);
        if (isNaN(d)) return iso || '';
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    }

    var state = { entries: [], filterType: 'quote' };

    window.showBdmEntries = async function () {
        var main = document.getElementById('mainContent');
        if (!main) return;
        main.style.display = 'block';
        if (typeof window.setActiveNav === 'function') window.setActiveNav('nav-bdm-entries');
        render(main);
        await loadEntries();
        renderList();
    };

    async function loadEntries() {
        try {
            var resp = await window.apiCall('bdm-entries?type=' + encodeURIComponent(state.filterType));
            state.entries = (resp && resp.success && resp.entries) || [];
        } catch (e) {
            console.error('[bdm-entries] load error:', e);
            state.entries = [];
        }
    }

    function render(main) {
        var today = new Date().toISOString().slice(0, 10);
        main.innerHTML =
            '<div class="page-header"><h2>📝 Upload Quote / Project Won</h2>' +
            '<p class="subtitle">BDMs record quotes and wins here. Entries flow into BDM Analytics.</p></div>' +
            '<div class="card" style="padding:1.25rem; margin-bottom:1rem;">' +
                '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px,1fr)); gap:0.85rem;">' +
                    field('Type', '<select id="be-type">' +
                        '<option value="quote">📝 Quote uploaded</option>' +
                        '<option value="won">🏆 Project Won</option>' +
                        '<option value="variation">➕ Variation</option>' +
                    '</select>') +
                    field('Date', '<input type="date" id="be-date" value="' + today + '">') +
                    field('Quote / Project Number', '<input type="text" id="be-num" placeholder="e.g. Q-2026-042">') +
                    field('Project Name', '<input type="text" id="be-proj" placeholder="Site / project">') +
                    field('Client Company', '<input type="text" id="be-client" placeholder="Client name">') +
                    field('Value', '<input type="number" id="be-value" min="0" step="0.01" placeholder="0.00">') +
                    field('Currency', '<select id="be-cur">' +
                        ['INR','USD','AUD','NZD','EUR','GBP','SGD','AED','CAD','JPY']
                            .map(function (c) { return '<option value="' + c + '"' + (c === 'INR' ? ' selected' : '') + '>' + c + '</option>'; }).join('') +
                    '</select>') +
                    field('Notes (optional)', '<input type="text" id="be-notes" placeholder="Any remark">') +
                '</div>' +
                '<div style="margin-top:1rem; display:flex; gap:0.75rem;">' +
                    '<button id="be-save" class="btn btn-primary">💾 Save Entry</button>' +
                    '<span id="be-status" style="align-self:center; color:#64748b;"></span>' +
                '</div>' +
            '</div>' +
            '<div class="card" style="padding:1rem;">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; gap:0.75rem; flex-wrap:wrap;">' +
                    '<h3 style="margin:0;">Recent Entries</h3>' +
                    '<select id="be-filter" style="padding:0.4rem; border:1px solid #ddd; border-radius:6px;">' +
                        '<option value="quote">Quotes</option>' +
                        '<option value="won">Wins</option>' +
                        '<option value="variation">Variations</option>' +
                    '</select>' +
                '</div>' +
                '<div id="be-list" style="overflow-x:auto;"><em style="color:#64748b;">Loading…</em></div>' +
            '</div>';

        document.getElementById('be-save').onclick = saveEntry;
        document.getElementById('be-filter').value = state.filterType;
        document.getElementById('be-filter').onchange = async function (e) {
            state.filterType = e.target.value;
            document.getElementById('be-list').innerHTML = '<em style="color:#64748b;">Loading…</em>';
            await loadEntries();
            renderList();
        };
    }

    function field(label, html) {
        return '<div><label style="display:block; font-size:0.8rem; color:#475569; margin-bottom:0.25rem;">' + label + '</label>' + html + '</div>';
    }

    async function saveEntry() {
        var btn = document.getElementById('be-save');
        var status = document.getElementById('be-status');
        var body = {
            type: document.getElementById('be-type').value,
            date: document.getElementById('be-date').value,
            projectNumber: document.getElementById('be-num').value.trim(),
            projectName: document.getElementById('be-proj').value.trim(),
            clientCompany: document.getElementById('be-client').value.trim(),
            value: document.getElementById('be-value').value,
            currency: document.getElementById('be-cur').value,
            notes: document.getElementById('be-notes').value.trim()
        };
        if (!body.date || !body.value) { status.textContent = '⚠️ Date and Value are required'; status.style.color = '#dc2626'; return; }

        btn.disabled = true; btn.textContent = '⏳ Saving…';
        status.textContent = ''; status.style.color = '#64748b';
        try {
            var resp = await window.apiCall('bdm-entries', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
            if (!resp || !resp.success) throw new Error((resp && resp.error) || 'Save failed');
            status.textContent = '✅ Saved. It will reflect in BDM Analytics.';
            status.style.color = '#059669';
            // clear value/number/notes; keep type/date/currency for fast entry
            document.getElementById('be-value').value = '';
            document.getElementById('be-num').value = '';
            document.getElementById('be-notes').value = '';
            // refresh list if filtered to this type
            if (state.filterType === body.type) { await loadEntries(); renderList(); }
        } catch (e) {
            status.textContent = '⚠️ ' + (e.message || e);
            status.style.color = '#dc2626';
        } finally {
            btn.disabled = false; btn.textContent = '💾 Save Entry';
        }
    }

    function renderList() {
        var host = document.getElementById('be-list');
        if (!host) return;
        var rows = state.entries.map(function (e, i) {
            return '<tr>' +
                '<td>' + (i + 1) + '</td>' +
                '<td>' + fmtDate(e.date) + '</td>' +
                '<td><strong>' + (e.bdmName || '') + '</strong></td>' +
                '<td>' + (e.projectNumber || '') + '</td>' +
                '<td>' + (e.projectName || '') + '</td>' +
                '<td>' + (e.clientCompany || '') + '</td>' +
                '<td style="text-align:right;">' + fmtMoney(e.value, e.currency) + '</td>' +
                '<td>' + (e.notes || '') + '</td>' +
                '<td><button class="btn btn-sm btn-danger" onclick="window._beDelete(\'' + e.id + '\')">🗑️</button></td>' +
            '</tr>';
        }).join('');
        host.innerHTML =
            '<table class="data-table" style="width:100%;">' +
                '<thead><tr>' +
                    '<th>#</th><th>Date</th><th>BDM</th><th>Number</th><th>Project</th><th>Client</th>' +
                    '<th style="text-align:right;">Value</th><th>Notes</th><th></th>' +
                '</tr></thead>' +
                '<tbody>' + (rows || '<tr><td colspan="9" style="text-align:center; padding:1rem; color:#64748b;">No entries yet.</td></tr>') + '</tbody>' +
            '</table>';
    }

    window._beDelete = async function (id) {
        if (!confirm('Delete this entry?')) return;
        try {
            var resp = await window.apiCall('bdm-entries?id=' + encodeURIComponent(id), { method: 'DELETE' });
            if (!resp || !resp.success) throw new Error((resp && resp.error) || 'Delete failed');
            await loadEntries();
            renderList();
        } catch (e) { alert(e.message || e); }
    };

    console.log('[bdm-entries] module loaded');
})();
