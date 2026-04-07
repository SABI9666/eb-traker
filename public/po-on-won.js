// public/po-on-won.js
// Adds P.O. capture (number, value, currency, FILE upload) to the BDM
// "Mark as Won" flow. Overrides window.markProposalWon defined in index.html.
//
// To activate: add this single line just before </body> in public/index.html:
//     <script src="po-on-won.js"></script>
(function () {
    if (typeof window === 'undefined') return;

    const ALLOWED_CURRENCIES = ['USD', 'AUD', 'GBP', 'CAD', 'EUR', 'INR'];
    const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // strip "data:<mime>;base64," prefix
                const result = String(reader.result || '');
                const comma = result.indexOf(',');
                resolve(comma >= 0 ? result.slice(comma + 1) : result);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    function buildModal() {
        // Remove any existing instance
        const existing = document.getElementById('poOnWonModal');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'poOnWonModal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:system-ui,Segoe UI,Arial,sans-serif;';

        const currencyOptions = ALLOWED_CURRENCIES
            .map(c => `<option value="${c}">${c}</option>`).join('');

        overlay.innerHTML = `
            <div style="background:#fff;border-radius:10px;width:460px;max-width:92vw;padding:24px 26px;box-shadow:0 10px 40px rgba(0,0,0,0.3);">
                <h2 style="margin:0 0 4px 0;font-size:20px;color:#0f172a;">Mark Proposal as WON</h2>
                <p style="margin:0 0 18px 0;font-size:13px;color:#475569;">Enter Purchase Order details. P.O. file is optional.</p>

                <label style="display:block;font-size:13px;font-weight:600;color:#0f172a;margin-bottom:4px;">P.O. Number <span style="color:#dc2626;">*</span></label>
                <input id="poOnWon_number" type="text" style="width:100%;padding:9px 11px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;margin-bottom:14px;box-sizing:border-box;" />

                <label style="display:block;font-size:13px;font-weight:600;color:#0f172a;margin-bottom:4px;">P.O. Value <span style="color:#dc2626;">*</span></label>
                <input id="poOnWon_value" type="number" min="0" step="0.01" style="width:100%;padding:9px 11px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;margin-bottom:14px;box-sizing:border-box;" />

                <label style="display:block;font-size:13px;font-weight:600;color:#0f172a;margin-bottom:4px;">Currency <span style="color:#dc2626;">*</span></label>
                <select id="poOnWon_currency" style="width:100%;padding:9px 11px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;margin-bottom:14px;background:#fff;box-sizing:border-box;">
                    ${currencyOptions}
                </select>

                <label style="display:block;font-size:13px;font-weight:600;color:#0f172a;margin-bottom:4px;">P.O. File (PDF / image, optional)</label>
                <input id="poOnWon_file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*" style="width:100%;font-size:13px;margin-bottom:18px;" />

                <div style="display:flex;justify-content:flex-end;gap:8px;">
                    <button type="button" id="poOnWon_cancel" style="padding:9px 16px;border:1px solid #cbd5e1;background:#fff;color:#0f172a;border-radius:6px;font-size:14px;cursor:pointer;">Cancel</button>
                    <button type="button" id="poOnWon_submit" style="padding:9px 18px;border:0;background:#16a34a;color:#fff;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;">Mark as WON</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        return overlay;
    }

    window.markProposalWon = async function (proposalId) {
        const overlay = buildModal();
        const numEl  = overlay.querySelector('#poOnWon_number');
        const valEl  = overlay.querySelector('#poOnWon_value');
        const curEl  = overlay.querySelector('#poOnWon_currency');
        const fileEl = overlay.querySelector('#poOnWon_file');
        const btnCancel = overlay.querySelector('#poOnWon_cancel');
        const btnSubmit = overlay.querySelector('#poOnWon_submit');

        const cleanup = () => { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); };
        btnCancel.addEventListener('click', cleanup);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });

        btnSubmit.addEventListener('click', async () => {
            const poNumber = (numEl.value || '').trim();
            const poValue  = parseFloat(valEl.value);
            const poCurrency = (curEl.value || 'USD').trim().toUpperCase();

            if (!poNumber) { alert('P.O. Number is required.'); numEl.focus(); return; }
            if (isNaN(poValue) || poValue <= 0) { alert('Please enter a valid positive P.O. Value.'); valEl.focus(); return; }
            if (!ALLOWED_CURRENCIES.includes(poCurrency)) { alert('Invalid currency.'); return; }

            let poFileBase64 = null;
            let poFileName = null;
            if (fileEl.files && fileEl.files[0]) {
                const f = fileEl.files[0];
                if (f.size > MAX_FILE_BYTES) {
                    alert('P.O. file exceeds 10 MB limit.');
                    return;
                }
                try {
                    poFileBase64 = await readFileAsBase64(f);
                    poFileName = f.name;
                } catch (e) {
                    alert('Failed to read P.O. file: ' + e.message);
                    return;
                }
            }

            try {
                btnSubmit.disabled = true;
                btnSubmit.textContent = 'Submitting...';
                if (typeof showLoading === 'function') showLoading();

                const response = await apiCall('proposals?id=' + proposalId, {
                    method: 'PUT',
                    body: JSON.stringify({
                        action: 'mark_won',
                        data: {
                            wonDate: new Date().toISOString(),
                            poNumber: poNumber,
                            poValue: poValue,
                            poCurrency: poCurrency,
                            poFileBase64: poFileBase64,
                            poFileName: poFileName
                        }
                    })
                });

                if (response && response.success) {
                    cleanup();
                    alert('\u2705 Proposal marked as WON!\n\nP.O. Number: ' + poNumber +
                          '\nP.O. Value: ' + poCurrency + ' ' + poValue +
                          (poFileName ? ('\nP.O. File: ' + poFileName) : '') +
                          '\n\nCOO will be notified.');
                    if (typeof triggerEmailNotification === 'function') {
                        try { triggerEmailNotification('project.won', { proposalId: proposalId }); } catch (e) {}
                    }
                    if (typeof closeModal === 'function') closeModal();
                    if (typeof showProposals === 'function') showProposals();
                } else {
                    throw new Error((response && response.error) || 'Failed to mark as WON');
                }
            } catch (error) {
                alert('\u274C Error: ' + error.message);
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Mark as WON';
            } finally {
                if (typeof hideLoading === 'function') hideLoading();
            }
        });

        // Focus first field
        setTimeout(() => numEl.focus(), 50);
    };

    console.log('[po-on-won] markProposalWon override with file upload installed.');
})();
