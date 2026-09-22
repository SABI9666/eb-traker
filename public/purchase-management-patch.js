// Purchase entry portal with COO / Director approval workflow.
(function () {
'use strict';
if (window._purchaseApprovalPortalLoaded) return;
window._purchaseApprovalPortalLoaded = true;
function css(){if(document.getElementById('pmStyles'))return;var s=document.createElement('style');s.id='pmStyles';s.textContent=`
.pm{max-width:1500px;margin:auto;color:#0f172a}.pm-hero{background:linear-gradient(135deg,#172333,#23364a);color:#fff;padding:1.3rem 1.45rem;border-radius:22px;margin-bottom:1rem;box-shadow:0 18px 45px -28px #000}.pm-tag{display:inline-flex;padding:.3rem .65rem;border-radius:999px;background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.4);color:#fbbf24;font-size:.68rem;font-weight:800;text-transform:uppercase}.pm-hero h2{margin:.55rem 0 .15rem;font-size:1.55rem}.pm-hero p{margin:0;color:#aab8c8;font-size:.85rem}.pm-actions{display:flex;gap:.5rem;flex-wrap:wrap}.pm-btn{border:1px solid #dbe4ee;background:#fff;color:#243244;padding:.6rem .9rem;border-radius:10px;cursor:pointer;font-weight:700;font-size:.8rem}.pm-btn.primary{background:#06b6d4;border-color:#22d3ee;color:#073742}.pm-btn.dark{background:#26374b;color:#eef7fb;border-color:#3b526c}.pm-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:.65rem;margin-bottom:1rem}.pm-kpi,.pm-card{background:#fff;border:1px solid #e5ebf1;border-radius:15px;box-shadow:0 10px 30px -26px rgba(15,23,42,.7)}.pm-kpi{padding:.85rem 1rem}.pm-kpi b{display:block;font-size:1.4rem}.pm-kpi span{display:block;font-size:.68rem;color:#64748b;text-transform:uppercase;margin-top:.15rem}.pm-kpi em{display:block;font-style:normal;font-size:.68rem;color:#0e7490;font-weight:700;margin-top:.35rem}.pm-card{overflow:hidden;margin-bottom:1rem}.pm-head{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:1rem 1.1rem;border-bottom:1px solid #edf1f5}.pm-head h3{margin:0;font-size:1rem}.pm-head p{margin:.15rem 0 0;font-size:.72rem;color:#7b8998}.pm-flow{display:grid;grid-template-columns:repeat(9,minmax(105px,1fr));gap:.4rem;padding:1rem;overflow:auto}.pm-stage{position:relative;border:1px solid #e5ebf1;background:#f8fafc;padding:.7rem .5rem;border-radius:11px;text-align:center}.pm-stage:after{content:'→';position:absolute;right:-.33rem;top:50%;transform:translateY(-50%);color:#94a3b8;font-weight:800}.pm-stage:last-child:after{display:none}.pm-stage strong{display:block;font-size:.66rem;margin-top:.2rem}.pm-stage span{display:inline-block;margin-top:.3rem;padding:.1rem .4rem;border-radius:999px;background:#e8f7fb;color:#0e7490;font-size:.62rem;font-weight:800}.pm-tabs{display:flex;gap:.3rem;padding:.65rem;background:#fbfcfd;border-bottom:1px solid #edf1f5;overflow:auto}.pm-tab{border:0;background:transparent;padding:.5rem .75rem;border-radius:8px;font-weight:700;color:#64748b;white-space:nowrap;cursor:pointer}.pm-tab.active{background:#172333;color:#fff}.pm-tools{display:flex;gap:.5rem;padding:.8rem 1rem;border-bottom:1px solid #eef2f6;flex-wrap:wrap}.pm-tools input,.pm-tools select{border:1px solid #dbe4ee;border-radius:9px;padding:.55rem .7rem;font-size:.78rem}.pm-tools input{min-width:250px;flex:1}.pm-table-wrap{overflow:auto}.pm-table{width:100%;border-collapse:collapse;min-width:980px}.pm-table th{background:#f8fafc;color:#64748b;font-size:.66rem;text-transform:uppercase;text-align:left;padding:.7rem .8rem;border-bottom:1px solid #e8edf2}.pm-table td{padding:.75rem .8rem;border-bottom:1px solid #eef2f6;font-size:.78rem;color:#334155}.pm-id{font-weight:800;color:#0e7490}.pm-pill{display:inline-flex;gap:.3rem;align-items:center;padding:.22rem .5rem;border-radius:999px;background:#eef6f8;color:#0e7490;font-size:.67rem;font-weight:800}.pm-urgent{color:#b91c1c;font-size:.63rem;font-weight:800;margin-left:.3rem}.pm-note{margin:1rem;padding:.75rem 1rem;border-radius:10px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:.72rem}.pm-compare{display:grid;grid-template-columns:repeat(3,1fr);gap:.8rem;padding:1rem}.pm-vendor{border:1px solid #e3e9ef;border-radius:14px;padding:1rem;cursor:pointer;position:relative}.pm-vendor.sel{border-color:#06b6d4;box-shadow:0 0 0 2px rgba(6,182,212,.12)}.pm-rec{position:absolute;right:.7rem;top:.7rem;background:#dcfce7;color:#166534;border-radius:999px;padding:.2rem .5rem;font-size:.62rem;font-weight:800}.pm-vendor h4{margin:0;padding-right:5rem}.pm-price{font-size:1.35rem;font-weight:800;margin:.7rem 0}.pm-meta{display:grid;grid-template-columns:1fr 1fr;gap:.45rem;font-size:.7rem;color:#64748b}.pm-meta b{display:block;color:#334155;margin-top:.1rem}.pm-score{border-top:1px solid #eef2f6;margin-top:.7rem;padding-top:.6rem;display:flex;justify-content:space-between;font-size:.72rem}.pm-split{display:grid;grid-template-columns:1.4fr .8fr;gap:1rem;padding:1rem}.pm-panel{border:1px solid #e6ebf2;border-radius:14px;padding:1rem}.pm-panel h4{margin:0 0 .7rem}.pm-event{display:grid;grid-template-columns:24px 1fr;gap:.5rem;margin:.55rem 0}.pm-dot{width:22px;height:22px;border-radius:50%;background:#e8f7fb;color:#0e7490;display:grid;place-items:center;font-size:.66rem;font-weight:900}.pm-event b{font-size:.74rem}.pm-event span{display:block;color:#7b8998;font-size:.68rem;margin-top:.1rem}.pm-modal{position:fixed;inset:0;background:rgba(15,23,42,.58);z-index:10050;display:flex;align-items:center;justify-content:center;padding:1rem}.pm-box{width:min(760px,100%);max-height:92vh;overflow:auto;background:#fff;color:#0f172a;border-radius:18px}.pm-box-h{display:flex;justify-content:space-between;gap:1rem;padding:1rem 1.2rem;border-bottom:1px solid #e9eef3}.pm-form{display:grid;grid-template-columns:1fr 1fr;gap:.8rem;padding:1rem}.pm-field label{display:block;font-size:.7rem;color:#64748b;font-weight:700;margin-bottom:.25rem}.pm-field input,.pm-field select,.pm-field textarea{width:100%;border:1px solid #dbe4ee;border-radius:9px;padding:.65rem;font:inherit;font-size:.8rem;box-sizing:border-box}.pm-field.full{grid-column:1/-1}@media(max-width:1100px){.pm-kpis{grid-template-columns:repeat(3,1fr)}.pm-flow{grid-template-columns:repeat(9,120px)}.pm-compare,.pm-split{grid-template-columns:1fr}}@media(max-width:650px){.pm-kpis{grid-template-columns:repeat(2,1fr)}.pm-form{grid-template-columns:1fr}.pm-field.full{grid-column:auto}}`;(document.head||document.documentElement).appendChild(s);}
const STAGES = [['rfq','RFQ'],['quote','Quotes'],['compare','Comparison'],['approval','Awaiting approval'],['po','Purchase order'],['delivery','Delivery'],['match','Invoice match'],['payment','Payment tracking'],['closed','Closed']];
const TYPES = ['requirement','quotation','approval','po','delivery','invoice','receipt','other'];
let rows = [], role = '', query = '', filter = '', approvalFilter = '', generation = 0;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label = value => (STAGES.find(s => s[0] === value) || ['',value])[1];
const date = value => value ? new Date(value).toLocaleString() : '—';
const money = row => row.currency + ' ' + Number(row.amount || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2});
function base() { return (window.API_BASE_URL || window.apiBaseUrl || window.API_BASE || 'https://west-epcm-backend-854824137821.us-central1.run.app').replace(/\/$/, '') + '/api/purchases'; }
async function request(path = '', options = {}, download = false) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('Please sign in again.');
    const token = await user.getIdToken();
    const response = await fetch(base() + path, {...options, headers:{...options.headers, Authorization:'Bearer ' + token}});
    if (download && response.ok) return response.blob();
    const result = await response.json().catch(() => ({error:'The purchase service is unavailable. Please retry.'}));
    if (!response.ok || !result.success) throw new Error(result.error || 'Request failed');
    return result;
}
function message(element, value) { element.textContent = value; element.setAttribute('role','status'); }
async function load() {
    const run = ++generation;
    const main = document.getElementById('mainContent');
    main.style.display = 'block';
    main.innerHTML = '<div class="pm"><div class="pm-card" style="padding:2rem" id="pmLoading" role="status">Loading purchase register…</div></div>';
    try {
        let next = '', all = [], result;
        do { result = await request(next ? '?after=' + encodeURIComponent(next) : ''); all.push(...result.data); next = result.next; } while (next && run === generation);
        if (run !== generation || !document.getElementById('pmLoading')) return;
        rows = all.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)); role = result.role;
        render();
    } catch (e) {
        if (run !== generation) return;
        const loading = document.getElementById('pmLoading');
        if (loading) { loading.innerHTML = '<p></p><button class="pm-btn">Retry</button>'; message(loading.querySelector('p'), e.message); loading.querySelector('button').onclick = load; }
    }
}
function render() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `<div class="pm"><div class="pm-hero"><span class="pm-tag">${role === 'purchase' ? 'Purchase portal' : (role === 'coo' ? 'COO · Approvals' : 'Director · Approvals')}</span><h2>Purchase Management</h2><p>Manage purchase records, supporting documents and activity history.</p><div class="pm-actions" style="margin-top:1rem">${role !== 'purchase' ? '<button class="pm-btn" id="pmBack">← Procurement</button>' : ''}<button class="pm-btn" id="pmRefresh">Refresh</button><button class="pm-btn" id="pmExport">Export register</button>${role === 'purchase' ? '<button class="pm-btn primary" id="pmNew">+ New purchase</button>' : ''}</div></div><div class="pm-kpis">${[['Total purchases',rows.length],['Open',rows.filter(r=>r.stage!=='closed').length],['Awaiting approval',rows.filter(r=>r.approval?.status==='pending').length],['Delivery',rows.filter(r=>r.stage==='delivery').length],['Payment',rows.filter(r=>r.stage==='payment').length],['Closed',rows.filter(r=>r.stage==='closed').length]].map(x=>`<div class="pm-kpi"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('')}</div><div class="pm-card"><div class="pm-tools"><input id="pmSearch" aria-label="Search purchases" placeholder="Search project, item, vendor or reference" value="${esc(query)}"><select id="pmFilter" aria-label="Filter by stage"><option value="">All stages</option>${STAGES.map(s=>`<option value="${s[0]}" ${filter===s[0]?'selected':''}>${s[1]}</option>`).join('')}</select><select id="pmApprovalFilter" aria-label="Filter approval"><option value="">All approval states</option>${['draft','pending','approved','rejected'].map(a=>`<option value="${a}" ${approvalFilter===a?'selected':''}>${a}</option>`).join('')}</select></div><div id="pmRows"></div></div><p class="pm-note">Purchase staff enter requests and upload documents. COO or Director approves submitted requests. Commercial changes require fresh approval. Payment stages track payments made outside this system.</p></div>`;
    if (document.getElementById('pmBack')) document.getElementById('pmBack').onclick = () => { generation++; if (typeof window._hubOpenPhase === 'function') window._hubOpenPhase('procurement'); };
    document.getElementById('pmRefresh').onclick = load;
    document.getElementById('pmExport').onclick = exportRows;
    if (role === 'purchase') document.getElementById('pmNew').onclick = () => open();
    document.getElementById('pmSearch').oninput = e => { query = e.target.value; table(); };
    document.getElementById('pmFilter').onchange = e => { filter = e.target.value; table(); };
    document.getElementById('pmApprovalFilter').onchange = e => { approvalFilter = e.target.value; table(); };
    table();
}
function visible() { return rows.filter(r => (!filter || r.stage === filter) && (!approvalFilter || (r.approval?.status || 'draft') === approvalFilter) && [r.id,r.reference,r.project,r.item,r.vendor].join(' ').toLowerCase().includes(query.toLowerCase())); }
function table() {
    const items = visible();
    document.getElementById('pmRows').innerHTML = items.length ? `<div class="pm-table-wrap"><table class="pm-table"><thead><tr><th>Purchase / project</th><th>Item / quantity</th><th>Vendor</th><th>Value</th><th>Stage / approval</th><th>Required by</th><th>Updated</th><th>Details</th></tr></thead><tbody>${items.map(r=>`<tr><td><b>${esc(r.reference || r.id.slice(0,8))}</b><br>${esc(r.project)}</td><td>${esc(r.item)}<br><small>${esc(r.qty)}</small>${r.priority==='urgent'?'<span class="pm-urgent">URGENT</span>':''}</td><td>${esc(r.vendor || 'Not selected')}</td><td>${esc(money(r))}</td><td><span class="pm-pill">${esc(label(r.stage))}</span><br><small>${esc(r.approval?.status || 'draft')}</small></td><td>${esc(r.requiredBy || '—')}</td><td>${esc(date(r.updatedAt))}</td><td><button class="pm-btn" data-purchase="${esc(r.id)}">View</button></td></tr>`).join('')}</tbody></table></div>` : '<p style="padding:2rem;color:#64748b">No purchases found. '+(role==='purchase'?'Create a purchase to get started.':'Purchase staff entries will appear here.')+'</p>';
    document.querySelectorAll('[data-purchase]').forEach(b=>b.onclick=()=>open(b.dataset.purchase));
}
function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(url), 30000);
}
function exportRows() {
    const cell = v => '"' + String(v ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g,'""') + '"';
    const keys = ['id','reference','project','item','qty','vendor','currency','amount','stage','requiredBy','priority','paymentReference','updatedAt'];
    saveBlob(new Blob(['\uFEFF' + [keys,...visible().map(r=>keys.map(k=>r[k]))].map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'purchase-register.csv');
}
function field(name, title, value, type = 'text', required = false) {
    return `<div class="pm-field"><label for="pm-${name}">${title}</label><input id="pm-${name}" name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} ${type==='number'?'min="0" max="1000000000000" step="0.01"':'maxlength="200"'}></div>`;
}
async function open(id) {
    document.getElementById('pmModal')?.remove();
    const modal = document.createElement('div'); modal.id='pmModal'; modal.className='pm-modal';
    const previousFocus = document.activeElement;
    modal.innerHTML = '<div class="pm-box" role="dialog" aria-modal="true" aria-label="Purchase details"><div class="pm-box-h"><h3 style="margin:0">Purchase details</h3><button class="pm-btn" id="pmClose">Close</button></div><div id="pmDetail" style="padding:1rem" role="status">Loading…</div></div>';
    document.body.appendChild(modal);
    const close = () => { modal.remove(); previousFocus?.focus(); };
    modal.querySelector('#pmClose').onclick=close;
    modal.querySelector('#pmClose').focus();
    modal.onkeydown=e=>{ if(e.key==='Escape')close(); if(e.key==='Tab'){const focusable=[...modal.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled && !el.closest('fieldset[disabled]'));const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}} };
    try {
        const result = id ? await request('/'+encodeURIComponent(id)) : {data:{currency:'INR',priority:'normal',stage:'rfq',amount:0},documents:[],activities:[]};
        if (!modal.isConnected) return;
        const r = result.data, approval = r.approval || { status: 'draft' }, editable = role === 'purchase' && r.stage !== 'closed' && approval.status !== 'pending';
        const detail = modal.querySelector('#pmDetail');
        detail.innerHTML = `<section class="pm-panel"><h3>Approval: ${esc(approval.status)}</h3>${approval.decidedBy ? `<p>${esc(approval.decidedBy.name)} · ${esc(date(approval.decidedAt))}</p><p>${esc(approval.note || '')}</p>` : ''}${id && role === 'purchase' && r.stage !== 'closed' ? (approval.status === 'pending' ? '<button class="pm-btn" data-action="withdraw">Withdraw for editing</button>' : approval.status !== 'approved' ? '<button class="pm-btn primary" data-action="submit">Submit saved purchase for approval</button>' : '<p>Approved. Changes to commercial details or supporting purchase documents require fresh approval.</p>') : ''}${id && ['coo','director'].includes(role) && approval.status === 'pending' ? '<label for="pmDecisionNote">Decision note (required for rejection)</label><textarea id="pmDecisionNote" maxlength="2000" rows="3" style="display:block;width:100%;box-sizing:border-box;margin:0.5rem 0"></textarea><div class="pm-actions"><button class="pm-btn primary" data-action="approved">Approve purchase</button><button class="pm-btn" data-action="rejected">Reject purchase</button></div>' : ''}<p id="pmDecisionStatus" role="status"></p></section><form id="pmForm"><fieldset ${editable?'':'disabled'} style="border:0;padding:0;margin:0"><div class="pm-form">${field('project','Project',r.project,'text',true)}${field('reference','RFQ / PO reference',r.reference)}${field('item','Item / scope',r.item,'text',true)}${field('qty','Quantity and unit',r.qty,'text',true)}${field('vendor','Vendor',r.vendor)}${field('amount','Budget / order value',r.amount,'number',true)}<div class="pm-field"><label for="pm-currency">Currency</label><select name="currency" id="pm-currency">${['INR','USD','CAD','AUD','GBP','EUR'].map(c=>`<option ${r.currency===c?'selected':''}>${c}</option>`).join('')}</select></div>${field('requiredBy','Required by',r.requiredBy,'date')}<div class="pm-field"><label for="pm-priority">Priority</label><select name="priority" id="pm-priority">${['normal','urgent'].map(c=>`<option ${r.priority===c?'selected':''}>${c}</option>`).join('')}</select></div><div class="pm-field"><label for="pm-stage">Stage</label><select name="stage" id="pm-stage" ${id?'':'disabled'}>${STAGES.map(s=>`<option value="${s[0]}" ${r.stage===s[0]?'selected':''} ${(s[0]==='approval' || (STAGES.indexOf(s)>=4 && approval.status!=='approved'))?'disabled':''}>${s[1]}</option>`).join('')}</select></div>${field('paymentReference','Payment / closure reference',r.paymentReference)}<div class="pm-field full"><label for="pm-specification">Technical requirements / details</label><textarea id="pm-specification" name="specification" maxlength="4000" rows="3">${esc(r.specification)}</textarea></div>${id?'<div class="pm-field full"><label for="pm-note">Activity note (required for stage changes)</label><textarea id="pm-note" name="note" maxlength="2000" rows="2"></textarea></div>':''}</div>${editable?'<button class="pm-btn primary" type="submit">Save purchase</button>':''}</fieldset><p id="pmSaveStatus" role="status"></p></form>${id?`<h3>Documents</h3><p>PDF, PNG or JPEG · up to 10 MB each</p><div id="pmDocuments">${result.documents.length?result.documents.map(d=>`<div class="pm-event"><span>📄</span><div><button type="button" class="pm-btn" data-doc="${esc(d.id)}">${esc(d.filename)}</button><span>${esc(d.type)} · ${esc(d.actor.name)} · ${esc(date(d.at))}</span></div></div>`).join(''):'No documents uploaded.'}</div>${editable?`<form id="pmUpload" class="pm-tools"><select name="type" aria-label="Document category">${TYPES.map(t=>`<option>${t}</option>`).join('')}</select><input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg" required aria-label="Choose document"><button class="pm-btn primary">Upload document</button></form>`:''}<p id="pmUploadStatus" role="status"></p><h3>Activity history</h3>${result.activities.map(a=>`<div class="pm-event"><span class="pm-dot">•</span><div><b>${esc(a.actor.name)} · ${esc(a.action)}</b><span>${esc(date(a.at))} · ${esc(a.actor.role)}</span><p style="font-size:.8rem;white-space:pre-wrap">${esc(typeof a.details==='string'?a.details:label(a.details.from)+' → '+label(a.details.to)+(a.details.note?'\n'+a.details.note:'')+(a.details.changed||[]).map(c=>'\n'+c.field+': '+c.before+' → '+c.after).join(''))}</p></div></div>`).join('')}`:'<p>Save the purchase first, then attach documents.</p>'}`;
        const savedForm = JSON.stringify([...new FormData(detail.querySelector('#pmForm'))]);
        detail.querySelectorAll('[data-action]').forEach(button => button.onclick = async () => {
            const action = button.dataset.action;
            if (action === 'submit' && savedForm !== JSON.stringify([...new FormData(detail.querySelector('#pmForm'))])) {
                return message(detail.querySelector('#pmDecisionStatus'), 'Save your edits before submitting for approval.');
            }
            const decision = ['approved','rejected'].includes(action);
            const note = detail.querySelector('#pmDecisionNote')?.value || '';
            if (action === 'rejected' && !note.trim()) return message(detail.querySelector('#pmDecisionStatus'), 'Enter a reason for rejection.');
            const buttons = detail.querySelectorAll('[data-action]'); buttons.forEach(b => b.disabled = true);
            try {
                await request('/'+id+'/'+(decision?'decision':action), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ version:r.version, ...(decision?{decision:action,note}:{}) }) });
                close(); await load(); await open(id);
            } catch (error) { message(detail.querySelector('#pmDecisionStatus'),error.message); buttons.forEach(b => b.disabled = false); }
        });
        detail.querySelector('#pmForm').onsubmit = async e => {
            e.preventDefault(); if (!editable) return;
            const form = e.target, button = form.querySelector('button[type=submit]');
            const data = Object.fromEntries(new FormData(form)); data.amount=Number(data.amount); data.version=r.version;
            button.disabled=true; message(detail.querySelector('#pmSaveStatus'),'Saving…');
            try { await request(id?'/'+id:'',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(async response=>{ close(); await load(); await open(id || response.data.id); }); }
            catch(error) { message(detail.querySelector('#pmSaveStatus'),error.message); button.disabled=false; }
        };
        detail.querySelectorAll('[data-doc]').forEach(button=>button.onclick=async()=>{
            button.disabled=true;
            try { const doc=result.documents.find(d=>d.id===button.dataset.doc); const blob=await request('/'+id+'/documents/'+doc.id,{},true); saveBlob(blob,doc.filename); }
            catch(e) { message(detail.querySelector('#pmUploadStatus'),e.message); }
            finally { button.disabled=false; }
        });
        const uploader=detail.querySelector('#pmUpload');
        if(uploader) uploader.onsubmit=async e=>{
            e.preventDefault(); const file=uploader.elements.file.files[0];
            if(!file || file.size>10*1024*1024) return message(detail.querySelector('#pmUploadStatus'),'Select a file up to 10 MB.');
            const button=uploader.querySelector('button'); button.disabled=true; message(detail.querySelector('#pmUploadStatus'),'Uploading…');
            try { await request('/'+id+'/documents',{method:'POST',body:new FormData(uploader)}); close(); await load(); await open(id); }
            catch(error){message(detail.querySelector('#pmUploadStatus'),error.message);button.disabled=false;}
        };
    } catch(e) { message(modal.querySelector('#pmDetail'),e.message); }
}
window.showPurchaseManagement = () => {
    css();
    const user = firebase.auth().currentUser;
    if (user && ['anwar@edanbrook.in','anwar1@edanbrook.in'].includes((user.email || '').toLowerCase()) && user.emailVerified === false) {
        const main = document.getElementById('mainContent');
        main.innerHTML = '<div class="pm"><div class="pm-panel"><h2>Purchase portal</h2><p>Please verify your email to activate purchase access.</p><div class="pm-actions"><button class="pm-btn" id="pmVerify">Send verification email</button><button class="pm-btn primary" id="pmVerified">I have verified my email</button></div><p id="pmVerificationStatus" role="status"></p></div></div>';
        document.getElementById('pmVerify').onclick = async e => {
            e.target.disabled = true;
            try { await user.sendEmailVerification(); message(document.getElementById('pmVerificationStatus'),'Verification email sent. Open its link, then click “I have verified my email”.'); }
            catch (error) { message(document.getElementById('pmVerificationStatus'),error.message); e.target.disabled = false; }
        };
        document.getElementById('pmVerified').onclick = async () => {
            try { await user.reload(); await user.getIdToken(true); if (user.emailVerified) load(); else message(document.getElementById('pmVerificationStatus'),'Email is not verified yet. Please open the verification link first.'); }
            catch (error) { message(document.getElementById('pmVerificationStatus'),error.message); }
        };
        return;
    }
    load();
};
window.openPurchaseRequestPreview = () => { if (role === 'purchase') open(); };
})();
