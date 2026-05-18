/* ============================================================
 * Estimator Quotation Template Patch
 *
 * Loaded AFTER /app1.js, /app2.js, /quotation_generator.js and the
 * existing estimator-upload-patch.js. Two responsibilities:
 *
 * 1. ESTIMATOR SIDE
 *    In the "Manhour Entry & Estimation" modal (showEstimationModal),
 *    inject a third upload area: "Quotation Template (.docx)". When
 *    the Estimator clicks Save, the chosen .docx is uploaded through
 *    the existing /api/files/upload-file endpoint with
 *    fileType='quotationTemplate', linked to the proposalId.
 *
 *    The existing template (if any) is fetched on modal open and shown
 *    as a downloadable link so the Estimator can see what is currently
 *    attached and choose to replace it.
 *
 * 2. BDM SIDE
 *    Replaces window.generateWordQuote (defined in
 *    /public/quotation_generator.js). When the BDM clicks "Generate
 *    Word Quote", we look up the proposal's quotationTemplate file. If
 *    one is attached, we render IT with the current pricing data
 *    (p.pricing.quoteValue / .projectNumber / .hourlyRate / etc.) and
 *    download the result as a .docx. If no template is attached we
 *    fall back to the default /public/proposal_template.docx -- the
 *    pre-patch behaviour.
 *
 * Because the pricing fields are pulled live at click-time, any COO
 * pricing edit is automatically reflected in the next download.
 * ============================================================ */
(function () {
    'use strict';
    if (window._estimatorQuoteTemplatePatchLoaded) return;
    window._estimatorQuoteTemplatePatchLoaded = true;

    // -----------------------------------------------------------
    // Small helpers
    // -----------------------------------------------------------
    function escHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function tsOf(file) {
        if (!file || !file.uploadedAt) return 0;
        if (typeof file.uploadedAt === 'string') {
            var t = Date.parse(file.uploadedAt);
            return isNaN(t) ? 0 : t;
        }
        if (file.uploadedAt._seconds) return file.uploadedAt._seconds * 1000;
        if (file.uploadedAt.seconds) return file.uploadedAt.seconds * 1000;
        return 0;
    }

    function pickLatestTemplate(files) {
        if (!Array.isArray(files)) return null;
        var candidates = files.filter(function (f) {
            return f && f.fileType === 'quotationTemplate';
        });
        if (!candidates.length) return null;
        candidates.sort(function (a, b) { return tsOf(b) - tsOf(a); });
        return candidates[0];
    }

    function fetchProposalTemplate(proposalId) {
        if (typeof window.apiCall !== 'function') return Promise.resolve(null);
        return window.apiCall('files?proposalId=' + encodeURIComponent(proposalId))
            .then(function (resp) {
                if (!resp || !resp.success) return null;
                return pickLatestTemplate(resp.data);
            })
            .catch(function (err) {
                console.warn('[estimator-quote-template] fetchProposalTemplate failed:', err);
                return null;
            });
    }

    // -----------------------------------------------------------
    // ESTIMATOR: inject template upload area into estimation modal
    // -----------------------------------------------------------
    function findEstimationProposalId() {
        // The Save button is rendered as:
        //   <button onclick="saveEstimation('<id>')" ...>
        var buttons = document.querySelectorAll('button[onclick^="saveEstimation"]');
        for (var i = 0; i < buttons.length; i++) {
            var oc = buttons[i].getAttribute('onclick') || '';
            var m = oc.match(/saveEstimation\(['"]([^'"]+)['"]\)/);
            if (m) return m[1];
        }
        return null;
    }

    function injectTemplateField() {
        // Modal not open -> nothing to do.
        if (!document.getElementById('boqFileInput')) return;
        // Already injected once -> done.
        if (document.getElementById('quotationTemplateInput')) return;

        var boqArea = document.getElementById('boqUploadArea');
        if (!boqArea) return;
        var section = boqArea.closest('.form-section') || boqArea.parentElement;
        if (!section) return;

        var html =
            '<div id="quotationTemplateBlock" style="margin-top:1.5rem; padding-top:1.25rem; border-top:2px dashed #cbd5e1;">' +
                '<label style="font-weight:600; margin-bottom:0.4rem; display:block; color:#1d4ed8;">' +
                    '📄 Quotation Template (.docx) — BDM will use this to generate the final priced quote' +
                '</label>' +
                '<div id="quotationTemplateInfo" style="font-size:0.82rem; color:#475569; margin-bottom:0.5rem;">' +
                    'Checking for an existing template…' +
                '</div>' +
                '<div class="upload-area" id="quotationTemplateArea" ' +
                    'onclick="document.getElementById(\'quotationTemplateInput\').click()" ' +
                    'style="padding:1.25rem; border:2px dashed #3b82f6; border-radius:8px; cursor:pointer; background:#eff6ff;">' +
                    '<div style="font-size:1.8rem;">📄</div>' +
                    '<p style="margin:0.25rem 0; color:#1e40af; font-weight:600;">Click to upload a Word quotation template (optional)</p>' +
                    '<p style="margin:0; font-size:0.78rem; color:#475569;">' +
                        'Use placeholders: ' +
                        '<code>{project_name}</code> <code>{quote_no}</code> <code>{client_name}</code> ' +
                        '<code>{client_company}</code> <code>{price_value}</code> <code>{item_price}</code> ' +
                        '<code>{hourly_rate}</code> <code>{lead_time}</code> <code>{services_list}</code> ' +
                        '<code>{date}</code> <code>{bdm_name}</code> <code>{bdm_role}</code> ' +
                        '<code>{company_name}</code>' +
                    '</p>' +
                    '<input type="file" id="quotationTemplateInput" style="display:none;" accept=".docx">' +
                '</div>' +
                '<div id="quotationTemplatePreview" style="margin-top:0.5rem;"></div>' +
            '</div>';
        section.insertAdjacentHTML('beforeend', html);

        var input = document.getElementById('quotationTemplateInput');
        if (input) {
            input.addEventListener('change', function () {
                var file = this.files && this.files[0];
                var preview = document.getElementById('quotationTemplatePreview');
                if (!preview) return;
                if (file) {
                    preview.innerHTML =
                        '<div style="padding:0.5rem 0.75rem; background:#dbeafe; border-radius:6px; color:#1e3a8a; font-size:0.85rem;">' +
                            '✅ Selected: <strong>' + escHtml(file.name) + '</strong> ' +
                            '(' + (file.size / 1024).toFixed(1) + ' KB) — will be uploaded when you click Save' +
                        '</div>';
                } else {
                    preview.innerHTML = '';
                }
            });
        }

        // Show existing template (if any) for this proposal.
        var proposalId = findEstimationProposalId();
        var info = document.getElementById('quotationTemplateInfo');
        if (!proposalId || !info) return;

        fetchProposalTemplate(proposalId).then(function (tpl) {
            if (!info.isConnected) return;
            if (tpl) {
                var url = tpl.fileUrl || tpl.url || '';
                info.innerHTML =
                    '<span style="color:#065f46;">✅ Current template attached:</span> ' +
                    (url
                        ? '<a href="' + escHtml(url) + '" target="_blank" rel="noopener" style="color:#1d4ed8; font-weight:600;">' +
                              escHtml(tpl.originalName || 'template.docx') +
                          '</a>'
                        : '<strong>' + escHtml(tpl.originalName || 'template.docx') + '</strong>') +
                    ' — uploading a new file will replace it for the BDM.';
            } else {
                info.innerHTML =
                    'No custom template attached. BDM will get the default ' +
                    '<code>proposal_template.docx</code> with live pricing injected.';
            }
        });
    }

    // -----------------------------------------------------------
    // Wrap window.saveEstimation so the chosen template is uploaded
    // alongside BOQ + image files.
    // -----------------------------------------------------------
    function ensureSaveEstimationWrapped() {
        if (typeof window.saveEstimation !== 'function') return;
        if (window.saveEstimation.__quoteTemplatePatched) return;

        var original = window.saveEstimation;
        var wrapped = async function (proposalId) {
            try {
                var tplInput = document.getElementById('quotationTemplateInput');
                var tplFile = tplInput && tplInput.files && tplInput.files[0];
                if (tplFile && typeof window.uploadFileDirectly === 'function') {
                    try {
                        await window.uploadFileDirectly(tplFile, proposalId, 'quotationTemplate');
                        console.log('[estimator-quote-template] template uploaded:', tplFile.name);
                    } catch (upErr) {
                        console.error('[estimator-quote-template] template upload failed:', upErr);
                        alert(
                            'Quotation template upload failed:\n' +
                            (upErr && upErr.message ? upErr.message : upErr) +
                            '\n\nThe estimation will still be saved.'
                        );
                    }
                }
            } catch (e) {
                console.warn('[estimator-quote-template] pre-save hook error:', e);
            }
            return original.apply(this, arguments);
        };
        wrapped.__quoteTemplatePatched = true;
        // Preserve any flags the previous patch set on saveEstimation
        // (forward-compat).
        Object.keys(original).forEach(function (k) {
            try { wrapped[k] = original[k]; } catch (e) { /* ignore */ }
        });
        window.saveEstimation = wrapped;
        console.log('[estimator-quote-template] saveEstimation wrapped');
    }

    // -----------------------------------------------------------
    // BDM SIDE: replace generateWordQuote to use the custom template
    // -----------------------------------------------------------
    function formatDateDdMmYyyy(d) {
        try {
            var x = d instanceof Date ? d : new Date(d);
            if (isNaN(x.getTime())) return '';
            var dd = String(x.getDate()).padStart(2, '0');
            var mm = String(x.getMonth() + 1).padStart(2, '0');
            return dd + '.' + mm + '.' + x.getFullYear();
        } catch (e) { return ''; }
    }

    function buildQuoteData(p) {
        var selectedServices = (p.estimation && p.estimation.services) || [];
        var servicesList = selectedServices.join(', ') || 'Steel Detailing';

        var timelineValue = p.timeline || '';
        var leadTime = '';
        if (timelineValue) {
            var n = parseInt(timelineValue, 10);
            if (!isNaN(n)) leadTime = (n === 1 ? '1 week' : n + ' weeks');
            else leadTime = String(timelineValue);
        }

        // BDM role lookup mirrors quotation_generator.js's getBDMRole().
        var bdmRole = 'Business Development Manager';
        if (p.createdByRole) {
            var r = String(p.createdByRole).toLowerCase();
            if (r === 'bdm') bdmRole = 'Business Development Manager';
            else if (r === 'coo') bdmRole = 'Chief Operating Officer';
            else if (r === 'director') bdmRole = 'Director';
            else bdmRole = p.createdByRole;
        }

        return {
            quote_no:      (p.pricing && p.pricing.projectNumber) || 'DRAFT',
            project_name:  p.projectName || 'Project Name',
            client_name:   p.clientCompany || p.clientContact || 'Client',
            client_company: p.clientCompany || 'Client Company',
            date:          formatDateDdMmYyyy(new Date()),
            services_list: servicesList,
            item_price:    (p.pricing && p.pricing.quoteValue) || '0',
            price_value:   (p.pricing && p.pricing.quoteValue) || '0',
            hourly_rate:   (p.pricing && p.pricing.hourlyRate) || '20',
            lead_time:     leadTime,
            bdm_name:      p.createdByName || 'Sales Team',
            bdm_role:      bdmRole,
            company_name:  'Edanbrook Consultancy Services INC'
        };
    }

    function fetchAsArrayBuffer(url) {
        return fetch(url, { credentials: 'omit' }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status + ' fetching template');
            return r.arrayBuffer();
        });
    }

    function renderAndDownload(arrayBuffer, quoteData) {
        if (typeof window.PizZip !== 'function' || !window.docxtemplater) {
            throw new Error('PizZip / docxtemplater not loaded');
        }
        var zip = new window.PizZip(arrayBuffer);
        var doc = new window.docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: '{', end: '}' }
        });
        doc.setData(quoteData);
        doc.render();
        var out = doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        var safeProj = String(quoteData.project_name || 'Project').replace(/[^a-z0-9]/gi, '_');
        var safeQuote = String(quoteData.quote_no || 'DRAFT').replace(/[^a-z0-9]/gi, '_');
        var fileName = 'Quote_' + safeQuote + '_' + safeProj + '.docx';
        if (typeof window.saveAs === 'function') {
            window.saveAs(out, fileName);
        } else {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(out);
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        }
        return fileName;
    }

    function installGenerateWordQuoteOverride() {
        if (window.generateWordQuote && window.generateWordQuote.__quoteTemplatePatched) return;
        var original = window.generateWordQuote;

        var wrapped = async function (proposalId) {
            console.log('[estimator-quote-template] generateWordQuote(' + proposalId + ')');
            try {
                if (typeof window.apiCall !== 'function') {
                    if (typeof original === 'function') return original(proposalId);
                    alert('apiCall not available.'); return;
                }
                if (typeof window.showLoading === 'function') window.showLoading();

                // 1. Fetch the proposal so we have the latest pricing.
                var proposalResp = await window.apiCall('proposals?id=' + encodeURIComponent(proposalId));
                if (!proposalResp || !proposalResp.success || !proposalResp.data) {
                    alert('Failed to fetch proposal data.');
                    if (typeof window.hideLoading === 'function') window.hideLoading();
                    return;
                }
                var p = proposalResp.data;
                var quoteData = buildQuoteData(p);
                console.log('[estimator-quote-template] quoteData:', quoteData);

                // 2. Look for a custom template attached to this proposal.
                var tpl = await fetchProposalTemplate(proposalId);

                if (!tpl) {
                    // No custom template -- fall back to the original
                    // generator which uses /proposal_template.docx.
                    if (typeof original === 'function') {
                        console.log('[estimator-quote-template] no custom template, falling back to default');
                        if (typeof window.hideLoading === 'function') window.hideLoading();
                        return original(proposalId);
                    }
                    alert('No quotation template available and default generator missing.');
                    if (typeof window.hideLoading === 'function') window.hideLoading();
                    return;
                }

                // 3. Render the custom template with the live pricing.
                var tplUrl = tpl.fileUrl || tpl.url;
                if (!tplUrl) {
                    alert('Custom quotation template has no downloadable URL.');
                    if (typeof window.hideLoading === 'function') window.hideLoading();
                    return;
                }
                console.log('[estimator-quote-template] using custom template:', tpl.originalName, tplUrl);
                var buf = await fetchAsArrayBuffer(tplUrl);
                var fileName = renderAndDownload(buf, quoteData);
                console.log('[estimator-quote-template] downloaded:', fileName);
            } catch (err) {
                console.error('[estimator-quote-template] generateWordQuote failed:', err);
                if (err && err.properties && err.properties.errors) {
                    var msgs = err.properties.errors.map(function (e) {
                        return 'Tag: ' + (e.properties && e.properties.tag) + ' - ' +
                            (e.properties && e.properties.explanation || e.message);
                    }).join('\n');
                    alert('Template Error: tags in the uploaded Word template do not match.\n\n' +
                          msgs +
                          '\n\nAsk the Estimator to re-upload a template using the supported placeholders.');
                } else {
                    alert('Error generating Word quote: ' + (err && err.message ? err.message : err));
                }
            } finally {
                if (typeof window.hideLoading === 'function') window.hideLoading();
            }
        };
        wrapped.__quoteTemplatePatched = true;
        window.generateWordQuote = wrapped;
        console.log('[estimator-quote-template] generateWordQuote overridden');
    }

    // -----------------------------------------------------------
    // Boot: poll for the estimation modal so we can inject our
    // upload field; install the BDM-side override eagerly.
    // -----------------------------------------------------------
    installGenerateWordQuoteOverride();

    var bootInterval = setInterval(function () {
        injectTemplateField();
        ensureSaveEstimationWrapped();
        // Re-install in case quotation_generator.js loaded after us.
        installGenerateWordQuoteOverride();
    }, 600);

    // Also observe DOM mutations so the injection runs whenever the
    // estimation modal is (re)opened.
    try {
        var mo = new MutationObserver(function () {
            injectTemplateField();
            ensureSaveEstimationWrapped();
        });
        mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
    } catch (e) { /* ignore */ }

    // Stop the safety interval after 5 minutes so it doesn't run forever.
    setTimeout(function () { clearInterval(bootInterval); }, 5 * 60 * 1000);

    console.log('[estimator-quote-template] patch loaded');
})();
