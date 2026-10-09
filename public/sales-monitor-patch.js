/* Sales portal: presentation only. Authorization is enforced by /api/sales-monitor. */
(function () {
    'use strict';
    const EMAIL = 'sales.edanbrook@outlook.com';
    let report = null, requestId = 0, page = 1, activeUid = null;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const money = value => value == null ? 'Not recorded' : Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const isSales = () => typeof currentUser !== 'undefined' && currentUser && (currentUser.email || '').trim().toLowerCase() === EMAIL;
    function filters() {
        return Object.fromEntries(['source', 'currency', 'bdm', 'from', 'to', 'search', 'kind'].map(key => [key, document.getElementById('sm-' + key)?.value || '']));
    }
    function table(headers, rows) {
        return `<div class="sm-scroll"><table><thead><tr>${headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}" class="sm-empty">No records match these filters.</td></tr>`}</tbody></table></div>`;
    }
    // Proposal statuses on project-record quotes; anything else is still open pipeline.
    const LOST = ['lost', 'rejected'], CLOSED = ['won', 'lost', 'rejected', 'subcontracted', 'cancelled'];
    const pct = (part, whole) => whole ? (part / whole * 100).toFixed(1) + '%' : '—';
    const quarter = date => date.slice(0, 4) + ' Q' + (Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1);
    let filtered = [];
    function render() {
        const output = document.getElementById('sm-results');
        if (!output || !report || !isSales()) return;
        const f = filters();
        if (f.from && f.to && f.from > f.to) { output.innerHTML = '<p class="sm-alert" role="alert">The start date must be on or before the end date.</p>'; return; }
        const sourceRows = report.rows.filter(r => r.source === f.source);
        const rows = sourceRows.filter(r => r.currency === f.currency && (!f.bdm || r.bdmUid === f.bdm) &&
            (!f.from || (r.date && r.date >= f.from)) && (!f.to || (r.date && r.date <= f.to)) &&
            (!f.search || `${r.projectName} ${r.projectNumber} ${r.client}`.toLowerCase().includes(f.search.toLowerCase())));
        const tracksOutcome = f.source === 'projects';
        const of = kind => rows.filter(r => r.kind === kind);
        const total = list => list.reduce((v, r) => v + (r.value || 0), 0);
        const wonRows = of('won'), quoteRows = of('quote');
        const wins = total(wonRows), variations = total(of('variation')), booked = wins + variations;
        const pricedWins = wonRows.filter(r => r.value != null);
        const decided = quoteRows.filter(r => r.status === 'won' || LOST.includes(r.status));
        const openQuotes = quoteRows.filter(r => !CLOSED.includes(r.status));
        const winRate = tracksOutcome ? pct(decided.filter(r => r.status === 'won').length, decided.length) : 'Not tracked';
        const bdms = new Map();
        const blank = name => ({ name, won: 0, quote: 0, variation: 0, count: 0, quotes: 0, decided: 0, wonQuotes: 0, pipeline: 0 });
        // Show zero-activity BDMs, too, when no individual BDM is selected.
        report.bdms.filter(b => !f.bdm || b.id === f.bdm).forEach(b => bdms.set(b.id, blank(b.name)));
        const months = new Map(), quarters = new Map(), clients = new Map();
        for (const r of rows) {
            if (!bdms.has(r.bdmUid)) bdms.set(r.bdmUid, blank(r.bdmName));
            const b = bdms.get(r.bdmUid); b[r.kind] += r.value || 0;
            if (r.kind === 'won') b.count++;
            if (r.kind === 'quote') {
                b.quotes++;
                if (r.status === 'won' || LOST.includes(r.status)) { b.decided++; if (r.status === 'won') b.wonQuotes++; }
                if (!CLOSED.includes(r.status)) b.pipeline += r.value || 0;
            }
            if (r.kind !== 'quote' && r.date) { const key = r.date.slice(0, 7); months.set(key, (months.get(key) || 0) + (r.value || 0)); }
            if (r.date) {
                const q = quarters.get(quarter(r.date)) || { won: 0, wonCount: 0, variation: 0, quote: 0, quoteCount: 0 };
                q[r.kind] += r.value || 0; if (r.kind === 'won') q.wonCount++; if (r.kind === 'quote') q.quoteCount++;
                quarters.set(quarter(r.date), q);
            }
            if (r.kind !== 'quote') {
                const name = r.client || 'Client not recorded';
                const c = clients.get(name) || { name, booked: 0, projects: new Set() };
                c.booked += r.value || 0; c.projects.add(r.projectId); clients.set(name, c);
            }
        }
        const ranking = [...bdms.values()].sort((a, b) => (b.won + b.variation) - (a.won + a.variation));
        const monthly = [...months.entries()].sort(([a], [b]) => a.localeCompare(b));
        const quarterly = [...quarters.entries()].sort(([a], [b]) => b.localeCompare(a));
        const topClients = [...clients.values()].sort((a, b) => b.booked - a.booked).slice(0, 10);
        const pipeline = [...openQuotes].sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 10);
        const max = Math.max(1, ...monthly.map(([, value]) => Math.abs(value)));
        const details = rows.filter(r => !f.kind || r.kind === f.kind).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        filtered = details;
        const pages = Math.max(1, Math.ceil(details.length / 25)); page = Math.min(page, pages);
        const missingDates = sourceRows.filter(r => !r.date).length;
        const missingValues = rows.filter(r => r.value == null).length;
        const cur = esc(f.currency);
        const card = (label, value, caption) => `<article class="sm-card"><span>${label}</span><strong>${value}</strong><small>${caption}</small></article>`;
        const period = f.from || f.to ? `${esc(f.from || 'start')} to ${esc(f.to || 'today')}` : 'All dates';
        const scope = [period, f.bdm ? esc(ranking[0]?.name || '') : 'All BDMs', f.search ? `“${esc(f.search)}”` : ''].filter(Boolean).join(' · ');
        output.innerHTML = `${missingDates || missingValues || f.currency === 'UNSPECIFIED' ? `<p class="sm-alert">${missingDates ? `${missingDates} source record(s) have no event date and are excluded when dates are filtered. ` : ''}${missingValues ? `${missingValues} matching record(s) have no value and are excluded from monetary totals. ` : ''}${f.currency === 'UNSPECIFIED' ? 'Currency is not recorded for this group; do not compare this total with other currencies.' : ''}</p>` : ''}
            <div class="sm-report-head"><div><h2>Sales performance report</h2><span>${f.source === 'manual' ? 'Manual BDM uploads' : 'Project records'} · ${cur} · ${scope}</span></div><div class="sm-actions"><button type="button" id="sm-csv">Export CSV</button><button type="button" id="sm-print">Print / Save PDF</button></div></div>
            <div class="sm-cards">${card('Booked sales', money(booked), cur + ' · wins + variations')}${card('Won project value', money(wins), wonRows.length + ' won records')}${card('Approved / recorded variations', money(variations), of('variation').length + ' variations · ' + cur)}${card('Quoted value', money(total(quoteRows)), quoteRows.length + ' quotes · separate from booked sales')}
            ${card('Average deal size', pricedWins.length ? money(total(pricedWins) / pricedWins.length) : '—', 'Won value ÷ priced wins')}${card('Win rate', winRate, tracksOutcome ? `${decided.filter(r => r.status === 'won').length} won of ${decided.length} decided quotes` : 'Manual uploads have no won/lost outcome')}${card('Open pipeline', tracksOutcome ? money(total(openQuotes)) : 'Not tracked', tracksOutcome ? openQuotes.length + ' quotes awaiting a decision' : 'Use project records for pipeline')}${card('Variation share', pct(variations, booked), 'Of booked sales')}</div>
            <section class="sm-panel"><div class="sm-section-title"><h2>BDM performance</h2><span>${cur} · ${ranking.length} BDMs · ranked by booked sales</span></div>${table(['Rank', 'BDM', 'Won', 'Won value', 'Variations', 'Booked sales', 'Share', 'Avg deal', 'Quotes', 'Quoted value', 'Win rate', 'Open pipeline'], ranking.map((b, i) => `<tr><td>${i + 1}</td><td><strong>${esc(b.name)}</strong></td><td>${b.count}</td><td>${money(b.won)}</td><td>${money(b.variation)}</td><td class="sm-total">${money(b.won + b.variation)}</td><td>${pct(b.won + b.variation, booked)}</td><td>${b.count ? money(b.won / b.count) : '—'}</td><td>${b.quotes}</td><td>${money(b.quote)}</td><td>${tracksOutcome ? pct(b.wonQuotes, b.decided) : '—'}</td><td>${tracksOutcome ? money(b.pipeline) : '—'}</td></tr>`))}</section>
            <section class="sm-panel"><div class="sm-section-title"><h2>Quarterly summary</h2><span>${cur} · dated records</span></div>${table(['Quarter', 'Won', 'Won value', 'Variations', 'Booked sales', 'Quotes issued', 'Quoted value'], quarterly.map(([q, v]) => `<tr><td><strong>${esc(q)}</strong></td><td>${v.wonCount}</td><td>${money(v.won)}</td><td>${money(v.variation)}</td><td class="sm-total">${money(v.won + v.variation)}</td><td>${v.quoteCount}</td><td>${money(v.quote)}</td></tr>`))}</section>
            <section class="sm-panel"><div class="sm-section-title"><h2>Monthly booked sales</h2><span>${cur} · dated records</span></div><div class="sm-trend">${monthly.length ? monthly.map(([month, value]) => `<div class="sm-bar-row"><span>${esc(month)}</span><div class="sm-bar-track"><div class="sm-bar" style="width:${Math.min(100, Math.abs(value) / max * 100)}%"></div></div><strong>${money(value)}</strong></div>`).join('') : '<p class="sm-empty">No dated sales in this selection.</p>'}</div></section>
            <div class="sm-split"><section class="sm-panel"><div class="sm-section-title"><h2>Top clients</h2><span>${cur} · by booked sales</span></div>${table(['Client', 'Projects', 'Booked sales', 'Share'], topClients.map(c => `<tr><td><strong>${esc(c.name)}</strong></td><td>${c.projects.size}</td><td class="sm-total">${money(c.booked)}</td><td>${pct(c.booked, booked)}</td></tr>`))}</section>
            <section class="sm-panel"><div class="sm-section-title"><h2>Open pipeline</h2><span>${tracksOutcome ? `${cur} · top ${pipeline.length} quotes awaiting decision` : 'Not tracked for manual uploads'}</span></div>${table(['Quoted', 'Project', 'BDM', 'Stage', 'Value'], tracksOutcome ? pipeline.map(r => `<tr><td>${esc(r.date || 'No date')}</td><td><strong>${esc(r.projectName)}</strong><small>${esc(r.client || '')}</small></td><td>${esc(r.bdmName)}</td><td><span class="sm-tag">${esc(String(r.status).replace(/_/g, ' '))}</span></td><td class="sm-total">${money(r.value)}</td></tr>`) : [])}</section></div>
            <section class="sm-panel sm-details"><div class="sm-section-title"><h2>Project revenue details</h2><span>${details.length} matching records</span></div>${table(['Date', 'Project / reference', 'Client', 'BDM', 'Type', 'Status', 'Value (' + f.currency + ')'], details.slice((page - 1) * 25, page * 25).map(r => `<tr><td>${esc(r.date || 'No date')}</td><td><strong>${esc(r.projectName)}</strong><small>${esc(r.projectNumber)}</small></td><td>${esc(r.client || '—')}</td><td>${esc(r.bdmName)}</td><td><span class="sm-tag">${esc(r.kind)}</span></td><td>${esc(String(r.status).replace(/_/g, ' '))}</td><td class="sm-total">${money(r.value)}</td></tr>`))}<div class="sm-pages"><button type="button" id="sm-prev" ${page === 1 ? 'disabled' : ''}>Previous</button><span>Page ${page} of ${pages}</span><button type="button" id="sm-next" ${page === pages ? 'disabled' : ''}>Next</button></div></section>
            <p class="sm-note">Generated ${esc(new Date(report.generatedAt).toLocaleString())}. Win rate counts priced proposals already marked won or lost/rejected; open pipeline is priced proposals not yet decided. Figures are booked sales, not invoiced revenue or cash received.</p>`;
        document.getElementById('sm-prev').onclick = () => { page--; render(); };
        document.getElementById('sm-next').onclick = () => { page++; render(); };
        document.getElementById('sm-csv').onclick = exportCsv;
        document.getElementById('sm-print').onclick = () => window.print();
    }
    function exportCsv() {
        const cell = value => { let s = String(value ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
        const lines = [['Date', 'Project', 'Project number', 'Client', 'BDM', 'Type', 'Status', 'Currency', 'Value'].map(cell).join(',')]
            .concat(filtered.map(r => [r.date, r.projectName, r.projectNumber, r.client, r.bdmName, r.kind, r.status, r.currency, r.value ?? ''].map(cell).join(',')));
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
        link.download = `sales-report-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }
    function populate() {
        const currencies = [...new Set(report.rows.filter(r => r.source === document.getElementById('sm-source').value).map(r => r.currency))].sort();
        const selector = document.getElementById('sm-currency'); const previous = selector.value;
        selector.innerHTML = (currencies.length ? currencies : ['INR']).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
        selector.value = currencies.includes(previous) ? previous : currencies.includes('INR') ? 'INR' : currencies[0] || 'INR';
        const bdmSelector = document.getElementById('sm-bdm'), selectedBdm = bdmSelector.value;
        const bdms = new Map(report.bdms.map(b => [b.id, b.name])); report.rows.forEach(r => bdms.set(r.bdmUid, r.bdmName));
        bdmSelector.innerHTML = '<option value="">All BDMs</option>' + [...bdms.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join('');
        if (bdms.has(selectedBdm)) bdmSelector.value = selectedBdm;
    }
    async function refresh() {
        const id = ++requestId; const uid = currentUser?.uid;
        const output = document.getElementById('sm-results');
        const button = document.getElementById('sm-refresh');
        output.innerHTML = '<p class="sm-empty" role="status">Loading sales data…</p>'; button.disabled = true;
        document.getElementById('sm-updated').textContent = 'Updating…';
        try {
            const result = await apiCall('sales-monitor');
            if (id !== requestId || !isSales() || currentUser.uid !== uid || !document.getElementById('sm-results')) return;
            if (!result.success || !result.data) throw new Error(result.error || 'Unable to load sales data.');
            report = result.data; populate(); render();
            document.getElementById('sm-updated').textContent = 'Updated ' + new Date(report.generatedAt).toLocaleString();
        } catch (error) {
            if (id === requestId && isSales() && document.getElementById('sm-results')) {
                report = null; output.innerHTML = `<p class="sm-alert" role="alert">${esc(error.message)} Select Refresh to try again.</p>`;
                document.getElementById('sm-updated').textContent = 'Update failed';
            }
        } finally { if (id === requestId) button.disabled = false; }
    }
    window.showSalesMonitor = function () {
        if (!isSales()) return;
        activeUid = currentUser.uid;
        const main = document.getElementById('mainContent');
        main.innerHTML = `<div class="sm"><header class="sm-hero"><div><div class="sm-eyebrow">WEST EPCM · SALES INTELLIGENCE</div><h1>Sales revenue monitor</h1><p>A clear view of sales performance across BDMs and projects.</p></div><span class="sm-readonly">Read-only access</span></header>
            <div class="sm-toolbar"><span id="sm-updated" aria-live="polite">Waiting for data</span><button type="button" id="sm-refresh">Refresh data</button></div>
            <section class="sm-panel sm-filters" aria-label="Sales filters">
            <label>Data source<select id="sm-source"><option value="projects">Project records</option><option value="manual">Manual BDM uploads</option></select></label>
            <label>Currency<select id="sm-currency"><option>INR</option></select></label>
            <label>BDM<select id="sm-bdm"><option value="">All BDMs</option></select></label>
            <label>From date<input type="date" id="sm-from"></label><label>To date<input type="date" id="sm-to"></label>
            <label>Project / client<input type="search" id="sm-search" placeholder="Search projects or clients"></label>
            <label>Detail rows<select id="sm-kind"><option value="">All types</option><option value="won">Won projects</option><option value="quote">Quotes</option><option value="variation">Variations</option></select></label>
            <button type="button" id="sm-reset">Reset filters</button></section>
            <p class="sm-note">Booked sales = won project / PO value + approved variations. Manual uploads use the values recorded by BDMs and are shown separately to avoid overlap. Quotes are separate from booked sales. Amounts stay in their original currency; these figures do not represent invoices or payments received. Date filters use the win, quote, or variation event date. “Detail rows” filters only the final table.</p>
            <div id="sm-results" aria-live="polite"></div></div>`;
        document.getElementById('sm-refresh').onclick = refresh;
        document.getElementById('sm-reset').onclick = () => { ['bdm', 'from', 'to', 'search', 'kind'].forEach(k => document.getElementById('sm-' + k).value = ''); page = 1; render(); };
        main.querySelectorAll('.sm-filters input, .sm-filters select').forEach(el => el.addEventListener(el.type === 'search' ? 'input' : 'change', () => { page = 1; if (el.id === 'sm-source' && report) populate(); render(); }));
        refresh();
    };
    document.addEventListener('DOMContentLoaded', () => {
        firebase.auth().onAuthStateChanged(user => {
            if (!user || user.uid !== activeUid) { report = null; requestId++; }
            if (!user || (user.email || '').trim().toLowerCase() !== EMAIL) {
                document.getElementById('appContainer')?.classList.remove('sales-portal');
                document.querySelector('#mainContent .sm')?.remove();
                activeUid = null;
            }
        });
        // Prevent late legacy navigation callbacks replacing the monitoring screen.
        let frame = null;
        const app = document.getElementById('appContainer');
        new MutationObserver(() => {
            if (frame !== null || !isSales()) return;
            frame = requestAnimationFrame(() => {
                frame = null;
                if (!isSales() || app.style.display === 'none') return;
                app.classList.add('sales-portal');
                app.classList.remove('top-menu-mode');
                if (!document.querySelector('#mainContent .sm')) window.showSalesMonitor();
            });
        }).observe(app, { childList: true, subtree: true });
    });
})();
