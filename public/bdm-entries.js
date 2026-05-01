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
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    var TYPE_META = {
        quote:     { label: 'Quote',     icon: '📝', color: '#2563eb', bg: '#eff6ff' },
        won:       { label: 'Won',       icon: '🏆', color: '#059669', bg: '#ecfdf5' },
        variation: { label: 'Variation', icon: '➕', color: '#7c3aed', bg: '#f5f3ff' }
    };

    // mineOnly is opt-in for everyone. Default OFF so Recent Entries
    // always shows the same rows the backend returns (matching what BDM
    // Analytics displays). Users can tick the "Only mine" toggle in the
    // toolbar to narrow the list to entries they themselves filed.
    var state = {
        entries: [],
        filterType: 'quote',
        loading: false,
        lastError: '',
        mineOnly: false
    };

    // Exposed so other modules (e.g. bdm-quote-sync-patch.js) can refresh
    // the recent entries list after a save without depending on DOM events.
    window._bdmEntriesReload = async function (preferType) {
        if (preferType && TYPE_META[preferType]) {
            state.filterType = preferType;
            var f = document.getElementById('be-filter');
            if (f) f.value = preferType;
        }
        var host = document.getElementById('be-list');
        if (host) host.innerHTML = loadingHtml();
        await loadEntries();
        renderList();
    };

    window.showBdmEntries = async function () {
        var main = document.getElementById('mainContent');
        if (!main) return;
        main.style.display = 'block';
        if (typeof window.setActiveNav === 'function') window.setActiveNav('nav-bdm-entries');
        render(main);
        await loadEntries();
        renderList();
    };

    // app1.js's apiCall wraps responses that don't carry a top-level `data`
    // key by re-emitting them as `{success: true, data: <originalResponse>}`.
    // Our backend returns `{success, entries, count, meta}` with no `data`,
    // so the actual payload ends up at `resp.data`. This helper unwraps that
    // layer when it detects the inner shape, so every reader can keep using
    // `resp.entries` etc. without caring whether the wrap kicked in.
    function unwrapApi(resp) {
        if (!resp || typeof resp !== 'object') return resp;
        if (resp.data && typeof resp.data === 'object' && !Array.isArray(resp.data)) {
            var inner = resp.data;
            if (inner.success !== undefined ||
                'entries' in inner || 'entry' in inner ||
                'count' in inner || 'meta' in inner) {
                return inner;
            }
        }
        return resp;
    }

    async function loadEntries() {
        state.loading = true;
        state.lastError = '';
        try {
            // Cache-buster + optional ?mine=1 ensure a stale browser cache
            // can't hide entries after a logout/login round-trip.
            var qs = 'type=' + encodeURIComponent(state.filterType) +
                     (state.mineOnly ? '&mine=1' : '') +
                     '&_t=' + Date.now();
            var raw = await window.apiCall('bdm-entries?' + qs);
            var resp = unwrapApi(raw);
            // Defensive: accept several response shapes so a backend tweak
            // doesn't silently empty the table.
            var list = [];
            if (resp && Array.isArray(resp.entries)) list = resp.entries;
            else if (resp && Array.isArray(resp.data)) list = resp.data;
            else if (Array.isArray(resp)) list = resp;
            else if (resp && resp.success === false) {
                state.lastError = resp.error || resp.message || 'Server returned an error';
            }
            state.entries = list;
            state.lastMeta = (resp && resp.meta) || null;
            console.log('[bdm-entries] loaded', list.length, 'entries for type=' + state.filterType,
                { unwrapped: resp, raw: raw });
        } catch (e) {
            console.error('[bdm-entries] load error:', e);
            state.entries = [];
            state.lastError = (e && e.message) || String(e);
        } finally {
            state.loading = false;
        }
    }

    function loadingHtml() {
        return '<div style="padding:1.25rem; text-align:center; color:#64748b;">' +
            '<span style="display:inline-block; width:14px; height:14px; border:2px solid #cbd5e1; border-top-color:#2563eb; border-radius:50%; vertical-align:middle; margin-right:0.5rem; animation: bdmSpin 0.8s linear infinite;"></span>' +
            'Loading recent entries…' +
            '</div>';
    }

    function injectStylesOnce() {
        if (document.getElementById('bdm-entries-style')) return;
        var st = document.createElement('style');
        st.id = 'bdm-entries-style';
        st.textContent = [
            '@keyframes bdmSpin { to { transform: rotate(360deg); } }',
            '.bdm-entries-table { width:100%; border-collapse: separate; border-spacing:0; font-size:0.88rem; }',
            '.bdm-entries-table thead th { position:sticky; top:0; background:#f1f5f9; color:#0f172a; font-weight:600; text-align:left; padding:0.65rem 0.75rem; border-bottom:1px solid #e2e8f0; font-size:0.78rem; letter-spacing:0.04em; text-transform:uppercase; }',
            '.bdm-entries-table tbody td { padding:0.6rem 0.75rem; border-bottom:1px solid #f1f5f9; vertical-align:middle; color:#1e293b; }',
            '.bdm-entries-table tbody tr:nth-child(even) td { background:#fafbfc; }',
            '.bdm-entries-table tbody tr:hover td { background:#eff6ff; }',
            '.bdm-entries-table .num { text-align:right; font-variant-numeric: tabular-nums; white-space:nowrap; }',
            '.bdm-entries-table .muted { color:#64748b; }',
            '.bdm-type-badge { display:inline-flex; align-items:center; gap:0.3rem; padding:0.15rem 0.55rem; border-radius:999px; font-size:0.72rem; font-weight:600; line-height:1.4; }',
            '.bdm-entries-card { padding:1rem 1.1rem; }',
            '.bdm-entries-toolbar { display:flex; justify-content:space-between; align-items:center; gap:0.75rem; flex-wrap:wrap; margin-bottom:0.75rem; }',
            '.bdm-entries-toolbar h3 { margin:0; font-size:1.05rem; color:#0f172a; }',
            '.bdm-entries-toolbar .meta { font-size:0.78rem; color:#64748b; }',
            '.bdm-entries-actions { display:flex; gap:0.4rem; align-items:center; }',
            '.bdm-entries-select { padding:0.4rem 0.6rem; border:1px solid #cbd5e1; border-radius:6px; background:#fff; font-size:0.85rem; }',
            '.bdm-entries-refresh { padding:0.4rem 0.7rem; border:1px solid #cbd5e1; background:#fff; border-radius:6px; cursor:pointer; font-size:0.82rem; color:#334155; }',
            '.bdm-entries-refresh:hover { background:#f1f5f9; }',
            '.bdm-entries-mine { display:inline-flex; align-items:center; gap:0.35rem; padding:0.35rem 0.6rem; border:1px solid #cbd5e1; border-radius:6px; background:#fff; font-size:0.82rem; color:#334155; cursor:pointer; user-select:none; }',
            '.bdm-entries-mine input { margin:0; cursor:pointer; }',
            '.bdm-entries-mine:hover { background:#f1f5f9; }',
            '.bdm-entries-empty { padding:1.5rem 1rem; text-align:center; color:#64748b; }',
            '.bdm-entries-empty .hint { font-size:0.8rem; margin-top:0.35rem; color:#94a3b8; }',
            '.bdm-entries-error { padding:0.85rem 1rem; background:#fef2f2; border:1px solid #fecaca; border-radius:6px; color:#991b1b; font-size:0.85rem; }',
            '.bdm-entries-scroll { max-height: 440px; overflow:auto; border:1px solid #e2e8f0; border-radius:8px; }',
            '.bdm-row-del { background:transparent; border:none; cursor:pointer; color:#94a3b8; padding:0.25rem 0.4rem; border-radius:4px; }',
            '.bdm-row-del:hover { background:#fee2e2; color:#b91c1c; }'
        ].join('\n');
        document.head.appendChild(st);
    }

    function render(main) {
        injectStylesOnce();
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
                '<div style="margin-top:1rem; display:flex; gap:0.75rem; flex-wrap:wrap;">' +
                    '<button id="be-save" class="btn btn-primary">💾 Save Entry</button>' +
                    '<span id="be-status" style="align-self:center; color:#64748b;"></span>' +
                '</div>' +
            '</div>' +
            '<div class="card bdm-entries-card">' +
                '<div class="bdm-entries-toolbar">' +
                    '<div>' +
                        '<h3>Recent Entries</h3>' +
                        '<div class="meta" id="be-meta">&nbsp;</div>' +
                    '</div>' +
                    '<div class="bdm-entries-actions">' +
                        '<label class="bdm-entries-mine" title="Show only entries I created">' +
                            '<input type="checkbox" id="be-mine"' + (state.mineOnly ? ' checked' : '') + '>' +
                            '<span>Only mine</span>' +
                        '</label>' +
                        '<select id="be-filter" class="bdm-entries-select" title="Filter by type">' +
                            '<option value="quote">📝 Quotes</option>' +
                            '<option value="won">🏆 Wins</option>' +
                            '<option value="variation">➕ Variations</option>' +
                        '</select>' +
                        '<button id="be-refresh" class="bdm-entries-refresh" title="Refresh list">↻ Refresh</button>' +
                    '</div>' +
                '</div>' +
                '<div id="be-list">' + loadingHtml() + '</div>' +
            '</div>';

        document.getElementById('be-save').onclick = saveEntry;
        document.getElementById('be-filter').value = state.filterType;
        document.getElementById('be-filter').onchange = async function (e) {
            state.filterType = e.target.value;
            document.getElementById('be-list').innerHTML = loadingHtml();
            await loadEntries();
            renderList();
        };
        document.getElementById('be-refresh').onclick = async function () {
            document.getElementById('be-list').innerHTML = loadingHtml();
            await loadEntries();
            renderList();
        };
        var mineCb = document.getElementById('be-mine');
        if (mineCb) {
            mineCb.onchange = async function () {
                state.mineOnly = !!mineCb.checked;
                document.getElementById('be-list').innerHTML = loadingHtml();
                await loadEntries();
                renderList();
            };
        }
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
            var resp = unwrapApi(await window.apiCall('bdm-entries', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }));
            if (!resp || !resp.success) throw new Error((resp && resp.error) || 'Save failed');
            status.textContent = '✅ Saved. It will reflect in BDM Analytics.';
            status.style.color = '#059669';
            // clear value/number/notes; keep type/date/currency for fast entry
            document.getElementById('be-value').value = '';
            document.getElementById('be-num').value = '';
            document.getElementById('be-notes').value = '';
            // Always switch the filter to the saved type and refresh so the
            // user sees their entry appear immediately.
            await window._bdmEntriesReload(body.type);
            // Notify any other open module (e.g. BDM Analytics) that a new
            // entry exists, so it can refresh its live data without a full
            // page reload.
            try { window.dispatchEvent(new CustomEvent('bdm-quote-saved', { detail: { type: body.type, entry: resp.entry } })); } catch (e) { /* ignore */ }
        } catch (e) {
            status.textContent = '⚠️ ' + (e.message || e);
            status.style.color = '#dc2626';
        } finally {
            btn.disabled = false; btn.textContent = '💾 Save Entry';
        }
    }

    function typeBadge(t) {
        var meta = TYPE_META[String(t || '').toLowerCase()] || { label: t || '—', icon: '•', color: '#475569', bg: '#f1f5f9' };
        return '<span class="bdm-type-badge" style="color:' + meta.color + '; background:' + meta.bg + ';">' +
            meta.icon + ' ' + escapeHtml(meta.label) + '</span>';
    }

    function renderList() {
        var host = document.getElementById('be-list');
        var meta = document.getElementById('be-meta');
        if (!host) return;

        if (state.loading) { host.innerHTML = loadingHtml(); return; }

        if (state.lastError) {
            host.innerHTML = '<div class="bdm-entries-error">⚠️ Could not load entries: ' +
                escapeHtml(state.lastError) + '</div>';
            if (meta) meta.textContent = '';
            return;
        }

        var typeLabel = (TYPE_META[state.filterType] || {}).label || state.filterType;
        if (meta) {
            meta.textContent = state.entries.length
                ? 'Showing ' + state.entries.length + ' ' + typeLabel.toLowerCase() + (state.entries.length === 1 ? ' entry' : ' entries') + (state.mineOnly ? ' (yours only)' : '')
                : '';
        }

        if (!state.entries.length) {
            host.innerHTML =
                '<div class="bdm-entries-empty">' +
                    'No ' + escapeHtml(typeLabel.toLowerCase()) + ' entries yet' + (state.mineOnly ? ' for you' : '') + '.' +
                    '<div class="hint">' + (state.mineOnly
                        ? 'Untick "Only mine" above to see entries from the rest of the team, or use the form above to record one — it will appear here right away.'
                        : 'Use the form above to record your first entry — it will appear here right away.') + '</div>' +
                '</div>';
            return;
        }

        var rows = state.entries.map(function (e, i) {
            var safeId = encodeURIComponent(e.id || '');
            return '<tr>' +
                '<td class="muted">' + (i + 1) + '</td>' +
                '<td>' + typeBadge(e.type) + '</td>' +
                '<td>' + escapeHtml(fmtDate(e.date)) + '</td>' +
                '<td><strong>' + escapeHtml(e.bdmName || '') + '</strong></td>' +
                '<td>' + escapeHtml(e.projectNumber || '') + '</td>' +
                '<td>' + escapeHtml(e.projectName || '') + '</td>' +
                '<td>' + escapeHtml(e.clientCompany || '') + '</td>' +
                '<td class="num"><strong>' + escapeHtml(fmtMoney(e.value, e.currency)) + '</strong></td>' +
                '<td class="muted">' + escapeHtml(e.notes || '') + '</td>' +
                '<td><button class="bdm-row-del" title="Delete entry" onclick="window._beDelete(\'' + safeId + '\')">🗑️</button></td>' +
            '</tr>';
        }).join('');

        host.innerHTML =
            '<div class="bdm-entries-scroll">' +
                '<table class="bdm-entries-table">' +
                    '<thead><tr>' +
                        '<th style="width:42px;">#</th><th>Type</th><th>Date</th><th>BDM</th>' +
                        '<th>Number</th><th>Project</th><th>Client</th>' +
                        '<th class="num">Value</th><th>Notes</th><th style="width:42px;"></th>' +
                    '</tr></thead>' +
                    '<tbody>' + rows + '</tbody>' +
                '</table>' +
            '</div>';
    }

    window._beDelete = async function (id) {
        if (!id) return;
        if (!confirm('Delete this entry?')) return;
        try {
            var resp = unwrapApi(await window.apiCall('bdm-entries?id=' + encodeURIComponent(decodeURIComponent(id)), { method: 'DELETE' }));
            if (!resp || !resp.success) throw new Error((resp && resp.error) || 'Delete failed');
            await loadEntries();
            renderList();
        } catch (e) { alert(e.message || e); }
    };

    console.log('[bdm-entries] module loaded');
})();
