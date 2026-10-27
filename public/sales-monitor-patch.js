/* Sales analysis report: one report for the sales portal and COO / Director.
   Presentation only; authorization is enforced by /api/sales-monitor. */
(function () {
    'use strict';
    const EMAIL = 'sales.edanbrook@outlook.com';
    let report = null, requestId = 0, page = 1, activeUid = null, view = 'month', tab = 'won', charts = [], records = [];
    const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const money = value => value == null ? 'Not recorded' : Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    // Short Indian units for chart axes and labels (K, L, Cr).
    const compact = v => { const a = Math.abs(v); return a >= 1e7 ? (v / 1e7).toFixed(2) + ' Cr' : a >= 1e5 ? (v / 1e5).toFixed(2) + ' L' : a >= 1e3 ? (v / 1e3).toFixed(1) + ' K' : String(Math.round(v)); };
    const pct = (part, whole) => whole ? (part / whole * 100).toFixed(1) + '%' : '—';
    const isSales = () => typeof currentUser !== 'undefined' && currentUser && (currentUser.email || '').trim().toLowerCase() === EMAIL;
    // COO / Director open the same report from their hub; the API enforces access.
    const isManagement = () => typeof currentUserRole !== 'undefined' && ['coo', 'director'].includes(String(currentUserRole || '').toLowerCase());
    const canView = () => typeof currentUser !== 'undefined' && !!currentUser && (isSales() || isManagement());
    // Same fixed rates as the rest of the tracker, so converted totals agree.
    const TO_INR = { INR: 1, USD: 90.0, AUD: 55.0, NZD: 51.0, EUR: 90.0, GBP: 105.0, SGD: 62.0, AED: 22.7, CAD: 61.0, JPY: 0.55 };
    const ALL = 'ALL_INR';
    const inr = r => r.value == null ? null : r.value * (TO_INR[r.currency] ?? 1);
    // The report opens on December 2025; earlier dates can be chosen. Undated records are left out.
    const START = '2025-12-01';
    const KINDS = {
        won: { label: 'Won projects', short: 'Won', color: '#1f5e8a', source: 'Priced quote value of proposals the BDM marked won (P.O. value shown for comparison)' },
        variation: { label: 'Variations (Accounts)', short: 'Variations', color: '#39a8ae', source: 'Uploaded by Accounts for the BDM' },
        purchase: { label: 'Purchase projects', short: 'Purchase projects', color: '#e0a23a', source: 'Initial approved sales value · not attributed to BDMs' },
        rfq: { label: 'RFQ value (Estimator)', short: 'RFQ', color: '#8696a7', source: 'Quote value uploaded by the estimator · not added to sales' }
    };
    const BDM_COLORS = ['#1f5e8a', '#39a8ae', '#e0a23a', '#8e6cc4', '#d9734e', '#5fa877', '#c95b6a', '#4f7fbf'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const utc = iso => new Date(iso + 'T00:00:00Z');
    const day = d => d.toISOString().slice(0, 10);
    const addDays = (iso, n) => { const d = utc(iso); d.setUTCDate(d.getUTCDate() + n); return day(d); };
    const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const weekStart = iso => addDays(iso, -((utc(iso).getUTCDay() + 6) % 7));
    const shortDate = iso => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
    const longDate = iso => `${shortDate(iso)} ${iso.slice(0, 4)}`;
    // Names typed all in capitals or all in lower case are shown in title case.
    const person = name => name && (name === name.toUpperCase() || name === name.toLowerCase())
        ? name.toLowerCase().replace(/(^|[\s.'-])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase()) : name;
    const periodKey = iso => view === 'month' ? iso.slice(0, 7) : view === 'week' ? weekStart(iso) : iso;
    const periodLabel = key => view === 'month' ? `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`
        : view === 'week' ? `${shortDate(key)} – ${longDate(addDays(key, 6))}` : longDate(key);
    // Monthly and weekly views list every period in the range; the date-wise view lists days with activity.
    function periodKeys(from, to, used) {
        if (view === 'day') return [...used].sort();
        const keys = [];
        for (let k = periodKey(from); k <= periodKey(to); k = view === 'month'
            ? (Number(k.slice(5, 7)) === 12 ? `${Number(k.slice(0, 4)) + 1}-01` : `${k.slice(0, 4)}-${String(Number(k.slice(5, 7)) + 1).padStart(2, '0')}`)
            : addDays(k, 7)) keys.push(k);
        return keys;
    }
    function filters() {
        return Object.fromEntries(['currency', 'bdm', 'from', 'to', 'search'].map(key => [key, document.getElementById('sm-' + key)?.value || '']));
    }
    function table(headers, rows, foot) {
        return `<div class="sm-scroll"><table><thead><tr>${headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${headers.length}" class="sm-empty">No records match these filters.</td></tr>`}</tbody>${rows.length && foot ? `<tfoot>${foot}</tfoot>` : ''}</table></div>`;
    }
    const blank = () => ({ won: 0, wonCount: 0, variation: 0, variationCount: 0, purchase: 0, purchaseCount: 0, rfq: 0, rfqCount: 0 });
    function tally(target, r) { target[r.kind] += r.value || 0; target[r.kind + 'Count']++; return target; }

    function drawCharts(series, mix, bdmRows) {
        charts.forEach(c => c.destroy()); charts = [];
        if (typeof Chart === 'undefined') return;
        const font = { family: 'inherit', size: 11 };
        const tooltip = { callbacks: { label: ctx => `${ctx.dataset.label || ctx.label}: ${money(ctx.raw)}` } };
        // Total above each stacked bar / beside each horizontal bar.
        const totals = { id: 'smTotals', afterDatasetsDraw(chart) {
            const c = chart.ctx, horizontal = chart.options.indexAxis === 'y', metas = chart.data.datasets.map((_, i) => chart.getDatasetMeta(i)).filter(m => !m.hidden);
            if (!metas.length) return;
            c.save(); c.font = '600 11px sans-serif'; c.fillStyle = '#173450';
            c.textAlign = horizontal ? 'left' : 'center'; c.textBaseline = horizontal ? 'middle' : 'bottom';
            chart.data.labels.forEach((_, i) => {
                const sum = metas.reduce((s, m) => s + (chart.data.datasets[m.index].data[i] || 0), 0);
                if (!sum) return;
                const edge = metas.map(m => m.data[i]).reduce((a, b) => horizontal ? (b.x > a.x ? b : a) : (b.y < a.y ? b : a));
                c.fillText(compact(sum), horizontal ? edge.x + 6 : edge.x, horizontal ? edge.y : edge.y - 4);
            });
            c.restore();
        } };
        // Grand total in the middle of each doughnut.
        const centre = { id: 'smCentre', afterDraw(chart) {
            const { ctx: c, chartArea: a } = chart, total = chart.data.datasets[0].data.reduce((s, v) => s + v, 0);
            c.save(); c.textAlign = 'center'; c.fillStyle = '#173450';
            c.font = '700 15px sans-serif'; c.fillText(compact(total), (a.left + a.right) / 2, (a.top + a.bottom) / 2 + 2);
            c.font = '11px sans-serif'; c.fillStyle = '#62758b'; c.fillText('Total', (a.left + a.right) / 2, (a.top + a.bottom) / 2 + 18);
            c.restore();
        } };
        const stacked = (id, labels, sets, horizontal) => {
            const el = document.getElementById(id); if (!el) return;
            const value = { stacked: true, beginAtZero: true, ticks: { callback: compact, font }, grid: { color: '#edf1f5' } }, category = { stacked: true, grid: { display: false }, ticks: { font } };
            charts.push(new Chart(el, { type: 'bar', plugins: [totals],
                data: { labels, datasets: sets.map(s => ({ ...s, borderRadius: 3, maxBarThickness: horizontal ? 26 : 46 })) },
                options: { indexAxis: horizontal ? 'y' : 'x', responsive: true, maintainAspectRatio: false, animation: false,
                    layout: { padding: horizontal ? { right: 64 } : { top: 20 } },
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font } }, tooltip },
                    scales: horizontal ? { x: value, y: category } : { x: category, y: value } } }));
        };
        const doughnut = (id, labels, data, colors) => {
            const el = document.getElementById(id); if (!el) return;
            charts.push(new Chart(el, { type: 'doughnut', plugins: data.some(Boolean) ? [centre] : [],
                data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#fff', borderWidth: 2 }] },
                options: { responsive: true, maintainAspectRatio: false, animation: false, cutout: '62%',
                    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font, generateLabels: chart => chart.data.labels.map((l, i) => ({
                        text: `${l} · ${pct(chart.data.datasets[0].data[i], chart.data.datasets[0].data.reduce((s, v) => s + v, 0))}`,
                        fillStyle: colors[i], strokeStyle: colors[i], index: i })) } }, tooltip } } }));
        };
        const chronological = [...series].reverse();
        stacked('sm-chart-period', chronological.map(p => p.label), ['won', 'variation', 'purchase'].map(k => ({ label: KINDS[k].short, data: chronological.map(p => p[k]), backgroundColor: KINDS[k].color })));
        doughnut('sm-chart-mix', mix.map(m => m.label), mix.map(m => m.value), mix.map(m => m.color));
        stacked('sm-chart-bdm', bdmRows.map(b => b.name), ['won', 'variation'].map(k => ({ label: KINDS[k].short, data: bdmRows.map(b => b[k]), backgroundColor: KINDS[k].color })), true);
        const share = bdmRows.filter(b => b.won + b.variation > 0), top = share.slice(0, 7), rest = share.slice(7).reduce((s, b) => s + b.won + b.variation, 0);
        doughnut('sm-chart-share', top.map(b => b.name).concat(rest ? ['Others'] : []), top.map(b => b.won + b.variation).concat(rest ? [rest] : []), BDM_COLORS.slice(0, top.length).concat(rest ? ['#b6c2cf'] : []));
    }

    function render() {
        const output = document.getElementById('sm-results');
        if (!output || !report || !canView()) return;
        const f = filters();
        if (!f.from) f.from = START;
        const end = f.to || today();
        if (f.bdm && tab === 'purchase') tab = 'won';
        if (f.from > end) { charts.forEach(c => c.destroy()); charts = []; output.innerHTML = '<p class="sm-alert" role="alert">The start date must be on or before the end date.</p>'; return; }
        const search = f.search.toLowerCase();
        const earlierWins = report.rows.filter(r => r.kind === 'won' && r.date && r.date < f.from && (!f.bdm || r.bdmUid === f.bdm)).length;
        const rows = report.rows.filter(r => (f.currency === ALL || r.currency === f.currency) &&
            // Purchase projects belong to no BDM, so a single-BDM view leaves them out.
            (!f.bdm || r.bdmUid === f.bdm) && r.date && r.date >= f.from && r.date <= end &&
            (!search || `${r.projectName} ${r.projectNumber} ${r.client} ${r.reference}`.toLowerCase().includes(search)))
            .map(r => f.currency === ALL ? { ...r, value: inr(r), currency: 'INR' } : r);
        const totals = rows.reduce(tally, blank());
        const bdmSales = totals.won + totals.variation, sales = bdmSales + totals.purchase;
        // Periods and BDMs.
        const buckets = new Map(), bdms = new Map();
        if (!f.bdm) report.bdms.forEach(b => bdms.set(b.id, { name: b.name, ...blank() }));
        rows.forEach(r => {
            const k = periodKey(r.date);
            tally(buckets.get(k) || buckets.set(k, blank()).get(k), r);
            if (r.kind !== 'purchase') tally(bdms.get(r.bdmUid) || bdms.set(r.bdmUid, { name: r.bdmName, ...blank() }).get(r.bdmUid), r);
        });
        const series = periodKeys(f.from, end, buckets.keys()).reverse().map(k => ({ key: k, label: periodLabel(k), ...(buckets.get(k) || blank()) }));
        const all = [...bdms.values()];
        const ranking = all.filter(b => b.wonCount || b.variationCount || b.rfqCount)
            .sort((a, b) => (b.won + b.variation) - (a.won + a.variation) || b.rfq - a.rfq || a.name.localeCompare(b.name));
        const idle = all.filter(b => !ranking.includes(b)).map(b => b.name).sort((a, b) => a.localeCompare(b));
        records = rows.filter(r => r.kind === tab).sort((a, b) => b.date.localeCompare(a.date) || (b.value || 0) - (a.value || 0));
        const pages = Math.max(1, Math.ceil(records.length / 25)); page = Math.min(page, pages);
        const missingValues = rows.filter(r => r.value == null).length, undated = report.rows.filter(r => !r.date).length;
        const cur = f.currency === ALL ? 'INR (all currencies converted)' : esc(f.currency);
        const viewName = { month: 'Monthly', week: 'Weekly', day: 'Date-wise' }[view];
        const bdmName = f.bdm ? esc(all[0]?.name || '') : 'All BDMs';
        const card = (label, value, caption, color) => `<article class="sm-card"${color ? ` style="border-top-color:${color}"` : ''}><span>${label}</span><strong>${value}</strong><small>${caption}</small></article>`;
        const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
        const periodRow = (label, p, isTotal) => `<tr${isTotal ? ' class="sm-sum"' : ''}><td><strong>${label}</strong></td><td class="sm-num">${p.wonCount}</td><td class="sm-num">${money(p.won)}</td><td class="sm-num">${money(p.variation)}</td><td class="sm-num">${money(p.won + p.variation)}</td><td class="sm-num">${money(p.purchase)}</td><td class="sm-total sm-num">${money(p.won + p.variation + p.purchase)}</td><td class="sm-num">${p.rfqCount}</td><td class="sm-num">${money(p.rfq)}</td></tr>`;
        const bdmRow = (rank, b, isTotal) => `<tr${isTotal ? ' class="sm-sum"' : ''}><td>${rank}</td><td class="sm-name"><strong>${esc(b.name)}</strong></td><td class="sm-num">${b.wonCount}</td><td class="sm-num">${money(b.won)}</td><td class="sm-num">${b.variationCount}</td><td class="sm-num">${money(b.variation)}</td><td class="sm-total sm-num">${money(b.won + b.variation)}</td><td class="sm-num">${pct(b.won + b.variation, bdmSales)}</td><td class="sm-num">${b.wonCount ? money(b.won / b.wonCount) : '—'}</td><td class="sm-num">${b.rfqCount}</td><td class="sm-num">${money(b.rfq)}</td></tr>`;
        const recordHeaders = {
            won: ['Won date', 'Project', 'Client', 'BDM', 'P.O. number', 'P.O. value (as typed)', 'Won value (quote)'],
            variation: ['Uploaded', 'Project / description', 'BDM', 'Reference', 'Variation value'],
            purchase: ['Award / PO date', 'Project number', 'Project', 'Client', 'Initial sales value'],
            rfq: ['Priced', 'Project', 'Client', 'BDM', 'Proposal status', 'RFQ value']
        }[tab];
        const recordRow = r => {
            const project = `<strong>${esc(r.projectName)}</strong>${r.projectNumber && tab !== 'purchase' ? `<small>${esc(r.projectNumber)}</small>` : ''}`;
            const value = `<td class="sm-total sm-num">${money(r.value)}</td>`;
            if (tab === 'won') return `<tr><td>${esc(r.date)}</td><td>${project}</td><td>${esc(r.client || '—')}</td><td class="sm-name">${esc(r.bdmName)}</td><td>${esc(r.reference || '—')}</td><td class="sm-num">${r.poValue == null ? '—' : esc(r.poCurrency) + ' ' + money(r.poValue)}</td>${value}</tr>`;
            if (tab === 'variation') return `<tr><td>${esc(r.date)}</td><td>${project}</td><td class="sm-name">${esc(r.bdmName)}</td><td>${esc(r.reference || '—')}</td>${value}</tr>`;
            if (tab === 'purchase') return `<tr><td>${esc(r.date)}</td><td><strong>${esc(r.projectNumber || '—')}</strong></td><td>${project}</td><td>${esc(r.client || '—')}</td>${value}</tr>`;
            return `<tr><td>${esc(r.date)}</td><td>${project}</td><td>${esc(r.client || '—')}</td><td class="sm-name">${esc(r.bdmName)}</td><td><span class="sm-tag">${esc(r.status)}</span></td>${value}</tr>`;
        };
        const tabTotal = records.reduce((s, r) => s + (r.value || 0), 0);
        output.innerHTML = `${missingValues || undated || earlierWins || f.currency === 'UNSPECIFIED' ? `<p class="sm-alert">${missingValues ? `${missingValues} matching record(s) have no value (a won proposal with no quote or P.O. value) and count as zero. ` : ''}${earlierWins ? `${earlierWins} won proposal(s) dated before ${longDate(f.from)} are outside this range; choose an earlier From date or “All time” to include them. ` : ''}${undated ? `${undated} record(s) have no date and are not in this report. ` : ''}${f.currency === 'UNSPECIFIED' ? 'Currency is not recorded for this group; do not compare this total with other currencies.' : ''}</p>` : ''}
            <div class="sm-report-head"><div><h2>Sales analysis · ${longDate(f.from)} to ${longDate(end)}</h2><span>${viewName} view · ${cur} · ${bdmName}${f.search ? ` · “${esc(f.search)}”` : ''}</span></div><div class="sm-actions"><button type="button" id="sm-csv">Export CSV</button><button type="button" id="sm-print">Print / Save PDF</button></div></div>
            <div class="sm-cards">${card('Total sales', money(sales), 'Won + variations' + (f.bdm ? '' : ' + purchase projects'), '#173450')}${card('Won projects', money(totals.won), count(totals.wonCount, 'proposal') + ' marked won · quote value', KINDS.won.color)}${card('Variations (Accounts)', money(totals.variation), count(totals.variationCount, 'variation') + ' uploaded by Accounts', KINDS.variation.color)}${card('Purchase projects', f.bdm ? '—' : money(totals.purchase), f.bdm ? 'Not attributed to BDMs' : count(totals.purchaseCount, 'project') + ' · shown separately', KINDS.purchase.color)}
            ${card('BDM sales', money(bdmSales), 'Won + variations · excludes purchase', '#173450')}${card('Average won deal', totals.wonCount ? money(totals.won / totals.wonCount) : '—', 'Won value ÷ won proposals', KINDS.won.color)}${card('RFQ value (Estimator)', money(totals.rfq), count(totals.rfqCount, 'RFQ') + ' priced · not added to sales', KINDS.rfq.color)}${card('Won ÷ RFQ value', pct(totals.won, totals.rfq), 'Won value against RFQ value in this period', KINDS.rfq.color)}</div>
            <div class="sm-charts">
                <section class="sm-panel sm-wide"><div class="sm-section-title"><h2>${viewName} sales</h2><span>${cur} · won + variations + purchase projects</span></div><div class="sm-chart"><canvas id="sm-chart-period" role="img" aria-label="${viewName} sales by type"></canvas></div></section>
                <section class="sm-panel"><div class="sm-section-title"><h2>Sales mix</h2><span>Share of total sales</span></div><div class="sm-chart"><canvas id="sm-chart-mix" role="img" aria-label="Sales mix"></canvas></div></section>
                <section class="sm-panel sm-wide"><div class="sm-section-title"><h2>BDM sales</h2><span>${cur} · won + variations by BDM</span></div><div class="sm-chart" style="height:${Math.max(260, ranking.length * 42 + 90)}px"><canvas id="sm-chart-bdm" role="img" aria-label="Sales by BDM"></canvas></div></section>
                <section class="sm-panel"><div class="sm-section-title"><h2>BDM share</h2><span>Share of BDM sales</span></div><div class="sm-chart"><canvas id="sm-chart-share" role="img" aria-label="Share of BDM sales"></canvas></div></section>
            </div>
            <section class="sm-panel"><div class="sm-section-title"><h2>${viewName} totals</h2><span>${cur} · ${view === 'day' ? 'dates with activity' : 'every ' + (view === 'month' ? 'month' : 'week (Mon – Sun)') + ' in the range'}</span></div><div class="sm-trend-table">${table([view === 'month' ? 'Month' : view === 'week' ? 'Week (Mon – Sun)' : 'Date', 'Wins', 'Won value', 'Variations', 'BDM sales', 'Purchase projects', 'Total sales', 'RFQs', 'RFQ value'], series.map(p => periodRow(esc(p.label), p)), periodRow('Total', totals, true))}</div></section>
            <section class="sm-panel"><div class="sm-section-title"><h2>BDM performance</h2><span>${cur} · ${count(ranking.length, 'active BDM')} · ranked by BDM sales · purchase projects excluded</span></div>${table(['Rank', 'BDM', 'Wins', 'Won value', 'Variations', 'Variation value', 'BDM sales', 'Share', 'Avg deal', 'RFQs', 'RFQ value'], ranking.map((b, i) => bdmRow(i + 1, b)), bdmRow('', { name: 'Total', ...totals }, true))}${idle.length ? `<p class="sm-idle">No activity in this period: ${idle.map(esc).join(', ')}</p>` : ''}</section>
            <section class="sm-panel sm-details"><div class="sm-section-title"><h2>Records</h2><div class="sm-toggle" role="tablist" aria-label="Record type">${Object.entries(KINDS).filter(([k]) => !(f.bdm && k === 'purchase')).map(([k, v]) => `<button type="button" role="tab" data-tab="${k}" aria-pressed="${tab === k}">${v.label} (${totals[k + 'Count']})</button>`).join('')}</div></div>
            <p class="sm-tab-note">${KINDS[tab].source} · ${records.length} record(s) · ${money(tabTotal)} ${f.currency === ALL ? 'INR' : esc(f.currency)}</p>
            ${table(recordHeaders, records.slice((page - 1) * 25, page * 25).map(recordRow))}<div class="sm-pages"><button type="button" id="sm-prev" ${page === 1 ? 'disabled' : ''}>Previous</button><span>Page ${page} of ${pages}</span><button type="button" id="sm-next" ${page === pages ? 'disabled' : ''}>Next</button></div></section>
            <p class="sm-note">${f.currency === ALL ? 'Converted to INR at fixed rates (USD 90, AUD 55, NZD 51, EUR 90, GBP 105, SGD 62, AED 22.7, CAD 61, JPY 0.55); unrecorded currencies are counted as INR. ' : ''}Generated ${esc(new Date(report.generatedAt).toLocaleString())}. Figures are booked sales, not invoiced revenue or cash received.</p>`;
        drawCharts(series, [['won', totals.won], ['variation', totals.variation], ['purchase', totals.purchase]].filter(([k]) => !(f.bdm && k === 'purchase'))
            .map(([k, value]) => ({ label: KINDS[k].short, value, color: KINDS[k].color })), ranking);
        document.getElementById('sm-prev').onclick = () => { page--; render(); };
        document.getElementById('sm-next').onclick = () => { page++; render(); };
        document.getElementById('sm-csv').onclick = () => exportCsv(rows);
        document.getElementById('sm-print').onclick = () => window.print();
        output.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; page = 1; render(); });
    }
    function exportCsv(rows) {
        const cell = value => { let s = String(value ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
        const lines = [['Date', 'Type', 'Project', 'Project number', 'Client', 'BDM', 'Reference', 'Status', 'Currency', 'Value', 'P.O. currency', 'P.O. value (as typed)'].map(cell).join(',')]
            .concat([...rows].sort((a, b) => b.date.localeCompare(a.date)).map(r => [r.date, KINDS[r.kind].label, r.projectName, r.projectNumber, r.client, r.kind === 'purchase' ? '' : r.bdmName, r.reference, r.status, r.currency, r.value ?? '', r.poCurrency ?? '', r.poValue ?? ''].map(cell).join(',')));
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
        link.download = `sales-analysis-${today()}.csv`;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }
    function populate() {
        const currencies = [...new Set(report.rows.map(r => r.currency))].sort();
        const selector = document.getElementById('sm-currency'); const previous = selector.value;
        selector.innerHTML = `<option value="${ALL}">All currencies (in INR)</option>` + currencies.map(c => `<option value="${esc(c)}">${esc(c)} only</option>`).join('');
        selector.value = currencies.includes(previous) ? previous : ALL;
        const bdmSelector = document.getElementById('sm-bdm'), selectedBdm = bdmSelector.value;
        const bdms = new Map(report.bdms.map(b => [b.id, b.name])); report.rows.forEach(r => { if (r.kind !== 'purchase') bdms.set(r.bdmUid, r.bdmName); });
        bdmSelector.innerHTML = '<option value="">All BDMs</option>' + [...bdms.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join('');
        if (bdms.has(selectedBdm)) bdmSelector.value = selectedBdm;
    }
    // Quick ranges set the dates and a matching view.
    function preset(name) {
        const t = today(), set = (from, to, v) => { document.getElementById('sm-from').value = from; document.getElementById('sm-to').value = to; setView(v); };
        if (name === 'week') set(weekStart(t) < START ? START : weekStart(t), t, 'day');
        else if (name === 'month') set(t.slice(0, 8) + '01', t, 'day');
        else if (name === 'last-month') { const first = utc(t.slice(0, 8) + '01'); first.setUTCMonth(first.getUTCMonth() - 1); set(day(first) < START ? START : day(first), addDays(t.slice(0, 8) + '01', -1), 'week'); }
        else if (name === 'ever') set(report?.rows.reduce((m, r) => r.date && r.date < m ? r.date : m, START) || START, '', 'month');
        else set(START, '', 'month');
    }
    function setView(v) {
        view = v; page = 1;
        document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    }
    async function refresh() {
        const id = ++requestId; const uid = currentUser?.uid;
        const output = document.getElementById('sm-results');
        const button = document.getElementById('sm-refresh');
        charts.forEach(c => c.destroy()); charts = [];
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
        main.innerHTML = `<div class="sm"><header class="sm-hero"><div><div class="sm-eyebrow">WEST EPCM · SALES INTELLIGENCE</div><h1>Sales analysis report</h1><p>Won projects, Accounts variations and purchase projects in one report, with estimator RFQ value alongside.</p></div><div class="sm-actions">${isSales() ? '' : '<button type="button" id="sm-back">← Sales tools</button>'}<span class="sm-readonly">Read-only access</span></div></header>
            <div class="sm-toolbar"><span id="sm-updated" aria-live="polite">Waiting for data</span><button type="button" id="sm-refresh">Refresh data</button></div>
            <section class="sm-panel sm-filters" aria-label="Report filters">
            <div class="sm-filter-row"><div class="sm-toggle" role="group" aria-label="Report view"><button type="button" data-view="month" aria-pressed="true">Monthly</button><button type="button" data-view="week" aria-pressed="false">Weekly</button><button type="button" data-view="day" aria-pressed="false">Date-wise</button></div>
            <div class="sm-presets" role="group" aria-label="Quick ranges"><button type="button" data-preset="week">This week</button><button type="button" data-preset="month">This month</button><button type="button" data-preset="last-month">Last month</button><button type="button" data-preset="all">From 1 Dec 2025</button><button type="button" data-preset="ever">All time</button></div></div>
            <label>From date<input type="date" id="sm-from" value="${START}"></label><label>To date<input type="date" id="sm-to"></label>
            <label>BDM<select id="sm-bdm"><option value="">All BDMs</option></select></label>
            <label>Currency<select id="sm-currency"><option value="ALL_INR">All currencies (in INR)</option></select></label>
            <label class="sm-search">Project / client / reference<input type="search" id="sm-search" placeholder="Search"></label>
            <button type="button" id="sm-reset">Reset filters</button></section>
            <p class="sm-note"><strong>What is counted.</strong> Won projects: the priced quote value (estimator pricing) of proposals the BDM marked won, on the won date; the P.O. value the BDM typed is listed beside it for comparison and used only when a proposal was never priced. Variations: values Accounts upload for a BDM. Purchase projects: the initial approved sales value of purchase portal projects, shown separately and not credited to any BDM. Total sales = won + variations + purchase projects. RFQ value is the quote value the estimator uploads on the proposal; it is shown for comparison and never added to sales. The report opens on 1 December 2025; choose “All time” or an earlier From date to see older wins.</p>
            <div id="sm-results" aria-live="polite"></div></div>`;
        view = 'month'; tab = 'won'; page = 1;
        document.getElementById('sm-refresh').onclick = refresh;
        document.getElementById('sm-back')?.addEventListener('click', () => { requestId++; if (typeof window._hubOpenSales === 'function') window._hubOpenSales(); else if (typeof window._hubOpenPhase === 'function') window._hubOpenPhase('corporate'); });
        document.getElementById('sm-reset').onclick = () => { ['bdm', 'to', 'search'].forEach(k => document.getElementById('sm-' + k).value = ''); document.getElementById('sm-from').value = START; document.getElementById('sm-currency').value = ALL; setView('month'); render(); };
        main.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { setView(b.dataset.view); render(); });
        main.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { preset(b.dataset.preset); render(); });
        main.querySelectorAll('.sm-filters input, .sm-filters select').forEach(el => el.addEventListener(el.type === 'search' ? 'input' : 'change', () => { page = 1; render(); }));
        refresh();
    };
    document.addEventListener('DOMContentLoaded', () => {
        firebase.auth().onAuthStateChanged(user => {
            if (!user || user.uid !== activeUid) { report = null; requestId++; }
            if (!user || (user.email || '').trim().toLowerCase() !== EMAIL) {
                document.getElementById('appContainer')?.classList.remove('sales-portal');
                if (!user || user.uid !== activeUid) { charts.forEach(c => c.destroy()); charts = []; document.querySelector('#mainContent .sm')?.remove(); activeUid = null; }
            }
        });
        // Prevent late legacy navigation callbacks replacing the report screen.
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
