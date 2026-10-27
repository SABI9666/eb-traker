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
                ? 'Update the client P.O. details below. <strong>COO, HR &amp; Accounts</strong> will be notified of the changes.'
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
            + '      <div style="font-size:0.78rem;color:#6b7280;margin-top:6px;">Use the date the client confirmed the order. The change is logged and the sales report moves the win to that date.</div>'
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
            alert('Won date saved: ' + window.formatWonDate(value));
            if (typeof closeModal === 'function') closeModal();
            if (typeof showProposals === 'function') showProposals();
        } catch (error) { alert('Error: ' + error.message); unlock(); }
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
                try { if (typeof triggerEmailNotification === 'function') triggerEmailNotification('project.won', { proposalId: proposalId }); } catch (e) {}
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
                alert('P.O. details updated.\n\nCOO, HR & Accounts have been notified.');
                if (typeof showProposals === 'function') showProposals();
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
            attachmentName: (p.poDetails && p.poDetails.attachmentName) || p.poAttachmentName || ''
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
