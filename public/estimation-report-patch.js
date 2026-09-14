// COO/Director estimation report workspace. PDF selection is local only.
// No upload, storage, extraction or report-generation API is called.
(function () {
    'use strict';
    if (window._estimationReportUIReady) return;
    window._estimationReportUIReady = true;

    function canSee() {
        var role = '';
        try {
            if (typeof currentUserRole !== 'undefined') role = currentUserRole;
            else if (window.currentUserRole != null) role = window.currentUserRole;
            else role = (document.getElementById('userRole') || {}).textContent;
        } catch (e) { return false; }
        return ['coo', 'director'].indexOf(String(role || '').trim().toLowerCase()) !== -1;
    }
    window.canSeeEstimationReports = canSee;

    var dispose = function () {};
    window.showEstimationReportGeneration = function () {
        dispose();
        var main = document.getElementById('mainContent');
        if (!main) return;
        if (!canSee()) {
            main.innerHTML = '<div class="card" role="alert" style="padding:2rem">Estimation Report Generation is available to COO and Director only.</div>';
            return;
        }
        main.innerHTML = `
<section class="erg" aria-labelledby="ergTitle">
<style>
.erg{max-width:1280px;margin:auto;color:#172b40}.erg *{box-sizing:border-box}
.erg-hero{padding:28px;border-radius:20px;background:linear-gradient(120deg,#132537,#234459);color:#fff;margin-bottom:20px}
.erg-eyebrow{color:#89e2ef;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
.erg h2{font-size:clamp(22px,3vw,30px);margin:10px 0}.erg-hero p{color:#c6d7e3;margin:0;line-height:1.6}
.erg-layout{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(270px,1fr);gap:20px;align-items:start}
.erg-card{padding:24px;background:#fff;border:1px solid #dce5ed;border-radius:16px;margin-bottom:18px}
.erg h3{font-size:17px;margin:0 0 8px}.erg-sub{font-size:13px;color:#52677b;line-height:1.6;margin:0 0 18px}
.erg-fields{display:grid;grid-template-columns:1fr 1fr;gap:16px}.erg-field{min-width:0}.erg-wide{grid-column:1/-1}
.erg label{display:block;font-weight:600;font-size:13px;margin-bottom:7px}
.erg input:not([type=file]),.erg select,.erg textarea{width:100%;padding:11px 12px;border:1px solid #b8c9d6;border-radius:9px;background:#fff;color:#172b40;font:inherit;font-size:14px}
.erg textarea{resize:vertical}.erg input:focus-visible,.erg select:focus-visible,.erg textarea:focus-visible,.erg button:focus-visible{outline:3px solid #0891b2;outline-offset:3px}
.erg-drop{border:2px dashed #80b7c7;background:#f1fafc;border-radius:12px;padding:25px;text-align:center}
.erg-drop.is-dragging{background:#d8f3f8;border-color:#0e7490}.erg-drop strong{display:block;margin-bottom:8px}
.erg input[type=file]{display:block;max-width:100%;margin:15px auto;color:#334e63;font:inherit;font-size:13px}
.erg input::file-selector-button{border:1px solid #0e7490;border-radius:8px;background:#0e7490;color:#fff;padding:10px 14px;margin-right:10px;cursor:pointer}
.erg-files{list-style:none;padding:0;margin:16px 0 0}.erg-files li{display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid #e4ebf0}
.erg-file-info{min-width:0;flex:1}.erg-file-info strong{display:block;overflow-wrap:anywhere;font-size:13px}.erg-file-info small{color:#52677b}
.erg button{font:inherit;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #bdcdda;border-radius:9px;background:#fff;color:#254258;padding:10px 14px}
.erg button.erg-primary{background:#0e7490;border-color:#0e7490;color:#fff}
.erg button:disabled{cursor:not-allowed;background:#e4ebf0;border-color:#d5dfe7;color:#596b7b}
.erg-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.erg-status{font-size:13px;color:#9f2f1b;white-space:pre-line;line-height:1.6;margin-top:12px}
.erg-note{padding:14px;border-radius:10px;background:#fff8e8;color:#78551b;font-size:13px;line-height:1.6}
.erg-summary{display:grid;grid-template-columns:1fr auto;gap:12px;font-size:14px;margin:20px 0}.erg-summary dd{margin:0;font-weight:700}
.erg-outline{padding-left:20px;color:#52677b;font-size:14px;line-height:2}
.erg-review{margin-top:18px;border-top:1px solid #dce5ed;padding-top:18px;overflow-wrap:anywhere}.erg-review p{white-space:pre-wrap;font-size:14px;line-height:1.6}
.erg [hidden]{display:none!important}
@media(max-width:800px){.erg-layout{grid-template-columns:1fr}.erg-hero,.erg-card{padding:20px}}
@media(max-width:480px){.erg-fields{grid-template-columns:1fr}.erg-wide{grid-column:auto}.erg-drop{padding:16px}}
</style>
<header class="erg-hero">
    <span class="erg-eyebrow">Engineering / Estimation</span>
    <h2 id="ergTitle" tabindex="-1">Estimation Report Generation</h2>
    <p>Prepare project details and select drawings for your estimation report.</p>
</header>
<div class="erg-layout">
<form id="ergForm">
    <div class="erg-card">
        <h3>1. Report details</h3>
        <p class="erg-sub">Set the context for your estimate. Required fields are marked *.</p>
        <div class="erg-fields">
            <div class="erg-field"><label for="ergProject">Project name *</label><input id="ergProject" required maxlength="160" placeholder="Enter project name"></div>
            <div class="erg-field"><label for="ergClient">Client name</label><input id="ergClient" maxlength="160" placeholder="Enter client name"></div>
            <div class="erg-field"><label for="ergReference">Report reference</label><input id="ergReference" maxlength="80" placeholder="e.g. EST-2026-001"></div>
            <div class="erg-field"><label for="ergDiscipline">Estimation discipline *</label><select id="ergDiscipline" required><option value="">Select discipline</option><option>Structural Steel</option><option>Rebar</option><option>Process Piping</option><option>Other</option></select></div>
            <div class="erg-field"><label for="ergUnits">Measurement units</label><select id="ergUnits"><option>Metric</option><option>Imperial</option></select></div>
            <div class="erg-field"><label for="ergCurrency">Currency</label><select id="ergCurrency"><option>CAD</option><option>USD</option><option>AUD</option><option>GBP</option><option>INR</option><option>EUR</option></select></div>
            <div class="erg-field erg-wide"><label for="ergScope">Scope and instructions</label><textarea id="ergScope" rows="3" maxlength="2000" placeholder="Describe the scope, drawing revisions, inclusions and exclusions"></textarea></div>
        </div>
    </div>
    <div class="erg-card">
        <h3>2. PDF drawings</h3>
        <p class="erg-sub">Choose multiple PDFs or drag them into the area below.</p>
        <div id="ergDrop" class="erg-drop">
            <strong>Drop PDF files here</strong>
            <label for="ergFiles">Or browse your device</label>
            <input id="ergFiles" type="file" multiple accept=".pdf,application/pdf" aria-describedby="ergLimits ergLocal">
            <div id="ergLimits" class="erg-sub">Up to 10 PDFs · 25 MB per file · 100 MB total</div>
        </div>
        <div id="ergStatus" class="erg-status" role="status" aria-live="polite"></div>
        <ul id="ergFileList" class="erg-files" aria-label="Selected PDFs"></ul>
        <p id="ergEmpty" class="erg-sub">No PDFs selected yet.</p>
        <div class="erg-actions"><button id="ergClearFiles" type="button" disabled>Remove all files</button></div>
    </div>
    <div class="erg-actions">
        <button id="ergReviewButton" class="erg-primary" type="submit" disabled>Review report setup</button>
        <button id="ergReset" type="button">Reset form</button>
    </div>
</form>
<aside class="erg-card" aria-labelledby="ergSummaryTitle">
    <h3 id="ergSummaryTitle">Report workspace</h3>
    <div id="ergLocal" class="erg-note">UI preview: files stay on your device and are not uploaded. Report generation is coming soon. Leaving this screen clears your setup.</div>
    <dl class="erg-summary"><dt>Selected PDFs</dt><dd id="ergCount">0</dd><dt>Total size</dt><dd id="ergSize">0 MB</dd></dl>
    <h3>Planned report sections</h3>
    <ol class="erg-outline"><li>Project and drawing summary</li><li>Quantity and material takeoff</li><li>Estimation breakdown</li><li>Assumptions and exclusions</li></ol>
    <p class="erg-sub">No quantities or costs have been calculated.</p>
    <button type="button" disabled aria-describedby="ergGenerationNote">Generate estimation report</button>
    <p id="ergGenerationNote" class="erg-sub" style="margin-top:12px">Generation will be enabled in the next phase.</p>
    <div id="ergReview" class="erg-review" hidden tabindex="-1"><h3>Setup review</h3><p id="ergReviewText"></p></div>
</aside>
</div>
</section>`;
        var root = main.querySelector('.erg');
        var form = root.querySelector('#ergForm');
        var input = root.querySelector('#ergFiles');
        var drop = root.querySelector('#ergDrop');
        var status = root.querySelector('#ergStatus');
        var files = [];
        var alive = true;
        var epoch = 0;
        var pending = false;
        var observer;
        function el(id) { return root.querySelector('#' + id); }
        function active() { return alive && root.isConnected && canSee(); }
        function size(bytes) { return (bytes / 1048576).toFixed(2) + ' MB'; }
        function total() { return files.reduce(function (n, f) { return n + f.size; }, 0); }
        function invalidateReview() { el('ergReview').hidden = true; el('ergReviewText').textContent = ''; }
        function update() {
            el('ergCount').textContent = String(files.length);
            el('ergSize').textContent = size(total());
            el('ergEmpty').hidden = files.length > 0;
            el('ergClearFiles').disabled = !files.length && !pending;
            el('ergReviewButton').disabled = pending || !files.length || !el('ergProject').value.trim() || !el('ergDiscipline').value;
        }
        function renderFiles() {
            var list = el('ergFileList');
            list.replaceChildren();
            files.forEach(function (file) {
                var row = document.createElement('li');
                var info = document.createElement('div');
                info.className = 'erg-file-info';
                var name = document.createElement('strong');
                name.textContent = file.name;
                var detail = document.createElement('small');
                detail.textContent = size(file.size) + ' · Selected locally';
                info.append(name, detail);
                var remove = document.createElement('button');
                remove.type = 'button';
                remove.textContent = 'Remove';
                remove.setAttribute('aria-label', 'Remove ' + file.name);
                remove.onclick = function () {
                    if (!active()) return;
                    files = files.filter(function (f) { return f !== file; });
                    invalidateReview();
                    renderFiles();
                    status.textContent = 'File removed.';
                    input.focus();
                };
                row.append(info, remove);
                list.appendChild(row);
            });
            update();
        }
        async function addFiles(selected) {
            if (!active()) return;
            if (pending) { status.textContent = 'Please wait while the selected PDFs are checked.'; return; }
            pending = true;
            var token = epoch;
            update();
            status.textContent = 'Checking selected PDFs…';
            var messages = [];
            var added = 0;
            try {
                // Only read the five-byte header; never parse or render PDF contents.
                for (var i = 0; i < selected.length; i++) {
                    var file = selected[i];
                    if (!active() || token !== epoch) return;
                    var reason = '';
                    if (!/\.pdf$/i.test(file.name)) reason = 'Only PDF files are supported.';
                    else if (!file.size) reason = 'This file is empty.';
                    else if (file.size > 25 * 1048576) reason = 'Maximum size is 25 MB per PDF.';
                    else if (files.some(function (f) { return f.name === file.name && f.size === file.size && f.lastModified === file.lastModified; })) reason = 'Already selected.';
                    else if (files.length >= 10) reason = 'A maximum of 10 PDFs can be selected.';
                    else if (total() + file.size > 100 * 1048576) reason = 'The combined limit is 100 MB.';
                    if (!reason) {
                        try {
                            var header = await file.slice(0, 5).text();
                            if (header !== '%PDF-') reason = 'This file does not have a PDF header.';
                        } catch (e) { reason = 'Could not read this file. Please select it again.'; }
                    }
                    if (!active() || token !== epoch) return;
                    if (reason) {
                        if (messages.length < 10) messages.push(file.name + ': ' + reason);
                    } else { files.push(file); added++; }
                }
                if (!active() || token !== epoch) return;
                invalidateReview();
                status.textContent = added + ' PDF(s) added locally.' + (messages.length ? '\n' + messages.join('\n') : '');
            } finally {
                if (alive && token === epoch) {
                    pending = false;
                    renderFiles();
                }
            }
        }
        input.onchange = function () {
            var selected = Array.from(input.files || []);
            input.value = '';
            addFiles(selected);
        };
        ['dragenter', 'dragover'].forEach(function (type) {
            drop.addEventListener(type, function (event) {
                event.preventDefault();
                if (active()) drop.classList.add('is-dragging');
            });
        });
        drop.addEventListener('dragleave', function (event) {
            if (!drop.contains(event.relatedTarget)) drop.classList.remove('is-dragging');
        });
        drop.addEventListener('drop', function (event) {
            event.preventDefault();
            drop.classList.remove('is-dragging');
            addFiles(Array.from((event.dataTransfer && event.dataTransfer.files) || []));
        });
        function clearFiles() {
            epoch++;
            pending = false;
            files = [];
            input.value = '';
            invalidateReview();
            renderFiles();
            status.textContent = 'Selected files cleared.';
        }
        el('ergClearFiles').onclick = function () { if (active()) clearFiles(); };
        el('ergReset').onclick = function () {
            if (!active()) return;
            form.reset();
            clearFiles();
            status.textContent = 'Report setup reset.';
            el('ergProject').focus();
        };
        form.addEventListener('input', function () { invalidateReview(); update(); });
        form.addEventListener('change', function () { invalidateReview(); update(); });
        form.onsubmit = function (event) {
            event.preventDefault();
            if (!active() || pending || !files.length || !form.reportValidity() || !el('ergProject').value.trim()) return;
            el('ergReviewText').textContent = [
                'Project: ' + el('ergProject').value.trim(),
                'Client: ' + (el('ergClient').value.trim() || 'Not specified'),
                'Reference: ' + (el('ergReference').value.trim() || 'Not specified'),
                'Discipline: ' + el('ergDiscipline').value,
                'Units: ' + el('ergUnits').value + ' · Currency: ' + el('ergCurrency').value,
                'PDFs: ' + files.length + ' · ' + size(total()),
                'Scope: ' + (el('ergScope').value.trim() || 'Not specified'),
                'Setup reviewed locally. No report has been generated or saved.'
            ].join('\n');
            el('ergReview').hidden = false;
            el('ergReview').focus();
        };
        function cleanup() {
            alive = false;
            epoch++;
            files = [];
            input.value = '';
            if (observer) observer.disconnect();
        }
        dispose = cleanup;
        observer = new MutationObserver(function () {
            if (!root.isConnected) { cleanup(); return; }
            var app = document.getElementById('appContainer');
            if (!canSee() || (app && (app.style.display === 'none' || app.hidden))) {
                cleanup();
                root.remove();
            }
        });
        observer.observe(main, { childList: true });
        var roleLabel = document.getElementById('userRole');
        if (roleLabel) observer.observe(roleLabel, { childList: true, characterData: true, subtree: true });
        var app = document.getElementById('appContainer');
        if (app) observer.observe(app, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
        renderFiles();
        main.scrollTop = 0;
        el('ergTitle').focus();
    };
})();
