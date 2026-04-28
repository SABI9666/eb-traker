/* ============================================================
 * Estimator Upload Patch
 *
 * Loaded AFTER /app1.js (and /app2.js). Replaces the broken
 * window.saveEstimation that POSTed FormData to /api/files
 * (rejected by backend with "Invalid request. Use /upload-file
 * for PDFs or provide links array for URLs.").
 *
 * Backend contract (api/files.js):
 *   - POST /api/files/upload-file   -> multer.single('file')  (binary)
 *   - POST /api/files               -> JSON { links: [...] }  (URLs)
 *
 * Fix: upload BOQ + image attachments one-by-one through the
 * existing window.uploadFileDirectly helper (which targets
 * /api/files/upload-file with the correct field name).
 * ============================================================ */
(function () {
    'use strict';

    function patchSaveEstimation() {
        if (typeof window.uploadFileDirectly !== 'function') return false;

        window.saveEstimation = async function (proposalId) {
            const services = Array.from(
                document.querySelectorAll('input[name="services"]:checked')
            ).map(cb => cb.value);

            const totalHours = parseFloat(document.getElementById('totalHours').value) || 0;
            const tonnage = parseFloat(document.getElementById('tonnageInput').value) || 0;

            const useTonnageCheckbox = document.getElementById('useTonnageForDesign');
            const usedTonnageForDesign = useTonnageCheckbox ? useTonnageCheckbox.checked : false;

            if (totalHours === 0 && tonnage === 0) {
                return alert('Please enter either Manhours OR Tonnage to proceed.');
            }
            if (services.length === 0) {
                return alert('Please select at least one service.');
            }

            const estimationData = {
                tonnage: tonnage,
                usedTonnageForDesign: usedTonnageForDesign,
                tonnageValue: usedTonnageForDesign ? tonnage : null,
                designHours: document.getElementById('designHours').value || 0,
                detailingHours: document.getElementById('detailingHours').value || 0,
                checkingHours: document.getElementById('checkingHours').value || 0,
                revisionHours: document.getElementById('revisionHours').value || 0,
                pmHours: document.getElementById('pmHours').value || 0,
                totalHours: totalHours,
                manhours: totalHours,
                services: services,
                notes: 'Estimation completed'
            };

            try {
                if (typeof showLoading === 'function') showLoading();

                const boqInput = document.getElementById('boqFileInput');
                const imageInput = document.getElementById('imageFileInput');
                const boqFiles = boqInput ? Array.from(boqInput.files) : [];
                const imageFiles = imageInput ? Array.from(imageInput.files) : [];
                const allFiles = boqFiles.concat(imageFiles);

                // Upload each file individually via /api/files/upload-file.
                // Don't abort the whole save if a single file fails — collect and report.
                const failures = [];
                for (const file of allFiles) {
                    try {
                        await window.uploadFileDirectly(file, proposalId, 'estimation');
                    } catch (err) {
                        console.error('Estimation file upload failed:', file.name, err);
                        failures.push(file.name + ': ' + (err && err.message ? err.message : err));
                    }
                }

                const response = await apiCall('proposals?id=' + proposalId, {
                    method: 'PUT',
                    body: JSON.stringify({ action: 'add_estimation', data: estimationData })
                });

                if (response && response.success) {
                    if (failures.length) {
                        alert(
                            'Estimation saved, but some files failed to upload:\n\n' +
                            failures.join('\n')
                        );
                    } else {
                        alert('Estimation saved successfully!');
                    }
                    const projectName =
                        (document.getElementById('estProjectName') || {}).value ||
                        'Unknown Project';
                    if (typeof triggerEmailNotification === 'function') {
                        triggerEmailNotification('estimation.complete', { projectName: projectName });
                    }
                    if (typeof closeModal === 'function') closeModal();
                    if (typeof showProposals === 'function') showProposals();
                } else {
                    throw new Error((response && response.error) || 'Failed to save estimation');
                }
            } catch (error) {
                alert('Error saving estimation: ' + (error && error.message ? error.message : error));
            } finally {
                if (typeof hideLoading === 'function') hideLoading();
            }
        };

        console.log('[estimator-upload-patch] saveEstimation override installed');
        return true;
    }

    // app1.js declares saveEstimation as a function declaration (auto-global),
    // and uploadFileDirectly is also defined there. We just need to wait until
    // both are present, then install the override.
    if (!patchSaveEstimation()) {
        let attempts = 0;
        const interval = setInterval(function () {
            attempts++;
            if (patchSaveEstimation() || attempts > 100) {
                clearInterval(interval);
            }
        }, 100);
    }
})();
