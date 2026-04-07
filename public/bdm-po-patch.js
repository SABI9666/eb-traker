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
        mode = mode || 'won'; // 'won' or 'update'
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
            + '      <button type="button" onclick="' + submitFn + '" style="padding:0.55rem 1rem;border:1px solid #16a34a;background:#16a34a;color:#fff;border-radius:6px;cursor:pointer;">' + submitLabel + '</button>'
            + '    </div>'
            + '  </div>'
            + '</div>';
        document.body.insertAdjacentHTML('beforeend', html);
    }

    window.closeBdmPoModal = function () {
        var el = document.getElementById('bdmPoModalOverlay');
        if (el) el.remove();
    };

    // Helper: read modal fields, validate, optionally upload file
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
                    } else {
                        attachmentName = poFile.name;
                    }
                } else {
                    attachmentName = poFile.name;
                }
            } catch (uErr) {
                console.error('PO upload failed:', uErr);
                if (!confirm('P.O. file upload failed. Continue without the new attachment?')) return null;
            }
        }

        return {
            poNumber: poNumber,
            poValue: poValueNum,
            poCurrency: poCurrency,
            trackingNumber: trackingNumber,
            attachmentUrl: attachmentUrl,
            attachmentName: attachmentName,
            attachmentFileId: attachmentFileId
        };
    }

    // ---------------------------------------------------------
    // 3. Mark proposal as WON (initial submit)
    // ---------------------------------------------------------
    window.confirmMarkProposalWon = async function (proposalId) {
        try {
            if (typeof showLoading === 'function') showLoading();
            var po = await collectPoPayloadFromModal(proposalId);
            if (!po) { if (typeof hideLoading === 'function') hideLoading(); return; }

            var payload = { action: 'mark_won', data: Object.assign({ wonDate: new Date().toISOString() }, po) };
            var resp = await apiCall('proposals?id=' + proposalId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (resp && resp.success) {
                window.closeBdmPoModal();
                alert('Proposal marked as WON!\n\nP.O. details have been sent to COO, HR & Accounts.');
                try { if (typeof triggerEmailNotification === 'function') triggerEmailNotification('project.won', { proposalId: proposalId }); } catch (e) {}
                if (typeof closeModal === 'function') closeModal();
                if (typeof showProposals === 'function') showProposals();
            } else {
                throw new Error((resp && resp.error) || 'Failed to mark as WON');
            }
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            if (typeof hideLoading === 'function') hideLoading();
        }
    };

    // ---------------------------------------------------------
    // 4. Update P.O. on an already-WON proposal
    // ---------------------------------------------------------
    window.confirmUpdateBdmPo = async function (proposalId) {
        try {
            if (typeof showLoading === 'function') showLoading();
            var po = await collectPoPayloadFromModal(proposalId);
            if (!po) { if (typeof hideLoading === 'function') hideLoading(); return; }

            // Use mark_won action which already accepts the same PO fields,
            // so backend updates poNumber/poValue/etc. and re-notifies stakeholders.
            var payload = { action: 'mark_won', data: Object.assign({ poUpdated: true, poUpdatedAt: new Date().toISOString() }, po) };
            var resp = await apiCall('proposals?id=' + proposalId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (resp && resp.success) {
                window.closeBdmPoModal();
                alert('P.O. details updated.\n\nCOO, HR & Accounts have been notified.');
                if (typeof showProposals === 'function') showProposals();
            } else {
                throw new Error((resp && resp.error) || 'Failed to update P.O.');
            }
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            if (typeof hideLoading === 'function') hideLoading();
        }
    };

    // Public entry points
    window.updateBdmPo = function (proposalId) {
        // Try to prefill from any in-memory proposal cache the app exposes
        var prefill = {};
        try {
            var lists = [window.proposals, window.allProposals, (window.appData && window.appData.proposals)];
            for (var i = 0; i < lists.length; i++) {
                var arr = lists[i];
                if (Array.isArray(arr)) {
                    var p = arr.find(function (x) { return x && (x.id === proposalId || x._id === proposalId); });
                    if (p) {
                        prefill = {
                            poNumber: p.poNumber || '',
                            poValue: p.poValue || (p.pricing && p.pricing.quoteValue) || '',
                            poCurrency: p.poCurrency || 'USD',
                            trackingNumber: p.trackingNumber || '',
                            attachmentName: p.poAttachmentName || ''
                        };
                        break;
                    }
                }
            }
        } catch (e) { /* ignore */ }
        openBdmPoModal(proposalId, 'update', prefill);
    };

    // ---------------------------------------------------------
    // 5. Override markProposalWon to open the PO modal
    // ---------------------------------------------------------
    function installOverride() {
        window.markProposalWon = function (proposalId) {
            openBdmPoModal(proposalId, 'won');
        };

        // Wrap getProposalAllocationButton so a BDM viewing a WON proposal
        // also sees an "Update P.O." button.
        if (typeof window.getProposalAllocationButton === 'function' && !window.getProposalAllocationButton._bdmPoWrapped) {
            var orig = window.getProposalAllocationButton;
            var wrapped = function (p) {
                var html = orig.apply(this, arguments) || '';
                try {
                    if (window.currentUserRole === 'bdm' && p && p.id) {
                        html += ' <button class="btn btn-warning btn-sm" onclick="updateBdmPo(\'' + p.id + '\')" style="margin-left:10px;background:#f59e0b;color:#fff;border:none;padding:0.4rem 0.8rem;border-radius:6px;cursor:pointer;">📝 Update P.O.</button>';
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
    // Also re-run shortly after load in case index.html re-defines functions later
    setTimeout(installOverride, 500);
    setTimeout(installOverride, 2000);

    console.log('BDM PO patch loaded: markProposalWon overridden, Update P.O. enabled, COO PO section hidden');
})();
