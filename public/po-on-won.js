// public/po-on-won.js
// Adds P.O. capture (number, value, currency) to the BDM "Mark as Won" flow.
// Overrides window.markProposalWon defined in index.html.
// Include with: <script src="po-on-won.js"></script> just before </body>.
(function () {
    if (typeof window === 'undefined') return;

    const ALLOWED_CURRENCIES = ['USD', 'AUD', 'GBP', 'CAD', 'EUR', 'INR'];

    window.markProposalWon = async function (proposalId) {
        if (!confirm('Mark this proposal as WON?\n\nYou will be asked to enter Purchase Order (P.O.) details next. COO will then create the project.')) return;

        // 1. P.O. Number (required)
        const poNumberInput = prompt('Enter Purchase Order (P.O.) Number:');
        if (poNumberInput === null) return; // cancelled
        const poNumber = poNumberInput.trim();
        if (!poNumber) {
            alert('P.O. Number is required to mark a proposal as won.');
            return;
        }

        // 2. P.O. Value (required, numeric > 0)
        const poValueRaw = prompt('Enter P.O. Value (numeric, e.g. 25000):');
        if (poValueRaw === null) return;
        const poValue = parseFloat(poValueRaw);
        if (isNaN(poValue) || poValue <= 0) {
            alert('Please enter a valid positive P.O. Value.');
            return;
        }

        // 3. Currency (defaults to USD)
        const poCurrencyRaw = prompt('Enter Currency (' + ALLOWED_CURRENCIES.join(', ') + '):', 'USD');
        if (poCurrencyRaw === null) return;
        const poCurrency = (poCurrencyRaw || 'USD').trim().toUpperCase();
        if (!ALLOWED_CURRENCIES.includes(poCurrency)) {
            alert('Invalid currency. Allowed: ' + ALLOWED_CURRENCIES.join(', '));
            return;
        }

        try {
            if (typeof showLoading === 'function') showLoading();
            const response = await apiCall('proposals?id=' + proposalId, {
                method: 'PUT',
                body: JSON.stringify({
                    action: 'mark_won',
                    data: {
                        wonDate: new Date().toISOString(),
                        poNumber: poNumber,
                        poValue: poValue,
                        poCurrency: poCurrency
                    }
                })
            });

            if (response && response.success) {
                alert('\u2705 Proposal marked as WON!\n\nP.O. Number: ' + poNumber +
                      '\nP.O. Value: ' + poCurrency + ' ' + poValue +
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
        } finally {
            if (typeof hideLoading === 'function') hideLoading();
        }
    };
})();
