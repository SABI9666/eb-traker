/* ============================================================
 * BDM Purchase Order Patch
 *
 * Loaded AFTER index.html's main inline scripts. Two responsibilities:
 *
 * 1. Replace BDM "Mark as Won" flow:
 *    - Opens a modal asking for P.O. attachment, P.O. number,
 *      value, currency and tracking number (all optional).
 *    - Uploads the attachment via the existing files API.
 *    - Sends poDetails to /api/proposals (action=mark_won).
 *    - Backend then notifies COO, HR & Accounts.
 *
 * 2. Remove the COO Purchase Order section from the project
 *    allocation modal — P.O. is now captured by the BDM at
 *    win-time, so the COO no longer enters it.
 *
 * To enable: include this file from index.html with
 *     <script src="bdm-po-patch.js"></script>
 * placed after the inline scripts that define markProposalWon().
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
    // 2. BDM "Mark as Won" with P.O. modal
    // ---------------------------------------------------------
    function openBdmPoModal(proposalId) {
        var existing = document.getElementById('bdmPoModalOverlay');
        if (existing) existing.remove();

        var html = ''
            + '<div id="bdmPoModalOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;">'
            + '  <div style="background:#fff;max-width:640px;width:100%;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,0.3);max-height:95vh;overflow-y:auto;font-family:inherit;">'
            + '    <div style="padding:1rem 1.25rem;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-start;">'
            + '      <div>'
            + '        <h2 style="margin:0;font-size:1.15rem;">Mark Proposal as WON</h2>'
            + '        <div style="font-size:0.8rem;color:#6b7280;">Optionally attach Purchase Order (P.O.) details</div>'
            + '      </div>'
            + '      <span style="cursor:pointer;font-size:1.5rem;line-height:1;color:#6b7280;" onclick="closeBdmPoModal()">&times;</span>'
            + '    </div>'
            + '    <div style="padding:1.25rem;">'
            + '      <div style="background:#fef9e7;padding:0.75rem 1rem;border-radius:8px;border-left:4px solid #f0c040;margin-bottom:1rem;font-size:0.85rem;color:#7c6a0a;">'
            + '        If client has issued a P.O., enter the details below. They will be sent to <strong>COO, HR &amp; Accounts</strong>. All P.O. fields are optional &mdash; leave blank if no P.O. has been issued yet.'
            + '      </div>'
            + '      <div style="margin-bottom:0.85rem;">'
            + '        <label style="display:block;font-size:0.85rem;margin-bottom:0.25rem;">P.O. Document (PDF / Image)</label>'
            + '        <input type="file" id="bdmPoFile" accept=".pdf,.png,.jpg,.jpeg" style="padding:0.5rem;width:100%;border:1px solid #d1d5db;border-radius:6px;">'
            + '      </div>'
            + '      <div style="display:flex;gap:0.75rem;margin-bottom:0.85rem;flex-wrap:wrap;">'
            + '        <div style="flex:1;min-width:200px;">'
            + '          <label style="display:block;font-size:0.85rem;margin-bottom:0.25rem;">P.O. Number</label>'
            + '          <input type="text" id="bdmPoNumber" placeholder="e.g., PO-2026-001" style="width:100%;padding:0.55rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;">'
            + '        </div>'
            + '        <div style="flex:1;min-width:200px;">'
            + '          <label style="display:block;font-size:0.85rem;margin-bottom:0.25rem;">P.O. Value</label>'
            + '          <input type="number" id="bdmPoValue" placeholder="e.g., 50000" min="0" step="0.01" style="width:100%;padding:0.55rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;">'
            + '        </div>'
            + '      </div>'
            + '      <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">'
            + '        <div style="flex:1;min-width:200px;">'
            + '          <label style="display:block;font-size:0.85rem;margin-bottom:0.25rem;">Currency</label>'
            + '          <select id="bdmPoCurrency" style="width:100%;padding:0.55rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;background:#fff;">'
            + '            <option value="USD">USD</option>'
            + '            <option value="AUD">AUD</option>'
            + '            <option value="GBP">GBP</option>'
            + '            <option value="CAD">CAD</option>'
            + '            <option value="INR">INR</option>'
            + '            <option value="EUR">EUR</option>'
            + '          </select>'
            + '        </div>'
            + '        <div style="flex:1;min-width:200px;">'
            + '          <label style="display:block;font-size:0.85rem;margin-bottom:0.25rem;">Tracking Number</label>'
            + '          <input type="text" id="bdmPoTracking" placeholder="Tracking / reference #" style="width:100%;padding:0.55rem 0.75rem;border:1px solid #d1d5db;border-radius:6px;">'
            + '        </div>'
            + '      </div>'
            + '    </div>'
            + '    <div style="padding:1rem 1.25rem;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:0.5rem;flex-wrap:wrap;">'
            + '      <button type="button" class="btn btn-outline" onclick="closeBdmPoModal()" style="padding:0.55rem 1rem;border:1px solid #d1d5db;background:#fff;border-radius:6px;cursor:pointer;">Cancel</button>'
            + '      <button type="button" class="btn btn-secondary" onclick="confirmMarkProposalWon(\'' + proposalId + '\', false)" style="padding:0.55rem 1rem;border:1px solid #6b7280;background:#6b7280;color:#fff;border-radius:6px;cursor:pointer;">Mark WON without P.O.</button>'
            + '      <button type="button" class="btn btn-success" onclick="confirmMarkProposalWon(\'' + proposalId + '\', true)" style="padding:0.55rem 1rem;border:1px solid #16a34a;background:#16a34a;color:#fff;border-radius:6px;cursor:pointer;">Mark WON &amp; Submit P.O.</button>'
            + '    </div>'
            + '  </div>'
            + '</div>';
        document.body.insertAdjacentHTML('beforeend', html);
    }

    window.closeBdmPoModal = function () {
        var el = document.getElementById('bdmPoModalOverlay');
        if (el) el.remove();
    };

    window.confirmMarkProposalWon = async function (proposalId, includePo) {
        try {
            if (typeof showLoading === 'function') showLoading();

            var poDetails = null;
            if (includePo) {
                var poNumber = (document.getElementById('bdmPoNumber').value || '').trim();
                var poValue = (document.getElementById('bdmPoValue').value || '').trim();
                var poCurrency = document.getElementById('bdmPoCurrency').value || 'USD';
                var trackingNumber = (document.getElementById('bdmPoTracking').value || '').trim();
                var poFileEl = document.getElementById('bdmPoFile');
                var poFile = (poFileEl && poFileEl.files && poFileEl.files[0]) ? poFileEl.files[0] : null;

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
                        if (!confirm('P.O. file upload failed. Continue marking as WON without the attachment?')) {
                            if (typeof hideLoading === 'function') hideLoading();
                            return;
                        }
                    }
                }

                if (poNumber || poValue || trackingNumber || attachmentUrl) {
                    poDetails = {
                        poNumber: poNumber,
                        value: poValue,
                        currency: poCurrency,
                        trackingNumber: trackingNumber,
                        attachmentUrl: attachmentUrl,
                        attachmentName: attachmentName,
                        attachmentFileId: attachmentFileId
                    };
                }
            }

            var resp = await apiCall('proposals?id=' + proposalId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'mark_won',
                    data: { wonDate: new Date().toISOString(), poDetails: poDetails }
                })
            });

            if (resp && resp.success) {
                window.closeBdmPoModal();
                alert(poDetails
                    ? 'Proposal marked as WON!\n\nP.O. details have been sent to COO, HR & Accounts.'
                    : 'Proposal marked as WON!\n\nCOO will be notified.');
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

    // Override the existing markProposalWon to open the new PO modal
    function installOverride() {
        window.markProposalWon = function (proposalId) {
            openBdmPoModal(proposalId);
        };
    }
    installOverride();
    // Re-install after DOMContentLoaded in case index.html re-defines it later
    document.addEventListener('DOMContentLoaded', installOverride);

    console.log('BDM PO patch loaded: markProposalWon overridden, COO PO section hidden');
})();
