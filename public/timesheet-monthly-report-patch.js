// public/timesheet-monthly-report-patch.js
// Improvements to the Designer Monthly Hours Report download:
//   1) Lets the user download for a single month (or all months).
//   2) Adds a "Project Details" sheet showing project number + name per designer.
//
// "Project Number" is the value entered by the COO during project allocation
// (stored as projects.projectNumber on the project document). It falls back to
// the older projectCode (quotation number) only when a projectNumber has not
// yet been assigned.

(function () {
    'use strict';

    if (window._monthlyReportPatchLoaded) return;
    window._monthlyReportPatchLoaded = true;

    function showMonthSelectionModal(monthlyTotals) {
        var existing = document.getElementById('monthSelectModalOverlay');
        if (existing) existing.remove();

        var options = (monthlyTotals || [])
            .slice()
            .sort(function (a, b) { return new Date(b.month) - new Date(a.month); })
            .map(function (m) { return '<option value="' + m.month + '">' + m.monthLabel + '</option>'; })
            .join('');

        var modalHTML = ''
            + '<div class="modal-overlay" id="monthSelectModalOverlay" '
            +       'style="display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; '
            +              'background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;" '
            +       'onclick="if(event.target.id === \'monthSelectModalOverlay\') { this.remove(); }">'
            +   '<div style="background: white; border-radius: 12px; padding: 2rem; min-width: 420px; '
            +               'max-width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.2);" '
            +         'onclick="event.stopPropagation()">'
            +     '<h3 style="margin: 0 0 0.5rem 0; color: #111827;">Download Monthly Report</h3>'
            +     '<p style="color: #6b7280; margin-bottom: 1.25rem; font-size: 0.9rem;">'
            +       'Select a single month or download all months. The report includes a '
            +       'per-project breakdown with project number and project name.'
            +     '</p>'
            +     '<label style="display: block; font-weight: 600; margin-bottom: 0.5rem; color: #374151;">Month</label>'
            +     '<select id="monthReportSelect" style="width: 100%; padding: 0.75rem; border: 1px solid #d1d5db; '
            +            'border-radius: 8px; font-size: 1rem; margin-bottom: 1.5rem; background: white;">'
            +       '<option value="ALL">All Months</option>'
            +       options
            +     '</select>'
            +     '<div style="display: flex; gap: 0.75rem; justify-content: flex-end;">'
            +       '<button type="button" class="btn btn-secondary" '
            +               'onclick="document.getElementById(\'monthSelectModalOverlay\').remove();">Cancel</button>'
            +       '<button type="button" class="btn btn-primary" '
            +               'onclick="generateDesignerMonthlyExcel(document.getElementById(\'monthReportSelect\').value); '
            +                        'document.getElementById(\'monthSelectModalOverlay\').remove();">Download</button>'
            +     '</div>'
            +   '</div>'
            + '</div>';

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    async function patchedDownloadDesignerMonthlyExcel() {
        try {
            if (typeof showLoading === 'function') showLoading();
            var response = await apiCall('timesheets?action=designer_weekly_report');
            if (typeof hideLoading === 'function') hideLoading();
            if (!response || !response.success) throw new Error((response && response.error) || 'Failed to fetch data');

            var data = response.data || {};
            var designers = data.designers || [];
            var monthlyTotals = data.monthlyTotals || [];
            var projectReport = data.projectReport || [];

            if (!monthlyTotals.length) {
                alert('No monthly data available to download.');
                return;
            }

            window._monthlyReportData = { designers: designers, monthlyTotals: monthlyTotals, projectReport: projectReport };
            showMonthSelectionModal(monthlyTotals);
        } catch (error) {
            if (typeof hideLoading === 'function') hideLoading();
            alert('Error: ' + error.message);
        }
    }

    function generateDesignerMonthlyExcel(selectedMonth) {
        try {
            if (typeof XLSX === 'undefined') {
                alert('Excel library not loaded. Please refresh the page.');
                return;
            }
            var cached = window._monthlyReportData;
            if (!cached) {
                alert('Report data unavailable. Please reload the dashboard and try again.');
                return;
            }
            var designers = cached.designers || [];
            var monthlyTotals = cached.monthlyTotals || [];
            var projectReport = cached.projectReport || [];

            var isAllMonths = !selectedMonth || selectedMonth === 'ALL';
            var monthsToInclude = isAllMonths
                ? monthlyTotals
                : monthlyTotals.filter(function (m) { return m.month === selectedMonth; });

            if (!monthsToInclude.length) {
                alert('No data for the selected month.');
                return;
            }

            var monthLabel = isAllMonths ? 'All Months' : monthsToInclude[0].monthLabel;
            var wb = XLSX.utils.book_new();

            // ---- Sheet 1: Summary (Designer x Month) ----
            var title = isAllMonths
                ? 'Designer Monthly Hours Report'
                : 'Designer Hours Report - ' + monthLabel;

            var summaryHeader = ['Designer'];
            monthsToInclude.forEach(function (m) { summaryHeader.push(m.monthLabel); });
            summaryHeader.push('Total');

            var summaryData = [
                [title],
                ['Generated: ' + new Date().toLocaleString()],
                [''],
                summaryHeader
            ];

            designers.forEach(function (d) {
                var row = [d.name];
                var rowTotal = 0;
                monthsToInclude.forEach(function (m) {
                    var h = (d.monthlyHours && d.monthlyHours[m.month]) || 0;
                    row.push(h);
                    rowTotal += h;
                });
                row.push(Math.round(rowTotal * 100) / 100);
                summaryData.push(row);
            });

            var totalRow = ['TOTAL'];
            monthsToInclude.forEach(function (m) { totalRow.push(m.total); });
            totalRow.push('');
            summaryData.push(totalRow);

            var ws1 = XLSX.utils.aoa_to_sheet(summaryData);
            var summaryCols = [{ wch: 30 }];
            monthsToInclude.forEach(function () { summaryCols.push({ wch: 14 }); });
            summaryCols.push({ wch: 10 });
            ws1['!cols'] = summaryCols;
            XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

            // ---- Sheet 2: Project Details (Designer x Project) ----
            var detailsHeader = ['Designer', 'Project Number', 'Project Name', 'Client', 'Section'];
            if (isAllMonths) {
                monthsToInclude.forEach(function (m) { detailsHeader.push(m.monthLabel); });
            } else {
                detailsHeader.push('Hours');
            }
            detailsHeader.push('Total');

            var detailsData = [
                ['Project Details - ' + monthLabel],
                ['Generated: ' + new Date().toLocaleString()],
                [''],
                detailsHeader
            ];

            designers.forEach(function (d) {
                var rows = [];
                projectReport.forEach(function (p) {
                    var pd = (p.designers || []).find(function (x) {
                        return (x.email && d.email && x.email === d.email) || x.name === d.name;
                    });
                    if (!pd) return;
                    var monthHours = monthsToInclude.map(function (m) {
                        return (pd.monthlyHours && pd.monthlyHours[m.month]) || 0;
                    });
                    var rowTotal = monthHours.reduce(function (sum, h) { return sum + h; }, 0);
                    if (rowTotal <= 0) return;
                    rows.push({
                        // projectNumber = COO-entered number (projects.projectNumber).
                        // Fall back to projectCode (quotation #) only when unset.
                        projectNumber: p.projectNumber || p.projectCode || '',
                        projectName: p.projectName || '',
                        client: p.clientCompany || '',
                        section: p.projectSection || '',
                        monthHours: monthHours,
                        total: Math.round(rowTotal * 100) / 100
                    });
                });

                rows.sort(function (a, b) { return b.total - a.total; });
                rows.forEach(function (r, idx) {
                    var row = [idx === 0 ? d.name : '', r.projectNumber, r.projectName, r.client, r.section];
                    r.monthHours.forEach(function (h) { row.push(h); });
                    row.push(r.total);
                    detailsData.push(row);
                });
            });

            if (detailsData.length === 4) {
                detailsData.push(['No project-level data available for the selected period.']);
            }

            var ws2 = XLSX.utils.aoa_to_sheet(detailsData);
            var monthColCount = isAllMonths ? monthsToInclude.length : 1;
            var detailsCols = [{ wch: 25 }, { wch: 16 }, { wch: 32 }, { wch: 24 }, { wch: 14 }];
            for (var i = 0; i < monthColCount; i++) detailsCols.push({ wch: 12 });
            detailsCols.push({ wch: 10 });
            ws2['!cols'] = detailsCols;
            XLSX.utils.book_append_sheet(wb, ws2, 'Project Details');

            var safeLabel = monthLabel.replace(/[^A-Za-z0-9]+/g, '_');
            XLSX.writeFile(wb, 'Designer_Monthly_Report_' + safeLabel + '_'
                + new Date().toISOString().split('T')[0] + '.xlsx');
        } catch (error) {
            alert('Error generating report: ' + error.message);
        }
    }

    function install() {
        window.downloadDesignerMonthlyExcel = patchedDownloadDesignerMonthlyExcel;
        window.generateDesignerMonthlyExcel = generateDesignerMonthlyExcel;
        window.showMonthSelectionModal = showMonthSelectionModal;
    }

    install();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install);
    }
    window.addEventListener('load', install);

    console.log('[monthly-report-patch] loaded — single-month download + project details enabled');
})();
