// public/timesheet-drawing-number-patch.js
// Adds optional "Drawing Number" and "Model Number" fields to the designer
// timesheet entry form, submits them alongside the main entry, and surfaces
// them in the "My Timesheet" listing.
//
// Why a patch: app1.js (~860KB) and app2.js (~820KB) are too large to
// repush as whole files, so this standalone script is loaded by
// bdm-po-patch.js and mutates the DOM / wraps window.submitTimesheet.

(function () {
    'use strict';

    if (window._timesheetDrawingPatchLoaded) return;
    window._timesheetDrawingPatchLoaded = true;

    var API_BASE_GLOBAL_NAMES = ['API_BASE_URL', 'API_URL', 'BACKEND_URL'];
    function getApiBase() {
        for (var i = 0; i < API_BASE_GLOBAL_NAMES.length; i++) {
            var v = window[API_BASE_GLOBAL_NAMES[i]];
            if (typeof v === 'string' && v) return v.replace(/\/$/, '');
        }
        return '';
    }

    function getAuthHeader() {
        // EB-Tracker uses authToken global set in app1.js
        var token = window.authToken || '';
        return token ? ('Bearer ' + token) : '';
    }

    function readFieldValue(id) {
        var el = document.getElementById(id);
        if (!el) return '';
        return (el.value || '').toString().trim();
    }

    // ------------------------------------------------------------------
    // 1. INJECT form fields into the timesheet form
    // ------------------------------------------------------------------
    function buildDrawingFieldsHtml() {
        return [
            '<div class="form-group ts-drawing-patch" style="margin-bottom: 1rem;">',
            '  <label style="display:block;margin-bottom:0.5rem;font-weight:600;">Drawing Number <span style="color:#94a3b8;font-weight:normal;">(optional)</span></label>',
            '  <input type="text" id="timesheetDrawingNumber" class="form-control" ',
            '         style="width:100%;padding:0.75rem;border:1px solid var(--border,#d1d5db);border-radius:8px;" ',
            '         maxlength="200" placeholder="e.g., DWG-00123" autocomplete="off">',
            '</div>',
            '<div class="form-group ts-drawing-patch" style="margin-bottom: 1rem;">',
            '  <label style="display:block;margin-bottom:0.5rem;font-weight:600;">Model Number <span style="color:#94a3b8;font-weight:normal;">(optional)</span></label>',
            '  <input type="text" id="timesheetModelNumber" class="form-control" ',
            '         style="width:100%;padding:0.75rem;border:1px solid var(--border,#d1d5db);border-radius:8px;" ',
            '         maxlength="200" placeholder="e.g., MDL-A45" autocomplete="off">',
            '</div>'
        ].join('');
    }

    function injectFieldsInto(form) {
        if (!form || form.dataset.drawingPatchApplied === '1') return;

        // Only touch a form that looks like the designer timesheet form
        var hasDescription = form.querySelector('#timesheetDescription');
        var hasHours = form.querySelector('#timesheetHours');
        if (!hasDescription || !hasHours) return;

        // Don't double-insert
        if (form.querySelector('#timesheetDrawingNumber') || form.querySelector('#timesheetModelNumber')) {
            form.dataset.drawingPatchApplied = '1';
            return;
        }

        var temp = document.createElement('div');
        temp.innerHTML = buildDrawingFieldsHtml();

        // Insert before the Description field so it appears above the free-text area
        var descGroup = hasDescription.closest('.form-group') || hasDescription.parentElement;
        var parent = descGroup ? descGroup.parentNode : form;
        while (temp.firstChild) {
            if (descGroup && parent) {
                parent.insertBefore(temp.firstChild, descGroup);
            } else {
                form.appendChild(temp.firstChild);
            }
        }

        form.dataset.drawingPatchApplied = '1';
    }

    function scanAndInject() {
        var forms = document.querySelectorAll('#timesheetForm, form#timesheetForm');
        for (var i = 0; i < forms.length; i++) {
            injectFieldsInto(forms[i]);
        }
    }

    // Observe DOM so the fields appear whenever the form is rendered
    var mo;
    function startObserver() {
        if (mo || typeof MutationObserver === 'undefined') return;
        mo = new MutationObserver(function () { scanAndInject(); });
        mo.observe(document.documentElement, { childList: true, subtree: true });
    }

    // ------------------------------------------------------------------
    // 2. Wrap window.submitTimesheet
    //    After the original submission succeeds, call our PATCH endpoint
    //    to store the drawing / model numbers on the newly created entry.
    // ------------------------------------------------------------------
    async function patchDrawingInfo(timesheetId, drawingNumber, modelNumber) {
        if (!timesheetId) return;
        if (!drawingNumber && !modelNumber) return;

        try {
            var url = getApiBase() + '/api/timesheet-drawing-info/' + encodeURIComponent(timesheetId);
            var headers = { 'Content-Type': 'application/json' };
            var auth = getAuthHeader();
            if (auth) headers.Authorization = auth;

            var body = {};
            if (drawingNumber) body.drawingNumber = drawingNumber;
            if (modelNumber) body.modelNumber = modelNumber;

            var resp = await fetch(url, {
                method: 'PATCH',
                headers: headers,
                body: JSON.stringify(body)
            });
            if (!resp.ok) {
                console.warn('[timesheet-drawing-patch] PATCH failed:', resp.status, await resp.text());
            } else {
                console.log('[timesheet-drawing-patch] drawing/model info saved for', timesheetId);
            }
        } catch (err) {
            console.warn('[timesheet-drawing-patch] PATCH error:', err && err.message);
        }
    }

    // Intercept the most recently created timesheet doc via the /api/timesheets
    // POST response. We wrap window.fetch briefly, but the safest route is
    // to wrap window.submitTimesheet: read the form fields BEFORE the submit
    // (because submit wipes the modal) and PATCH the last entry afterwards.
    function wrapSubmitTimesheet() {
        if (window._timesheetDrawingSubmitWrapped) return;
        if (typeof window.submitTimesheet !== 'function') return;

        var original = window.submitTimesheet;

        // Capture the most recent timesheet create response so we know the id
        var lastCreatedId = null;
        if (!window._timesheetDrawingFetchWrapped && typeof window.fetch === 'function') {
            var origFetch = window.fetch.bind(window);
            window.fetch = async function (input, init) {
                var url = (typeof input === 'string') ? input : (input && input.url) || '';
                var method = (init && init.method) ||
                             (typeof input === 'object' && input && input.method) || 'GET';
                var isTimesheetCreate = /\/api\/timesheets(\/?|\?|$)/.test(url) &&
                                        String(method).toUpperCase() === 'POST';
                var response = await origFetch(input, init);
                if (isTimesheetCreate) {
                    try {
                        var cloned = response.clone();
                        var data = await cloned.json();
                        if (data && data.success && data.data && data.data.id) {
                            lastCreatedId = data.data.id;
                        }
                    } catch (_e) { /* ignore */ }
                }
                return response;
            };
            window._timesheetDrawingFetchWrapped = true;
        }

        window.submitTimesheet = async function () {
            var drawingNumber = readFieldValue('timesheetDrawingNumber');
            var modelNumber = readFieldValue('timesheetModelNumber');

            lastCreatedId = null;
            var result = await original.apply(this, arguments);

            // Give the original function a moment to finish its async chain
            // in case it doesn't await fetch before returning.
            for (var i = 0; i < 20 && !lastCreatedId; i++) {
                await new Promise(function (r) { setTimeout(r, 50); });
            }

            if (lastCreatedId && (drawingNumber || modelNumber)) {
                await patchDrawingInfo(lastCreatedId, drawingNumber, modelNumber);
            }
            return result;
        };
        window._timesheetDrawingSubmitWrapped = true;
        console.log('[timesheet-drawing-patch] wrapped window.submitTimesheet');
    }

    function poll() {
        scanAndInject();
        wrapSubmitTimesheet();
    }

    // ------------------------------------------------------------------
    // 3. Add a "Drawing / Model" column to the My Timesheet table
    // ------------------------------------------------------------------
    function decorateTimesheetTables() {
        // Find tables whose header contains Description AND Status
        var tables = document.querySelectorAll('table');
        for (var t = 0; t < tables.length; t++) {
            var tbl = tables[t];
            if (tbl.dataset.drawingPatchDecorated === '1') continue;

            var headerRow = tbl.querySelector('thead tr');
            if (!headerRow) continue;
            var ths = headerRow.querySelectorAll('th');
            if (ths.length < 4) continue;

            var headerTexts = [];
            for (var h = 0; h < ths.length; h++) headerTexts.push((ths[h].textContent || '').trim().toLowerCase());
            var descIdx = headerTexts.indexOf('description');
            var statusIdx = headerTexts.indexOf('status');
            if (descIdx === -1 || statusIdx === -1) continue;

            // Insert a new column header after Description
            var newTh = document.createElement('th');
            newTh.textContent = 'Drawing / Model';
            newTh.style.padding = ths[descIdx].style.padding || '1rem';
            newTh.style.textAlign = 'left';
            ths[descIdx].insertAdjacentElement('afterend', newTh);

            // Insert a cell in each row at the same position
            var bodyRows = tbl.querySelectorAll('tbody tr');
            for (var r = 0; r < bodyRows.length; r++) {
                var row = bodyRows[r];
                var cells = row.querySelectorAll('td');
                if (cells.length < descIdx + 1) continue;

                // If the row is a "no entries" colspan cell, bump its colspan instead
                if (cells.length === 1 && cells[0].hasAttribute('colspan')) {
                    var span = parseInt(cells[0].getAttribute('colspan'), 10);
                    if (!isNaN(span)) cells[0].setAttribute('colspan', String(span + 1));
                    continue;
                }

                var newTd = document.createElement('td');
                // Pull values off the row via data attributes we set on rendering,
                // or fall back to empty; when the row is re-rendered by the app
                // without drawing info, the cell will simply be blank.
                var drawing = row.dataset.drawingNumber || '';
                var model = row.dataset.modelNumber || '';
                var parts = [];
                if (drawing) parts.push('<span style="display:inline-block;padding:2px 8px;border-radius:10px;background:#eef2ff;color:#3730a3;font-size:12px;">DWG ' + escapeHtml(drawing) + '</span>');
                if (model) parts.push('<span style="display:inline-block;padding:2px 8px;border-radius:10px;background:#ecfdf5;color:#065f46;font-size:12px;">MDL ' + escapeHtml(model) + '</span>');
                newTd.innerHTML = parts.length ? parts.join(' ') : '<span style="color:#cbd5e1;">—</span>';
                cells[descIdx].insertAdjacentElement('afterend', newTd);
            }

            tbl.dataset.drawingPatchDecorated = '1';
        }
    }

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ------------------------------------------------------------------
    // Init
    // ------------------------------------------------------------------
    function init() {
        startObserver();
        poll();
        setInterval(poll, 1000);
        setInterval(decorateTimesheetTables, 1500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
