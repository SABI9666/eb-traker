// EB Tracker - Timesheet Portal (multi-company). Standalone page: it does not
// load or change anything in the main EB Tracker app. Same Firebase login.
(function () {
    'use strict';

    const firebaseConfig = {
        apiKey: 'AIzaSyBp7wCYMuM_FND-WnDlH0lrDJFGt4DqK-U',
        authDomain: 'eb-tracker-ff945.firebaseapp.com',
        projectId: 'eb-tracker-ff945',
        storageBucket: 'eb-tracker-ff945.firebasestorage.app',
        messagingSenderId: '854824137821',
        appId: '1:854824137821:web:7a408282c2f7c1816c89b4'
    };
    const API = (window.TS_API_BASE || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && localStorage.getItem('tsApiBase'))
        || 'https://west-epcm-backend-854824137821.us-central1.run.app') + '/api/ts-portal';

    // A named app keeps the portal's sign-in separate from EB Tracker's on the same
    // domain: signing in or out here never signs anyone in or out of EB Tracker.
    const fbApp = firebase.initializeApp(firebaseConfig, 'ts-portal');
    const auth = fbApp.auth();
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});

    const ROLE_LABEL = { employee: 'Employee', supervisor: 'Supervisor', project_manager: 'Project manager', gm: 'General manager', company_admin: 'Company admin' };
    const STEP_LABEL = { supervisor: 'Supervisor', project_manager: 'Project manager', gm: 'General manager' };
    const MANAGERS = ['supervisor', 'project_manager', 'gm', 'company_admin'];
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmtH = n => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });
    const pad = n => String(n).padStart(2, '0');
    const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
    const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const weekStartOf = s => { const dow = new Date(s + 'T00:00:00Z').getUTCDay(); return addDays(s, dow === 0 ? -6 : 1 - dow); };
    const fmtDate = (s, opts = { day: 'numeric', month: 'short' }) => new Date(s + 'T00:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC', ...opts });
    const fmtWhen = s => s ? new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
    const chip = st => `<span class="chip ${esc(st)}">${esc(st === 'submitted' ? 'waiting approval' : st)}</span>`;

    const state = { me: null, loginMode: 'member', approvalsCount: 0 };

    // ---------------- API ----------------
    async function api(path, opts = {}) {
        const user = auth.currentUser;
        if (!user) throw new Error('Please sign in');
        const token = await user.getIdToken();
        const headers = { Authorization: 'Bearer ' + token, ...(opts.headers || {}) };
        let body = opts.body;
        if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
        let r;
        try { r = await fetch(API + path, { method: opts.method || 'GET', headers, body }); }
        catch (e) { throw new Error('Cannot reach the server. Check your connection and try again.'); }
        if (opts.raw) { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText); return r; }
        const data = await r.json().catch(() => ({}));
        if (!r.ok) { const e = new Error(data.error || r.statusText); e.details = data.details; e.status = r.status; throw e; }
        return data;
    }

    // ---------------- UI helpers ----------------
    let toastTimer;
    function toast(msg, bad) {
        const t = $('#toast');
        t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false;
        clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, bad ? 6000 : 3000);
    }
    function errorHtml(e) {
        const list = (e.details || []).map(d => `<li>${d.row ? `Row ${esc(d.row)}: ` : ''}${esc(d.error)}</li>`).join('');
        return `<div class="banner bad"><b>${esc(e.message)}</b>${list ? `<ul class="errors">${list}</ul>` : ''}</div>`;
    }
    function modal(title, bodyHtml, buttons) {
        buttons = buttons || [{ label: 'Close', value: null, cls: 'primary' }];
        return new Promise(resolve => {
            const root = $('#modalRoot');
            root.innerHTML = `<div class="overlay"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
                <header><h3>${esc(title)}</h3><button class="icon-btn" data-x aria-label="Close">×</button></header>
                <div class="body">${bodyHtml}</div>
                <footer>${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</footer>
            </div></div>`;
            const close = v => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); resolve(v); };
            const onKey = e => { if (e.key === 'Escape') close(null); };
            document.addEventListener('keydown', onKey);
            $('[data-x]', root).onclick = () => close(null);
            $('.overlay', root).addEventListener('mousedown', e => { if (e.target.classList.contains('overlay')) close(null); });
            $$('footer .btn', root).forEach(btn => {
                btn.onclick = async () => {
                    const b = buttons[Number(btn.dataset.i)];
                    if (b.onClick) {
                        btn.disabled = true;
                        try { const v = await b.onClick($('.body', root)); if (v !== false) close(v === undefined ? b.value : v); }
                        catch (e) { const box = $('.modal-err', root) || $('.body', root).insertAdjacentElement('afterbegin', Object.assign(document.createElement('div'), { className: 'modal-err' })); box.innerHTML = errorHtml(e); }
                        finally { btn.disabled = false; }
                    } else close(b.value);
                };
            });
            const first = $('.body input, .body select, .body textarea', root);
            (first || $('footer .btn:last-child', root)).focus();
        });
    }
    const confirmBox = (title, html, okLabel = 'OK', cls = 'primary') => modal(title, html, [{ label: 'Cancel', value: false }, { label: okLabel, value: true, cls }]);
    function download(blob, name) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    function setContent(html) { const c = $('#content'); c.innerHTML = html; c.focus({ preventScroll: true }); window.scrollTo(0, 0); }
    const loading = () => setContent('<div class="empty"><div class="spinner" style="margin:auto"></div></div>');

    // ---------------- Sign in ----------------
    function showLogin(message, ok) {
        $('#boot').hidden = true; $('#appView').hidden = true; $('#loginView').hidden = false;
        const m = $('#loginMsg');
        if (message) { m.textContent = message; m.className = 'msg' + (ok ? ' ok' : ''); m.hidden = false; } else m.hidden = true;
    }
    function setLoginMode(mode) {
        state.loginMode = mode;
        $$('.tab').forEach(t => { const on = t.dataset.mode === mode; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
        $('.login-card').classList.toggle('super', mode === 'super');
        $('#loginHint').textContent = mode === 'super'
            ? 'Platform owner only. Manage companies and their admins.'
            : 'Sign in with the email your company admin invited.';
        $('#loginBtn').textContent = mode === 'super' ? 'Sign in as Super Admin' : 'Sign in';
        $('#loginMsg').hidden = true;
    }
    $$('.tab').forEach(t => t.addEventListener('click', () => setLoginMode(t.dataset.mode)));
    $('#toggleReset').addEventListener('click', () => {
        const showReset = $('#resetForm').hidden;
        $('#resetForm').hidden = !showReset; $('#loginForm').hidden = showReset;
        $('#toggleReset').textContent = showReset ? 'Back to sign in' : 'Forgot password?';
        if (showReset) $('#resetEmail').value = $('#loginEmail').value;
    });
    $('#resetForm').addEventListener('submit', async e => {
        e.preventDefault();
        try {
            await auth.sendPasswordResetEmail($('#resetEmail').value.trim(), { url: location.origin + location.pathname });
        } catch (err) { /* same message either way: do not reveal which emails exist */ }
        showLogin('If that email has an account, a reset link is on its way.', true);
    });
    $('#loginForm').addEventListener('submit', async e => {
        e.preventDefault();
        const btn = $('#loginBtn'); btn.disabled = true;
        sessionStorage.setItem('tsLoginMode', state.loginMode);
        try {
            await auth.signInWithEmailAndPassword($('#loginEmail').value.trim(), $('#loginPassword').value);
            $('#loginPassword').value = '';
        } catch (err) {
            const code = err && err.code || '';
            showLogin(/wrong-password|user-not-found|invalid-credential|invalid-login/.test(code) ? 'Email or password is incorrect.'
                : code === 'auth/too-many-requests' ? 'Too many attempts. Wait a few minutes or reset your password.' : (err.message || 'Sign in failed'));
        } finally { btn.disabled = false; }
    });
    $('#signOut').addEventListener('click', () => auth.signOut());
    $('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

    auth.onAuthStateChanged(async user => {
        if (!user) { state.me = null; $('#boot').hidden = true; showLogin(); return; }
        $('#boot').hidden = false;
        try {
            state.me = await api('/me');
        } catch (e) {
            await auth.signOut(); showLogin(e.message); return;
        }
        const mode = sessionStorage.getItem('tsLoginMode');
        sessionStorage.removeItem('tsLoginMode');
        const { user: u, membership: m } = state.me;
        if (mode === 'super' && !u.superAdmin) {
            await auth.signOut(); setLoginMode('super'); showLogin('This account is not a Super Admin.'); return;
        }
        if (!u.superAdmin && !m) {
            await auth.signOut(); showLogin('This account is not part of any company in the Timesheet Portal. Ask your company admin to invite you.'); return;
        }
        if (!u.superAdmin && m && m.companyStatus !== 'active') {
            await auth.signOut(); showLogin(`${m.companyName} is ${m.companyStatus}. Contact the portal administrator.`); return;
        }
        if (!u.superAdmin && m && m.status === 'disabled') {
            await auth.signOut(); showLogin('Your account has been disabled by your company admin.'); return;
        }
        startApp(mode === 'super');
    });

    // ---------------- Shell & router ----------------
    const isMember = () => !!(state.me && state.me.membership && state.me.membership.companyStatus === 'active' && state.me.membership.status !== 'disabled');
    const role = () => (isMember() ? state.me.membership.role : null);
    const isManager = () => MANAGERS.includes(role());
    const isAdmin = () => role() === 'company_admin';
    const isSuper = () => !!(state.me && state.me.user.superAdmin);

    function homeRoute() {
        if (!isMember()) return '#/super';
        if (role() === 'gm') return '#/reports';
        return '#/week';
    }

    function startApp(superFirst) {
        $('#boot').hidden = true; $('#loginView').hidden = true; $('#appView').hidden = false;
        const m = state.me.membership;
        $('#companyName').textContent = isMember() ? m.companyName : 'Platform';
        $('#whoName').textContent = isMember() ? m.name : state.me.user.email;
        $('#whoRole').textContent = [isMember() ? ROLE_LABEL[m.role] : null, isSuper() ? 'Super Admin' : null].filter(Boolean).join(' · ');
        if (superFirst || !location.hash || location.hash === '#/' || location.hash === '#') location.hash = superFirst ? '#/super' : homeRoute();
        else route();
        refreshBadge();
    }

    function renderMenu(active) {
        const items = [];
        if (isMember()) {
            items.push('<h4>My time</h4>', link('#/week', 'My week', active), link('#/history', 'My history', active));
            if (isManager()) {
                items.push('<h4>Manage</h4>', link('#/approvals', 'Approvals', active, state.approvalsCount),
                    link('#/team', 'Team overview', active), link('#/reports', 'Reports', active));
            }
            if (isAdmin()) {
                items.push('<h4>Company admin</h4>', link('#/admin/people', 'People', active), link('#/admin/projects', 'Projects', active),
                    link('#/admin/settings', 'Settings', active), link('#/admin/audit', 'Activity log', active));
            }
        }
        if (isSuper()) items.push('<h4>Super Admin</h4>', link('#/super', 'Companies', active), link('#/super/summary', 'All-company summary', active));
        $('#sidebar').innerHTML = items.join('');
    }
    function link(href, label, active, badge) {
        const on = active === href || (href !== '#/super' && active.startsWith(href + '/'));
        return `<a href="${href}" class="${on ? 'active' : ''}"${on ? ' aria-current="page"' : ''}>${esc(label)}${badge ? `<span class="badge">${badge}</span>` : ''}</a>`;
    }
    async function refreshBadge() {
        if (!isManager()) return;
        try { state.approvalsCount = (await api('/ts/approvals')).approvals.length; } catch (e) { state.approvalsCount = 0; }
        renderMenu(currentBase());
    }
    function currentBase() {
        const h = location.hash || '#/';
        const parts = h.split('/');
        if (parts[1] === 'admin' || (parts[1] === 'super' && parts[2] === 'summary')) return parts.slice(0, 3).join('/');
        if (parts[1] === 'sheet') return '#/approvals';
        return parts.slice(0, 2).join('/');
    }

    const routes = [
        [/^#\/week(?:\/(\d{4}-\d{2}-\d{2}))?$/, m => isMember() && viewWeek(m[1])],
        [/^#\/history$/, () => isMember() && viewHistory()],
        [/^#\/approvals$/, () => isManager() && viewApprovals()],
        [/^#\/sheet\/([A-Za-z0-9]+_\d{4}-\d{2}-\d{2})$/, m => isMember() && viewSheet(m[1])],
        [/^#\/team(?:\/(\d{4}-\d{2}-\d{2}))?$/, m => isManager() && viewTeam(m[1])],
        [/^#\/reports(?:\/(\d{4}-\d{2}))?$/, m => isManager() && viewReports(m[1])],
        [/^#\/admin\/people$/, () => isAdmin() && viewPeople()],
        [/^#\/admin\/projects$/, () => isAdmin() && viewProjects()],
        [/^#\/admin\/settings$/, () => isAdmin() && viewSettings()],
        [/^#\/admin\/audit$/, () => isAdmin() && viewAudit()],
        [/^#\/super$/, () => isSuper() && viewCompanies()],
        [/^#\/super\/company\/([a-z0-9-]+)$/, m => isSuper() && viewCompany(m[1])],
        [/^#\/super\/summary(?:\/(\d{4}-\d{2}))?$/, m => isSuper() && viewSuperSummary(m[1])]
    ];
    async function route() {
        if (!state.me) return;
        $('#sidebar').classList.remove('open');
        renderMenu(currentBase());
        const h = location.hash || '';
        for (const [re, fn] of routes) {
            const m = h.match(re);
            if (m) {
                loading();
                try { if (await fn(m) === false) location.replace(homeRoute()); }
                catch (e) {
                    if (e.status === 401) { await auth.signOut(); return; }
                    setContent(errorHtml(e));
                }
                return;
            }
        }
        location.replace(homeRoute());
    }
    window.addEventListener('hashchange', route);

    // ---------------- My week ----------------
    async function viewWeek(wsParam) {
        const ws = weekStartOf(wsParam || todayIso());
        if (wsParam && wsParam !== ws) { location.replace('#/week/' + ws); return; }
        const [{ sheet, settings, dates }, { projects }] = await Promise.all([api('/ts/week?start=' + ws), api('/ts/projects')]);
        const editable = ['new', 'draft', 'returned'].includes(sheet.status);
        // Collapse entries into rows: one row per project, one note per row.
        const rows = [];
        const byProject = new Map();
        for (const e of sheet.entries) {
            let r = byProject.get(e.projectId);
            if (!r) { r = { projectId: e.projectId, code: e.projectCode, name: e.projectName, hours: {}, notes: [] }; byProject.set(e.projectId, r); rows.push(r); }
            r.hours[e.date] = e.hours;
            if (e.note && !r.notes.includes(e.note)) r.notes.push(e.note);
        }
        if (editable && !rows.length) rows.push({ projectId: '', hours: {}, notes: [] });
        const known = new Map(projects.map(p => [p.id, p]));
        sheet.entries.forEach(e => { if (!known.has(e.projectId)) known.set(e.projectId, { id: e.projectId, code: e.projectCode, name: e.projectName, closed: true }); });

        const banner = {
            new: '', draft: '<div class="banner info">Draft saved. Submit when the week is complete.</div>',
            returned: `<div class="banner warn"><b>Returned for changes:</b> ${esc(sheet.returnComment || '')}</div>`,
            submitted: `<div class="banner info">Submitted ${esc(fmtWhen(sheet.submittedAt))}. Waiting for <b>${esc(STEP_LABEL[sheet.currentStepType] || 'approval')}</b>.</div>`,
            approved: `<div class="banner ok">Approved ${esc(fmtWhen(sheet.approvedAt))}. This week is locked.</div>`
        }[sheet.status] || '';

        setContent(`
            <div class="page-head">
                <h2>My week</h2>
                <div class="week-nav">
                    <a class="btn sm" href="#/week/${addDays(ws, -7)}" aria-label="Previous week">‹</a>
                    <span class="label">${esc(fmtDate(ws))} – ${esc(fmtDate(addDays(ws, 6), { day: 'numeric', month: 'short', year: 'numeric' }))}</span>
                    <a class="btn sm" href="#/week/${addDays(ws, 7)}" aria-label="Next week">›</a>
                    <a class="btn sm ghost" href="#/week">This week</a>
                </div>
                ${sheet.status !== 'new' ? chip(sheet.status) : ''}
            </div>
            ${banner}
            <div id="weekMsg"></div>
            <div class="card">
                <div class="table-wrap"><table class="grid" id="grid">
                    <thead><tr><th>Project</th>${dates.map((d, i) => `<th class="day ${i > 4 ? 'weekend' : ''}">${DAYS[i]}<small>${esc(fmtDate(d))}</small></th>`).join('')}<th class="num">Total</th><th>Note</th>${editable ? '<th></th>' : ''}</tr></thead>
                    <tbody></tbody>
                    <tfoot><tr><td>Day total</td>${dates.map((d, i) => `<td class="ro ${i > 4 ? 'weekend' : ''}" data-dt="${d}"></td>`).join('')}<td class="num" id="gt"></td><td colspan="${editable ? 2 : 1}"></td></tr></tfoot>
                </table></div>
                ${editable ? '<button class="btn sm" id="addRow" style="margin-top:10px">+ Add project</button>' : ''}
            </div>
            <div class="card row" style="justify-content:space-between">
                <div class="totals"><div>Week total<b id="tTotal">0</b></div><div>Overtime<b id="tOt">0</b></div><div>Standard week<b>${fmtH(settings.stdWeekHours)} h</b></div></div>
                ${editable ? `<div class="row">
                    <button class="btn" id="copyLast">Copy last week</button>
                    <button class="btn" id="tpl">Excel template</button>
                    <label class="btn" style="margin:0">Upload Excel/CSV<input type="file" id="upFile" accept=".xlsx,.csv" hidden></label>
                    <button class="btn" id="save">Save draft</button>
                    <button class="btn primary" id="submit">Submit for approval</button>
                </div>` : ''}
            </div>
            ${sheet.trail.length ? `<div class="card"><h3>History</h3>${trailHtml(sheet.trail)}</div>` : ''}`);

        const tbody = $('#grid tbody');
        const projectOptions = sel => `<option value="">Choose project…</option>` + [...known.values()].filter(p => !p.closed || p.id === sel)
            .sort((a, b) => a.code.localeCompare(b.code)).map(p => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(p.code)} · ${esc(p.name)}</option>`).join('');
        function rowHtml(r) {
            if (!editable) {
                return `<tr><td class="proj"><b>${esc(r.code)}</b> ${esc(r.name)}</td>${dates.map((d, i) => `<td class="ro ${i > 4 ? 'weekend' : ''}">${r.hours[d] ? fmtH(r.hours[d]) : ''}</td>`).join('')}<td class="num rt"></td><td>${esc(r.notes.join('; '))}</td></tr>`;
            }
            return `<tr><td class="proj"><select aria-label="Project">${projectOptions(r.projectId)}</select></td>
                ${dates.map((d, i) => `<td class="h ${i > 4 ? 'weekend' : ''}"><input inputmode="decimal" data-d="${d}" aria-label="${DAYS[i]} hours" value="${r.hours[d] ? r.hours[d] : ''}"></td>`).join('')}
                <td class="num rt"></td><td class="note"><input aria-label="Note" maxlength="500" value="${esc(r.notes.join('; '))}" placeholder="Optional"></td>
                <td><button class="icon-btn" data-del aria-label="Remove row">×</button></td></tr>`;
        }
        tbody.innerHTML = rows.length ? rows.map(rowHtml).join('') : `<tr><td colspan="10" class="empty">No hours this week.</td></tr>`;

        function readRows() {
            if (!editable) return rows;
            return $$('tr', tbody).map(tr => ({
                projectId: $('select', tr).value,
                hours: Object.fromEntries($$('input[data-d]', tr).map(i => [i.dataset.d, Number(String(i.value).replace(',', '.')) || 0])),
                notes: [$('td.note input', tr).value.trim()]
            }));
        }
        function recalc() {
            const rs = readRows();
            const dayTotals = Object.fromEntries(dates.map(d => [d, 0]));
            $$('tr', tbody).forEach((tr, i) => {
                const r = rs[i]; if (!r) return;
                const t = dates.reduce((a, d) => a + (r.hours[d] || 0), 0);
                dates.forEach(d => { dayTotals[d] += r.hours[d] || 0; });
                const cell = $('.rt', tr); if (cell) cell.textContent = t ? fmtH(t) : '';
            });
            let total = 0, otDay = 0;
            dates.forEach(d => {
                const td = $(`[data-dt="${d}"]`); total += dayTotals[d];
                otDay += Math.max(0, dayTotals[d] - settings.stdDayHours);
                td.textContent = dayTotals[d] ? fmtH(dayTotals[d]) : '';
                td.classList.toggle('over', dayTotals[d] > settings.stdDayHours);
            });
            if (editable) $$('input[data-d]', tbody).forEach(i => i.classList.toggle('over', dayTotals[i.dataset.d] > settings.maxDayHours));
            const ot = settings.overtimeMode === 'day' ? otDay : Math.max(0, total - settings.stdWeekHours);
            $('#gt').textContent = fmtH(total); $('#tTotal').textContent = fmtH(total) + ' h'; $('#tOt').textContent = fmtH(ot) + ' h';
        }
        recalc();
        if (!editable) return;

        let dirty = false;
        tbody.addEventListener('input', () => { dirty = true; recalc(); });
        tbody.addEventListener('change', () => { dirty = true; recalc(); });
        tbody.addEventListener('click', e => {
            if (!e.target.closest('[data-del]')) return;
            e.target.closest('tr').remove(); dirty = true;
            if (!$('tr', tbody)) tbody.insertAdjacentHTML('beforeend', rowHtml({ projectId: '', hours: {}, notes: [] }));
            recalc();
        });
        $('#addRow').onclick = () => { tbody.insertAdjacentHTML('beforeend', rowHtml({ projectId: '', hours: {}, notes: [] })); $('tr:last-child select', tbody).focus(); };
        const leaveGuard = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
        window.addEventListener('beforeunload', leaveGuard);
        window.addEventListener('hashchange', () => window.removeEventListener('beforeunload', leaveGuard), { once: true });

        function collect() {
            const entries = [];
            const errs = [];
            readRows().forEach((r, i) => {
                const any = dates.some(d => r.hours[d]);
                if (!r.projectId) { if (any) errs.push({ row: i + 1, error: 'Choose a project' }); return; }
                dates.forEach(d => { if (r.hours[d]) entries.push({ projectId: r.projectId, date: d, hours: r.hours[d], note: r.notes[0] || '' }); });
            });
            if (errs.length) throw Object.assign(new Error('Please fix the highlighted rows'), { details: errs });
            return entries;
        }
        async function save(quiet) {
            $('#weekMsg').innerHTML = '';
            try {
                await api('/ts/week/' + ws, { method: 'PUT', body: { entries: collect() } });
                dirty = false;
                if (!quiet) toast('Saved');
                return true;
            } catch (e) { $('#weekMsg').innerHTML = errorHtml(e); return false; }
        }
        $('#save').onclick = async () => { if (await save()) route(); };
        $('#submit').onclick = async () => {
            if (!(await save(true))) return;
            let routeHtml = '';
            try {
                const { route: steps } = await api(`/ts/week/${ws}/route`);
                routeHtml = steps.length ? `<p>Your week goes to:</p><ol>${steps.map(s => `<li><b>${esc(STEP_LABEL[s.step])}</b>: ${esc(s.approvers.join(', '))}</li>`).join('')}</ol>`
                    : '<p>No approver is set up, so the week will be approved straight away.</p>';
            } catch (e) { /* preview is optional */ }
            if (!(await confirmBox('Submit this week?', `<p>Total <b>${esc($('#tTotal').textContent)}</b>, overtime <b>${esc($('#tOt').textContent)}</b>.</p>${routeHtml}<p class="muted">You cannot edit the week after submitting unless it is returned.</p>`, 'Submit'))) { route(); return; }
            try {
                const r = await api(`/ts/week/${ws}/submit`, { method: 'POST' });
                toast(r.status === 'approved' ? 'Submitted and approved' : 'Submitted for approval');
            } catch (e) { $('#weekMsg').innerHTML = errorHtml(e); return; }
            route();
        };
        $('#copyLast').onclick = async () => {
            const prev = await api('/ts/week?start=' + addDays(ws, -7));
            if (!prev.sheet.entries.length) { toast('Last week has no hours to copy'); return; }
            const seen = new Set();
            tbody.innerHTML = '';
            prev.sheet.entries.forEach(e => {
                if (seen.has(e.projectId) || !projects.some(p => p.id === e.projectId)) return;
                seen.add(e.projectId);
                tbody.insertAdjacentHTML('beforeend', rowHtml({ projectId: e.projectId, hours: {}, notes: [] }));
            });
            if (!seen.size) tbody.insertAdjacentHTML('beforeend', rowHtml({ projectId: '', hours: {}, notes: [] }));
            dirty = true; recalc(); toast('Copied last week\'s projects. Enter this week\'s hours.');
        };
        $('#tpl').onclick = () => {
            const lines = ['Date,Project code,Hours,Note'];
            dates.slice(0, 5).forEach(d => lines.push(`${d},${projects[0] ? projects[0].code : 'PROJECT-CODE'},8,`));
            download(new Blob(['\uFEFF' + lines.join('\r\n') + '\r\n'], { type: 'text/csv' }), `timesheet-${ws}.csv`);
            if (projects.length) {
                modal('Excel template', `<p>Fill one row per project per day (dates as YYYY-MM-DD or DD/MM/YYYY), then use <b>Upload Excel/CSV</b>. Project codes you can use:</p>
                    <ul>${projects.map(p => `<li><b>${esc(p.code)}</b> ${esc(p.name)}</li>`).join('')}</ul>`);
            }
        };
        $('#upFile').onchange = async e => {
            const file = e.target.files[0]; e.target.value = '';
            if (!file) return;
            const fd = new FormData(); fd.append('file', file);
            $('#weekMsg').innerHTML = '';
            try {
                const r = await api(`/ts/week/${ws}/upload`, { method: 'POST', body: fd });
                if (r.errors.length) { $('#weekMsg').innerHTML = errorHtml({ message: `The file has ${r.errors.length} problem(s). Nothing was loaded.`, details: r.errors }); return; }
                const map = new Map();
                r.entries.forEach(en => {
                    const row = map.get(en.projectId) || { projectId: en.projectId, hours: {}, notes: [] };
                    row.hours[en.date] = en.hours; if (en.note && !row.notes.includes(en.note)) row.notes.push(en.note);
                    map.set(en.projectId, row);
                });
                tbody.innerHTML = [...map.values()].map(rowHtml).join('') || rowHtml({ projectId: '', hours: {}, notes: [] });
                dirty = true; recalc();
                $('#weekMsg').innerHTML = `<div class="banner info">Loaded ${r.entries.length} entries from <b>${esc(file.name)}</b>. Check them, then Save or Submit.</div>`;
            } catch (err) { $('#weekMsg').innerHTML = errorHtml(err); }
        };
    }

    function trailHtml(trail) {
        const verb = { submitted: 'Submitted', approved: 'Approved', returned: 'Returned', reopened: 'Reopened by admin' };
        return `<ul class="trail">${trail.map(t => `<li class="${esc(t.action)}"><b>${esc(verb[t.action] || t.action)}</b>${t.step ? ` (${esc(STEP_LABEL[t.step] || t.step)})` : ''} by ${esc(t.byName)}${t.override ? ' <span class="chip">admin override</span>' : ''} <span class="muted">· ${esc(fmtWhen(t.at))}</span>${t.comment ? `<div>“${esc(t.comment)}”</div>` : ''}</li>`).join('')}</ul>`;
    }

    // ---------------- History ----------------
    async function viewHistory() {
        const { sheets } = await api('/ts/history');
        setContent(`<div class="page-head"><h2>My history</h2></div>
            <div class="card table-wrap">${sheets.length ? `<table><thead><tr><th>Week</th><th>Status</th><th class="num">Hours</th><th class="num">Overtime</th><th>Comment</th></tr></thead><tbody>
            ${sheets.map(s => `<tr class="click" data-href="#/week/${esc(s.weekStart)}"><td>${esc(fmtDate(s.weekStart, { day: 'numeric', month: 'short', year: 'numeric' }))}</td><td>${chip(s.status)}${s.status === 'submitted' && s.currentStepType ? ` <span class="muted">${esc(STEP_LABEL[s.currentStepType])}</span>` : ''}</td><td class="num">${fmtH(s.totalHours)}</td><td class="num">${fmtH(s.overtimeHours)}</td><td>${esc(s.returnComment || '')}</td></tr>`).join('')}
            </tbody></table>` : '<div class="empty">No timesheets yet.</div>'}</div>`);
        clickRows();
    }
    function clickRows() { $$('tr.click').forEach(tr => { tr.tabIndex = 0; tr.onclick = () => { location.hash = tr.dataset.href; }; tr.onkeydown = e => { if (e.key === 'Enter') tr.onclick(); }; }); }

    // ---------------- Approvals ----------------
    async function viewApprovals() {
        const { approvals } = await api('/ts/approvals');
        state.approvalsCount = approvals.length; renderMenu('#/approvals');
        setContent(`<div class="page-head"><h2>Approvals</h2><span class="muted">${approvals.length} waiting for you</span></div>
            <div class="card table-wrap">${approvals.length ? `<table><thead><tr><th>Person</th><th>Week</th><th>Your step</th><th class="num">Hours</th><th class="num">Overtime</th><th>Submitted</th></tr></thead><tbody>
            ${approvals.map(a => `<tr class="click" data-href="#/sheet/${esc(a.id)}"><td><b>${esc(a.memberName)}</b></td><td>${esc(fmtDate(a.weekStart, { day: 'numeric', month: 'short', year: 'numeric' }))}</td><td>${esc(STEP_LABEL[a.stepType] || '')}</td><td class="num">${fmtH(a.totalHours)}</td><td class="num">${a.overtimeHours ? `<b style="color:var(--warn)">${fmtH(a.overtimeHours)}</b>` : '0'}</td><td>${esc(fmtWhen(a.submittedAt))}</td></tr>`).join('')}
            </tbody></table>` : '<div class="empty">Nothing waiting for you. 🎉</div>'}</div>`);
        clickRows();
    }

    async function viewSheet(id) {
        const { sheet, canDecide, dates } = await api('/ts/sheets/' + id);
        const rows = new Map();
        sheet.entries.forEach(e => {
            const r = rows.get(e.projectId) || { code: e.projectCode, name: e.projectName, hours: {}, notes: [] };
            r.hours[e.date] = e.hours; if (e.note && !r.notes.includes(e.note)) r.notes.push(e.note);
            rows.set(e.projectId, r);
        });
        const dayTotal = d => sheet.entries.filter(e => e.date === d).reduce((a, e) => a + e.hours, 0);
        setContent(`<div class="page-head"><a class="btn sm" href="#/approvals">‹ Back</a><h2>${esc(sheet.memberName)} · week of ${esc(fmtDate(sheet.weekStart, { day: 'numeric', month: 'short', year: 'numeric' }))}</h2>${chip(sheet.status)}</div>
            <div id="decideMsg"></div>
            <div class="card"><div class="table-wrap"><table class="grid"><thead><tr><th>Project</th>${dates.map((d, i) => `<th class="day ${i > 4 ? 'weekend' : ''}">${DAYS[i]}<small>${esc(fmtDate(d))}</small></th>`).join('')}<th class="num">Total</th><th>Note</th></tr></thead><tbody>
            ${[...rows.values()].map(r => `<tr><td class="proj"><b>${esc(r.code)}</b> ${esc(r.name)}</td>${dates.map((d, i) => `<td class="ro ${i > 4 ? 'weekend' : ''}">${r.hours[d] ? fmtH(r.hours[d]) : ''}</td>`).join('')}<td class="num">${fmtH(Object.values(r.hours).reduce((a, h) => a + h, 0))}</td><td>${esc(r.notes.join('; '))}</td></tr>`).join('')}
            </tbody><tfoot><tr><td>Day total</td>${dates.map((d, i) => `<td class="ro ${i > 4 ? 'weekend' : ''}">${dayTotal(d) ? fmtH(dayTotal(d)) : ''}</td>`).join('')}<td class="num">${fmtH(sheet.totalHours)}</td><td></td></tr></tfoot></table></div>
            <div class="totals" style="margin-top:14px"><div>Total<b>${fmtH(sheet.totalHours)} h</b></div><div>Overtime<b>${fmtH(sheet.overtimeHours)} h</b></div><div>Approval route<b style="font-size:14px">${esc(sheet.approvalSteps.map(s => STEP_LABEL[s]).join(' → ') || '-')}</b></div></div></div>
            ${canDecide ? `<div class="card"><h3>Your decision${sheet.currentStepType ? ` (${esc(STEP_LABEL[sheet.currentStepType])} step)` : ''}</h3>
                <label>Comment <span class="muted">(required when returning)</span><textarea id="decComment" rows="3" maxlength="1000"></textarea></label>
                <div class="row"><button class="btn ok" id="approve">Approve</button><button class="btn danger" id="return">Return for changes</button></div></div>` : ''}
            ${isAdmin() && ['submitted', 'approved'].includes(sheet.status) ? '<div class="card row"><span class="muted">Company admin:</span><button class="btn sm" id="reopen">Reopen for correction</button></div>' : ''}
            <div class="card"><h3>History</h3>${trailHtml(sheet.trail) || '<span class="muted">No activity yet.</span>'}</div>`);
        const decide = async decision => {
            try {
                const r = await api(`/ts/sheets/${id}/decide`, { method: 'POST', body: { decision, comment: $('#decComment').value } });
                toast(r.status === 'approved' ? 'Approved' : r.status === 'returned' ? 'Returned to the employee' : 'Approved, sent to the next step');
                refreshBadge(); location.hash = '#/approvals';
            } catch (e) { $('#decideMsg').innerHTML = errorHtml(e); }
        };
        if (canDecide) { $('#approve').onclick = () => decide('approve'); $('#return').onclick = () => decide('return'); }
        if ($('#reopen')) $('#reopen').onclick = async () => {
            const ok = await modal('Reopen this week?', '<p>The employee will be able to edit and resubmit. Approved hours leave the reports until it is approved again.</p><label>Reason<textarea name="reason" rows="3" maxlength="500"></textarea></label>',
                [{ label: 'Cancel', value: false }, { label: 'Reopen', cls: 'primary', onClick: async body => { await api(`/company/sheets/${id}/reopen`, { method: 'POST', body: { reason: $('[name=reason]', body).value } }); return true; } }]);
            if (ok) { toast('Week reopened'); route(); }
        };
    }

    // ---------------- Team ----------------
    async function viewTeam(wsParam) {
        const ws = weekStartOf(wsParam || todayIso());
        const { team } = await api('/ts/team?week=' + ws);
        const count = st => team.filter(t => t.status === st).length;
        setContent(`<div class="page-head"><h2>Team overview</h2>
            <div class="week-nav"><a class="btn sm" href="#/team/${addDays(ws, -7)}" aria-label="Previous week">‹</a><span class="label">Week of ${esc(fmtDate(ws, { day: 'numeric', month: 'short', year: 'numeric' }))}</span><a class="btn sm" href="#/team/${addDays(ws, 7)}" aria-label="Next week">›</a></div></div>
            <div class="kpis"><div class="kpi"><span>People</span><b>${team.length}</b></div><div class="kpi"><span>Approved</span><b>${count('approved')}</b></div><div class="kpi"><span>Waiting approval</span><b>${count('submitted')}</b></div><div class="kpi"><span>Not submitted</span><b>${team.length - count('approved') - count('submitted')}</b></div></div>
            <div class="card table-wrap">${team.length ? `<table><thead><tr><th>Name</th><th>Role</th><th>Status</th><th class="num">Hours</th><th class="num">Overtime</th></tr></thead><tbody>
            ${team.map(t => `<tr ${t.sheetId && t.status !== 'draft' ? `class="click" data-href="#/sheet/${esc(t.sheetId)}"` : ''}><td><b>${esc(t.name)}</b></td><td>${esc(ROLE_LABEL[t.role])}</td><td>${chip(t.status)}${t.stepType ? ` <span class="muted">${esc(STEP_LABEL[t.stepType])}</span>` : ''}</td><td class="num">${t.totalHours ? fmtH(t.totalHours) : ''}</td><td class="num">${t.overtimeHours ? fmtH(t.overtimeHours) : ''}</td></tr>`).join('')}
            </tbody></table>` : '<div class="empty">Nobody in your team yet.</div>'}</div>`);
        clickRows();
    }

    // ---------------- Reports ----------------
    async function viewReports(monthParam) {
        const month = monthParam || todayIso().slice(0, 7);
        const r = await api('/ts/reports/summary?month=' + month);
        const maxP = Math.max(1, ...r.byProject.map(p => p.hours));
        setContent(`<div class="page-head"><h2>Reports</h2><span class="chip">${esc(r.scope)}</span>
            <input type="month" id="month" value="${esc(month)}" aria-label="Month"><button class="btn primary" id="export">Export to Excel</button></div>
            <div class="kpis">
                <div class="kpi"><span>Approved hours</span><b>${fmtH(r.totalHours)}</b></div>
                <div class="kpi"><span>Overtime hours</span><b>${fmtH(r.overtimeHours)}</b></div>
                <div class="kpi"><span>Sheets approved</span><b>${r.sheets.approved || 0}</b></div>
                <div class="kpi"><span>Waiting approval</span><b>${r.sheets.submitted || 0}</b></div>
            </div>
            <p class="muted">Only approved weeks count towards hours. Weeks that cross a month are split by date.</p>
            <div class="grid2">
                <div class="card table-wrap"><h3>Hours by project</h3>${r.byProject.length ? `<table><thead><tr><th>Project</th><th class="num">Hours</th><th></th><th class="num">People</th></tr></thead><tbody>
                    ${r.byProject.map(p => `<tr><td><b>${esc(p.code)}</b> ${esc(p.name)}</td><td class="num">${fmtH(p.hours)}</td><td style="width:30%"><div class="bar"><i style="width:${(p.hours / maxP * 100).toFixed(1)}%"></i></div></td><td class="num">${p.people}</td></tr>`).join('')}
                    </tbody></table>` : '<div class="empty">No approved hours this month.</div>'}</div>
                <div class="card table-wrap"><h3>Hours by person</h3>${r.byMember.length ? `<table><thead><tr><th>Name</th><th class="num">Hours</th><th class="num">Overtime</th><th class="num">Weeks</th></tr></thead><tbody>
                    ${r.byMember.map(m => `<tr><td>${esc(m.name)}</td><td class="num">${fmtH(m.hours)}</td><td class="num">${m.overtimeHours ? `<b style="color:var(--warn)">${fmtH(m.overtimeHours)}</b>` : '0'}</td><td class="num">${m.weeks}</td></tr>`).join('')}
                    </tbody></table>` : '<div class="empty">No approved hours this month.</div>'}</div>
            </div>`);
        $('#month').onchange = e => { if (e.target.value) location.hash = '#/reports/' + e.target.value; };
        $('#export').onclick = async () => {
            try {
                const res = await api('/ts/reports/export?month=' + month, { raw: true });
                download(await res.blob(), `timesheets-${state.me.membership.companyId}-${month}.xlsx`);
            } catch (e) { toast(e.message, true); }
        };
    }

    // ---------------- Company admin: people ----------------
    async function viewPeople() {
        const { members } = await api('/company/members');
        const byUid = new Map(members.map(m => [m.uid, m]));
        const supervisors = members.filter(m => m.status !== 'disabled' && m.role !== 'employee');
        setContent(`<div class="page-head"><h2>People</h2><button class="btn primary" id="addPerson">+ Invite person</button></div>
            <div class="card table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Supervisor</th><th>Status</th><th></th></tr></thead><tbody>
            ${members.map(m => `<tr><td><b>${esc(m.name)}</b>${m.uid === state.me.user.uid ? ' <span class="muted">(you)</span>' : ''}</td><td>${esc(m.email)}</td><td>${esc(ROLE_LABEL[m.role])}</td>
                <td>${esc(m.supervisorUid && byUid.get(m.supervisorUid) ? byUid.get(m.supervisorUid).name : '-')}</td><td>${chip(m.status)}</td>
                <td><button class="btn sm" data-edit="${esc(m.uid)}">Edit</button></td></tr>`).join('')}
            </tbody></table></div>
            <p class="muted">Invited people get an email to set their password, then sign in at this page. Their supervisor approves their weeks when the Supervisor step is on.</p>`);
        const roleSelect = (cur, dis) => `<select name="role" ${dis ? 'disabled' : ''}>${Object.entries(ROLE_LABEL).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
        const supSelect = (cur, self) => `<select name="supervisorUid"><option value="">No supervisor</option>${supervisors.filter(s => s.uid !== self).map(s => `<option value="${esc(s.uid)}" ${s.uid === cur ? 'selected' : ''}>${esc(s.name)} (${esc(ROLE_LABEL[s.role])})</option>`).join('')}</select>`;
        $('#addPerson').onclick = async () => {
            const res = await modal('Invite person', `<div class="grid2"><label>Full name<input name="name" required></label><label>Email<input name="email" type="email" required></label>
                <label>Role${roleSelect('employee')}</label><label>Supervisor${supSelect('')}</label></div>`,
                [{ label: 'Cancel', value: null }, { label: 'Send invite', cls: 'primary', onClick: async b => api('/company/members', { method: 'POST', body: formData(b) }) }]);
            if (res) { await showInviteResult(res); route(); }
        };
        $$('[data-edit]').forEach(btn => btn.onclick = async () => {
            const m = byUid.get(btn.dataset.edit);
            const self = m.uid === state.me.user.uid;
            const saved = await modal(`Edit ${m.name}`, `<div class="grid2"><label>Full name<input name="name" value="${esc(m.name)}"></label><label>Email<input value="${esc(m.email)}" disabled></label>
                <label>Role${roleSelect(m.role, self)}</label><label>Supervisor${supSelect(m.supervisorUid, m.uid)}</label></div>
                ${self ? '<p class="muted">You cannot change your own role or disable yourself.</p>' : `<label class="check"><input type="checkbox" name="disabled" ${m.status === 'disabled' ? 'checked' : ''}> Disabled (cannot sign in to this portal)</label>`}`,
                [{ label: 'Cancel', value: false }, { label: 'Save', cls: 'primary', onClick: async b => {
                    const f = formData(b); const body = { name: f.name, supervisorUid: f.supervisorUid || null };
                    if (!self) { body.role = f.role; body.status = f.disabled ? 'disabled' : 'active'; }
                    await api('/company/members/' + m.uid, { method: 'PATCH', body }); return true;
                } }]);
            if (saved) { toast('Saved'); route(); }
        });
    }
    async function showInviteResult(res) {
        await modal('Invitation sent', res.created
            ? `<p>An email with a link to set a password has been sent. If it does not arrive, copy this one-time link and send it yourself:</p><div class="copy"><input readonly value="${esc(res.setPasswordLink)}"><button class="btn sm" id="copyBtn">Copy</button></div>`
            : '<p>This person already has a login (for example from EB Tracker). They can sign in to the Timesheet Portal with their existing password.</p>');
    }
    document.addEventListener('click', e => {
        if (e.target.id !== 'copyBtn') return;
        const input = e.target.previousElementSibling; input.select();
        navigator.clipboard && navigator.clipboard.writeText(input.value).then(() => toast('Copied'), () => {});
    });
    // New company form: suggest the code from the name until the code is typed by hand.
    document.addEventListener('input', e => {
        const code = $('#modalRoot [name=code]');
        if (!code || !$('#modalRoot [name=adminEmail]')) return;
        if (e.target === code) { code.dataset.touched = '1'; return; }
        if (e.target === $('#modalRoot [name=name]') && !code.dataset.touched) {
            code.value = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
        }
    });
    function formData(root) {
        const out = {};
        $$('input[name], select[name], textarea[name]', root).forEach(el => {
            if (el.type === 'checkbox' && el.name.endsWith('[]')) { const k = el.name.slice(0, -2); out[k] = out[k] || []; if (el.checked) out[k].push(el.value); }
            else if (el.type === 'checkbox') out[el.name] = el.checked;
            else out[el.name] = el.value.trim();
        });
        return out;
    }

    // ---------------- Company admin: projects ----------------
    async function viewProjects() {
        const [{ projects }, { members }] = await Promise.all([api('/company/projects'), api('/company/members')]);
        const active = members.filter(m => m.status !== 'disabled');
        const name = uid => (members.find(m => m.uid === uid) || {}).name || '-';
        setContent(`<div class="page-head"><h2>Projects</h2><button class="btn primary" id="addProject">+ New project</button></div>
            <div class="card table-wrap">${projects.length ? `<table><thead><tr><th>Code</th><th>Name</th><th>Project manager</th><th>Who can book</th><th>Status</th><th></th></tr></thead><tbody>
            ${projects.map(p => `<tr><td><b>${esc(p.code)}</b></td><td>${esc(p.name)}</td><td>${esc(p.pmUid ? name(p.pmUid) : '-')}</td><td>${p.memberUids.length ? `${p.memberUids.length} people` : 'Everyone'}</td><td>${chip(p.active ? 'active' : 'closed')}</td><td><button class="btn sm" data-edit="${esc(p.id)}">Edit</button></td></tr>`).join('')}
            </tbody></table>` : '<div class="empty">No projects yet. Add one so people can book hours.</div>'}</div>`);
        const form = (p = { code: '', name: '', pmUid: '', memberUids: [], active: true }) => `<div class="grid2"><label>Code<input name="code" value="${esc(p.code)}" required></label><label>Name<input name="name" value="${esc(p.name)}" required></label></div>
            <label>Project manager<select name="pmUid"><option value="">None</option>${active.map(m => `<option value="${esc(m.uid)}" ${m.uid === p.pmUid ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
            <label>Who can book hours <span class="muted">(leave all unticked for everyone)</span></label>
            <div class="checklist">${active.map(m => `<label class="check"><input type="checkbox" name="memberUids[]" value="${esc(m.uid)}" ${p.memberUids.includes(m.uid) ? 'checked' : ''}> ${esc(m.name)}</label>`).join('')}</div>
            <label class="check" style="margin-top:12px"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}> Open for booking</label>`;
        const body = b => { const f = formData(b); return { code: f.code, name: f.name, pmUid: f.pmUid || null, memberUids: f.memberUids || [], active: f.active }; };
        $('#addProject').onclick = async () => {
            if (await modal('New project', form(), [{ label: 'Cancel', value: false }, { label: 'Create', cls: 'primary', onClick: async b => { await api('/company/projects', { method: 'POST', body: body(b) }); return true; } }])) { toast('Project created'); route(); }
        };
        $$('[data-edit]').forEach(btn => btn.onclick = async () => {
            const p = projects.find(x => x.id === btn.dataset.edit);
            if (await modal(`Edit ${p.code}`, form(p), [{ label: 'Cancel', value: false }, { label: 'Save', cls: 'primary', onClick: async b => { await api('/company/projects/' + p.id, { method: 'PATCH', body: body(b) }); return true; } }])) { toast('Saved'); route(); }
        });
    }

    // ---------------- Company admin: settings ----------------
    async function viewSettings() {
        const { settings: s, timezone } = await api('/company/settings');
        const dow = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        setContent(`<div class="page-head"><h2>Settings</h2></div><div id="setMsg"></div>
            <form id="setForm">
            <div class="card"><h3>Working hours</h3><div class="grid2">
                <label>Standard day (hours)<input name="stdDayHours" type="number" step="0.25" min="1" max="24" value="${s.stdDayHours}"></label>
                <label>Standard week (hours)<input name="stdWeekHours" type="number" step="0.25" min="1" max="168" value="${s.stdWeekHours}"></label>
                <label>Maximum per day (hours)<input name="maxDayHours" type="number" step="0.25" min="1" max="24" value="${s.maxDayHours}"></label>
                <label>Note required above (hours per day)<input name="noteOverHours" type="number" step="0.25" min="0" max="24" value="${s.noteOverHours}"></label>
                <label>Hour step<select name="stepHours">${[0.1, 0.25, 0.5, 1].map(v => `<option value="${v}" ${v === s.stepHours ? 'selected' : ''}>${v} h</option>`).join('')}</select></label>
                <label>Overtime counted<select name="overtimeMode"><option value="week" ${s.overtimeMode === 'week' ? 'selected' : ''}>Above the standard week</option><option value="day" ${s.overtimeMode === 'day' ? 'selected' : ''}>Above the standard day, each day</option></select></label>
            </div></div>
            <div class="card"><h3>Approval steps</h3><p class="muted">A submitted week goes through the ticked steps in this order. If a step has nobody (for example no supervisor set), it goes to the company admins.</p>
                ${['supervisor', 'project_manager', 'gm'].map(k => `<label class="check"><input type="checkbox" name="step_${k}" ${s.approvalSteps.includes(k) ? 'checked' : ''}> ${STEP_LABEL[k]}${k === 'project_manager' ? ' (PM of any project on the sheet)' : ''}</label>`).join('')}
            </div>
            <div class="card"><h3>Emails</h3><div class="grid2">
                <label>Reminder day<select name="reminderDow">${dow.map((d, i) => `<option value="${i}" ${i === s.reminderDow ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
                <label>Reminder time (${esc(timezone)})<select name="reminderHour">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === s.reminderHour ? 'selected' : ''}>${pad(h)}:00</option>`).join('')}</select></label></div>
                <label class="check"><input type="checkbox" name="monthlyReportEmail" ${s.monthlyReportEmail ? 'checked' : ''}> Email the monthly report to GMs and company admins on the 1st</label>
            </div>
            <button class="btn primary" type="submit">Save settings</button></form>`);
        $('#setForm').onsubmit = async e => {
            e.preventDefault();
            const f = formData(e.target);
            const body = { approvalSteps: ['supervisor', 'project_manager', 'gm'].filter(k => f['step_' + k]), monthlyReportEmail: f.monthlyReportEmail, overtimeMode: f.overtimeMode };
            ['stdDayHours', 'stdWeekHours', 'maxDayHours', 'noteOverHours', 'stepHours', 'reminderDow', 'reminderHour'].forEach(k => { body[k] = Number(f[k]); });
            try {
                const r = await api('/company/settings', { method: 'PUT', body });
                state.me.membership.settings = r.settings;
                $('#setMsg').innerHTML = ''; toast('Settings saved');
            } catch (err) { $('#setMsg').innerHTML = errorHtml(err); }
        };
    }

    async function viewAudit(path = '/company/audit', title = 'Activity log') {
        const { audit } = await api(path);
        setContent(`<div class="page-head"><h2>${esc(title)}</h2></div><div class="card table-wrap">${audit.length ? `<table><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead><tbody>
            ${audit.map(a => `<tr><td>${esc(fmtWhen(a.at))}</td><td>${esc(a.byEmail)}${a.bySuperAdmin ? ' <span class="chip">Super Admin</span>' : ''}</td><td>${esc(a.action)}</td><td class="muted" style="font-size:12px">${esc(a.details ? JSON.stringify(a.details).slice(0, 160) : '')}</td></tr>`).join('')}
            </tbody></table>` : '<div class="empty">No activity yet.</div>'}</div>`);
    }

    // ---------------- Super Admin ----------------
    async function viewCompanies() {
        const { companies } = await api('/platform/companies');
        setContent(`<div class="page-head"><h2>Companies</h2><button class="btn primary" id="newCo">+ New company</button></div>
            <div class="card table-wrap">${companies.length ? `<table><thead><tr><th>Company</th><th>Code</th><th>Admins</th><th class="num">People</th><th>Status</th><th></th></tr></thead><tbody>
            ${companies.map(c => `<tr><td><b>${esc(c.name)}</b><div class="muted" style="font-size:12px">${esc(c.timezone)}</div></td><td>${esc(c.id)}</td><td>${c.admins.map(a => esc(a.name)).join(', ') || '-'}</td><td class="num">${c.memberCount}</td><td>${chip(c.status)}</td>
                <td class="row"><a class="btn sm" href="#/super/company/${esc(c.id)}">Open</a><button class="btn sm ${c.status === 'active' ? 'danger' : ''}" data-toggle="${esc(c.id)}" data-status="${esc(c.status)}">${c.status === 'active' ? 'Suspend' : 'Activate'}</button></td></tr>`).join('')}
            </tbody></table>` : '<div class="empty">No companies yet. Create the first one.</div>'}</div>
            <p class="muted">Each company signs in at this same page. People only ever see their own company's data. A suspended company cannot sign in.</p>`);
        $('#newCo').onclick = async () => {
            // Default to the Super Admin's own time zone; browsers list India as Asia/Calcutta, so add Asia/Kolkata.
            const mine = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
            const tzs = [...new Set(['Asia/Kolkata', mine, ...(Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['Asia/Dubai', 'Europe/London', 'America/New_York', 'UTC'])])].sort();
            const defTz = mine === 'Asia/Calcutta' ? 'Asia/Kolkata' : mine;
            const res = await modal('New company', `<div class="grid2"><label>Company name<input name="name" required></label>
                <label>Company code <span class="muted">(lowercase, used in links)</span><input name="code" pattern="[a-z0-9][a-z0-9-]{1,39}" placeholder="e.g. acme" required></label></div>
                <label>Time zone<select name="timezone">${tzs.map(t => `<option ${t === defTz ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
                <h3 style="margin:8px 0 10px">First company admin</h3><div class="grid2"><label>Name<input name="adminName" required></label><label>Email<input name="adminEmail" type="email" required></label></div>`,
                [{ label: 'Cancel', value: null }, { label: 'Create company', cls: 'primary', onClick: async b => api('/platform/companies', { method: 'POST', body: formData(b) }) }]);
            if (res) { await showInviteResult(res.admin); route(); }
        };
        $$('[data-toggle]').forEach(btn => btn.onclick = async () => {
            const to = btn.dataset.status === 'active' ? 'suspended' : 'active';
            if (!(await confirmBox(`${to === 'suspended' ? 'Suspend' : 'Activate'} company?`, to === 'suspended' ? '<p>Nobody in this company will be able to sign in until it is activated again. Their data is kept.</p>' : '<p>People in this company will be able to sign in again.</p>', to === 'suspended' ? 'Suspend' : 'Activate', to === 'suspended' ? 'danger' : 'primary'))) return;
            try { await api('/platform/companies/' + btn.dataset.toggle, { method: 'PATCH', body: { status: to } }); toast('Company ' + to); route(); } catch (e) { toast(e.message, true); }
        });
    }

    async function viewCompany(cid) {
        const [{ companies }, { members }] = await Promise.all([api('/platform/companies'), api(`/platform/companies/${cid}/members`)]);
        const c = companies.find(x => x.id === cid);
        if (!c) throw new Error('Company not found');
        setContent(`<div class="page-head"><a class="btn sm" href="#/super">‹ Companies</a><h2>${esc(c.name)}</h2>${chip(c.status)}<button class="btn" id="audit">Activity log</button><button class="btn primary" id="addAdmin">+ Add company admin</button></div>
            <div class="card table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>
            ${members.map(m => `<tr><td><b>${esc(m.name)}</b></td><td>${esc(m.email)}</td><td>${esc(ROLE_LABEL[m.role])}</td><td>${chip(m.status || 'active')}</td></tr>`).join('')}
            </tbody></table></div><p class="muted">The company admin manages people, projects and settings. The Super Admin only adds admins.</p>`);
        $('#addAdmin').onclick = async () => {
            const res = await modal('Add company admin', `<div class="grid2"><label>Name<input name="name" required></label><label>Email<input name="email" type="email" required></label></div>`,
                [{ label: 'Cancel', value: null }, { label: 'Add admin', cls: 'primary', onClick: async b => api(`/platform/companies/${cid}/members`, { method: 'POST', body: { ...formData(b), role: 'company_admin' } }) }]);
            if (res) { await showInviteResult(res); route(); }
        };
        $('#audit').onclick = () => { loading(); viewAudit(`/platform/companies/${cid}/audit`, `${c.name} · activity log`).catch(e => setContent(errorHtml(e))); };
    }

    async function viewSuperSummary(monthParam) {
        const month = monthParam || todayIso().slice(0, 7);
        const { companies } = await api('/platform/summary?month=' + month);
        const sum = k => companies.reduce((a, c) => a + (k(c) || 0), 0);
        setContent(`<div class="page-head"><h2>All-company summary</h2><input type="month" id="month" value="${esc(month)}" aria-label="Month"></div>
            <div class="kpis"><div class="kpi"><span>Companies</span><b>${companies.length}</b></div><div class="kpi"><span>People</span><b>${sum(c => c.members)}</b></div>
            <div class="kpi"><span>Approved hours</span><b>${fmtH(sum(c => c.totalHours))}</b></div><div class="kpi"><span>Waiting approval</span><b>${sum(c => c.sheets.submitted)}</b></div></div>
            <div class="card table-wrap"><table><thead><tr><th>Company</th><th>Status</th><th class="num">People</th><th class="num">Approved hours</th><th class="num">Overtime</th><th class="num">Waiting</th></tr></thead><tbody>
            ${companies.map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${chip(c.status)}</td><td class="num">${c.members}</td><td class="num">${fmtH(c.totalHours)}</td><td class="num">${fmtH(c.overtimeHours)}</td><td class="num">${c.sheets.submitted || 0}</td></tr>`).join('')}
            </tbody></table></div>`);
        $('#month').onchange = e => { if (e.target.value) location.hash = '#/super/summary/' + e.target.value; };
    }
})();
