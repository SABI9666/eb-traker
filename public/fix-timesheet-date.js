// public/fix-timesheet-date.js
// Fixes "date not showing in My Timesheet".
//
// Root cause: showTimesheet() in index.html references `assignedProjects`
// which is undefined in its scope (only a local const inside showTimesheetModal).
// This throws a ReferenceError before the table renders.
//
// Approach: override window.showTimesheet with a corrected version and use
// Object.defineProperty to prevent showApp() from re-installing the buggy one.

(function () {
    'use strict';

    if (window._timesheetDateFixLoaded) return;
    window._timesheetDateFixLoaded = true;

    // ── Date parser: handles all Firestore Timestamp shapes + strings + Date ──
    function parseEntryDate(dateValue) {
        if (!dateValue) return null;
        // Firestore Timestamp: { seconds, nanoseconds } or { _seconds, _nanoseconds }
        if (typeof dateValue === 'object' && !Array.isArray(dateValue)) {
            var secs = dateValue.seconds !== undefined ? dateValue.seconds
                     : dateValue._seconds !== undefined ? dateValue._seconds
                     : null;
            if (secs !== null) return new Date(Number(secs) * 1000);
            if (typeof dateValue.toDate === 'function') return dateValue.toDate();
        }
        if (typeof dateValue === 'number') return new Date(dateValue);
        if (typeof dateValue === 'string') {
            var d = new Date(dateValue);
            return isNaN(d.getTime()) ? null : d;
        }
        if (dateValue instanceof Date) return isNaN(dateValue.getTime()) ? null : dateValue;
        return null;
    }

    // ── The corrected showTimesheet implementation ────────────────────────────
    async function fixedShowTimesheet() {
        if (typeof setActiveNav === 'function') setActiveNav('nav-timesheet');
        var main = document.getElementById('mainContent');
        if (main) main.style.display = 'block';
        if (typeof showLoading === 'function') showLoading();

        try {
            var projectsResponse = await apiCall('projects?assignedToMe=true');
            var timesheetResponse = await apiCall('timesheets');

            var projects = [];
            var entries = [];

            if (projectsResponse && projectsResponse.success) {
                var rawProjects = projectsResponse.data || [];
                var uid = window.currentUser && window.currentUser.uid;
                // FIX: was `assignedProjects` (undefined) — use `projects` instead
                projects = rawProjects.filter(function (p) {
                    return (p.assignedDesigners && p.assignedDesigners.includes(uid))
                        || (p.assignedDesignerUids && p.assignedDesignerUids.includes(uid));
                });
            }

            if (timesheetResponse && timesheetResponse.success) {
                entries = timesheetResponse.data || [];
            }

            // ── Week / Month helpers ────────────────────────────────────────
            function isThisWeek(dateValue) {
                var d = parseEntryDate(dateValue);
                if (!d || isNaN(d.getTime())) return false;
                var now = new Date();
                var ws = new Date(now);
                ws.setDate(now.getDate() - now.getDay());
                ws.setHours(0, 0, 0, 0);
                return d >= ws;
            }
            function isThisMonth(dateValue) {
                var d = parseEntryDate(dateValue);
                if (!d || isNaN(d.getTime())) return false;
                var now = new Date();
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }

            var thisWeekHours = entries
                .filter(function (e) { return isThisWeek(e.date); })
                .reduce(function (s, e) { return s + parseFloat(e.hours || 0); }, 0);
            var thisMonthHours = entries
                .filter(function (e) { return isThisMonth(e.date); })
                .reduce(function (s, e) { return s + parseFloat(e.hours || 0); }, 0);

            // ── Project lookup (FIXED: `projects` not `assignedProjects`) ───
            var projectLookup = {};
            projects.forEach(function (p) { if (p.id) projectLookup[p.id] = p; });

            // ── Build entries table rows ─────────────────────────────────
            var entriesHtml;
            if (entries.length === 0) {
                entriesHtml = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-light);">'
                    + 'No timesheet entries yet. Click "Log Hours" to add your first entry.</td></tr>';
            } else {
                entriesHtml = entries.slice(0, 50).map(function (entry) {
                    var entryDate = parseEntryDate(entry.date);
                    var formattedDate = (entryDate && !isNaN(entryDate.getTime()))
                        ? entryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                        : 'N/A';
                    var proj = projectLookup[entry.projectId];
                    var projNum = entry.projectNumber || (proj && proj.projectNumber) || null;
                    var projectDisplay = projNum
                        ? '<span style="font-weight:700;color:var(--primary-blue);">' + projNum + '</span> <small style="color:#6b7280;">' + (entry.projectName || '') + '</small>'
                        : (entry.projectName || entry.projectCode || 'Unknown Project');
                    var entryDateForEdit = (entryDate && !isNaN(entryDate.getTime()))
                        ? entryDate.toISOString().split('T')[0]
                        : '';
                    var escapedDesc = (entry.description || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    var escapedProj = (entry.projectName || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    var statusBg = entry.status === 'approved' ? '#d4edda' : '#fff3cd';
                    var statusColor = entry.status === 'approved' ? '#155724' : '#856404';
                    return '<tr>'
                        + '<td>' + formattedDate + '</td>'
                        + '<td>' + projectDisplay + '</td>'
                        + '<td><strong>' + parseFloat(entry.hours || 0).toFixed(2) + 'h</strong></td>'
                        + '<td>' + (entry.description || 'No description') + '</td>'
                        + '<td><span style="padding:0.25rem 0.5rem;border-radius:4px;background:' + statusBg + ';color:' + statusColor + ';">' + (entry.status || 'Pending') + '</span></td>'
                        + '<td style="white-space:nowrap;">'
                        + '<button onclick="editTimesheetEntry(\'' + entry.id + '\',\'' + (entry.projectId || '') + '\',\'' + entryDateForEdit + '\',' + parseFloat(entry.hours || 0) + ',\'' + escapedDesc + '\',\'' + escapedProj + '\')" '
                        + 'class="btn btn-sm" style="padding:0.35rem 0.75rem;font-size:0.8rem;background:var(--accent-blue);color:white;border:none;border-radius:6px;cursor:pointer;margin-right:0.25rem;">'
                        + '&#9999;&#65039; Edit</button> '
                        + '<button onclick="deleteTimesheetEntry(\'' + entry.id + '\')" '
                        + 'class="btn btn-sm btn-danger" style="padding:0.35rem 0.75rem;font-size:0.8rem;background:var(--danger);color:white;border:none;border-radius:6px;cursor:pointer;">'
                        + '&#128465;&#65039; Delete</button>'
                        + '</td></tr>';
                }).join('');
            }

            if (!main) return;
            main.innerHTML = '<div class="page-header">'
                + '<h2>&#9201;&#65039; My Timesheet</h2>'
                + '<p class="subtitle">Track your hours on assigned projects</p>'
                + '</div>'
                + '<div class="card" style="background:white;border-radius:12px;padding:1.5rem;box-shadow:0 4px 6px rgba(0,0,0,0.1);">'
                + '<div class="card-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">'
                + '<h3 style="margin:0;">Log Hours</h3>'
                + '<button onclick="showTimesheetModal()" class="btn btn-primary"><span>+</span> Log Hours</button>'
                + '</div>'
                // Summary cards
                + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:2rem;padding:1rem;">'
                + '<div class="stat-card" style="background:white;border:2px solid var(--border);border-radius:10px;padding:1rem;text-align:center;">'
                + '<div style="font-size:0.9rem;color:var(--text-light);margin-bottom:0.5rem;">This Week</div>'
                + '<div style="font-size:2.5rem;font-weight:700;color:var(--primary-blue);">' + thisWeekHours.toFixed(1) + 'h</div></div>'
                + '<div class="stat-card" style="background:white;border:2px solid var(--border);border-radius:10px;padding:1rem;text-align:center;">'
                + '<div style="font-size:0.9rem;color:var(--text-light);margin-bottom:0.5rem;">This Month</div>'
                + '<div style="font-size:2.5rem;font-weight:700;color:var(--primary-blue);">' + thisMonthHours.toFixed(1) + 'h</div></div>'
                + '<div class="stat-card" style="background:white;border:2px solid var(--border);border-radius:10px;padding:1rem;text-align:center;">'
                + '<div style="font-size:0.9rem;color:var(--text-light);margin-bottom:0.5rem;">Active Projects</div>'
                + '<div style="font-size:2.5rem;font-weight:700;color:var(--primary-blue);">' + projects.length + '</div></div>'
                + '</div>'
                // Entries table
                + '<table class="data-table" style="width:100%;border-collapse:collapse;">'
                + '<thead><tr style="background:var(--light-blue);">'
                + '<th style="padding:1rem;text-align:left;">Date</th>'
                + '<th style="padding:1rem;text-align:left;">Project</th>'
                + '<th style="padding:1rem;text-align:left;">Hours</th>'
                + '<th style="padding:1rem;text-align:left;">Description</th>'
                + '<th style="padding:1rem;text-align:left;">Status</th>'
                + '<th style="padding:1rem;text-align:left;">Actions</th>'
                + '</tr></thead>'
                + '<tbody>' + entriesHtml + '</tbody>'
                + '</table></div>';

        } catch (error) {
            console.error('[fix-timesheet-date] showTimesheet error:', error);
            if (main) {
                main.innerHTML = '<div class="error-message" style="background:#fee;padding:2rem;border-radius:12px;text-align:center;">'
                    + '<h3>&#9888;&#65039; Error Loading Timesheet</h3>'
                    + '<p>' + error.message + '</p>'
                    + '<button onclick="showTimesheet()" class="btn btn-primary" style="margin-top:1rem;">Retry</button></div>';
            }
        } finally {
            if (typeof hideLoading === 'function') hideLoading();
        }
    }

    // ── Install: use defineProperty so showApp() cannot overwrite the fix ───
    function install() {
        try {
            // Attempt to use defineProperty to lock the fixed version in place.
            // configurable:true still lets us re-define if needed, but showApp()'s
            // simple `window.showTimesheet = function(){}` assignment will be
            // intercepted by our setter and discarded.
            var _fn = fixedShowTimesheet;
            Object.defineProperty(window, 'showTimesheet', {
                get: function () { return _fn; },
                set: function () { /* ignore reassignment from showApp */ },
                configurable: true,
                enumerable: true
            });
            console.log('[fix-timesheet-date] showTimesheet patched (defineProperty)');
        } catch (e) {
            // Fallback: direct assignment (may be overwritten by showApp, but better than nothing)
            window.showTimesheet = fixedShowTimesheet;
            console.log('[fix-timesheet-date] showTimesheet patched (direct assign)');
        }
    }

    // Install immediately and re-check after DOM ready
    install();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install);
    }
    // Re-apply after typical app init delay (in case showApp redefined it)
    setTimeout(install, 1000);
    setTimeout(install, 3000);

    console.log('[fix-timesheet-date] patch loaded');
})();
