/* ============================================================
 * BDM Purchase Order Patch
 *
 * Loaded AFTER index.html's main inline scripts. Responsibilities:
 *
 * 1. Replace BDM "Mark as Won" flow with a P.O. modal
 *    (P.O. Number and P.O. Value are required).
 * 2. Provide an "Update P.O." action so BDM can edit the P.O.
 *    details after the proposal is already marked WON.
 * 3. Hide the COO Purchase Order section (P.O. is now captured
 *    by the BDM at win-time).
 * 4. Load coo-notification-badges.js patch for COO nav badges.
 * 5. Load fix-timesheet-date.js to fix date display in My Timesheet.
 * 6. Load timesheet-drawing-number-patch.js to add drawing/model
 *    number fields to the designer timesheet entry form.
 * ============================================================ */
(function () {
    'use strict';

    // ---------------------------------------------------------
    // 1. Hide COO P.O. section in the project allocation modal
    // ---------------------------------------------------------
    function hideCooPoSection() {
        var ids = ['cooPoFile', 'cooPoNumber', 'cooPoValue', 'cooPoCurrency', 'cooPoFilePreview'];
        ids.forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            var section = (el.closest && (el.closest('.form-section') || el.closest('.form-row'))) || el.parentElement;
            if (section && section.dataset && section.dataset.poHidden !== '1') {
                section.style.display = 'none';
                section.dataset.poHidden = '1';
            }
        });
    }
    document.addEventListener('DOMContentLoaded', hideCooPoSection);
    try {
        var _poObserver = new MutationObserver(hideCooPoSection);
        _poObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
    } catch (e) { /* ignore */ }

    // Stub so any leftover onchange="handleCooPoFileSelect(this)" doesn't throw
    if (typeof window.handleCooPoFileSelect !== 'function') {
        window.handleCooPoFileSelect = function () { /* PO removed from COO allocation */ };
    }

    // ---------------------------------------------------------
    // 2. P.O. modal (used by Mark-as-Won AND Update-P.O. flows)
    // ---------------------------------------------------------
    function openBdmPoModal(proposalId, mode, prefill) {
        mode = mode || 'won';
        prefill = prefill || {};

        var existing = document.getElementById('bdmPoModalOverlay');
        if (existing) existing.remove();

        var title = mode === 'update' ? 'Update Purchase Order' : 'Mark Proposal as WON';
        var subtitle = mode === 'update'
            ? 'Edit the existing P.O. details for this project'
            : 'Enter Purchase Order (P.O.) details';
        var submitLabel = mode === 'update' ? 'Save P.O. Changes' : 'Mark WON & Submit P.O.';
        var submitFn = mode === 'update'
            ? "confirmUpdateBdmPo('" + proposalId + "')"
            : "confirmMarkProposalWon('" + proposalId + "')";

        var currencies = ['USD','AUD','GBP','CAD','INR','EUR'];
        var currencyOptions = currencies.map(function (c) {
            var sel = (prefill.poCurrency === c) ? ' selected' : '';
            return '<option value="' + c + '"' + sel + '>' + c + '</option>';
        }).join('');

        var html = ''
            + '<div id="bdmPoModalOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;">'
            + '  <div style="background:#fff;max-width:640px;width:100%;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,0.3);max-height:95vh;overflow-y:auto;font-family:inherit;">'
            + '    <div style="padding:1rem 1.25rem;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-start;">'
            + '      <div>'
            + '        <h2 style="margin:0;font-size:1.15rem;">' + title + '</h2>'
            + '        <div style="font-size:0.8rem;color:#6b7280;">' + subtitle + '</div>'
            + '      </div>'
            + '      <span style="cursor:pointer;font-size:1.5rem;line-height:1;color:#6b7280;" onclick="closeBdmPoModal()">&times;</span>'
            + '    </div>'
            + '    <div style="padding:1.25rem;">'
            + '      <div style="background:#fef9e7;padding:0.75rem 1rem;border-radius:8px;border-left:4px solid #f0c040;margin-bottom:1rem;font-size:0.85rem;color:#7c6a0a;">'
            + '        ' + (mode === 'update'
                ? 'Correct the client P.O. number, value or currency. The change is logged in the Won record; <strong>no email is sent</strong> and the won date stays the same.'
                    + (prefill.quoteLabel ? '<br>The sales report values this win at the priced quote (<strong>' + prefill.quoteLabel + '</strong>); the P.O. value is kept beside it for comparison.' : '')
                : 'Enter the client P.O. details below. They will be sent to <strong>COO, HR &amp; Accounts</strong>.')
            + ' <strong>P.O. Number</strong> and <strong>P.O. Value</strong> are required.'
            + '      </div>'
            + '      <div style="margin-bottom:0.85rem;">'
            + '        <label style="display:block;font-size:0.85rem;margin-bottom:0.25rem;">P.O. Document (PDF / Image)</label>'
            + '        <input type="file" id="bdmPoFile" accept=".pdf,.png,.jpg,.jpeg" style="padding:0.5rem;width:100%;border:1px solid #d1d5db;border-radius:6px;">'
            + (prefill.attachmentName
                ? '<div style="font-size:0.78rem;color:#6b7280;margin-top:4px;">Current: ' + prefill.attachmentName + ' (leave empty to keep)</div>'
                : '')
            + '      </div>'
            + '      <div style="display:flex;gap:0.75rem;margin-bottom:0.85rem;flex-wrap:wrap;">'
            + '        <div style="flex:1;min-width:200px;">'
            + '          <label style="display:block;font-size:0.85rem;margin-bottom:0.25rem;">P.O. Number <span style="color:#dc2626;">*</span></label>'
            + '          <input type="text" id="bdmPoNumber" value="' + (prefill.poNumber || '') + '" placeholder="e.g., PO-2026-001" required style="width:100%;padding:0.55rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;">'
            + '        </div>'
            + '        <div style="flex:1;min-width:200px;">'
            + '          <label style="display:block;font-size:0.85rem;margin-bottom:0.25rem;">P.O. Value <span style="color:#dc2626;">*</span></label>'
            + '          <input type="number" id="bdmPoValue" value="' + (prefill.poValue || '') + '" placeholder="e.g., 50000" min="0" step="0.01" required style="width:100%;padding:0.55rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;">'
            + '        </div>'
            + '      </div>'
            + (mode === 'update' ? '' :
                '      <div style="margin-bottom:0.85rem;">'
            + '        <label style="display:block;font-size:0.85rem;margin-bottom:0.25rem;">Won date <span style="color:#dc2626;">*</span></label>'
            + '        <input type="date" id="bdmWonDate" value="' + localToday() + '" max="' + localToday() + '" min="2020-01-01" required style="width:100%;max-width:240px;padding:0.55rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;">'
            + '        <div style="font-size:0.78rem;color:#6b7280;margin-top:4px;">The date the client confirmed the order. It drives the sales report and can be corrected later with “Edit won date”.</div>'
            + '      </div>')
            + '      <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">'
            + '        <div style="flex:1;min-width:200px;">'
            + '          <label style="display:block;font-size:0.85rem;margin-bottom:0.25rem;">Currency</label>'
            + '          <select id="bdmPoCurrency" style="width:100%;padding:0.55rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;background:#fff;">'
            +              currencyOptions
            + '          </select>'
            + '        </div>'
            + '        <div style="flex:1;min-width:200px;">'
            + '          <label style="display:block;font-size:0.85rem;margin-bottom:0.25rem;">Tracking Number</label>'
            + '          <input type="text" id="bdmPoTracking" value="' + (prefill.trackingNumber || '') + '" placeholder="Tracking / reference #" style="width:100%;padding:0.55rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;">'
            + '        </div>'
            + '      </div>'
            + '    </div>'
            + '    <div style="padding:1rem 1.25rem;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:0.5rem;flex-wrap:wrap;">'
            + '      <button type="button" onclick="closeBdmPoModal()" style="padding:0.55rem 1rem;border:1px solid #d1d5db;background:#fff;border-radius:6px;cursor:pointer;">Cancel</button>'
            + '      <button type="button" id="bdmPoSubmit" onclick="' + submitFn + '" style="padding:0.55rem 1rem;border:1px solid #16a34a;background:#16a34a;color:#fff;border-radius:6px;cursor:pointer;">' + submitLabel + '</button>'
            + '    </div>'
            + '  </div>'
            + '</div>';
        document.body.insertAdjacentHTML('beforeend', html);
    }

    function localToday() {
        var d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    // One submit at a time: a double click must not send the same P.O. / win twice.
    function lockSubmit(id, busyText) {
        var btn = document.getElementById(id);
        if (!btn || btn.disabled) return null;
        var label = btn.textContent;
        btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = busyText;
        return function () { if (document.body.contains(btn)) { btn.disabled = false; btn.style.opacity = ''; btn.textContent = label; } };
    }
    function findProposal(proposalId) {
        var lists = [window.proposals, window.allProposals, (window.appData && window.appData.proposals)];
        for (var i = 0; i < lists.length; i++) {
            if (Array.isArray(lists[i])) {
                var p = lists[i].find(function (x) { return x && (x.id === proposalId || x._id === proposalId); });
                if (p) return p;
            }
        }
        return null;
    }
    function isoDay(ts) {
        if (!ts) return '';
        var d = ts.toDate ? ts.toDate() : new Date(ts._seconds != null ? ts._seconds * 1000 : ts.seconds != null ? ts.seconds * 1000 : ts);
        return isNaN(d.getTime()) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    window.formatWonDate = function (ts) {
        var day = isoDay(ts);
        if (!day) return 'Not set';
        var d = new Date(day + 'T12:00:00');
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    // ---------------------------------------------------------
    // 3. Edit won date (BDM who won the proposal, COO or Director)
    // ---------------------------------------------------------
    window.editWonDate = async function (proposalId) {
        var p = findProposal(proposalId);
        if (!p) {
            try {
                var got = await apiCall('proposals?id=' + encodeURIComponent(proposalId));
                p = (got && got.success && got.data) || {};
            } catch (e) { p = {}; }
        }
        var current = isoDay(p.wonDate);
        var history = Array.isArray(p.wonDateHistory) ? p.wonDateHistory.slice(-5).reverse() : [];
        var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
        var existing = document.getElementById('bdmWonDateOverlay');
        if (existing) existing.remove();
        document.body.insertAdjacentHTML('beforeend', ''
            + '<div id="bdmWonDateOverlay" style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;">'
            + '  <div role="dialog" aria-modal="true" aria-labelledby="bdmWonDateTitle" style="background:#fff;max-width:440px;width:100%;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,0.3);font-family:inherit;">'
            + '    <div style="padding:1rem 1.25rem;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-start;">'
            + '      <div><h2 id="bdmWonDateTitle" style="margin:0;font-size:1.1rem;">Edit won date</h2>'
            + '      <div style="font-size:0.8rem;color:#6b7280;">' + esc(p.projectName || 'Proposal') + (p.clientCompany ? ' · ' + esc(p.clientCompany) : '') + '</div></div>'
            + '      <span style="cursor:pointer;font-size:1.5rem;line-height:1;color:#6b7280;" onclick="document.getElementById(\'bdmWonDateOverlay\').remove()">&times;</span>'
            + '    </div>'
            + '    <div style="padding:1.25rem;">'
            + '      <div style="font-size:0.85rem;color:#374151;margin-bottom:0.75rem;">Current won date: <strong>' + esc(window.formatWonDate(p.wonDate)) + '</strong></div>'
            + '      <label for="bdmEditWonDate" style="display:block;font-size:0.85rem;margin-bottom:0.25rem;">New won date</label>'
            + '      <input type="date" id="bdmEditWonDate" value="' + esc(current || localToday()) + '" max="' + localToday() + '" min="2020-01-01" style="width:100%;padding:0.55rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;">'
            + '      <div style="font-size:0.78rem;color:#6b7280;margin-top:6px;">Use the date the client confirmed the order. The change is logged, the sales report moves the win to that date, and no email is sent.</div>'
            + (history.length ? '<div style="margin-top:0.9rem;font-size:0.78rem;color:#4b5563;"><strong>Previous changes</strong><ul style="margin:0.3rem 0 0 1rem;padding:0;">'
                + history.map(function (h) { return '<li>' + esc(h.from) + ' → ' + esc(h.to) + ' by ' + esc(h.by) + '</li>'; }).join('') + '</ul></div>' : '')
            + '    </div>'
            + '    <div style="padding:1rem 1.25rem;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:0.5rem;">'
            + '      <button type="button" onclick="document.getElementById(\'bdmWonDateOverlay\').remove()" style="padding:0.55rem 1rem;border:1px solid #d1d5db;background:#fff;border-radius:6px;cursor:pointer;">Cancel</button>'
            + '      <button type="button" id="bdmWonDateSave" onclick="saveWonDate(\'' + esc(proposalId) + '\')" style="padding:0.55rem 1rem;border:1px solid #1d4ed8;background:#1d4ed8;color:#fff;border-radius:6px;cursor:pointer;">Save won date</button>'
            + '    </div>'
            + '  </div>'
            + '</div>');
    };
    window.saveWonDate = async function (proposalId) {
        var value = (document.getElementById('bdmEditWonDate') || {}).value || '';
        if (!value) { alert('Please choose a date.'); return; }
        if (value > localToday()) { alert('Won date cannot be in the future.'); return; }
        var unlock = lockSubmit('bdmWonDateSave', 'Saving…');
        if (!unlock) return;
        try {
            var resp = await apiCall('proposals?id=' + proposalId, { method: 'PUT', body: JSON.stringify({ action: 'update_won_date', data: { wonDate: value } }) });
            if (!resp || !resp.success) throw new Error((resp && resp.error) || 'Could not save the won date');
            var overlay = document.getElementById('bdmWonDateOverlay');
            if (overlay) overlay.remove();
            // Editing the date never sends the "Project won" email again.
            var reopen = !!document.getElementById('wonRecordPanel') && typeof viewProposal === 'function';
            if (typeof closeModal === 'function') closeModal();
            if (typeof showProposals === 'function') showProposals();
            if (reopen) viewProposal(proposalId);
            alert('Won date saved: ' + window.formatWonDate(value) + '\nNo email is sent for a date change.');
        } catch (error) { alert('Error: ' + error.message); unlock(); }
    };

    // ---------------------------------------------------------
    // 4. Won record: won date, every "Won" click, P.O. updates and
    //    other proposals for the same project (delete duplicates here)
    // ---------------------------------------------------------
    function role() {
        try { if (typeof currentUserRole !== 'undefined' && currentUserRole) return String(currentUserRole).toLowerCase(); } catch (e) {}
        return String(window.currentUserRole || '').toLowerCase();
    }
    function uid() {
        try { if (typeof currentUser !== 'undefined' && currentUser) return currentUser.uid; } catch (e) {}
        return window.currentUser ? window.currentUser.uid : '';
    }
    var escHtml = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    function when(iso) {
        var d = new Date(iso);
        return isNaN(d.getTime()) ? escHtml(iso || '—') : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    function money(p) {
        var v = p.pricing && p.pricing.quoteValue != null ? p.pricing.quoteValue : p.poValue;
        var c = p.pricing && p.pricing.quoteValue != null ? p.pricing.currency : p.poCurrency;
        return v == null || v === '' ? '—' : escHtml((c || '') + ' ' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 }));
    }
    var wonRecordRequest = 0;
    window.renderWonRecord = async function (p) {
        var panel = document.getElementById('wonRecordPanel');
        if (!panel || !p || p.status !== 'won') return;
        var request = ++wonRecordRequest;
        var log = Array.isArray(p.changeLog) ? p.changeLog : [];
        var clicks = log.filter(function (e) { return e && e.action === 'mark_won'; });
        var poUpdates = log.filter(function (e) { return e && e.action === 'update_po'; });
        var dateEdits = Array.isArray(p.wonDateHistory) ? p.wonDateHistory : [];
        // The BDM who won it, COO or Director may remove a WON entry; removing the last one undoes the win.
        var canEdit = ['coo', 'director'].indexOf(role()) !== -1 || (role() === 'bdm' && p.createdByUid === uid());
        var locked = !!(p.projectCreated && p.projectId);
        var item = function (icon, title, sub, action) {
            return '<li style="display:flex;gap:0.6rem;align-items:flex-start;padding:0.45rem 0;border-bottom:1px dashed #e5e7eb;"><span aria-hidden="true">' + icon + '</span><div style="flex:1;"><div style="font-weight:600;color:#1f2937;">' + title + '</div><div style="font-size:0.8rem;color:#6b7280;">' + sub + '</div></div>' + (action || '') + '</li>';
        };
        var removeButton = function (e) {
            if (!canEdit) return '';
            var last = clicks.length === 1;
            if (last && locked) return '<span style="font-size:0.72rem;color:#6b7280;align-self:center;" title="A project was created from this win">Project created</span>';
            return '<button type="button" data-won-remove="' + escHtml(e.timestamp) + '" title="' + (last ? 'Remove this WON entry and undo the win' : 'Remove this repeat WON entry') + '" style="align-self:center;padding:0.25rem 0.6rem;border:1px solid #fca5a5;background:#fff;color:#b91c1c;border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer;white-space:nowrap;">🗑 ' + (last ? 'Delete (undo WON)' : 'Delete') + '</button>';
        };
        var events = clicks.map(function (e, i) { return { at: e.timestamp, html: item('✅', i === 0 ? 'Marked WON' : 'Marked WON again (repeat click)', when(e.timestamp) + ' · ' + escHtml(e.performedByName || ''), removeButton(e)) }; })
            .concat(poUpdates.map(function (e) { return { at: e.timestamp, html: item('📝', 'P.O. updated', when(e.timestamp) + ' · ' + escHtml(e.performedByName || '') + (e.details ? ' · ' + escHtml(e.details.replace(/^P\.O\. details updated /, '')) : '')) }; }))
            .concat(dateEdits.map(function (h) { return { at: h.at, html: item('📅', 'Won date changed ' + escHtml(h.from) + ' → ' + escHtml(h.to), when(h.at) + ' · ' + escHtml(h.by || '')) }; }))
            .sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
        var badge = function (text, bg, fg, border) { return '<span style="display:inline-block;padding:0.2rem 0.6rem;border-radius:999px;background:' + bg + ';color:' + fg + ';border:1px solid ' + border + ';font-size:0.75rem;font-weight:700;">' + text + '</span>'; };
        var clickBadge = clicks.length > 1 ? badge('Won clicked ' + clicks.length + ' times', '#fef3c7', '#92400e', '#fcd34d')
            : clicks.length ? badge('Won clicked once', '#dcfce7', '#166534', '#86efac') : badge('Won click not recorded', '#f3f4f6', '#374151', '#d1d5db');
        // Older wins have no recorded click; they can still be undone as a whole.
        var undoLegacy = !clicks.length && canEdit && !locked ? '<button type="button" data-won-remove="" style="padding:0.25rem 0.6rem;border:1px solid #fca5a5;background:#fff;color:#b91c1c;border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer;">🗑 Undo WON</button>' : '';
        var stat = function (label, value) { return '<div style="min-width:150px;"><div style="font-size:0.72rem;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;">' + label + '</div><div style="font-weight:700;color:#111827;margin-top:2px;">' + value + '</div></div>'; };
        panel.innerHTML = '<div style="border:1px solid #dbeafe;border-radius:12px;overflow:hidden;">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;padding:0.85rem 1rem;background:#eff6ff;border-bottom:1px solid #dbeafe;"><strong style="color:#1e3a8a;">Won record</strong><span style="display:flex;gap:0.5rem;align-items:center;">' + undoLegacy + clickBadge + '</span></div>'
            + '<div style="display:flex;gap:1.5rem;flex-wrap:wrap;padding:0.9rem 1rem;">'
            + stat('Won date', escHtml(window.formatWonDate(p.wonDate)) + (p.wonDateEdited ? ' <span style="font-size:0.72rem;color:#3730a3;font-weight:600;">(edited' + (p.wonDateEditedBy ? ' by ' + escHtml(p.wonDateEditedBy) : '') + ')</span>' : '')
                + (canEdit ? ' <button type="button" data-won-date-edit title="Change the won date (no email is sent)" style="margin-left:6px;padding:0.15rem 0.5rem;border:1px solid #93c5fd;background:#fff;color:#1d4ed8;border-radius:6px;font-size:0.72rem;font-weight:600;cursor:pointer;vertical-align:middle;">✏️ Edit</button>' : ''))
            + stat('First clicked WON', clicks.length ? when(clicks[0].timestamp) : (p.poAddedAt ? escHtml(window.formatWonDate(p.poAddedAt)) : 'Not recorded'))
            + stat('Won value (quote)', money(p))
            + stat('P.O. (number · value)', escHtml(p.poNumber || '—') + (p.poValue ? ' · ' + escHtml((p.poCurrency || '') + ' ' + Number(p.poValue).toLocaleString('en-US', { maximumFractionDigits: 2 })) : '')
                + (role() === 'bdm' && p.createdByUid === uid() ? ' <button type="button" data-po-edit title="Edit P.O. number, value or currency (no email is sent)" style="margin-left:6px;padding:0.15rem 0.5rem;border:1px solid #fcd34d;background:#fff;color:#b45309;border-radius:6px;font-size:0.72rem;font-weight:600;cursor:pointer;vertical-align:middle;">✏️ Edit</button>' : ''))
            + '</div>'
            + (events.length ? '<div style="padding:0 1rem 0.6rem;"><div style="font-size:0.78rem;font-weight:700;color:#374151;margin-bottom:0.2rem;">History</div><ul style="list-style:none;margin:0;padding:0;">' + events.map(function (e) { return e.html; }).join('') + '</ul></div>' : '')
            + (clicks.length > 1 ? '<div style="margin:0 1rem 0.8rem;padding:0.6rem 0.8rem;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;font-size:0.8rem;color:#78350f;">Repeat WON clicks on this proposal are counted <strong>once</strong> in the sales report. Use <strong>Delete</strong> beside a repeat entry to clean the record; the won date then returns to the first click unless it was set by hand. Deleting the only remaining entry undoes the WON. (Before 27 Oct 2026 an “Update P.O.” save was also recorded as a WON click.)</div>' : '')
            + '<div id="wonDuplicateList" style="border-top:1px solid #e5e7eb;padding:0.8rem 1rem;font-size:0.85rem;color:#6b7280;">Checking for other proposals of this project…</div>'
            + '</div>';
        var dateButton = panel.querySelector('[data-won-date-edit]');
        if (dateButton) dateButton.onclick = function () { window.editWonDate(p.id); };
        var poButton = panel.querySelector('[data-po-edit]');
        if (poButton) poButton.onclick = function () { window.updateBdmPo(p.id); };
        panel.querySelectorAll('[data-won-remove]').forEach(function (btn) {
            btn.onclick = async function () {
                var ts = btn.getAttribute('data-won-remove');
                var undo = clicks.length <= 1;
                var message = undo
                    ? 'Undo WON for "' + (p.projectName || 'this proposal') + '"?\n\nThe proposal goes back to ' + (p.submittedToClientAt ? 'Submitted to client' : 'Approved') + ', its P.O. details are cleared and it leaves the sales report.'
                    : 'Delete the repeat WON entry of ' + when(ts) + '?\n\nThe win stays; the won date returns to the first WON click' + (p.wonDateEdited ? ' only if it was not set by hand' : '') + '.';
                if (!confirm(message)) return;
                btn.disabled = true; btn.textContent = 'Deleting…';
                try {
                    var resp = await apiCall('proposals?id=' + encodeURIComponent(p.id), { method: 'PUT', body: JSON.stringify({ action: 'remove_won_click', data: ts ? { timestamp: ts } : {} }) });
                    if (!resp || !resp.success) throw new Error((resp && resp.error) || 'Could not delete the WON entry');
                    if (undo) {
                        if (typeof closeModal === 'function') closeModal();
                        alert('WON removed. The proposal is back to ' + (p.submittedToClientAt ? 'Submitted to client' : 'Approved') + '.');
                    } else {
                        var fresh = await apiCall('proposals?id=' + encodeURIComponent(p.id));
                        if (fresh && fresh.success && fresh.data) window.renderWonRecord(Object.assign({ id: p.id }, fresh.data));
                    }
                    if (typeof showProposals === 'function') showProposals();
                } catch (error) { alert('Error: ' + error.message); btn.disabled = false; btn.textContent = '🗑 Delete'; }
            };
        });
        // The server checks every BDM's proposals with the same rule as the sales report (same project and client).
        var dups = null;
        try {
            var resp = await apiCall('proposals?id=' + encodeURIComponent(p.id) + '&duplicates=1');
            if (resp && resp.success && resp.data && Array.isArray(resp.data.duplicates)) dups = resp.data.duplicates;
        } catch (e) { dups = null; }
        if (request !== wonRecordRequest) return;
        var box = document.getElementById('wonDuplicateList');
        if (!box) return;
        if (dups === null) { box.textContent = 'Could not check for duplicate proposals.'; return; }
        if (!dups.length) { box.innerHTML = '<span style="color:#166534;font-weight:600;">✓ No other proposal for this project and client.</span>'; return; }
        var me = uid(), r = role();
        // Only another WON proposal is a duplicate win in the sales report; others are listed for clean-up.
        var wonDups = dups.filter(function (d) { return d.status === 'won'; }).length;
        box.innerHTML = (wonDups
            ? '<div style="font-weight:700;color:#9a3412;margin-bottom:0.5rem;">⚠ ' + wonDups + ' other WON proposal' + (wonDups === 1 ? '' : 's') + ' for the same project and client — shown as a possible duplicate in the sales report</div>'
            : '<div style="font-weight:700;color:#92400e;margin-bottom:0.5rem;">' + dups.length + ' other proposal' + (dups.length === 1 ? '' : 's') + ' for the same project and client (not won — not counted in sales)</div>')
            + dups.map(function (d) {
                var canDelete = (r === 'director') || (d.createdByUid === me && !(d.projectCreated && d.projectId));
                var why = !canDelete ? (d.projectCreated ? 'Project already created — ask COO / Director' : 'Owned by ' + escHtml(d.createdByName || 'another BDM') + ' — they or the Director can delete it') : '';
                var canView = r !== 'bdm' || d.createdByUid === me;
                return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;padding:0.6rem 0.75rem;margin-bottom:0.45rem;border:1px solid #fed7aa;border-radius:8px;background:#fff7ed;">'
                    + '<div><div style="font-weight:600;color:#1f2937;">' + escHtml(d.projectName) + ' <span style="font-weight:500;color:#6b7280;">· ' + escHtml(String(d.status || '').replace(/_/g, ' ').toUpperCase()) + '</span></div>'
                    + '<div style="font-size:0.78rem;color:#6b7280;">Created ' + escHtml(window.formatWonDate(d.createdAt)) + ' by ' + escHtml(d.createdByName || '—') + (d.status === 'won' ? ' · Won ' + escHtml(window.formatWonDate(d.wonDate)) + ' · ' + money(d) + (d.poNumber ? ' · P.O. ' + escHtml(d.poNumber) : '') : '') + '</div></div>'
                    + '<div style="display:flex;gap:0.4rem;">'
                    + (canView ? '<button type="button" class="btn btn-outline btn-sm" onclick="if (typeof closeModal === \'function\') closeModal(); viewProposal(\'' + escHtml(d.id) + '\')">View</button>' : '')
                    + (canDelete ? '<button type="button" class="btn btn-danger btn-sm" data-dup-delete="' + escHtml(d.id) + '">🗑 Delete duplicate</button>' : '<span style="font-size:0.75rem;color:#9a3412;align-self:center;">' + why + '</span>')
                    + '</div></div>';
            }).join('');
        box.querySelectorAll('[data-dup-delete]').forEach(function (btn) {
            btn.onclick = async function () {
                var d = dups.find(function (x) { return x.id === btn.getAttribute('data-dup-delete'); });
                if (!d || !confirm('Delete the duplicate proposal "' + d.projectName + '" (' + String(d.status || '').replace(/_/g, ' ') + ', created ' + window.formatWonDate(d.createdAt) + ')?\n\nIts files are removed too. This cannot be undone.')) return;
                btn.disabled = true; btn.textContent = 'Deleting…';
                try {
                    var del = await apiCall('proposals?id=' + encodeURIComponent(d.id), { method: 'DELETE' });
                    if (!del || !del.success) throw new Error((del && del.error) || 'Delete failed');
                    window.renderWonRecord(p);
                    if (typeof showProposals === 'function') showProposals();
                } catch (error) { alert('Error: ' + error.message); btn.disabled = false; btn.textContent = '🗑 Delete duplicate'; }
            };
        });
    };

    window.closeBdmPoModal = function () {
        var el = document.getElementById('bdmPoModalOverlay');
        if (el) el.remove();
    };

    async function collectPoPayloadFromModal(proposalId) {
        var poNumber = (document.getElementById('bdmPoNumber').value || '').trim();
        var poValueStr = (document.getElementById('bdmPoValue').value || '').trim();
        var poCurrency = document.getElementById('bdmPoCurrency').value || 'USD';
        var trackingNumber = (document.getElementById('bdmPoTracking').value || '').trim();
        var poFileEl = document.getElementById('bdmPoFile');
        var poFile = (poFileEl && poFileEl.files && poFileEl.files[0]) ? poFileEl.files[0] : null;
        if (!poNumber) { alert('P.O. Number is required.'); return null; }
        var poValueNum = parseFloat(poValueStr);
        if (isNaN(poValueNum) || poValueNum <= 0) { alert('Please enter a valid P.O. Value.'); return null; }
        var attachmentUrl = '', attachmentName = '', attachmentFileId = '';
        if (poFile) {
            try {
                if (typeof window.uploadFileDirectly === 'function') {
                    var up = await window.uploadFileDirectly(poFile, proposalId, 'po');
                    if (up && up.success && up.data) {
                        attachmentUrl = up.data.fileUrl || up.data.url || '';
                        attachmentName = up.data.originalName || poFile.name;
                        attachmentFileId = up.data.id || '';
                    } else { attachmentName = poFile.name; }
                } else { attachmentName = poFile.name; }
            } catch (uErr) {
                console.error('PO upload failed:', uErr);
                if (!confirm('P.O. file upload failed. Continue without the new attachment?')) return null;
            }
        }
        return { poNumber, poValue: poValueNum, poCurrency, trackingNumber, attachmentUrl, attachmentName, attachmentFileId };
    }

    window.confirmMarkProposalWon = async function (proposalId) {
        var wonDate = (document.getElementById('bdmWonDate') || {}).value || localToday();
        if (wonDate > localToday()) { alert('Won date cannot be in the future.'); return; }
        var unlock = lockSubmit('bdmPoSubmit', 'Submitting…');
        if (!unlock) return;
        try {
            if (typeof showLoading === 'function') showLoading();
            var po = await collectPoPayloadFromModal(proposalId);
            if (!po) { unlock(); if (typeof hideLoading === 'function') hideLoading(); return; }
            var payload = { action: 'mark_won', data: Object.assign({ wonDate: wonDate }, po) };
            var resp = await apiCall('proposals?id=' + proposalId, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (resp && resp.success) {
                window.closeBdmPoModal();
                alert('Proposal marked as WON!\n\nP.O. details have been sent to COO, HR & Accounts.');
                // The server sends the "Project won" email once, when the proposal is first marked won.
                if (typeof closeModal === 'function') closeModal();
                if (typeof showProposals === 'function') showProposals();
            } else { throw new Error((resp && resp.error) || 'Failed to mark as WON'); }
        } catch (error) { alert('Error: ' + error.message); unlock(); }
        finally { if (typeof hideLoading === 'function') hideLoading(); }
    };

    window.confirmUpdateBdmPo = async function (proposalId) {
        var unlock = lockSubmit('bdmPoSubmit', 'Saving…');
        if (!unlock) return;
        try {
            if (typeof showLoading === 'function') showLoading();
            var po = await collectPoPayloadFromModal(proposalId);
            if (!po) { unlock(); if (typeof hideLoading === 'function') hideLoading(); return; }
            var payload = { action: 'mark_won', data: Object.assign({ poUpdated: true, poUpdatedAt: new Date().toISOString() }, po) };
            var resp = await apiCall('proposals?id=' + proposalId, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (resp && resp.success) {
                window.closeBdmPoModal();
                alert('P.O. details updated. No email was sent.');
                var reopen = !!document.getElementById('wonRecordPanel') && typeof viewProposal === 'function';
                if (reopen && typeof closeModal === 'function') closeModal();
                if (typeof showProposals === 'function') showProposals();
                if (reopen) viewProposal(proposalId);
            } else { throw new Error((resp && resp.error) || 'Failed to update P.O.'); }
        } catch (error) { alert('Error: ' + error.message); unlock(); }
        finally { if (typeof hideLoading === 'function') hideLoading(); }
    };

    window.updateBdmPo = async function (proposalId) {
        var p = findProposal(proposalId);
        if (!p) {
            try { var got = await apiCall('proposals?id=' + encodeURIComponent(proposalId)); p = got && got.success ? got.data : null; } catch (e) { p = null; }
        }
        var prefill = p ? {
            poNumber: p.poNumber || '',
            poValue: p.poValue || (p.pricing && p.pricing.quoteValue) || '',
            poCurrency: p.poCurrency || 'USD',
            trackingNumber: (p.poDetails && p.poDetails.trackingNumber) || p.trackingNumber || '',
            attachmentName: (p.poDetails && p.poDetails.attachmentName) || p.poAttachmentName || '',
            quoteLabel: p.pricing && p.pricing.quoteValue != null ? escHtml((p.pricing.currency || '') + ' ' + Number(p.pricing.quoteValue).toLocaleString('en-US', { maximumFractionDigits: 2 })) : ''
        } : {};
        openBdmPoModal(proposalId, 'update', prefill);
    };

    function installOverride() {
        window.markProposalWon = function (proposalId) {
            openBdmPoModal(proposalId, 'won');
        };
        if (typeof window.getProposalAllocationButton === 'function' && !window.getProposalAllocationButton._bdmPoWrapped) {
            var orig = window.getProposalAllocationButton;
            var wrapped = function (p) {
                var html = orig.apply(this, arguments) || '';
                try {
                    if (window.currentUserRole === 'bdm' && p && p.id && p.status === 'won') {
                        html += ' <button class="btn btn-warning btn-sm" onclick="updateBdmPo(\'' + p.id + '\')" style="margin-left:10px;background:#f59e0b;color:#fff;border:none;padding:0.4rem 0.8rem;border-radius:6px;cursor:pointer;">&#128221; Update P.O.</button>';
                    }
                } catch (e) { /* ignore */ }
                return html;
            };
            wrapped._bdmPoWrapped = true;
            window.getProposalAllocationButton = wrapped;
        }
    }
    installOverride();
    document.addEventListener('DOMContentLoaded', installOverride);
    setTimeout(installOverride, 500);
    setTimeout(installOverride, 2000);

    console.log('BDM PO patch loaded: markProposalWon overridden, Update P.O. enabled, COO PO section hidden');
})();

// ── Load patch scripts ─────────────────────────────────────────────────────────────────
(function () {
    var patches = [
        { id: '_authPersistencePatchScript', src: 'auth-persistence-patch.js' },
        { id: '_cooNotifBadgeScript',   src: 'coo-notification-badges.js' },
        { id: '_fixTimesheetDateScript', src: 'fix-timesheet-date.js' },
        { id: '_monthlyReportPatchScript', src: 'timesheet-monthly-report-patch.js' },
        { id: '_timesheetDrawingPatchScript', src: 'timesheet-drawing-number-patch.js' },
        { id: '_estimatorUploadPatchScript', src: 'estimator-upload-patch.js' },
        // Estimator-side .docx quotation template upload + BDM auto-priced
        // download. Companion to /public/quotation_generator.js -- overrides
        // window.generateWordQuote so the BDM gets the estimator's custom
        // template (if any) rendered with live p.pricing values.
        { id: '_estimatorQuoteTemplatePatchScript', src: 'estimator-quote-template-patch.js' },
        // BDM Analytics and the manual "Upload Quote / Won" ledger are retired:
        // the single Sales analysis report (sales-monitor-patch.js) replaces them.
        // Accounts-driven Variation upload + COO Variation Tracker section +
        // BDM "My Variations" view. Companion to api/account-variations.js.
        { id: '_accountVariationPatchScript', src: 'account-variation-patch.js' },
        // BDM lead register with follow-up reminders (api/leads.js).
        { id: '_bdmLeadsPatchScript', src: 'bdm-leads-patch.js' },
        // Sample project HTML showcase gallery (api/sample-projects.js).
        { id: '_sampleProjectsPatchScript', src: 'sample-projects-patch.js' },
        // Tekla Structures model reports for COO/Director portal.
        // Companion to api/tekla-reports.js (see TEKLA_INTEGRATION.md).
        { id: '_teklaReportsPatchScript', src: 'tekla-reports-patch.js' },
        // Executive Command Center landing hub for COO/Director.
        { id: '_managementHubPatchScript', src: 'management-hub-patch.js' }
    ];
    patches.forEach(function (p) {
        if (document.getElementById(p.id)) return;
        var s = document.createElement('script');
        s.id  = p.id;
        // Bump on every change to any *-patch.js so browsers fetch a fresh
        // copy instead of serving the previously cached ?v= URL.
        var APP_PATCH_VERSION = 'v76';
        s.src = p.src + (p.src.indexOf('?') === -1 ? '?' : '&') + 'v=' + APP_PATCH_VERSION;
        s.async = true;
        s.onerror = function () { console.warn('[patch-loader] Failed to load ' + p.src); };
        (document.head || document.body || document.documentElement).appendChild(s);
    });
})();
