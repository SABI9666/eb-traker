// Purchase portal projects: project number, contract value and daily site logs
// (material, manpower, machinery) with project-wise reports for COO / Director.
// Authorization is enforced by /api/purchase-projects.
(function () {
'use strict';
if (window._purchaseProjectsLoaded) return;
window._purchaseProjectsLoaded = true;
function css() {
    if (document.getElementById('ppStyles')) return;
    const s = document.createElement('style'); s.id = 'ppStyles';
    s.textContent = `
.pp{max-width:1500px;margin:auto;color:#0f172a}.pp *{box-sizing:border-box}
.pp-hero{background:linear-gradient(135deg,#172333,#1f4257);color:#fff;padding:1.3rem 1.45rem;border-radius:20px;margin-bottom:1rem;box-shadow:0 18px 45px -28px #000;display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:flex-end}
.pp-eyebrow{display:inline-flex;padding:.28rem .65rem;border-radius:999px;background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.4);color:#fbbf24;font-size:.66rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
.pp-hero h2{margin:.5rem 0 .2rem;font-size:1.5rem;color:#fff}.pp-hero p{margin:0;color:#b6c4d3;font-size:.84rem}
.pp-actions{display:flex;gap:.45rem;flex-wrap:wrap;align-items:center}
.pp-btn{border:1px solid #dbe4ee;background:#fff;color:#243244;padding:.55rem .85rem;border-radius:9px;cursor:pointer;font-weight:700;font-size:.78rem;white-space:nowrap}
.pp-btn:hover{border-color:#94a3b8}.pp-btn:disabled{opacity:.55;cursor:not-allowed}
.pp-btn.primary{background:#06b6d4;border-color:#22d3ee;color:#073742}.pp-btn.ok{background:#16a34a;border-color:#16a34a;color:#fff}.pp-btn.danger{color:#b91c1c;border-color:#fecaca}
.pp-btn.small{padding:.35rem .6rem;font-size:.7rem}
.pp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.65rem;margin-bottom:1rem}
.pp-kpi,.pp-card{background:#fff;border:1px solid #e5ebf1;border-radius:14px;box-shadow:0 10px 30px -26px rgba(15,23,42,.7)}
.pp-kpi{padding:.85rem 1rem;min-width:0}.pp-kpi span{display:block;font-size:.66rem;color:#64748b;text-transform:uppercase;font-weight:700;letter-spacing:.03em}
.pp-kpi b{display:block;font-size:1.25rem;margin-top:.3rem;overflow-wrap:anywhere}.pp-kpi small{display:block;font-size:.7rem;color:#0e7490;font-weight:600;margin-top:.25rem}
.pp-card{overflow:hidden;margin-bottom:1rem}.pp-head{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:.9rem 1.1rem;border-bottom:1px solid #edf1f5;flex-wrap:wrap}
.pp-head h3{margin:0;font-size:.98rem}.pp-head p{margin:.15rem 0 0;font-size:.72rem;color:#7b8998}
.pp-tools{display:flex;gap:.5rem;padding:.8rem 1rem;border-bottom:1px solid #eef2f6;flex-wrap:wrap;align-items:center}
.pp-tools input,.pp-tools select{border:1px solid #dbe4ee;border-radius:9px;padding:.5rem .65rem;font-size:.78rem;background:#fff}
.pp-tools input[type=search]{min-width:220px;flex:1}.pp-tools label{font-size:.7rem;color:#64748b;font-weight:700;display:flex;gap:.35rem;align-items:center}
.pp-wrap{overflow:auto}.pp-table{width:100%;border-collapse:collapse;min-width:900px}
.pp-table th{background:#f8fafc;color:#64748b;font-size:.64rem;text-transform:uppercase;letter-spacing:.03em;text-align:left;padding:.65rem .75rem;border-bottom:1px solid #e8edf2;white-space:nowrap}
.pp-table td{padding:.65rem .75rem;border-bottom:1px solid #eef2f6;font-size:.78rem;color:#334155;vertical-align:top}
.pp-table td.num,.pp-table th.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.pp-table tfoot td{font-weight:800;background:#f8fafc;color:#0f172a}.pp-table small{display:block;color:#7b8998;font-size:.68rem;margin-top:.1rem}
.pp-table tr.removed td{color:#94a3b8;text-decoration:line-through}.pp-table tr.removed td.why{text-decoration:none}
.pp-no{font-weight:800;color:#0e7490;white-space:nowrap}
.pp-pill{display:inline-flex;padding:.18rem .5rem;border-radius:999px;font-size:.64rem;font-weight:800;text-transform:capitalize;white-space:nowrap;background:#eef6f8;color:#0e7490}
.pp-pill.pending{background:#fff7ed;color:#c2410c}.pp-pill.approved,.pp-pill.active{background:#dcfce7;color:#166534}.pp-pill.rejected,.pp-pill.cancelled{background:#fee2e2;color:#b91c1c}.pp-pill.on_hold{background:#fef9c3;color:#854d0e}.pp-pill.completed{background:#e0e7ff;color:#3730a3}
.pp-meter{height:7px;border-radius:99px;background:#e2e8f0;overflow:hidden;min-width:80px;margin-top:.3rem}.pp-meter i{display:block;height:100%;background:#0891b2}.pp-meter i.over{background:#dc2626}
.pp-stack{display:flex;height:14px;border-radius:99px;overflow:hidden;background:#e2e8f0;margin:.4rem 0 .6rem}.pp-stack i{display:block;height:100%}
.pp-legend{display:flex;gap:1rem;flex-wrap:wrap;font-size:.74rem;color:#475569}.pp-legend span:before{content:'';display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:.35rem;background:var(--c);vertical-align:-1px}
.pp-info{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.8rem;padding:1rem 1.1rem}.pp-info div span{display:block;font-size:.64rem;color:#64748b;text-transform:uppercase;font-weight:700}.pp-info div b{display:block;font-size:.84rem;margin-top:.15rem;overflow-wrap:anywhere}
.pp-tabs{display:flex;gap:.3rem;padding:.6rem;background:#fbfcfd;border-bottom:1px solid #edf1f5;overflow:auto}
.pp-tab{border:0;background:transparent;padding:.5rem .75rem;border-radius:8px;font-weight:700;color:#64748b;white-space:nowrap;cursor:pointer;font-size:.78rem}.pp-tab[aria-selected=true]{background:#172333;color:#fff}
.pp-empty{padding:2rem;color:#64748b;text-align:center;font-size:.85rem}.pp-alert{margin:0 0 1rem;padding:.7rem 1rem;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:.78rem}
.pp-note{font-size:.72rem;color:#64748b;margin:.4rem 0 1rem}
.pp-event{display:grid;grid-template-columns:22px 1fr;gap:.5rem;padding:.55rem 1rem;border-bottom:1px solid #f1f5f9}.pp-event b{font-size:.76rem}.pp-event span{display:block;color:#7b8998;font-size:.68rem}.pp-event p{margin:.2rem 0 0;font-size:.76rem;white-space:pre-wrap}
.pp-modal{position:fixed;inset:0;background:rgba(15,23,42,.58);z-index:10060;display:flex;align-items:center;justify-content:center;padding:1rem}
.pp-box{width:min(720px,100%);max-height:92vh;overflow:auto;background:#fff;color:#0f172a;border-radius:16px}
.pp-box-h{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:1rem 1.2rem;border-bottom:1px solid #e9eef3}.pp-box-h h3{margin:0;font-size:1.02rem}
.pp-form{display:grid;grid-template-columns:1fr 1fr;gap:.8rem;padding:1rem 1.2rem}
.pp-field label{display:block;font-size:.7rem;color:#475569;font-weight:700;margin-bottom:.25rem}
.pp-field input,.pp-field select,.pp-field textarea{width:100%;border:1px solid #dbe4ee;border-radius:9px;padding:.6rem;font:inherit;font-size:.82rem;background:#fff}
.pp-field.full{grid-column:1/-1}.pp-field.check label{display:flex;gap:.5rem;align-items:center;font-size:.8rem;color:#0f172a}.pp-field.check input{width:auto}
.pp-calc{grid-column:1/-1;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:.7rem .9rem;font-size:.84rem;color:#075985}
.pp-foot{display:flex;justify-content:flex-end;gap:.5rem;padding:0 1.2rem 1.2rem;align-items:center;flex-wrap:wrap}.pp-foot p{margin:0 auto 0 0;font-size:.78rem;color:#b91c1c}
@media(max-width:650px){.pp-form{grid-template-columns:1fr}.pp-hero h2{font-size:1.25rem}.pp-tools input[type=search]{min-width:0;width:100%}}
@media print{@page{size:A4 landscape;margin:10mm}body:has(#mainContent .pp) *{visibility:hidden}#mainContent .pp,#mainContent .pp *{visibility:visible}#mainContent .pp{position:absolute;left:0;top:0;width:100%;max-width:none}
.pp-noprint{display:none!important}.pp-hero{background:#172333!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.pp-stack i,.pp-meter i,.pp-legend span:before{-webkit-print-color-adjust:exact;print-color-adjust:exact}.pp-wrap{overflow:visible}.pp-table{min-width:0!important}.pp-card,.pp-kpi{break-inside:avoid;box-shadow:none}.pp-section{break-inside:auto}}`;
    (document.head || document.documentElement).appendChild(s);
}
const CURRENCIES = ['INR', 'USD', 'CAD', 'AUD', 'GBP', 'EUR'];
const STATUSES = [['active', 'Active'], ['on_hold', 'On hold'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];
const TYPES = {
    material: { label: 'Material', plural: 'Materials', color: '#0891b2' },
    manpower: { label: 'Manpower', plural: 'Manpower', color: '#7c3aed' },
    machinery: { label: 'Machinery', plural: 'Machinery', color: '#ea580c' }
};
const TRADES = ['Supervisor', 'Engineer', 'Foreman', 'Fitter', 'Welder', 'Rigger', 'Mason', 'Carpenter', 'Bar bender', 'Electrician', 'Painter', 'Helper', 'Operator', 'Driver', 'Security'];
let projects = [], role = '', search = '', statusFilter = '', generation = 0;
let current = null, tab = 'daily', from = '', to = '', purchases = null;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = v => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = v => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const money = (cur, v) => (cur || '') + ' ' + fmt(v);
const when = v => v ? new Date(v).toLocaleString() : '—';
const dmy = iso => iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
const today = () => new Date().toISOString().slice(0, 10);
const statusLabel = s => (STATUSES.find(x => x[0] === s) || [s, s])[1];
const totalsOf = p => ({ material: 0, manpower: 0, machinery: 0, manDays: 0, manHours: 0, machineHours: 0, entries: 0, ...(p.totals || {}) });
const costOf = p => { const t = totalsOf(p); return t.material + t.manpower + t.machinery; };
const isManager = () => role === 'coo' || role === 'director';
function base() { return (window.API_BASE_URL || window.apiBaseUrl || window.API_BASE || 'https://west-epcm-backend-854824137821.us-central1.run.app').replace(/\/$/, '') + '/api/'; }
async function request(path, options = {}) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Please sign in again.');
    const token = await user.getIdToken();
    const response = await fetch(base() + path, { ...options, headers: { ...options.headers, Authorization: 'Bearer ' + token, ...(options.body ? { 'Content-Type': 'application/json' } : {}) } });
    const result = await response.json().catch(() => ({ error: 'The project service is unavailable. Please retry.' }));
    if (!response.ok || !result.success) throw new Error(result.error || 'Request failed');
    return result;
}
const post = (path, body, method = 'POST') => request(path, { method, body: JSON.stringify(body) });
// Sum amounts per currency; projects may be priced in different currencies.
function byCurrency(list, pick) {
    const map = new Map();
    list.forEach(p => map.set(p.currency, (map.get(p.currency) || 0) + pick(p)));
    return map.size ? [...map.entries()].sort().map(([c, v]) => money(c, v)).join('<br>') : '—';
}
function pill(value, text) { return `<span class="pp-pill ${esc(value)}">${esc(text || String(value).replace(/_/g, ' '))}</span>`; }
function meter(cost, value) {
    const pct = value ? cost / value * 100 : 0;
    return `${value ? pct.toFixed(1) + '%' : '—'}<div class="pp-meter"><i class="${pct > 100 ? 'over' : ''}" style="width:${Math.min(100, pct)}%"></i></div>`;
}
function saveCsv(name, rows) {
    const cell = v => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function main() { const m = document.getElementById('mainContent'); m.style.display = 'block'; return m; }
function busy(text) { main().innerHTML = `<div class="pm pp"><div class="pp-card pp-empty" id="ppLoading" role="status">${esc(text)}</div></div>`; }
function failed(error, retry) {
    const box = document.getElementById('ppLoading');
    if (!box) return;
    box.innerHTML = `<p role="alert">${esc(error.message)}</p><button class="pp-btn" type="button">Retry</button>`;
    box.querySelector('button').onclick = retry;
}
async function loadList() {
    const run = ++generation; current = null;
    busy('Loading projects…');
    try {
        const result = await request('purchase-projects');
        if (run !== generation) return;
        projects = result.data; role = result.role;
        renderList();
    } catch (e) { if (run === generation) failed(e, loadList); }
}
function backButton() {
    if (role === 'purchase') return '<button class="pp-btn" type="button" id="ppToPurchases">← Purchase register</button>';
    return '<button class="pp-btn" type="button" id="ppToHub">← Procurement</button>';
}
function bindBack() {
    document.getElementById('ppToPurchases')?.addEventListener('click', () => { generation++; window.showPurchaseManagement?.(); });
    document.getElementById('ppToHub')?.addEventListener('click', () => { generation++; if (typeof window._hubOpenPhase === 'function') window._hubOpenPhase('procurement'); });
}
function visibleProjects() {
    const q = search.trim().toLowerCase();
    return projects.filter(p => (!statusFilter || (statusFilter === 'pending' ? p.approval?.status === 'pending' : p.status === statusFilter)) &&
        (!q || [p.projectNumber, p.name, p.client, p.location, p.manager].join(' ').toLowerCase().includes(q)))
        .sort((a, b) => (b.awardDate || '').localeCompare(a.awardDate || '') || a.projectNumber.localeCompare(b.projectNumber));
}
function renderList() {
    const live = projects.filter(p => p.status !== 'cancelled');
    const t = live.reduce((s, p) => { const x = totalsOf(p); s.manDays += x.manDays; s.machineHours += x.machineHours; s.entries += x.entries; return s; }, { manDays: 0, machineHours: 0, entries: 0 });
    const pending = projects.filter(p => p.approval?.status === 'pending').length;
    const kpi = (label, value, note) => `<div class="pp-kpi"><span>${label}</span><b>${value}</b>${note ? `<small>${note}</small>` : ''}</div>`;
    main().innerHTML = `<div class="pm pp">
      <div class="pp-hero"><div><span class="pp-eyebrow">${role === 'purchase' ? 'Purchase portal' : (role === 'coo' ? 'COO' : 'Director') + ' · Project reports'}</span><h2>Projects &amp; site cost reports</h2><p>Project register with contract value and daily material, manpower and machinery logs.</p></div>
      <div class="pp-actions pp-noprint">${backButton()}<button class="pp-btn" type="button" id="ppRefresh">Refresh</button><button class="pp-btn" type="button" id="ppCsv">Export CSV</button><button class="pp-btn" type="button" id="ppPrint">Print / PDF</button>${role === 'purchase' ? '<button class="pp-btn primary" type="button" id="ppNew">+ New project</button>' : ''}</div></div>
      ${pending && isManager() ? `<p class="pp-alert">${pending} project(s) await your approval. Only approved project values are added to sales.</p>` : ''}
      <div class="pp-kpis">${kpi('Active projects', live.filter(p => p.status === 'active').length, projects.length + ' in register')}${kpi('Contract value', byCurrency(live, p => p.projectValue || 0), 'Excludes cancelled')}${kpi('Cost to date', byCurrency(live, costOf), t.entries + ' log entries')}${kpi('Material', byCurrency(live, p => totalsOf(p).material))}${kpi('Manpower', byCurrency(live, p => totalsOf(p).manpower), qty(t.manDays) + ' man-days')}${kpi('Machinery', byCurrency(live, p => totalsOf(p).machinery), qty(t.machineHours) + ' machine-hours')}${kpi('Awaiting approval', pending, 'Project creation / edits')}</div>
      <div class="pp-card"><div class="pp-head"><div><h3>Project-wise summary</h3><p>Cost to date = material + manpower + machinery logs. Balance = contract value − cost to date.</p></div></div>
      <div class="pp-tools pp-noprint"><input type="search" id="ppSearch" aria-label="Search projects" placeholder="Search project number, name, client or location" value="${esc(search)}"><select id="ppStatus" aria-label="Filter projects"><option value="">All projects</option>${STATUSES.map(s => `<option value="${s[0]}" ${statusFilter === s[0] ? 'selected' : ''}>${s[1]}</option>`).join('')}<option value="pending" ${statusFilter === 'pending' ? 'selected' : ''}>Awaiting approval</option></select></div>
      <div id="ppRows"></div></div>
      <p class="pp-note">Approved project values (when “count in sales” is ticked) are added to booked sales at the award / PO date and appear in the weekly sales of the Sales Revenue Monitor. Edits return to COO / Director; sales keep the last approved value until the edit is approved.</p></div>`;
    bindBack();
    document.getElementById('ppRefresh').onclick = loadList;
    document.getElementById('ppPrint').onclick = () => window.print();
    document.getElementById('ppCsv').onclick = () => saveCsv('project-summary-' + today() + '.csv', [['Project number', 'Project', 'Client', 'Location', 'Status', 'Approval', 'Award date', 'Currency', 'Contract value', 'Material', 'Manpower', 'Machinery', 'Cost to date', 'Balance', 'Man-days', 'Machine-hours', 'Last log'],
        ...visibleProjects().map(p => { const x = totalsOf(p); return [p.projectNumber, p.name, p.client, p.location, statusLabel(p.status), p.approval?.status, p.awardDate, p.currency, p.projectValue, x.material, x.manpower, x.machinery, costOf(p), (p.projectValue || 0) - costOf(p), x.manDays, x.machineHours, p.lastEntryDate || '']; })]);
    if (role === 'purchase') document.getElementById('ppNew').onclick = () => projectForm();
    document.getElementById('ppSearch').oninput = e => { search = e.target.value; listRows(); };
    document.getElementById('ppStatus').onchange = e => { statusFilter = e.target.value; listRows(); };
    listRows();
}
function listRows() {
    const items = visibleProjects();
    const box = document.getElementById('ppRows');
    if (!items.length) { box.innerHTML = `<p class="pp-empty">${projects.length ? 'No projects match these filters.' : role === 'purchase' ? 'No projects yet. Select “+ New project” to add one.' : 'Projects added by Purchase will appear here.'}</p>`; return; }
    box.innerHTML = `<div class="pp-wrap"><table class="pp-table"><thead><tr><th>Project no.</th><th>Project / client</th><th>Status</th><th class="num">Contract value</th><th class="num">Material</th><th class="num">Manpower</th><th class="num">Machinery</th><th class="num">Cost to date</th><th>Cost % of value</th><th class="num">Balance</th><th>Last log</th><th class="pp-noprint">Actions</th></tr></thead><tbody>${items.map(p => {
        const x = totalsOf(p), cost = costOf(p), a = p.approval?.status || 'pending';
        return `<tr><td class="pp-no">${esc(p.projectNumber)}</td><td><b>${esc(p.name)}</b><small>${esc([p.client, p.location].filter(Boolean).join(' · ') || '—')}</small></td>
        <td>${pill(p.status, statusLabel(p.status))}<br>${pill(a, a === 'pending' ? 'Awaiting approval' : a)}</td>
        <td class="num">${money(p.currency, p.projectValue)}</td><td class="num">${fmt(x.material)}</td><td class="num">${fmt(x.manpower)}<small>${qty(x.manDays)} man-days</small></td><td class="num">${fmt(x.machinery)}<small>${qty(x.machineHours)} hrs</small></td>
        <td class="num"><b>${fmt(cost)}</b></td><td>${meter(cost, p.projectValue)}</td><td class="num" style="color:${(p.projectValue || 0) - cost < 0 ? '#b91c1c' : 'inherit'}">${fmt((p.projectValue || 0) - cost)}</td><td>${dmy(p.lastEntryDate)}</td>
        <td class="pp-noprint"><div class="pp-actions"><button class="pp-btn small primary" type="button" data-open="${esc(p.id)}">Open report</button>${role === 'purchase' && !['completed', 'cancelled'].includes(p.status) ? `<button class="pp-btn small" type="button" data-log="${esc(p.id)}">+ Daily log</button>` : ''}${isManager() && a === 'pending' ? `<button class="pp-btn small ok" type="button" data-review="${esc(p.id)}">Review</button>` : ''}</div></td></tr>`;
    }).join('')}</tbody></table></div>`;
    box.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openProject(b.dataset.open));
    box.querySelectorAll('[data-review]').forEach(b => b.onclick = () => openProject(b.dataset.review));
    box.querySelectorAll('[data-log]').forEach(b => b.onclick = () => openProject(b.dataset.log, 'material'));
}
async function openProject(id, logType) {
    const run = ++generation;
    busy('Loading project report…');
    try {
        const [result, list] = await Promise.all([request('purchase-projects/' + encodeURIComponent(id)), loadPurchases().catch(() => null)]);
        if (run !== generation) return;
        current = result; purchases = list;
        if (!role) role = (await request('purchase-projects')).role;
        if (run !== generation) return;
        renderProject();
        if (logType) entryForm(logType);
    } catch (e) { if (run === generation) failed(e, () => openProject(id, logType)); }
}
async function loadPurchases() {
    const all = []; let next = '';
    do { const r = await request('purchases' + (next ? '?after=' + encodeURIComponent(next) : '')); all.push(...r.data); next = r.next; } while (next);
    return all;
}
function inRange(e) { return (!from || e.date >= from) && (!to || e.date <= to); }
function renderProject() {
    const p = current.data, cur = p.currency, a = p.approval?.status || 'pending';
    const entries = current.entries.filter(inRange);
    const live = entries.filter(e => !e.deletedAt);
    const sum = type => live.filter(e => type ? e.type === type : true).reduce((s, e) => s + (e.amount || 0), 0);
    const all = totalsOf(p), cost = costOf(p), ranged = !!(from || to);
    const period = { material: sum('material'), manpower: sum('manpower'), machinery: sum('machinery') };
    const periodCost = period.material + period.manpower + period.machinery;
    const manDays = live.filter(e => e.type === 'manpower').reduce((s, e) => s + e.workers, 0);
    const machineHours = live.filter(e => e.type === 'machinery').reduce((s, e) => s + e.units * e.hours, 0);
    const kpi = (label, value, note) => `<div class="pp-kpi"><span>${label}</span><b>${value}</b>${note ? `<small>${note}</small>` : ''}</div>`;
    const canLog = role === 'purchase' && !['completed', 'cancelled'].includes(p.status);
    const stack = cost ? Object.keys(TYPES).map(k => `<i style="width:${all[k] / cost * 100}%;background:${TYPES[k].color}" title="${TYPES[k].label}"></i>`).join('') : '';
    const sales = p.sales;
    main().innerHTML = `<div class="pm pp">
      <div class="pp-hero"><div><span class="pp-eyebrow">Project report · ${esc(p.projectNumber)}</span><h2>${esc(p.name)}</h2><p>${esc([p.client, p.location].filter(Boolean).join(' · ') || 'No client recorded')} &nbsp; ${pill(p.status, statusLabel(p.status))} ${pill(a, a === 'pending' ? 'Awaiting approval' : a)}</p></div>
      <div class="pp-actions pp-noprint"><button class="pp-btn" type="button" id="ppBack">← All projects</button><button class="pp-btn" type="button" id="ppCsv">Export CSV</button><button class="pp-btn" type="button" id="ppPrint">Print / PDF</button>${role === 'purchase' ? '<button class="pp-btn" type="button" id="ppEdit">Edit project</button>' : ''}${canLog ? Object.keys(TYPES).map(k => `<button class="pp-btn primary" type="button" data-add="${k}">+ ${TYPES[k].label}</button>`).join('') : ''}${isManager() && a === 'pending' ? '<button class="pp-btn ok" type="button" data-decide="approved">Approve</button><button class="pp-btn danger" type="button" data-decide="rejected">Reject</button>' : ''}</div></div>
      ${a === 'pending' ? `<p class="pp-alert">${p.approval?.kind === 'edit' ? 'Project changes are' : 'This project is'} awaiting COO / Director approval${sales ? ` — sales currently use the last approved value ${esc(money(sales.currency, sales.value))}` : ' — it is not yet counted in sales'}.</p>` : ''}
      ${a === 'rejected' ? `<p class="pp-alert">Rejected by ${esc(p.approval.decidedBy?.name || 'management')}: ${esc(p.approval.note || '')}. Edit the project to resubmit.</p>` : ''}
      <div class="pp-card"><div class="pp-info">
        <div><span>Project number</span><b>${esc(p.projectNumber)}</b></div><div><span>Contract / PO value</span><b>${esc(money(cur, p.projectValue))}</b></div><div><span>Award / PO date</span><b>${dmy(p.awardDate)}</b></div>
        <div><span>Start · planned completion</span><b>${dmy(p.startDate)} → ${dmy(p.endDate)}</b></div><div><span>Project manager</span><b>${esc(p.manager || '—')}</b></div>
        <div><span>Counted in sales</span><b>${sales?.include ? `Yes · ${esc(money(sales.currency, sales.value))} on ${dmy(sales.date)}` : p.includeInSales ? 'After approval' : 'No'}</b></div>
        ${p.description ? `<div style="grid-column:1/-1"><span>Scope / description</span><b style="font-weight:500;white-space:pre-wrap">${esc(p.description)}</b></div>` : ''}
      </div></div>
      <div class="pp-kpis">${kpi('Contract value', esc(money(cur, p.projectValue)))}${kpi('Cost to date', esc(money(cur, cost)), all.entries + ' entries')}${kpi('Balance', `<em style="font-style:normal;color:${p.projectValue - cost < 0 ? '#b91c1c' : 'inherit'}">${esc(money(cur, p.projectValue - cost))}</em>`, p.projectValue ? (cost / p.projectValue * 100).toFixed(1) + '% of value consumed' : '')}${kpi('Material', esc(money(cur, all.material)))}${kpi('Manpower', esc(money(cur, all.manpower)), qty(all.manDays) + ' man-days · ' + qty(all.manHours) + ' man-hours')}${kpi('Machinery', esc(money(cur, all.machinery)), qty(all.machineHours) + ' machine-hours')}</div>
      <div class="pp-card"><div class="pp-head"><div><h3>Cost breakdown</h3><p>Share of cost to date by category</p></div></div><div style="padding:0 1.1rem 1rem"><div class="pp-stack">${stack}</div><div class="pp-legend">${Object.keys(TYPES).map(k => `<span style="--c:${TYPES[k].color}">${TYPES[k].label} ${cost ? (all[k] / cost * 100).toFixed(1) : '0.0'}% · ${fmt(all[k])}</span>`).join('')}</div></div></div>
      <div class="pp-card pp-section"><div class="pp-tools pp-noprint"><label>From<input type="date" id="ppFrom" value="${esc(from)}"></label><label>To<input type="date" id="ppTo" value="${esc(to)}"></label>
        <button class="pp-btn small" type="button" data-range="week">This week</button><button class="pp-btn small" type="button" data-range="month">This month</button><button class="pp-btn small" type="button" data-range="all">All dates</button>
        <span style="font-size:.74rem;color:#475569">${ranged ? `Period cost: <b>${esc(money(cur, periodCost))}</b> · ${qty(manDays)} man-days · ${qty(machineHours)} machine-hours` : 'Showing all dates'}</span></div>
        <div class="pp-tabs pp-noprint" role="tablist">${[['daily', 'Daily summary'], ['material', 'Material'], ['manpower', 'Manpower'], ['machinery', 'Machinery'], ['purchases', 'Purchases'], ['activity', 'Activity']].map(([k, l]) => `<button class="pp-tab" type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>
        <div id="ppTab"></div></div>
      <p class="pp-note">Amounts are in the project currency (${esc(cur)}). Material = quantity × rate; manpower = workers × rate per man-day; machinery = units × hours × rate per hour. Removed entries stay in the history but are excluded from totals.${ranged ? ` Report period ${esc(from || 'start')} to ${esc(to || 'today')}.` : ''} Generated ${esc(new Date().toLocaleString())}.</p></div>`;
    document.getElementById('ppBack').onclick = loadList;
    document.getElementById('ppPrint').onclick = () => window.print();
    document.getElementById('ppCsv').onclick = exportProject;
    document.getElementById('ppEdit')?.addEventListener('click', () => projectForm(p));
    document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => entryForm(b.dataset.add));
    document.querySelectorAll('[data-decide]').forEach(b => b.onclick = () => decisionForm(b.dataset.decide));
    document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; renderProject(); });
    document.getElementById('ppFrom').onchange = e => { from = e.target.value; renderProject(); };
    document.getElementById('ppTo').onchange = e => { to = e.target.value; renderProject(); };
    document.querySelectorAll('[data-range]').forEach(b => b.onclick = () => {
        const d = new Date();
        if (b.dataset.range === 'all') { from = ''; to = ''; }
        else if (b.dataset.range === 'month') { from = today().slice(0, 8) + '01'; to = today(); }
        else { d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); from = d.toISOString().slice(0, 10); to = today(); }
        renderProject();
    });
    renderTab(entries);
}
function table(head, rows, foot) {
    return `<div class="pp-wrap"><table class="pp-table"><thead><tr>${head.map(h => `<th class="${/amount|rate|qty|workers|hours|units|total|cost|value|man-|machine/i.test(h) ? 'num' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${head.length}" class="pp-empty">No entries for this period.</td></tr>`}</tbody>${foot && rows.length ? `<tfoot>${foot}</tfoot>` : ''}</table></div>`;
}
function renderTab(entries) {
    const box = document.getElementById('ppTab'), p = current.data;
    const live = entries.filter(e => !e.deletedAt);
    const by = e => `<small>${esc(e.createdBy?.name || '')}</small>`;
    const remove = e => role === 'purchase' && !e.deletedAt ? `<button class="pp-btn small danger pp-noprint" type="button" data-remove="${esc(e.id)}">Remove</button>` : '';
    const why = e => e.deletedAt ? `<td class="why"><small>Removed: ${esc(e.deleteReason)}</small></td>` : `<td>${esc(e.remarks || '')}${by(e)}</td>`;
    const rowsOf = type => entries.filter(e => e.type === type).sort((a, b) => b.date.localeCompare(a.date) || (b.at || '').localeCompare(a.at || ''));
    const sum = (type, key) => live.filter(e => e.type === type).reduce((s, e) => s + (key(e) || 0), 0);
    if (tab === 'daily') {
        const days = new Map();
        live.forEach(e => {
            const d = days.get(e.date) || { material: 0, manpower: 0, machinery: 0, workers: 0, machineHours: 0, items: 0 };
            d[e.type] += e.amount; d.items++;
            if (e.type === 'manpower') d.workers += e.workers;
            if (e.type === 'machinery') d.machineHours += e.units * e.hours;
            days.set(e.date, d);
        });
        let running = 0;
        const asc = [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => { running += d.material + d.manpower + d.machinery; return [date, d, running]; });
        const t = asc.reduce((s, [, d]) => { ['material', 'manpower', 'machinery', 'workers', 'machineHours', 'items'].forEach(k => s[k] += d[k]); return s; }, { material: 0, manpower: 0, machinery: 0, workers: 0, machineHours: 0, items: 0 });
        box.innerHTML = table(['Date', 'Entries', 'Material', 'Manpower', 'Workers (man-days)', 'Machinery', 'Machine-hours', 'Day total', 'Cumulative cost'],
            asc.reverse().map(([date, d, cum]) => `<tr><td><b>${dmy(date)}</b></td><td>${d.items}</td><td class="num">${fmt(d.material)}</td><td class="num">${fmt(d.manpower)}</td><td class="num">${qty(d.workers)}</td><td class="num">${fmt(d.machinery)}</td><td class="num">${qty(d.machineHours)}</td><td class="num"><b>${fmt(d.material + d.manpower + d.machinery)}</b></td><td class="num">${fmt(cum)}</td></tr>`),
            `<tr><td>Total · ${asc.length} day(s)</td><td>${t.items}</td><td class="num">${fmt(t.material)}</td><td class="num">${fmt(t.manpower)}</td><td class="num">${qty(t.workers)}</td><td class="num">${fmt(t.machinery)}</td><td class="num">${qty(t.machineHours)}</td><td class="num">${fmt(t.material + t.manpower + t.machinery)}</td><td></td></tr>`);
    } else if (tab === 'material') {
        box.innerHTML = table(['Date', 'Material', 'Qty', 'Rate', 'Amount', 'Supplier', 'DC / invoice ref.', 'Remarks / entered by', ''],
            rowsOf('material').map(e => `<tr class="${e.deletedAt ? 'removed' : ''}"><td>${dmy(e.date)}</td><td><b>${esc(e.description)}</b></td><td class="num">${qty(e.quantity)} ${esc(e.unit)}</td><td class="num">${fmt(e.rate)}</td><td class="num"><b>${fmt(e.amount)}</b></td><td>${esc(e.supplier || '—')}</td><td>${esc(e.reference || '—')}</td>${why(e)}<td>${remove(e)}</td></tr>`),
            `<tr><td colspan="4">Total material</td><td class="num">${fmt(sum('material', e => e.amount))}</td><td colspan="4"></td></tr>`);
    } else if (tab === 'manpower') {
        box.innerHTML = table(['Date', 'Trade / category', 'Workers', 'Hours each', 'Man-hours', 'Rate / man-day', 'Amount', 'Contractor', 'Remarks / entered by', ''],
            rowsOf('manpower').map(e => `<tr class="${e.deletedAt ? 'removed' : ''}"><td>${dmy(e.date)}</td><td><b>${esc(e.description)}</b></td><td class="num">${qty(e.workers)}</td><td class="num">${qty(e.hours)}</td><td class="num">${qty(e.workers * e.hours)}</td><td class="num">${fmt(e.rate)}</td><td class="num"><b>${fmt(e.amount)}</b></td><td>${esc(e.supplier || '—')}</td>${why(e)}<td>${remove(e)}</td></tr>`),
            `<tr><td colspan="2">Total manpower</td><td class="num">${qty(sum('manpower', e => e.workers))}</td><td></td><td class="num">${qty(sum('manpower', e => e.workers * e.hours))}</td><td></td><td class="num">${fmt(sum('manpower', e => e.amount))}</td><td colspan="3"></td></tr>`);
    } else if (tab === 'machinery') {
        box.innerHTML = table(['Date', 'Machinery / equipment', 'Units', 'Hours', 'Machine-hours', 'Rate / hour', 'Amount', 'Owner / supplier', 'Remarks / entered by', ''],
            rowsOf('machinery').map(e => `<tr class="${e.deletedAt ? 'removed' : ''}"><td>${dmy(e.date)}</td><td><b>${esc(e.description)}</b></td><td class="num">${qty(e.units)}</td><td class="num">${qty(e.hours)}</td><td class="num">${qty(e.units * e.hours)}</td><td class="num">${fmt(e.rate)}</td><td class="num"><b>${fmt(e.amount)}</b></td><td>${esc(e.supplier || '—')}</td>${why(e)}<td>${remove(e)}</td></tr>`),
            `<tr><td colspan="4">Total machinery</td><td class="num">${qty(sum('machinery', e => e.units * e.hours))}</td><td></td><td class="num">${fmt(sum('machinery', e => e.amount))}</td><td colspan="3"></td></tr>`);
    } else if (tab === 'purchases') {
        const linked = (purchases || []).filter(r => (r.projectNumber || '').toUpperCase() === p.projectNumber);
        box.innerHTML = purchases === null ? '<p class="pp-empty">The purchase register could not be loaded.</p>' : table(['Reference', 'Item / quantity', 'Vendor', 'Value', 'Stage', 'Approval', 'Updated'],
            linked.map(r => `<tr><td class="pp-no">${esc(r.reference || r.id.slice(0, 8))}</td><td><b>${esc(r.item)}</b><small>${esc(r.qty)}</small></td><td>${esc(r.vendor || '—')}</td><td class="num">${esc(money(r.currency, r.amount))}</td><td>${pill('', String(r.stage).toUpperCase())}</td><td>${pill(r.approval?.status || 'draft')}</td><td>${when(r.updatedAt)}</td></tr>`)) +
            '<p class="pp-note" style="padding:0 1rem">Purchase register entries linked to this project number. Link a purchase by choosing the project number on the purchase form.</p>';
    } else {
        box.innerHTML = current.activities.length ? current.activities.map(a => `<div class="pp-event"><span>•</span><div><b>${esc(a.actor?.name)} · ${esc(String(a.action).replace(/_/g, ' '))}</b><span>${when(a.at)} · ${esc(a.actor?.role)}</span><p>${esc(typeof a.details === 'string' ? a.details : [a.details?.note, ...(a.details?.changed || []).map(c => `${c.field}: ${c.before} → ${c.after}`)].filter(Boolean).join('\n'))}</p></div></div>`).join('') : '<p class="pp-empty">No activity recorded.</p>';
    }
    box.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => removeForm(current.entries.find(e => e.id === b.dataset.remove)));
}
function exportProject() {
    const p = current.data;
    const rows = [['Project number', 'Project', 'Date', 'Type', 'Description', 'Quantity / workers / units', 'Unit / hours', 'Rate', 'Currency', 'Amount', 'Supplier / contractor', 'Reference', 'Remarks', 'Entered by', 'Status']];
    current.entries.filter(inRange).sort((a, b) => a.date.localeCompare(b.date)).forEach(e => rows.push([p.projectNumber, p.name, e.date, TYPES[e.type].label, e.description,
        e.type === 'material' ? e.quantity : e.type === 'manpower' ? e.workers : e.units, e.type === 'material' ? e.unit : e.hours, e.rate, e.currency || p.currency, e.amount,
        e.supplier, e.reference || '', e.remarks, e.createdBy?.name, e.deletedAt ? 'Removed: ' + e.deleteReason : 'Active']));
    saveCsv(`project-${p.projectNumber.replace(/[^A-Za-z0-9_-]/g, '_')}-${today()}.csv`, rows);
}
// Shared accessible modal.
function modal(title, body, onSubmit, submitText) {
    document.getElementById('ppModal')?.remove();
    const previous = document.activeElement;
    const wrap = document.createElement('div'); wrap.id = 'ppModal'; wrap.className = 'pp-modal';
    wrap.innerHTML = `<form class="pp-box" role="dialog" aria-modal="true" aria-label="${esc(title)}" novalidate><div class="pp-box-h"><h3>${esc(title)}</h3><button class="pp-btn" type="button" data-close>Close</button></div>${body}<div class="pp-foot"><p role="status" id="ppMsg"></p><button class="pp-btn" type="button" data-close>Cancel</button><button class="pp-btn primary" type="submit">${esc(submitText)}</button></div></form>`;
    document.body.appendChild(wrap);
    const close = () => { wrap.remove(); previous?.focus?.(); };
    wrap.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
    wrap.onkeydown = e => {
        if (e.key === 'Escape') close();
        if (e.key === 'Tab') {
            const f = [...wrap.querySelectorAll('button,input,select,textarea')].filter(x => !x.disabled), first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    };
    const form = wrap.querySelector('form');
    form.onsubmit = async e => {
        e.preventDefault();
        const button = form.querySelector('[type=submit]'), msg = form.querySelector('#ppMsg');
        const invalid = [...form.elements].find(el => el.willValidate && !el.checkValidity());
        if (invalid) { msg.textContent = (invalid.labels?.[0]?.textContent || 'A field') + ': ' + invalid.validationMessage; invalid.focus(); return; }
        button.disabled = true; msg.textContent = 'Saving…';
        try { await onSubmit(new FormData(form), form); close(); }
        catch (error) { msg.textContent = error.message; button.disabled = false; }
    };
    (form.querySelector('input:not([type=hidden]):not([disabled]),select,textarea') || form.querySelector('[data-close]')).focus();
    return form;
}
const input = (name, label, value, attrs = '', full = false) => `<div class="pp-field${full ? ' full' : ''}"><label for="pp-${name}">${label}</label><input id="pp-${name}" name="${name}" value="${esc(value ?? '')}" ${attrs}></div>`;
function projectForm(p) {
    const editing = !!p; p = p || { currency: 'INR', status: 'active', includeInSales: true, awardDate: today() };
    modal(editing ? 'Edit project ' + p.projectNumber : 'New project', `<div class="pp-form">
        ${input('projectNumber', 'Project number *', p.projectNumber, `required maxlength="40" placeholder="e.g. EB-2026-014" ${editing ? 'disabled' : ''}`)}
        ${input('name', 'Project name *', p.name, 'required maxlength="200"')}
        ${input('client', 'Client', p.client, 'maxlength="200"')}${input('location', 'Site / location', p.location, 'maxlength="200"')}
        ${input('projectValue', 'Project / PO value *', p.projectValue, 'required type="number" min="0" max="1000000000000" step="0.01"')}
        <div class="pp-field"><label for="pp-currency">Currency</label><select id="pp-currency" name="currency">${CURRENCIES.map(c => `<option ${p.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        ${input('awardDate', 'Award / PO date *', p.awardDate, 'required type="date"')}${input('manager', 'Project manager / site in-charge', p.manager, 'maxlength="200"')}
        ${input('startDate', 'Start date', p.startDate, 'type="date"')}${input('endDate', 'Planned completion', p.endDate, 'type="date"')}
        <div class="pp-field"><label for="pp-status">Status</label><select id="pp-status" name="status">${STATUSES.map(s => `<option value="${s[0]}" ${p.status === s[0] ? 'selected' : ''}>${s[1]}</option>`).join('')}</select></div>
        <div class="pp-field check"><label><input type="checkbox" name="includeInSales" ${p.includeInSales ? 'checked' : ''}> Count project value in sales (weekly sales report)</label></div>
        <div class="pp-field full"><label for="pp-description">Scope / description</label><textarea id="pp-description" name="description" rows="3" maxlength="4000">${esc(p.description)}</textarea></div>
        ${editing ? '<div class="pp-field full"><label for="pp-note">Reason for change *</label><textarea id="pp-note" name="note" rows="2" maxlength="2000" required></textarea></div>' : ''}
        <p class="pp-calc">${editing ? 'Changes are saved and sent to COO / Director. Sales keep the last approved value until approval.' : 'The project is submitted to COO / Director. Its value is added to sales after approval. The project number cannot be changed later.'}</p></div>`,
    async data => {
        const body = Object.fromEntries(data);
        body.projectValue = Number(body.projectValue); body.includeInSales = data.has('includeInSales');
        if (editing) { body.version = p.version; await post('purchase-projects/' + p.id, body, 'PUT'); await openProject(p.id); }
        else { const r = await post('purchase-projects', body); await openProject(r.data.id); }
    }, editing ? 'Save & submit for approval' : 'Create & submit for approval');
}
function entryForm(type) {
    const p = current.data, cur = p.currency;
    const fields = {
        material: `${input('description', 'Material *', '', 'required maxlength="200" placeholder="e.g. Cement OPC 53, TMT 12 mm" list="ppMaterials"', true)}
            ${input('quantity', 'Quantity *', '', 'required type="number" min="0" step="0.01"')}${input('unit', 'Unit', '', 'maxlength="20" placeholder="bag, MT, nos, m³"')}
            ${input('rate', `Rate per unit (${cur}) *`, '', 'required type="number" min="0" step="0.01"')}${input('supplier', 'Supplier', '', 'maxlength="200"')}
            ${input('reference', 'DC / invoice reference', '', 'maxlength="100"')}`,
        manpower: `${input('description', 'Trade / category *', '', 'required maxlength="100" list="ppTrades"')}${input('supplier', 'Contractor', '', 'maxlength="200"')}
            ${input('workers', 'Number of workers *', '', 'required type="number" min="1" step="1"')}${input('hours', 'Hours worked each', '8', 'type="number" min="0" max="24" step="0.5"')}
            ${input('rate', `Rate per man-day (${cur}) *`, '', 'required type="number" min="0" step="0.01"')}`,
        machinery: `${input('description', 'Machinery / equipment *', '', 'required maxlength="200" placeholder="e.g. Crane 25T, JCB, DG 125 kVA"', true)}
            ${input('units', 'Number of units *', '1', 'required type="number" min="1" step="1"')}${input('hours', 'Working hours *', '', 'required type="number" min="0" max="24" step="0.5"')}
            ${input('rate', `Rate per hour (${cur}) *`, '', 'required type="number" min="0" step="0.01"')}${input('supplier', 'Owner / supplier', '', 'maxlength="200"')}`
    }[type];
    const known = [...new Set(current.entries.filter(e => e.type === 'material').map(e => e.description))].slice(0, 100);
    const form = modal(`Daily ${TYPES[type].label.toLowerCase()} log · ${p.projectNumber}`, `<div class="pp-form">${input('date', 'Date *', today(), `required type="date" max="${today()}"`)}<div></div>${fields}
        <div class="pp-field full"><label for="pp-remarks">Remarks</label><textarea id="pp-remarks" name="remarks" rows="2" maxlength="1000"></textarea></div><p class="pp-calc" id="ppAmount" aria-live="polite"></p></div>
        <datalist id="ppTrades">${TRADES.map(t => `<option value="${t}">`).join('')}</datalist><datalist id="ppMaterials">${known.map(t => `<option value="${esc(t)}">`).join('')}</datalist>`,
    async data => {
        const body = Object.fromEntries(data); body.type = type;
        ['quantity', 'rate', 'workers', 'hours', 'units'].forEach(k => { if (k in body) body[k] = body[k] === '' ? 0 : Number(body[k]); });
        await post('purchase-projects/' + p.id + '/entries', body);
        tab = type; await openProject(p.id);
    }, 'Save entry');
    const calc = () => {
        const v = k => Number(form.elements[k]?.value || 0);
        const amount = type === 'material' ? v('quantity') * v('rate') : type === 'manpower' ? v('workers') * v('rate') : v('units') * v('hours') * v('rate');
        form.querySelector('#ppAmount').innerHTML = `Amount: <b>${esc(money(cur, amount))}</b>${type === 'manpower' ? ` · ${qty(v('workers') * v('hours'))} man-hours` : type === 'machinery' ? ` · ${qty(v('units') * v('hours'))} machine-hours` : ''}`;
    };
    form.addEventListener('input', calc); calc();
}
function removeForm(entry) {
    modal('Remove entry', `<div class="pp-form"><p class="pp-calc">${esc(dmy(entry.date))} · ${esc(TYPES[entry.type].label)} · ${esc(entry.description)} · ${esc(money(current.data.currency, entry.amount))}<br>The entry stays in the history but no longer counts in totals.</p>
        <div class="pp-field full"><label for="pp-reason">Reason for removal *</label><textarea id="pp-reason" name="reason" rows="2" maxlength="1000" required></textarea></div></div>`,
    async data => { await post(`purchase-projects/${current.data.id}/entries/${entry.id}/delete`, { reason: data.get('reason') }); await openProject(current.data.id); }, 'Remove entry');
}
function decisionForm(decision) {
    const p = current.data;
    modal((decision === 'approved' ? 'Approve ' : 'Reject ') + p.projectNumber, `<div class="pp-form"><p class="pp-calc">${esc(p.name)} · ${esc(money(p.currency, p.projectValue))} · award ${dmy(p.awardDate)} · ${p.includeInSales && p.status !== 'cancelled' ? 'will count in sales on approval' : 'not counted in sales'}</p>
        <div class="pp-field full"><label for="pp-dnote">Decision note${decision === 'rejected' ? ' *' : ''}</label><textarea id="pp-dnote" name="note" rows="3" maxlength="2000" ${decision === 'rejected' ? 'required' : ''}></textarea></div></div>`,
    async data => { await post(`purchase-projects/${p.id}/decision`, { version: p.version, decision, note: data.get('note') }); await openProject(p.id); }, decision === 'approved' ? 'Approve' : 'Reject');
}
window.showPurchaseProjects = function () { css(); from = ''; to = ''; tab = 'daily'; loadList(); };
// Used by the purchase form to link a purchase to a project number.
window.loadPurchaseProjectOptions = async function () { return (await request('purchase-projects')).data; };
})();
