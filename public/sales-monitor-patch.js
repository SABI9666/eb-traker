/* Sales portal: presentation only. Authorization is enforced by /api/sales-monitor. */
(function () {
    'use strict';
    const EMAIL = 'sales.edanbrook@outlook.com';
    let report = null, requestId = 0, page = 1, activeUid = null;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const money = value => value == null ? 'Not recorded' : Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const isSales = () => typeof currentUser !== 'undefined' && currentUser && (currentUser.email || '').trim().toLowerCase() === EMAIL;
    // COO / Director open the same report from their hub; the API enforces access.
    const isManagement = () => typeof currentUserRole !== 'undefined' && ['coo', 'director'].includes(String(currentUserRole || '').toLowerCase());
    const canView = () => typeof currentUser !== 'undefined' && !!currentUser && (isSales() || isManagement());
    // BDM sales come from values entered in "Upload Quote / Won". Uploads began in April 2026, so
    // proposals marked won from Dec 2025 to Mar 2026 fill the earlier months (wins only, never quotes).
    const SOURCES = { all: 'All sources', manual: 'BDM quote uploads', proposals: 'Proposal wins (Dec 2025 – Mar 2026)', purchase: 'Purchase portal projects' };
    const SOURCE_TAGS = { manual: 'BDM upload', proposals: 'Proposal won', purchase: 'Purchase project' };
    function filters() {
        return Object.fromEntries(['source', 'currency', 'bdm', 'from', 'to', 'search', 'kind'].map(key => [key, document.getElementById('sm-' + key)?.value || '']));
    }
    function table(headers, rows) {
        return `<div class="sm-scroll"><table><thead><tr>${headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}" class="sm-empty">No records match these filters.</td></tr>`}</tbody></table></div>`;
    }
    const pct = (part, whole) => whole ? (part / whole * 100).toFixed(1) + '%' : '—';
    const quarter = date => date.slice(0, 4) + ' Q' + (Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1);
    // Same fixed rates as the COO BDM analysis (EB-Backend api/bdm-analytics.js), so combined totals match it.
    const TO_INR = { INR: 1, USD: 90.0, AUD: 55.0, NZD: 51.0, EUR: 90.0, GBP: 105.0, SGD: 62.0, AED: 22.7, CAD: 61.0, JPY: 0.55 };
    const ALL = 'ALL_INR';
    const inr = r => r.value == null ? null : r.value * (TO_INR[r.currency] ?? 1);
    // Reporting starts in December 2025; earlier and undated records are left out.
    const START = '2025-12-01';
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const utc = iso => new Date(iso + 'T00:00:00Z');
    const day = d => d.toISOString().slice(0, 10);
    const weekStart = iso => { const d = utc(iso); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return day(d); };
    const shortDate = iso => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
    // Names typed all in capitals or all in lower case are shown in title case.
    const person = name => name && (name === name.toUpperCase() || name === name.toLowerCase())
        ? name.toLowerCase().replace(/(^|[\s.'-])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase()) : name;
    let filtered = [], trend = 'month', charts = [];
    // Proposal charts, as on the COO analytics dashboard: proposals marked won since 1 Dec 2025, at quoted value.
    const usd = v => '$' + Math.round(v).toLocaleString('en-US');
    const usdAxis = v => Math.abs(v) >= 1000 ? '$' + v / 1000 + 'k' : '$' + v;
    function drawCharts() {
        charts.forEach(c => c.destroy()); charts = [];
        if (typeof Chart === 'undefined') return;
        const wins = report.proposalWins || [], byMonth = new Map(), byBdm = new Map();
        wins.forEach(w => { byMonth.set(w.date.slice(0, 7), (byMonth.get(w.date.slice(0, 7)) || 0) + w.value); byBdm.set(w.bdmName, (byBdm.get(w.bdmName) || 0) + w.value); });
        const months = periods(START, day(new Date()), 'month'), bdms = [...byBdm.entries()].sort((a, b) => b[1] - a[1]);
        const valueLabels = { id: 'smValueLabels', afterDatasetsDraw(chart) {
            const c = chart.ctx, horizontal = chart.options.indexAxis === 'y';
            c.save(); c.font = '600 11px sans-serif'; c.fillStyle = '#173450';
            c.textAlign = horizontal ? 'left' : 'center'; c.textBaseline = horizontal ? 'middle' : 'bottom';
            chart.getDatasetMeta(0).data.forEach((bar, i) => { const v = chart.data.datasets[0].data[i]; if (v) c.fillText(usd(v), horizontal ? bar.x + 6 : bar.x, horizontal ? bar.y : bar.y - 4); });
            c.restore();
        } };
        const tooltip = { callbacks: { label: ctx => usd(ctx.raw) } };
        const month = document.getElementById('sm-chart-month'), bdm = document.getElementById('sm-chart-bdm');
        if (month) charts.push(new Chart(month, { type: 'bar', plugins: [valueLabels],
            data: { labels: months.map(m => m.label), datasets: [{ data: months.map(m => byMonth.get(m.key) || 0), backgroundColor: '#39a8ae', borderRadius: 5 }] },
            options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 18 } }, plugins: { legend: { display: false }, tooltip },
                scales: { y: { beginAtZero: true, ticks: { callback: usdAxis } }, x: { grid: { display: false } } } } }));
        if (bdm) charts.push(new Chart(bdm, { type: 'bar', plugins: [valueLabels],
            data: { labels: bdms.map(b => person(b[0])), datasets: [{ data: bdms.map(b => b[1]), backgroundColor: ['#1f5e8a', '#39a8ae', '#f2b24c', '#8e6cc4', '#e57f4f', '#5fb07a', '#d1606b', '#8696a7'], borderRadius: 5 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, layout: { padding: { right: 80 } }, plugins: { legend: { display: false }, tooltip },
                scales: { x: { beginAtZero: true, ticks: { callback: usdAxis } }, y: { grid: { display: false } } } } }));
    }
    // Every week or month from the report start to the end of the selection, including empty ones.
    function periods(from, to, mode = trend) {
        const list = [];
        if (mode === 'week') {
            for (const d = utc(weekStart(from)); day(d) <= to; d.setUTCDate(d.getUTCDate() + 7)) {
                const end = new Date(d); end.setUTCDate(end.getUTCDate() + 6);
                list.push({ key: day(d), label: `${shortDate(day(d))} – ${shortDate(day(end))} ${day(end).slice(0, 4)}` });
            }
        } else {
            for (let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7)); `${y}-${String(m).padStart(2, '0')}` <= to.slice(0, 7); m === 12 ? (y++, m = 1) : m++)
                list.push({ key: `${y}-${String(m).padStart(2, '0')}`, label: `${MONTHS[m - 1]} ${y}` });
        }
        return list;
    }
    function render() {
        const output = document.getElementById('sm-results');
        if (!output || !report || !canView()) return;
        const f = filters();
        if (!f.from || f.from < START) f.from = START;
        if (f.from && f.to && f.from > f.to) { output.innerHTML = '<p class="sm-alert" role="alert">The start date must be on or before the end date.</p>'; return; }
        const sourceRows = report.rows.filter(r => f.source === 'all' || r.source === f.source);
        const rows = sourceRows.filter(r => (f.currency === ALL || r.currency === f.currency) && (!f.bdm || r.bdmUid === f.bdm) &&
            (!f.from || (r.date && r.date >= f.from)) && (!f.to || (r.date && r.date <= f.to)) &&
            (!f.search || `${r.projectName} ${r.projectNumber} ${r.client}`.toLowerCase().includes(f.search.toLowerCase())))
            .map(r => f.currency === ALL ? { ...r, value: inr(r), currency: 'INR' } : r);
        const of = kind => rows.filter(r => r.kind === kind);
        const total = list => list.reduce((v, r) => v + (r.value || 0), 0);
        const wonRows = of('won'), quoteRows = of('quote');
        // Purchase portal projects are not BDM sales: initial sales value only, kept out of BDM figures.
        const purchaseRows = of('purchase').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const showPurchase = f.source === 'all' || f.source === 'purchase';
        const wins = total(wonRows), variations = total(of('variation')), purchaseSales = total(purchaseRows), bdmBooked = wins + variations, booked = bdmBooked + purchaseSales;
        const pricedWins = wonRows.filter(r => r.value != null);
        const quoted = total(quoteRows);
        const bdms = new Map();
        const blank = name => ({ name, won: 0, quote: 0, variation: 0, count: 0, quotes: 0 });
        // Show zero-activity BDMs, too, when no individual BDM is selected.
        report.bdms.filter(b => !f.bdm || b.id === f.bdm).forEach(b => bdms.set(b.id, blank(b.name)));
        const months = new Map(), quarters = new Map();
        for (const r of rows) {
            const b = r.kind === 'purchase' ? blank('') : (bdms.get(r.bdmUid) || bdms.set(r.bdmUid, blank(r.bdmName)).get(r.bdmUid));
            if (r.kind !== 'purchase') b[r.kind] += r.value || 0;
            if (r.kind === 'won') b.count++;
            if (r.kind === 'quote') b.quotes++;
            if (r.date) {
                const key = trend === 'week' ? weekStart(r.date) : r.date.slice(0, 7);
                const t = months.get(key) || { won: 0, wonCount: 0, variation: 0, quote: 0, quoteCount: 0, purchase: 0, purchaseCount: 0 };
                t[r.kind] += r.value || 0; t[r.kind + 'Count'] += r.kind === 'variation' ? 0 : 1;
                months.set(key, t);
            }
            if (r.date) {
                const q = quarters.get(quarter(r.date)) || { won: 0, wonCount: 0, variation: 0, quote: 0, quoteCount: 0, purchase: 0, purchaseCount: 0 };
                q[r.kind] += r.value || 0; q[r.kind + 'Count'] += r.kind === 'variation' ? 0 : 1;
                quarters.set(quarter(r.date), q);
            }
        }
        // Rank by booked sales, then quoted value; BDMs with no uploads in the period are listed after a summary line.
        const all = [...bdms.values()];
        const ranking = all.filter(b => b.count || b.quotes || b.won || b.variation || b.quote)
            .sort((a, b) => (b.won + b.variation) - (a.won + a.variation) || b.quote - a.quote || a.name.localeCompare(b.name));
        const idle = all.filter(b => !ranking.includes(b)).map(b => b.name).sort((a, b) => a.localeCompare(b));
        const last = rows.reduce((m, r) => r.date > m ? r.date : m, '');
        const end = f.to || [day(new Date()), last].sort()[1];
        const series = periods(f.from, end).map(p => ({ ...p, ...(months.get(p.key) || { won: 0, wonCount: 0, variation: 0, quote: 0, quoteCount: 0, purchase: 0, purchaseCount: 0 }) })).reverse();
        const quarterly = [...quarters.entries()].sort(([a], [b]) => b.localeCompare(a));
        const max = Math.max(1, ...series.map(p => Math.abs(p.won + p.variation + p.purchase)));
        const details = rows.filter(r => !f.kind || r.kind === f.kind).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        filtered = details;
        const pages = Math.max(1, Math.ceil(details.length / 25)); page = Math.min(page, pages);
        const missingDates = sourceRows.filter(r => !r.date).length;
        const before = sourceRows.filter(r => r.date && r.date < START).length;
        const missingValues = rows.filter(r => r.value == null).length;
        const cur = f.currency === ALL ? 'INR (all currencies converted)' : esc(f.currency);
        const card = (label, value, caption) => `<article class="sm-card"><span>${label}</span><strong>${value}</strong><small>${caption}</small></article>`;
        const period = `${esc(f.from)} to ${esc(f.to || 'today')}`;
        const scope = [period, f.bdm ? esc((ranking[0] || all[0])?.name || '') : 'All BDMs', f.search ? `“${esc(f.search)}”` : ''].filter(Boolean).join(' · ');
        output.innerHTML = `${missingDates || missingValues || f.currency === 'UNSPECIFIED' ? `<p class="sm-alert">${missingDates ? `${missingDates} record(s) have no event date and are not included in this report. ` : ''}${missingValues ? `${missingValues} matching record(s) have no value and are excluded from monetary totals. ` : ''}${f.currency === 'UNSPECIFIED' ? 'Currency is not recorded for this group; do not compare this total with other currencies.' : ''}</p>` : ''}
            <div class="sm-report-head"><div><h2>Sales performance report</h2><span>${SOURCES[f.source]} · ${cur} · ${scope}</span></div><div class="sm-actions"><button type="button" id="sm-csv">Export CSV</button><button type="button" id="sm-print">Print / Save PDF</button></div></div>
            <div class="sm-cards">${card('Booked sales', money(booked), cur + ' · wins + variations' + (showPurchase ? ' + purchase projects' : ''))}${card('Won project value', money(wins), wonRows.length + ' wins')}${card('Variations', money(variations), of('variation').length + ' uploaded variations · ' + cur)}${card('Quoted value', money(quoted), quoteRows.length + ' quotes uploaded · separate from booked sales')}
            ${card('Average deal size', pricedWins.length ? money(total(pricedWins) / pricedWins.length) : '—', 'Won value ÷ priced wins')}${card('Quote conversion', pct(wins, quoted), 'Won value ÷ quoted value')}${card('Variation share', pct(variations, booked), 'Of booked sales')}${showPurchase ? card('Purchase project sales', money(purchaseSales), purchaseRows.length + ' projects · initial sales value · not BDM sales') : ''}</div>
            <div class="sm-charts"><section class="sm-panel"><div class="sm-section-title"><h2>Monthly revenue (won proposals)</h2><span>USD · proposals marked won since Dec 2025 · not affected by the filters above</span></div><div class="sm-chart"><canvas id="sm-chart-month" role="img" aria-label="Monthly booked sales"></canvas></div></section>
            <section class="sm-panel"><div class="sm-section-title"><h2>BDM performance (won revenue)</h2><span>USD · proposals marked won since Dec 2025 · not affected by the filters above</span></div><div class="sm-chart"><canvas id="sm-chart-bdm" role="img" aria-label="Booked sales by BDM"></canvas></div></section></div>
            <section class="sm-panel"><div class="sm-section-title"><h2>BDM performance</h2><span>${cur} · ${ranking.length} active BDM${ranking.length === 1 ? '' : 's'} · ranked by booked sales · Upload Quote / Won values + proposal wins before April 2026</span></div>${table(['Rank', 'BDM', 'Quotes', 'Quoted value', 'Wins', 'Won value', 'Variations', 'Booked sales', 'Share', 'Avg deal', 'Conversion'], ranking.map((b, i) => `<tr><td>${i + 1}</td><td class="sm-name"><strong>${esc(b.name)}</strong></td><td class="sm-num">${b.quotes}</td><td class="sm-num">${money(b.quote)}</td><td class="sm-num">${b.count}</td><td class="sm-num">${money(b.won)}</td><td class="sm-num">${b.variation ? money(b.variation) : '—'}</td><td class="sm-total sm-num">${money(b.won + b.variation)}</td><td class="sm-num">${pct(b.won + b.variation, bdmBooked)}</td><td class="sm-num">${b.count ? money(b.won / b.count) : '—'}</td><td class="sm-num">${pct(b.won, b.quote)}</td></tr>`).concat(ranking.length ? [`<tr class="sm-sum"><td></td><td><strong>Total</strong></td><td class="sm-num">${ranking.reduce((n, b) => n + b.quotes, 0)}</td><td class="sm-num">${money(quoted)}</td><td class="sm-num">${wonRows.length}</td><td class="sm-num">${money(wins)}</td><td class="sm-num">${variations ? money(variations) : '—'}</td><td class="sm-total sm-num">${money(bdmBooked)}</td><td class="sm-num">${bdmBooked ? '100.0%' : '—'}</td><td class="sm-num">${pricedWins.length ? money(total(pricedWins) / pricedWins.length) : '—'}</td><td class="sm-num">${pct(wins, quoted)}</td></tr>`] : []))}${idle.length ? `<p class="sm-idle">No uploads in this period: ${idle.map(esc).join(', ')}</p>` : ''}</section>
            <section class="sm-panel"><div class="sm-section-title"><h2>Quarterly summary</h2><span>${cur} · dated records</span></div>${table(['Quarter', 'Won', 'Won value', 'Variations', 'Purchase projects', 'Booked sales', 'Quotes issued', 'Quoted value'], quarterly.map(([q, v]) => `<tr><td><strong>${esc(q)}</strong></td><td>${v.wonCount}</td><td>${money(v.won)}</td><td>${money(v.variation)}</td><td>${money(v.purchase)}</td><td class="sm-total">${money(v.won + v.variation + v.purchase)}</td><td>${v.quoteCount}</td><td>${money(v.quote)}</td></tr>`))}</section>
            <section class="sm-panel"><div class="sm-section-title"><h2>${trend === 'week' ? 'Weekly' : 'Monthly'} sales</h2><div class="sm-toggle" role="group" aria-label="Sales period"><button type="button" data-trend="week" aria-pressed="${trend === 'week'}">Weekly</button><button type="button" data-trend="month" aria-pressed="${trend === 'month'}">Monthly</button></div></div>
            <div class="sm-scroll sm-trend-table">${table([trend === 'week' ? 'Week (Mon – Sun)' : 'Month', 'Won', 'Won value', 'Variations', 'Purchase projects', 'Booked sales', '', 'Quotes', 'Quoted value'], series.map(p => `<tr><td><strong>${esc(p.label)}</strong></td><td>${p.wonCount}</td><td>${money(p.won)}</td><td>${money(p.variation)}</td><td>${money(p.purchase)}</td><td class="sm-total">${money(p.won + p.variation + p.purchase)}</td><td class="sm-bar-cell"><div class="sm-bar-track"><div class="sm-bar" style="width:${Math.min(100, Math.abs(p.won + p.variation + p.purchase) / max * 100)}%"></div></div></td><td>${p.quoteCount}</td><td>${money(p.quote)}</td></tr>`))}</div></section>
            ${showPurchase ? `<section class="sm-panel"><div class="sm-section-title"><h2>Purchase portal projects</h2><span>${cur} · initial sales value approved by COO / Director · not attributed to BDMs</span></div>${table(['Award / PO date', 'Project number', 'Project', 'Client', 'Initial sales value'], purchaseRows.map(r => `<tr><td>${esc(r.date || 'No date')}</td><td><strong>${esc(r.projectNumber)}</strong></td><td><strong>${esc(r.projectName)}</strong></td><td>${esc(r.client || '—')}</td><td class="sm-total">${money(r.value)}</td></tr>`))}</section>` : ''}
            <section class="sm-panel sm-details"><div class="sm-section-title"><h2>Project revenue details</h2><span>${details.length} matching records</span></div>${table(['Date', 'Project / reference', 'Client', 'BDM', 'Type', 'Status', 'Value (' + (f.currency === ALL ? 'INR' : f.currency) + ')'], details.slice((page - 1) * 25, page * 25).map(r => `<tr><td>${esc(r.date || 'No date')}</td><td><strong>${esc(r.projectName)}</strong><small>${esc(r.projectNumber)}</small></td><td>${esc(r.client || '—')}</td><td class="sm-name">${esc(r.bdmName)}</td><td><span class="sm-tag">${esc(r.kind === 'purchase' ? 'purchase project' : r.kind)}</span>${f.source === 'all' ? `<small>${SOURCE_TAGS[r.source]}</small>` : ''}</td><td>${esc(String(r.status).replace(/_/g, ' '))}</td><td class="sm-total">${money(r.value)}</td></tr>`))}<div class="sm-pages"><button type="button" id="sm-prev" ${page === 1 ? 'disabled' : ''}>Previous</button><span>Page ${page} of ${pages}</span><button type="button" id="sm-next" ${page === pages ? 'disabled' : ''}>Next</button></div></section>
            <p class="sm-note">Report period starts 1 Dec 2025${before ? ` (${before} earlier record(s) not shown)` : ''}. ${f.currency === ALL ? 'Converted to INR at the fixed rates used by the COO BDM analysis (USD 90, AUD 55, NZD 51, EUR 90, GBP 105, SGD 62, AED 22.7, CAD 61, JPY 0.55); unrecorded currencies are counted as INR. ' : ''}${f.source === 'all' ? 'All sources adds BDM quote uploads, proposal wins dated 1 Dec 2025 – 31 Mar 2026 and approved purchase portal projects together. ' : ''}Generated ${esc(new Date(report.generatedAt).toLocaleString())}. BDM quotes and variations are only the values entered in Upload Quote / Won. Wins are uploaded wins plus proposals marked won from 1 Dec 2025 to 31 Mar 2026 (before uploads began); proposal quotes and later proposal wins are not included. Conversion is won value ÷ quoted value. Figures are booked sales, not invoiced revenue or cash received.</p>`;
        document.getElementById('sm-prev').onclick = () => { page--; render(); };
        document.getElementById('sm-next').onclick = () => { page++; render(); };
        document.getElementById('sm-csv').onclick = exportCsv;
        drawCharts();
        output.querySelectorAll('[data-trend]').forEach(b => b.onclick = () => { trend = b.dataset.trend; render(); });
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
        const source = document.getElementById('sm-source').value;
        const currencies = [...new Set(report.rows.filter(r => source === 'all' || r.source === source).map(r => r.currency))].sort();
        const selector = document.getElementById('sm-currency'); const previous = selector.value;
        selector.innerHTML = `<option value="${ALL}">All currencies (in INR)</option>` + currencies.map(c => `<option value="${esc(c)}">${esc(c)} only</option>`).join('');
        selector.value = currencies.includes(previous) ? previous : ALL;
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
            if (id !== requestId || !canView() || currentUser.uid !== uid || !document.getElementById('sm-results')) return;
            if (!result.success || !result.data) throw new Error(result.error || 'Unable to load sales data.');
            report = result.data;
            report.rows.forEach(r => { r.bdmName = person(r.bdmName); });
            report.bdms.forEach(b => { b.name = person(b.name); });
            populate(); render();
            document.getElementById('sm-updated').textContent = 'Updated ' + new Date(report.generatedAt).toLocaleString();
        } catch (error) {
            if (id === requestId && canView() && document.getElementById('sm-results')) {
                report = null; output.innerHTML = `<p class="sm-alert" role="alert">${esc(error.message)} Select Refresh to try again.</p>`;
                document.getElementById('sm-updated').textContent = 'Update failed';
            }
        } finally { if (id === requestId) button.disabled = false; }
    }
    window.showSalesMonitor = function () {
        if (!canView()) return;
        activeUid = currentUser.uid;
        const main = document.getElementById('mainContent');
        main.innerHTML = `<div class="sm"><header class="sm-hero"><div><div class="sm-eyebrow">WEST EPCM · SALES INTELLIGENCE</div><h1>Sales revenue monitor</h1><p>A clear view of sales performance across BDMs and projects.</p></div><div class="sm-actions">${isSales() ? '' : '<button type="button" id="sm-back">← Sales tools</button>'}<span class="sm-readonly">Read-only access</span></div></header>
            <div class="sm-toolbar"><span id="sm-updated" aria-live="polite">Waiting for data</span><button type="button" id="sm-refresh">Refresh data</button></div>
            <section class="sm-panel sm-filters" aria-label="Sales filters">
            <label>Data source<select id="sm-source"><option value="all">All sources</option><option value="manual">BDM quote uploads</option><option value="proposals">Proposal wins (Dec 2025 – Mar 2026)</option><option value="purchase">Purchase portal projects</option></select></label>
            <label>Currency<select id="sm-currency"><option value="ALL_INR">All currencies (in INR)</option></select></label>
            <label>BDM<select id="sm-bdm"><option value="">All BDMs</option></select></label>
            <label>From date<input type="date" id="sm-from" min="${START}" value="${START}"></label><label>To date<input type="date" id="sm-to" min="${START}"></label>
            <label>Project / client<input type="search" id="sm-search" placeholder="Search projects or clients"></label>
            <label>Detail rows<select id="sm-kind"><option value="">All types</option><option value="won">Won projects</option><option value="quote">Quotes</option><option value="variation">Variations</option><option value="purchase">Purchase projects</option></select></label>
            <button type="button" id="sm-reset">Reset filters</button></section>
            <p class="sm-note">BDM figures use the values entered in Upload Quote / Won. Because uploads began in April 2026, proposals marked won from 1 Dec 2025 to 31 Mar 2026 are added as wins for those months; no other proposal values are used. Booked sales = won value + uploaded variations + purchase portal projects (initial sales value at the award / PO date; these are separate from BDM sales and not shown in BDM figures). Quotes are reported separately from booked sales. The default view combines BDM quote uploads, those proposal wins and purchase portal projects in INR; pick a single source or currency to see original amounts without conversion. These figures are not invoices or payments received. The report covers 1 December 2025 onwards; date filters use the win, quote, or variation event date. “Detail rows” filters only the final table.</p>
            <div id="sm-results" aria-live="polite"></div></div>`;
        document.getElementById('sm-refresh').onclick = refresh;
        document.getElementById('sm-back')?.addEventListener('click', () => { requestId++; if (typeof window._hubOpenSales === 'function') window._hubOpenSales(); else if (typeof window._hubOpenPhase === 'function') window._hubOpenPhase('corporate'); });
        document.getElementById('sm-reset').onclick = () => { ['bdm', 'from', 'to', 'search', 'kind'].forEach(k => document.getElementById('sm-' + k).value = k === 'from' ? START : ''); page = 1; render(); };
        main.querySelectorAll('.sm-filters input, .sm-filters select').forEach(el => el.addEventListener(el.type === 'search' ? 'input' : 'change', () => { page = 1; if (el.id === 'sm-source' && report) populate(); render(); }));
        refresh();
    };
    document.addEventListener('DOMContentLoaded', () => {
        firebase.auth().onAuthStateChanged(user => {
            if (!user || user.uid !== activeUid) { report = null; requestId++; }
            if (!user || (user.email || '').trim().toLowerCase() !== EMAIL) {
                document.getElementById('appContainer')?.classList.remove('sales-portal');
                if (!user || user.uid !== activeUid) { document.querySelector('#mainContent .sm')?.remove(); activeUid = null; }
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
