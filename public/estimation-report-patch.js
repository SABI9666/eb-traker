// COO/Director estimation report workspace.
// Selected PDFs are read in the browser with pdf.js (loaded on demand from cdnjs).
// If that engine cannot load, each PDF is sent to POST /api/estimation-reports/extract,
// which extracts text in memory on the server. Nothing is stored; results live only on screen.
(function () {
    'use strict';
    if (window._estimationReportUIReady) return;
    window._estimationReportUIReady = true;

    var PDFJS_VERSION = '3.11.174';
    var PDFJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + PDFJS_VERSION + '/';
    var MAX_PAGES_PER_FILE = 300;
    var MAX_TEXT_PER_PAGE = 20000;

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

    // ---------- pdf.js loader ----------
    var pdfjsPromise = null;
    function loadPdfJs() {
        if (window.pdfjsLib && window.pdfjsLib.getDocument) return Promise.resolve(window.pdfjsLib);
        if (pdfjsPromise) return pdfjsPromise;
        pdfjsPromise = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = PDFJS_BASE + 'pdf.min.js';
            s.async = true;
            s.onload = function () {
                var lib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
                if (!lib) { reject(new Error('PDF engine did not initialise.')); return; }
                lib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.js';
                window.pdfjsLib = lib;
                resolve(lib);
            };
            s.onerror = function () { reject(new Error('Could not load the PDF engine. Check your internet connection.')); };
            document.head.appendChild(s);
        });
        pdfjsPromise.catch(function () { pdfjsPromise = null; });
        return pdfjsPromise;
    }

    // ---------- text extraction ----------
    // Groups pdf.js text items into rows (same baseline) and cells (runs of
    // nearby text within a row), keeping positions for title-block lookups.
    function itemsToRows(items) {
        var runs = [];
        items.forEach(function (it) {
            if (!it || typeof it.str !== 'string' || !it.str.trim()) return;
            var t = it.transform || [1, 0, 0, 1, 0, 0];
            runs.push({ x: t[4], y: t[5], w: it.width || 0, h: Math.abs(t[3]) || Math.abs(t[0]) || 8, s: it.str });
        });
        runs.sort(function (a, b) { return (b.y - a.y) || (a.x - b.x); });
        var rows = [];
        var cur = null;
        runs.forEach(function (r) {
            if (cur && Math.abs(cur.y - r.y) <= Math.max(2, Math.min(cur.h, r.h) * 0.45)) cur.parts.push(r);
            else { cur = { y: r.y, h: r.h, parts: [r] }; rows.push(cur); }
        });
        return rows.map(function (row) {
            row.parts.sort(function (a, b) { return a.x - b.x; });
            var cells = [];
            var cell = null;
            row.parts.forEach(function (p) {
                var gap = cell ? p.x - cell.x2 : Infinity;
                if (cell && gap <= p.h * 1.2) {
                    if (gap > p.h * 0.2 && !/\s$/.test(cell.text)) cell.text += ' ';
                    cell.text += p.s;
                    cell.x2 = Math.max(cell.x2, p.x + p.w);
                } else {
                    cell = { x: p.x, x2: p.x + p.w, text: p.s };
                    cells.push(cell);
                }
            });
            cells.forEach(function (c) { c.text = c.text.replace(/[\u2018\u2019\u2032]/g, "'").replace(/[\u201C\u201D\u2033]/g, '"').replace(/\s+/g, ' ').trim(); });
            cells = cells.filter(function (c) { return c.text; });
            return { y: row.y, h: row.h, cells: cells, text: cells.map(function (c) { return c.text; }).join(' ') };
        }).filter(function (r) { return r.text; });
    }

    async function extractFile(lib, file, onPage, isCancelled) {
        var data = new Uint8Array(await file.arrayBuffer());
        var doc = await lib.getDocument({ data: data, isEvalSupported: false }).promise;
        try {
            var meta = {};
            try {
                var m = await doc.getMetadata();
                var info = (m && m.info) || {};
                meta = { title: info.Title || '', author: info.Author || '', creator: info.Creator || '', producer: info.Producer || '', created: info.CreationDate || '' };
            } catch (e) { /* metadata is optional */ }
            var pages = [];
            var count = Math.min(doc.numPages, MAX_PAGES_PER_FILE);
            for (var i = 1; i <= count; i++) {
                if (isCancelled()) return null;
                var page = await doc.getPage(i);
                var vp = page.getViewport({ scale: 1 });
                var tc = await page.getTextContent();
                var rows = itemsToRows(tc.items);
                var lines = rows.map(function (r) { return r.text; });
                var text = lines.join('\n');
                if (text.length > MAX_TEXT_PER_PAGE) text = text.slice(0, MAX_TEXT_PER_PAGE);
                pages.push({ number: i, widthPt: vp.width, heightPt: vp.height, rows: rows, lines: lines, text: text });
                if (page.cleanup) page.cleanup();
                onPage(i, count);
            }
            return { name: file.name, size: file.size, totalPages: doc.numPages, truncated: doc.numPages > count, meta: meta, pages: pages };
        } finally {
            try { doc.destroy(); } catch (e) { /* ignore */ }
        }
    }

    // Server fallback: the backend returns positioned text runs as
    // [text, x, y, width, height] tuples, rebuilt here into the same page shape.
    async function extractFileOnServer(file, onPage) {
        var call = typeof apiCall === 'function' ? apiCall : window.apiCall;
        if (typeof call !== 'function') throw new Error('The PDF engine could not load and the server is unavailable.');
        var form = new FormData();
        form.append('file', file, file.name);
        var resp = await call('estimation-reports/extract', { method: 'POST', body: form });
        var data = resp && resp.data ? resp.data : resp;
        if (!data || !Array.isArray(data.pages)) throw new Error((resp && resp.error) || 'Server extraction failed.');
        var pages = data.pages.map(function (pg) {
            var rows = itemsToRows((pg.items || []).map(function (i) {
                return { str: String(i[0] || ''), transform: [i[4], 0, 0, i[4], i[1], i[2]], width: i[3] };
            }));
            var lines = rows.map(function (r) { return r.text; });
            var text = lines.join('\n');
            if (text.length > MAX_TEXT_PER_PAGE) text = text.slice(0, MAX_TEXT_PER_PAGE);
            return { number: pg.number, widthPt: pg.widthPt, heightPt: pg.heightPt, rows: rows, lines: lines, text: text };
        });
        onPage(pages.length, pages.length || 1);
        return { name: file.name, size: file.size, totalPages: data.totalPages || pages.length, truncated: !!data.truncated, meta: data.meta || {}, pages: pages, viaServer: true };
    }

    // ---------- parsing ----------
    var SHEET_SIZES = [
        ['A0', 841, 1189], ['A1', 594, 841], ['A2', 420, 594], ['A3', 297, 420], ['A4', 210, 297],
        ['ARCH E1', 762, 1067], ['ARCH E', 914, 1219], ['ARCH D', 610, 914], ['ARCH C', 457, 610],
        ['ANSI E', 864, 1118], ['ANSI D', 559, 864], ['ANSI C', 432, 559], ['Tabloid', 279, 432], ['Letter', 216, 279]
    ];
    function sheetSize(wPt, hPt) {
        var a = Math.min(wPt, hPt) * 25.4 / 72, b = Math.max(wPt, hPt) * 25.4 / 72;
        for (var i = 0; i < SHEET_SIZES.length; i++) {
            var s = SHEET_SIZES[i];
            if (Math.abs(a - s[1]) <= 8 && Math.abs(b - s[2]) <= 8) return s[0];
        }
        return Math.round(a) + ' × ' + Math.round(b) + ' mm';
    }

    var N = '\\d+(?:\\.\\d+)?(?:[-\\s]\\d+\\/\\d+|\\/\\d+)?';   // 6, 0.375, 3/8, 4-1/2
    var X = '\\s?[xX×]\\s?';
    var MEMBER_PATTERNS = [
        { family: 'Wide flange (W)', re: new RegExp('\\b(W|HP|M)\\s?(\\d{1,4})' + X + '(\\d{1,3}(?:\\.\\d+)?)\\b', 'g'), wt: 3 },
        { family: 'Tee (WT)', re: new RegExp('\\b(WT)\\s?(\\d{1,4}(?:\\.\\d+)?)' + X + '(\\d{1,3}(?:\\.\\d+)?)\\b', 'g'), wt: 3 },
        { family: 'Channel (C/MC)', re: new RegExp('\\b(MC|C)(\\d{1,3})' + X + '(\\d{1,2}(?:\\.\\d+)?)\\b', 'g'), wt: 3 },
        { family: 'HSS / Tube', re: new RegExp('\\b(HSS)\\s?(' + N + ')(' + X + N + ')(' + X + N + ')?', 'g') },
        { family: 'Angle (L)', re: new RegExp('\\b(L)\\s?(' + N + ')' + X + '(' + N + ')' + X + '(' + N + ')', 'g') },
        { family: 'Metric section (UB/UC/PFC)', re: /\b(\d{2,4})\s?[xX×]\s?(\d{2,4})(?:\s?[xX×]\s?(\d{1,3}(?:\.\d+)?))?\s?(UB|UC|PFC|UBP|WB|WC)\b/g, wt: 3 },
        { family: 'Hollow section (SHS/RHS/CHS)', re: /\b(SHS|RHS|CHS)\s?(\d{2,4}(?:\.\d+)?)(?:\s?[xX×]\s?(\d{1,4}(?:\.\d+)?)){1,2}\b/g },
        { family: 'Plate (PL)', re: new RegExp('\\bPL\\s?(' + N + ')\\s?(?:mm|")?(?:' + X + '(' + N + ')\\s?(?:mm|")?)?', 'g') }
    ];
    var REBAR_PATTERNS = [
        /(?:^|[^A-Z0-9#])(#(?:[3-9]|1[0-8]))(?![0-9])/g,
        /\b((?:10|15|20|25|30|35|45|55)M)\b/g,
        /\b([NTY](?:10|12|16|20|24|25|28|32|36|40))\b/g
    ];
    var GRADE_RE = /\b(A992(?:\s?GR(?:ADE)?\.?\s?50)?|A572(?:\s?GR(?:ADE)?\.?\s?\d{2})?|A36|A500(?:\s?GR(?:ADE)?\.?\s?[BC])?|A53(?:\s?GR(?:ADE)?\.?\s?B)?|A325|A490|F3125|F1554(?:\s?GR(?:ADE)?\.?\s?\d{2,3})?|A615(?:\s?GR(?:ADE)?\.?\s?\d{2})?|A706|A123|A153|G40\.21(?:\s?\d{3}W)?|CSA\s?G30\.18|CSA\s?W59|AWS\s?D1\.[1-8]|E70XX|E49XX|\d{3}W(?:T)?|S235|S275|S355|S460)\b/gi;
    var CONNECTION_RE = /\b(BOLT|BOLTS|ANCHOR ROD|ANCHOR BOLT|WELD|FILLET|CJP|PJP|SHEAR TAB|SHEAR PLATE|BASE PLATE|CAP PLATE|STIFFENER|GUSSET|CLIP ANGLE|MOMENT CONN|HOT[- ]DIP|GALVANI[SZ]ED|PRIMER|PAINT|FIREPROOF)/i;
    var DATE_RE = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{1,2}[\s\-](?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)[A-Z]*\.?[\s\-,]+\d{2,4}|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)[A-Z]*\.?\s+\d{1,2},?\s+\d{4})\b/i;

    function normDesignation(s) {
        return String(s).toUpperCase().replace(/×/g, 'X').replace(/\s+/g, '')
            .replace(/([\d"'])X(?=\d)/g, '$1x').replace(/^(HSS|L|PL|SHS|RHS|CHS)X?/, '$1');
    }

    var LABEL_WORD_RE = /^(?:DRAWING|DWG|SHEET|REV|REVISION|SCALE|DATE|TITLE|DRAWN|CHECKED|APPROVED|DESIGNED|PROJECT|JOB|CLIENT|NO\.?)\b/i;

    // Finds the value for a title-block label: text after the label in the same
    // cell, then the next cell to the right, then the nearest cell below it.
    function labelValue(rows, labelRe, valueRe, maxLen) {
        maxLen = maxLen || 40;
        function accept(text) {
            text = String(text || '').replace(/^[\s:.#\-–]+/, '');
            if (!text || LABEL_WORD_RE.test(text)) return '';
            var v = text.match(valueRe);
            return v && v[1] && v[1].length <= maxLen ? v[1].trim() : '';
        }
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            for (var c = 0; c < row.cells.length; c++) {
                var cell = row.cells[c];
                var m = cell.text.match(labelRe);
                if (!m) continue;
                var found = accept(cell.text.slice(m.index + m[0].length));
                if (found) return found;
                var right = row.cells[c + 1];
                if (right && right.x - cell.x2 < row.h * 8 && (found = accept(right.text))) return found;
                var best = null;
                for (var j = i + 1; j < rows.length && row.y - rows[j].y <= row.h * 4; j++) {
                    rows[j].cells.forEach(function (below) {
                        if (below.x2 < cell.x - row.h * 2 || below.x > cell.x2 + row.h * 2) return;
                        var score = (row.y - rows[j].y) + Math.abs(below.x - cell.x) * 0.5;
                        if (!best || score < best.score) best = { score: score, cell: below };
                    });
                    if (best) break;
                }
                if (best && (found = accept(best.cell.text))) return found;
            }
        }
        return '';
    }

    function parsePage(page) {
        var rows = page.rows || (page.lines || []).map(function (l, i) { return { y: -i * 12, h: 10, text: l, cells: [{ x: 0, x2: l.length * 5, text: l }] }; });
        var lines = rows.map(function (r) { return r.text; });
        var text = lines.join('\n');
        var info = {
            drawingNo: labelValue(rows, /\b(?:DRAWING|DWG|SHEET)\s*(?:NO\.?|NUMBER|#)/i, /^([A-Z0-9][A-Z0-9\-_.\/]{1,30})/i),
            revision: labelValue(rows, /\bREV(?:ISION)?\.?(?:\s*NO\.?)?/i, /^([A-Z0-9]{1,3})\b/i, 3),
            scale: labelValue(rows, /\bSCALE\b/i, /^((?:[\d\/\-]+\s*"?\s*=\s*\d+'\s*-?\s*\d*"?)|(?:\d+(?:\.\d+)?\s*[:\/]\s*\d+(?:\.\d+)?)|N\.?T\.?S\.?|AS SHOWN|AS NOTED)/i),
            date: '',
            title: labelValue(rows, /\b(?:DRAWING\s+TITLE|SHEET\s+TITLE|TITLE)\b\s*:?/i, /^([A-Z0-9][^\n]{2,79})$/i, 80),
            sheetSize: sheetSize(page.widthPt, page.heightPt),
            hasText: text.replace(/\s/g, '').length > 20
        };
        var dm = labelValue(rows, /\bDATE\b/i, DATE_RE);
        info.date = dm || ((text.match(DATE_RE) || [])[1] || '');
        if (!info.drawingNo) {
            var sheet = text.match(/\b([A-Z]{1,3}-\d{2,4}(?:\.\d{1,2})?|[SEAMP]\d{3}(?:\.\d{1,2})?)\b/);
            if (sheet) info.drawingNo = sheet[1];
        }

        var members = [];
        MEMBER_PATTERNS.forEach(function (p) {
            p.re.lastIndex = 0;
            var m;
            while ((m = p.re.exec(text))) {
                var raw = m[0];
                if (p.family === 'Channel (C/MC)' && /^C\d{1,3}x\d{1,2}$/i.test(raw) && +m[2] > 15) continue;
                var weight = p.wt ? parseFloat(m[p.wt]) : null;
                var metric = /UB|UC|PFC|UBP|WB|WC/i.test(raw) || (p.family === 'Wide flange (W)' && +m[2] >= 100);
                members.push({ designation: normDesignation(raw), family: p.family, weight: weight, unit: weight == null ? '' : (metric ? 'kg/m' : 'lb/ft') });
            }
        });
        var rebar = [];
        REBAR_PATTERNS.forEach(function (re) {
            re.lastIndex = 0;
            var m;
            while ((m = re.exec(text))) rebar.push(m[1].toUpperCase());
        });
        var grades = [];
        GRADE_RE.lastIndex = 0;
        var g;
        while ((g = GRADE_RE.exec(text))) grades.push(g[1].toUpperCase().replace(/\s+/g, ' ').replace(/GRADE/, 'GR'));

        var connections = [];
        var notes = [];
        var notesX = null, lastY = null, lastH = 10;
        rows.forEach(function (row) {
            row.cells.forEach(function (cell) {
                if (CONNECTION_RE.test(cell.text) && cell.text.length >= 8 && cell.text.length <= 180) connections.push(cell.text);
            });
            var heading = row.cells.filter(function (c) { return /^(?:GENERAL\s+|STRUCTURAL\s+|STEEL\s+|CONCRETE\s+)?NOTES?\s*:?$/i.test(c.text); })[0];
            if (heading) { notesX = heading.x; lastY = row.y; lastH = row.h; return; }
            if (notesX === null) return;
            if (lastY - row.y > Math.max(row.h, lastH) * 3) { notesX = null; return; }
            var cell = row.cells.filter(function (c) { return Math.abs(c.x - notesX) <= Math.max(40, row.h * 4); })[0];
            if (!cell) return;
            if (/^\d{1,2}[.)]\s+\S/.test(cell.text) || /^[-•]\s+\S/.test(cell.text)) notes.push(cell.text);
            else if (notes.length) notes[notes.length - 1] += ' ' + cell.text;
            else return;
            lastY = row.y;
            lastH = row.h;
        });
        return { info: info, members: members, rebar: rebar, grades: grades, connections: connections, notes: notes };
    }

    function analyse(results) {
        var register = [], memberMap = {}, rebarMap = {}, gradeMap = {}, connSet = {}, notes = [], noteSet = {}, warnings = [];
        var pageCount = 0, textPages = 0;
        results.forEach(function (doc) {
            if (doc.error) { warnings.push(doc.name + ': ' + doc.error); return; }
            if (doc.truncated) warnings.push(doc.name + ': only the first ' + MAX_PAGES_PER_FILE + ' of ' + doc.totalPages + ' pages were analysed.');
            var scanned = 0;
            doc.pages.forEach(function (page) {
                pageCount++;
                var p = page.parsed || (page.parsed = parsePage(page));
                if (p.info.hasText) textPages++; else scanned++;
                var ref = p.info.drawingNo || (doc.name.replace(/\.pdf$/i, '') + ' p.' + page.number);
                register.push({ file: doc.name, page: page.number, ref: ref, info: p.info, callouts: p.members.length });
                p.members.forEach(function (m) {
                    var e = memberMap[m.designation] || (memberMap[m.designation] = { designation: m.designation, family: m.family, weight: m.weight, unit: m.unit, count: 0, sheets: {} });
                    e.count++;
                    e.sheets[ref] = 1;
                });
                p.rebar.forEach(function (r) {
                    var e = rebarMap[r] || (rebarMap[r] = { size: r, count: 0, sheets: {} });
                    e.count++;
                    e.sheets[ref] = 1;
                });
                p.grades.forEach(function (gr) { gradeMap[gr] = (gradeMap[gr] || 0) + 1; });
                p.connections.forEach(function (c) { var k = c.toUpperCase(); if (!connSet[k]) connSet[k] = { text: c, ref: ref }; });
                p.notes.forEach(function (n) { var k = n.toUpperCase(); if (!noteSet[k]) { noteSet[k] = 1; notes.push({ text: n, ref: ref }); } });
            });
            if (scanned) warnings.push(doc.name + ': ' + scanned + ' page(s) have no selectable text (likely scanned). OCR is needed to read them.');
        });
        var members = Object.keys(memberMap).map(function (k) { return memberMap[k]; })
            .sort(function (a, b) { return a.family.localeCompare(b.family) || (b.count - a.count) || a.designation.localeCompare(b.designation, undefined, { numeric: true }); });
        var rebar = Object.keys(rebarMap).map(function (k) { return rebarMap[k]; }).sort(function (a, b) { return b.count - a.count; });
        var grades = Object.keys(gradeMap).map(function (k) { return { grade: k, count: gradeMap[k] }; }).sort(function (a, b) { return b.count - a.count; });
        var connections = Object.keys(connSet).map(function (k) { return connSet[k]; });
        var families = {};
        members.forEach(function (m) { families[m.family] = (families[m.family] || 0) + m.count; });
        return {
            files: results.length, pages: pageCount, textPages: textPages, register: register, members: members, families: families,
            calloutTotal: members.reduce(function (n, m) { return n + m.count; }, 0),
            drawingsIdentified: register.filter(function (r) { return r.info.drawingNo; }).length,
            rebar: rebar, grades: grades, connections: connections.slice(0, 60), notes: notes.slice(0, 60), warnings: warnings
        };
    }

    // ---------- rendering helpers ----------
    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function sheetsList(obj) {
        var k = Object.keys(obj);
        return k.slice(0, 6).join(', ') + (k.length > 6 ? ' +' + (k.length - 6) + ' more' : '');
    }
    function csvCell(v) {
        var s = String(v == null ? '' : v);
        if (/^[=+\-@]/.test(s)) s = "'" + s;
        return '"' + s.replace(/"/g, '""') + '"';
    }

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
.erg textarea{resize:vertical}.erg input:focus-visible,.erg select:focus-visible,.erg textarea:focus-visible,.erg button:focus-visible,.erg summary:focus-visible{outline:3px solid #0891b2;outline-offset:3px}
.erg-drop{border:2px dashed #80b7c7;background:#f1fafc;border-radius:12px;padding:25px;text-align:center}
.erg-drop.is-dragging{background:#d8f3f8;border-color:#0e7490}.erg-drop strong{display:block;margin-bottom:8px}
.erg input[type=file]{display:block;max-width:100%;margin:15px auto;color:#334e63;font:inherit;font-size:13px}
.erg input::file-selector-button{border:1px solid #0e7490;border-radius:8px;background:#0e7490;color:#fff;padding:10px 14px;margin-right:10px;cursor:pointer}
.erg-files{list-style:none;padding:0;margin:16px 0 0}.erg-files li{display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid #e4ebf0}
.erg-file-info{min-width:0;flex:1}.erg-file-info strong{display:block;overflow-wrap:anywhere;font-size:13px}.erg-file-info small{color:#52677b}
.erg-badge{display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;background:#e4ebf0;color:#3b5266;margin-left:6px}
.erg-badge.ok{background:#dcf5e7;color:#16643b}.erg-badge.run{background:#dff3f8;color:#0b5f75}.erg-badge.err{background:#fde6e1;color:#9f2f1b}
.erg button{font:inherit;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #bdcdda;border-radius:9px;background:#fff;color:#254258;padding:10px 14px}
.erg button.erg-primary{background:#0e7490;border-color:#0e7490;color:#fff}
.erg button:disabled{cursor:not-allowed;background:#e4ebf0;border-color:#d5dfe7;color:#596b7b}
.erg-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.erg-status{font-size:13px;color:#9f2f1b;white-space:pre-line;line-height:1.6;margin-top:12px}
.erg-note{padding:14px;border-radius:10px;background:#eef7fa;color:#1f5566;font-size:13px;line-height:1.6}
.erg-summary{display:grid;grid-template-columns:1fr auto;gap:12px;font-size:14px;margin:20px 0}.erg-summary dd{margin:0;font-weight:700}
.erg-outline{padding-left:20px;color:#52677b;font-size:14px;line-height:2}
.erg-progress{height:8px;border-radius:999px;background:#e4ebf0;overflow:hidden;margin-top:12px}.erg-progress span{display:block;height:100%;width:0;background:linear-gradient(90deg,#0e7490,#22b8cf);transition:width .2s}
.erg-results{margin-top:6px}
.erg-rhead{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start;padding:24px;border-radius:16px;background:#fff;border:1px solid #dce5ed;border-top:5px solid #0e7490;margin-bottom:18px}
.erg-rhead h3{font-size:20px;margin:4px 0}.erg-meta{font-size:13px;color:#52677b;line-height:1.7}
.erg-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:18px}
.erg-kpi{background:#fff;border:1px solid #dce5ed;border-radius:14px;padding:16px}.erg-kpi b{display:block;font-size:26px;color:#0e5b70;line-height:1.2}.erg-kpi span{font-size:12px;color:#52677b;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.erg-table-wrap{overflow-x:auto;border:1px solid #e4ebf0;border-radius:10px}
.erg table{width:100%;border-collapse:collapse;font-size:13px}.erg th{background:#f3f7fa;text-align:left;font-weight:700;color:#2a4458;padding:10px 12px;border-bottom:1px solid #dce5ed;white-space:nowrap}
.erg td{padding:9px 12px;border-bottom:1px solid #eef2f5;vertical-align:top}.erg tr:last-child td{border-bottom:0}.erg td.num{text-align:right;font-variant-numeric:tabular-nums}
.erg td.mono,.erg .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.erg-muted{color:#8193a3}
.erg-bars{display:grid;gap:8px;margin-top:6px}.erg-bar{display:grid;grid-template-columns:minmax(120px,220px) 1fr 44px;gap:10px;align-items:center;font-size:13px}.erg-bar i{display:block;height:10px;border-radius:999px;background:#22b8cf}.erg-bar em{font-style:normal;text-align:right;font-weight:700}
.erg-chips{display:flex;flex-wrap:wrap;gap:8px}.erg-chip{padding:6px 10px;border-radius:999px;background:#eef4f8;border:1px solid #d6e2ea;font-size:12px;font-weight:600}.erg-chip small{color:#52677b;font-weight:500;margin-left:4px}
.erg-list{margin:0;padding-left:18px;font-size:13px;line-height:1.7}.erg-list li{margin-bottom:4px}.erg-list small{color:#6a7f91}
.erg-warn{padding:14px;border-radius:10px;background:#fff8e8;color:#78551b;font-size:13px;line-height:1.6;margin-bottom:18px}
.erg-two{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.erg details{border:1px solid #e4ebf0;border-radius:10px;margin-bottom:10px}.erg summary{cursor:pointer;padding:12px 14px;font-weight:600;font-size:13px}
.erg pre{margin:0;padding:14px;background:#f7fafc;border-top:1px solid #e4ebf0;font-size:12px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto}
.erg-filter{max-width:320px;margin-bottom:12px}
.erg [hidden]{display:none!important}
@media(max-width:800px){.erg-layout,.erg-two{grid-template-columns:1fr}.erg-hero,.erg-card,.erg-rhead{padding:20px}}
@media(max-width:480px){.erg-fields{grid-template-columns:1fr}.erg-wide{grid-column:auto}.erg-drop{padding:16px}.erg-bar{grid-template-columns:100px 1fr 36px}}
</style>
<header class="erg-hero">
    <span class="erg-eyebrow">Engineering / Estimation</span>
    <h2 id="ergTitle" tabindex="-1">Estimation Report Generation</h2>
    <p>Upload drawing PDFs to extract the drawing register, member sizes, rebar, material grades and notes automatically.</p>
</header>
<div class="erg-layout">
<form id="ergForm">
    <div class="erg-card">
        <h3>1. Report details</h3>
        <p class="erg-sub">These details appear on the extraction report header.</p>
        <div class="erg-fields">
            <div class="erg-field"><label for="ergProject">Project name</label><input id="ergProject" maxlength="160" placeholder="Enter project name"></div>
            <div class="erg-field"><label for="ergClient">Client name</label><input id="ergClient" maxlength="160" placeholder="Enter client name"></div>
            <div class="erg-field"><label for="ergReference">Report reference</label><input id="ergReference" maxlength="80" placeholder="e.g. EST-2026-001"></div>
            <div class="erg-field"><label for="ergDiscipline">Estimation discipline</label><select id="ergDiscipline"><option value="">Select discipline</option><option>Structural Steel</option><option>Rebar</option><option>Process Piping</option><option>Other</option></select></div>
            <div class="erg-field"><label for="ergUnits">Measurement units</label><select id="ergUnits"><option>Metric</option><option>Imperial</option></select></div>
            <div class="erg-field"><label for="ergCurrency">Currency</label><select id="ergCurrency"><option>CAD</option><option>USD</option><option>AUD</option><option>GBP</option><option>INR</option><option>EUR</option></select></div>
            <div class="erg-field erg-wide"><label for="ergScope">Scope and instructions</label><textarea id="ergScope" rows="3" maxlength="2000" placeholder="Describe the scope, drawing revisions, inclusions and exclusions"></textarea></div>
        </div>
    </div>
    <div class="erg-card">
        <h3>2. PDF drawings</h3>
        <p class="erg-sub">Choose multiple PDFs or drag them into the area below. Extraction starts automatically.</p>
        <div id="ergDrop" class="erg-drop">
            <strong>Drop PDF files here</strong>
            <label for="ergFiles">Or browse your device</label>
            <input id="ergFiles" type="file" multiple accept=".pdf,application/pdf" aria-describedby="ergLimits ergLocal">
            <div id="ergLimits" class="erg-sub">Up to 10 PDFs · 25 MB per file · 100 MB total</div>
        </div>
        <div id="ergStatus" class="erg-status" role="status" aria-live="polite"></div>
        <div id="ergProgressWrap" hidden><div class="erg-progress" role="progressbar" aria-label="Extraction progress" aria-valuemin="0" aria-valuemax="100"><span id="ergProgressBar"></span></div><p id="ergProgressText" class="erg-sub" style="margin:8px 0 0"></p></div>
        <ul id="ergFileList" class="erg-files" aria-label="Selected PDFs"></ul>
        <p id="ergEmpty" class="erg-sub">No PDFs selected yet.</p>
        <div class="erg-actions"><button id="ergClearFiles" type="button" disabled>Remove all files</button></div>
    </div>
    <div class="erg-actions">
        <button id="ergReviewButton" class="erg-primary" type="submit" disabled>Re-run extraction</button>
        <button id="ergReset" type="button">Reset form</button>
    </div>
</form>
<aside class="erg-card" aria-labelledby="ergSummaryTitle">
    <h3 id="ergSummaryTitle">Report workspace</h3>
    <div id="ergLocal" class="erg-note">PDFs are read in your browser; if the browser PDF engine is unavailable they are processed in memory by the EB server. Nothing is saved, and leaving this screen clears the results.</div>
    <dl class="erg-summary"><dt>Selected PDFs</dt><dd id="ergCount">0</dd><dt>Total size</dt><dd id="ergSize">0 MB</dd><dt>Pages analysed</dt><dd id="ergPages">0</dd></dl>
    <h3>Extracted report sections</h3>
    <ol class="erg-outline"><li>Drawing register (no., title, rev, scale, date)</li><li>Member size schedule</li><li>Reinforcement &amp; material grades</li><li>Connections, notes &amp; page text</li></ol>
    <p class="erg-sub">Figures are extracted from PDF text and should be verified against the drawings before pricing.</p>
</aside>
</div>
<div id="ergResults" class="erg-results" hidden tabindex="-1" aria-live="polite"></div>
</section>`;
        var root = main.querySelector('.erg');
        var form = root.querySelector('#ergForm');
        var input = root.querySelector('#ergFiles');
        var drop = root.querySelector('#ergDrop');
        var status = root.querySelector('#ergStatus');
        var files = [];
        var cache = new Map();     // File -> extraction result
        var lastReport = null;
        var alive = true;
        var epoch = 0;
        var pending = false;
        var extracting = false;
        var runId = 0;
        var observer;
        function el(id) { return root.querySelector('#' + id); }
        function active() { return alive && root.isConnected && canSee(); }
        function size(bytes) { return (bytes / 1048576).toFixed(2) + ' MB'; }
        function total() { return files.reduce(function (n, f) { return n + f.size; }, 0); }
        function update() {
            el('ergCount').textContent = String(files.length);
            el('ergSize').textContent = size(total());
            el('ergPages').textContent = String(lastReport ? lastReport.pages : 0);
            el('ergEmpty').hidden = files.length > 0;
            el('ergClearFiles').disabled = !files.length && !pending;
            el('ergReviewButton').disabled = pending || extracting || !files.length;
        }
        function fileBadge(file) {
            var r = cache.get(file);
            if (!r) return extracting ? '<span class="erg-badge run">Queued</span>' : '<span class="erg-badge">Pending</span>';
            if (r.running) return '<span class="erg-badge run">Extracting…</span>';
            if (r.error) return '<span class="erg-badge err">Failed</span>';
            return '<span class="erg-badge ok">' + r.pages.length + ' page' + (r.pages.length === 1 ? '' : 's') + ' extracted</span>';
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
                detail.innerHTML = esc(size(file.size)) + ' ' + fileBadge(file);
                info.append(name, detail);
                var remove = document.createElement('button');
                remove.type = 'button';
                remove.textContent = 'Remove';
                remove.disabled = extracting;
                remove.setAttribute('aria-label', 'Remove ' + file.name);
                remove.onclick = function () {
                    if (!active() || extracting) return;
                    files = files.filter(function (f) { return f !== file; });
                    cache.delete(file);
                    renderFiles();
                    status.textContent = 'File removed.';
                    runExtraction();
                    input.focus();
                };
                row.append(info, remove);
                list.appendChild(row);
            });
            update();
        }
        function setProgress(pct, text) {
            el('ergProgressWrap').hidden = pct == null;
            if (pct == null) return;
            el('ergProgressBar').style.width = Math.max(0, Math.min(100, pct)) + '%';
            el('ergProgressBar').parentNode.setAttribute('aria-valuenow', String(Math.round(pct)));
            el('ergProgressText').textContent = text || '';
        }

        async function runExtraction(force) {
            if (!active()) return;
            var myRun = ++runId;
            var token = epoch;
            if (force) cache.clear();
            if (!files.length) { lastReport = null; renderResults(); update(); return; }
            var todo = files.filter(function (f) { return !cache.has(f) || cache.get(f).error; });
            if (!todo.length) { lastReport = analyse(files.map(function (f) { return cache.get(f); })); renderResults(); update(); return; }
            extracting = true;
            renderFiles();
            status.style.color = '#1f5566';
            status.textContent = 'Loading PDF engine…';
            setProgress(2, 'Preparing…');
            function stale() { return !active() || token !== epoch || myRun !== runId; }
            try {
                var lib = await loadPdfJs().catch(function (err) {
                    console.warn('[estimation-report] Browser PDF engine unavailable, using server extraction:', err && err.message);
                    return null;
                });
                if (stale()) return;
                if (!lib) status.textContent = 'Browser PDF engine unavailable. Extracting on the server…';
                for (var i = 0; i < todo.length; i++) {
                    if (stale()) return;
                    var file = todo[i];
                    cache.set(file, { name: file.name, running: true, pages: [] });
                    renderFiles();
                    status.textContent = 'Extracting ' + file.name + '…';
                    try {
                        var res = await (lib ? extractFile.bind(null, lib) : extractFileOnServer)(file, function (pg, count) {
                            if (stale()) return;
                            var pct = ((i + pg / count) / todo.length) * 100;
                            setProgress(pct, 'File ' + (i + 1) + ' of ' + todo.length + ' · page ' + pg + ' of ' + count);
                        }, stale);
                        if (stale()) { cache.delete(file); return; }
                        cache.set(file, res);
                    } catch (err) {
                        if (stale()) { cache.delete(file); return; }
                        var msg = err && err.name === 'PasswordException' ? 'PDF is password protected.' : ((err && err.message) || 'Could not read this PDF.');
                        cache.set(file, { name: file.name, error: msg, pages: [] });
                    }
                }
                if (stale()) return;
                lastReport = analyse(files.map(function (f) { return cache.get(f); }));
                setProgress(null);
                status.textContent = 'Extraction complete: ' + lastReport.pages + ' page(s) from ' + files.length + ' PDF(s).';
                renderResults(true);
            } catch (err) {
                if (stale()) return;
                setProgress(null);
                status.style.color = '';
                status.textContent = (err && err.message) || 'Extraction failed.';
                todo.forEach(function (f) { var r = cache.get(f); if (r && r.running) cache.delete(f); });
            } finally {
                if (myRun === runId) {
                    extracting = false;
                    if (alive) renderFiles();
                }
            }
        }

        function projectHeader() {
            return {
                project: el('ergProject').value.trim(),
                client: el('ergClient').value.trim(),
                reference: el('ergReference').value.trim(),
                discipline: el('ergDiscipline').value,
                units: el('ergUnits').value,
                currency: el('ergCurrency').value,
                scope: el('ergScope').value.trim()
            };
        }

        function reportHtml(r, h) {
            var now = new Date().toLocaleString();
            var familyMax = Math.max.apply(null, [1].concat(Object.keys(r.families).map(function (k) { return r.families[k]; })));
            var out = '';
            out += '<div class="erg-rhead"><div><span class="erg-eyebrow" style="color:#0e7490">Extraction report</span>' +
                '<h3>' + esc(h.project || 'Untitled project') + '</h3>' +
                '<div class="erg-meta">' + [
                    h.client ? 'Client: <b>' + esc(h.client) + '</b>' : '',
                    h.reference ? 'Ref: <b>' + esc(h.reference) + '</b>' : '',
                    h.discipline ? 'Discipline: <b>' + esc(h.discipline) + '</b>' : '',
                    'Units: <b>' + esc(h.units) + '</b> · Currency: <b>' + esc(h.currency) + '</b>'
                ].filter(Boolean).join(' &nbsp;·&nbsp; ') + '<br>Generated ' + esc(now) + (h.scope ? '<br>Scope: ' + esc(h.scope) : '') + '</div></div>' +
                '<div class="erg-actions erg-noprint" style="margin-top:0"><button type="button" data-act="csv">Export CSV</button><button type="button" data-act="print" class="erg-primary">Print / Save PDF</button></div></div>';

            out += '<div class="erg-kpis">' + [
                [r.files, 'PDF files'], [r.pages, 'Pages analysed'], [r.drawingsIdentified, 'Drawing nos. found'],
                [r.members.length, 'Unique member sizes'], [r.calloutTotal, 'Member callouts'], [r.rebar.length, 'Rebar sizes'], [r.grades.length, 'Material grades']
            ].map(function (k) { return '<div class="erg-kpi"><b>' + esc(k[0]) + '</b><span>' + esc(k[1]) + '</span></div>'; }).join('') + '</div>';

            if (r.warnings.length) out += '<div class="erg-warn" role="note"><b>Attention</b><ul class="erg-list">' + r.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>';

            out += '<div class="erg-card"><h3>Drawing register</h3><p class="erg-sub">Title-block details detected on each page. Blank cells were not found in the PDF text.</p><div class="erg-table-wrap"><table><thead><tr><th>#</th><th>Drawing no.</th><th>Title</th><th>Rev</th><th>Scale</th><th>Date</th><th>Sheet</th><th>Member callouts</th><th>Source</th></tr></thead><tbody>' +
                (r.register.length ? r.register.map(function (row, i) {
                    var d = row.info;
                    return '<tr><td class="num">' + (i + 1) + '</td><td class="mono"><b>' + (d.drawingNo ? esc(d.drawingNo) : '<span class="erg-muted">—</span>') + '</b></td><td>' + (esc(d.title) || '<span class="erg-muted">—</span>') +
                        (d.hasText ? '' : ' <span class="erg-badge err">No text</span>') + '</td><td>' + (esc(d.revision) || '<span class="erg-muted">—</span>') + '</td><td>' + (esc(d.scale) || '<span class="erg-muted">—</span>') +
                        '</td><td>' + (esc(d.date) || '<span class="erg-muted">—</span>') + '</td><td>' + esc(d.sheetSize) + '</td><td class="num">' + row.callouts + '</td><td><small>' + esc(row.file) + ' · p.' + row.page + '</small></td></tr>';
                }).join('') : '<tr><td colspan="9" class="erg-muted">No pages could be read.</td></tr>') + '</tbody></table></div></div>';

            out += '<div class="erg-card"><h3>Member size schedule</h3><p class="erg-sub">Steel section designations found in the drawings. Callouts count every occurrence of the size in the PDF text (plans, elevations and schedules), not the number of pieces.</p>';
            if (r.members.length) {
                out += '<div class="erg-bars" style="margin-bottom:18px">' + Object.keys(r.families).sort(function (a, b) { return r.families[b] - r.families[a]; }).map(function (f) {
                    return '<div class="erg-bar"><span>' + esc(f) + '</span><i style="width:' + Math.max(3, r.families[f] / familyMax * 100) + '%"></i><em>' + r.families[f] + '</em></div>';
                }).join('') + '</div>';
                out += '<input class="erg-filter" type="search" data-filter="members" placeholder="Filter sizes…" aria-label="Filter member sizes">';
                out += '<div class="erg-table-wrap"><table data-table="members"><thead><tr><th>Designation</th><th>Section type</th><th>Nominal weight</th><th>Callouts</th><th>Found on</th></tr></thead><tbody>' +
                    r.members.map(function (m) {
                        return '<tr><td class="mono"><b>' + esc(m.designation) + '</b></td><td>' + esc(m.family) + '</td><td class="num">' + (m.weight != null ? esc(m.weight + ' ' + m.unit) : '<span class="erg-muted">—</span>') +
                            '</td><td class="num">' + m.count + '</td><td><small>' + esc(sheetsList(m.sheets)) + '</small></td></tr>';
                    }).join('') + '</tbody></table></div>';
            } else out += '<p class="erg-muted">No steel member designations were detected.</p>';
            out += '</div>';

            out += '<div class="erg-two"><div class="erg-card"><h3>Reinforcement</h3>' + (r.rebar.length ?
                '<div class="erg-table-wrap"><table><thead><tr><th>Bar size</th><th>Callouts</th><th>Found on</th></tr></thead><tbody>' + r.rebar.map(function (b) {
                    return '<tr><td class="mono"><b>' + esc(b.size) + '</b></td><td class="num">' + b.count + '</td><td><small>' + esc(sheetsList(b.sheets)) + '</small></td></tr>';
                }).join('') + '</tbody></table></div>' : '<p class="erg-muted">No rebar sizes were detected.</p>') + '</div>';
            out += '<div class="erg-card"><h3>Material grades &amp; standards</h3>' + (r.grades.length ?
                '<div class="erg-chips">' + r.grades.map(function (g) { return '<span class="erg-chip">' + esc(g.grade) + '<small>×' + g.count + '</small></span>'; }).join('') + '</div>' :
                '<p class="erg-muted">No material grades were detected.</p>') + '</div></div>';

            out += '<div class="erg-two"><div class="erg-card"><h3>Connections, finishes &amp; fabrication</h3>' + (r.connections.length ?
                '<ul class="erg-list">' + r.connections.map(function (c) { return '<li>' + esc(c.text) + ' <small>(' + esc(c.ref) + ')</small></li>'; }).join('') + '</ul>' :
                '<p class="erg-muted">No bolt, weld or finish references were detected.</p>') + '</div>';
            out += '<div class="erg-card"><h3>Drawing notes</h3>' + (r.notes.length ?
                '<ol class="erg-list">' + r.notes.map(function (n) { return '<li>' + esc(n.text.replace(/^\d{1,2}[.)]\s+|^[-•]\s+/, '')) + ' <small>(' + esc(n.ref) + ')</small></li>'; }).join('') + '</ol>' :
                '<p class="erg-muted">No numbered notes were detected under a NOTES heading.</p>') + '</div></div>';

            out += '<div class="erg-card erg-noprint"><h3>Extracted page text</h3><p class="erg-sub">Raw text read from each page, for checking and copying.</p>';
            files.forEach(function (f) {
                var doc = cache.get(f);
                if (!doc || doc.error) return;
                doc.pages.forEach(function (p) {
                    var ref = (p.parsed && p.parsed.info.drawingNo) || ('Page ' + p.number);
                    out += '<details><summary>' + esc(doc.name) + ' · p.' + p.number + ' · ' + esc(ref) + ' <span class="erg-muted">(' + p.lines.length + ' lines)</span></summary><pre>' + (esc(p.text) || '<span class="erg-muted">No selectable text on this page.</span>') + '</pre></details>';
                });
            });
            out += '</div>';
            return out;
        }

        function renderResults(focus) {
            var box = el('ergResults');
            if (!lastReport) { box.hidden = true; box.innerHTML = ''; return; }
            box.innerHTML = reportHtml(lastReport, projectHeader());
            box.hidden = false;
            if (focus) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function exportCsv() {
            if (!lastReport) return;
            var h = projectHeader();
            var rows = [['Estimation extraction report'], ['Project', h.project], ['Client', h.client], ['Reference', h.reference], ['Discipline', h.discipline], [],
                ['DRAWING REGISTER'], ['File', 'Page', 'Drawing no.', 'Title', 'Revision', 'Scale', 'Date', 'Sheet size', 'Member callouts']];
            lastReport.register.forEach(function (r) { rows.push([r.file, r.page, r.info.drawingNo, r.info.title, r.info.revision, r.info.scale, r.info.date, r.info.sheetSize, r.callouts]); });
            rows.push([], ['MEMBER SIZE SCHEDULE'], ['Designation', 'Section type', 'Nominal weight', 'Unit', 'Callouts', 'Found on']);
            lastReport.members.forEach(function (m) { rows.push([m.designation, m.family, m.weight, m.unit, m.count, Object.keys(m.sheets).join('; ')]); });
            rows.push([], ['REINFORCEMENT'], ['Bar size', 'Callouts', 'Found on']);
            lastReport.rebar.forEach(function (b) { rows.push([b.size, b.count, Object.keys(b.sheets).join('; ')]); });
            rows.push([], ['MATERIAL GRADES'], ['Grade', 'Mentions']);
            lastReport.grades.forEach(function (g) { rows.push([g.grade, g.count]); });
            rows.push([], ['NOTES'], ['Note', 'Drawing']);
            lastReport.notes.forEach(function (n) { rows.push([n.text, n.ref]); });
            var csv = '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n');
            var a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
            a.download = (h.reference || h.project || 'estimation').replace(/[^\w\-]+/g, '_') + '_extraction.csv';
            document.body.appendChild(a);
            a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        }

        function printReport() {
            if (!lastReport) return;
            var styles = root.querySelector('style').textContent;
            var w = window.open('', '_blank');
            if (!w) { alert('Please allow pop-ups to print the report.'); return; }
            w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(projectHeader().project || 'Estimation extraction report') +
                '</title><style>' + styles + ' body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:24px;background:#fff} .erg-noprint{display:none!important} .erg-card,.erg-kpi,.erg-rhead{break-inside:avoid} .erg-table-wrap{overflow:visible} tr{break-inside:avoid}</style></head><body><div class="erg">' +
                reportHtml(lastReport, projectHeader()) + '</div></body></html>');
            w.document.close();
            w.focus();
            setTimeout(function () { w.print(); }, 300);
        }

        el('ergResults').addEventListener('click', function (e) {
            var b = e.target.closest && e.target.closest('button[data-act]');
            if (!b || !active()) return;
            if (b.getAttribute('data-act') === 'csv') exportCsv();
            else if (b.getAttribute('data-act') === 'print') printReport();
        });
        el('ergResults').addEventListener('input', function (e) {
            if (!e.target.matches || !e.target.matches('input[data-filter]')) return;
            var q = e.target.value.trim().toLowerCase();
            var table = el('ergResults').querySelector('table[data-table="' + e.target.getAttribute('data-filter') + '"]');
            if (!table) return;
            Array.prototype.forEach.call(table.tBodies[0].rows, function (tr) { tr.hidden = !!q && tr.textContent.toLowerCase().indexOf(q) === -1; });
        });

        async function addFiles(selected) {
            if (!active()) return;
            if (pending || extracting) { status.textContent = 'Please wait until the current PDFs have been processed.'; return; }
            pending = true;
            var token = epoch;
            update();
            status.style.color = '';
            status.textContent = 'Checking selected PDFs…';
            var messages = [];
            var added = 0;
            try {
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
                status.textContent = added + ' PDF(s) added.' + (messages.length ? '\n' + messages.join('\n') : '');
            } finally {
                if (alive && token === epoch) {
                    pending = false;
                    renderFiles();
                }
            }
            if (added && active() && token === epoch) runExtraction();
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
            runId++;
            pending = false;
            extracting = false;
            files = [];
            cache.clear();
            lastReport = null;
            input.value = '';
            setProgress(null);
            renderResults();
            renderFiles();
            status.style.color = '';
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
        var headerTimer = null;
        function refreshHeader() {
            clearTimeout(headerTimer);
            headerTimer = setTimeout(function () { if (active() && lastReport) renderResults(); }, 300);
        }
        form.addEventListener('input', function () { update(); refreshHeader(); });
        form.addEventListener('change', function () { update(); refreshHeader(); });
        form.onsubmit = function (event) {
            event.preventDefault();
            if (!active() || pending || extracting || !files.length) return;
            runExtraction(true);
        };
        function cleanup() {
            alive = false;
            epoch++;
            runId++;
            files = [];
            cache.clear();
            lastReport = null;
            input.value = '';
            clearTimeout(headerTimer);
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

    // Exposed for automated checks of the parsing rules.
    window._estimationReportParser = { parsePage: parsePage, analyse: analyse, itemsToRows: itemsToRows };
})();
