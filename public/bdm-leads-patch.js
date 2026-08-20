// bdm-leads-patch.js
// BDM "Leads" register — prospects the BDM is chasing, with follow-up
// reminders. Companion to api/leads.js (Firestore `bdm_leads`).
//
//   - BDM records: lead name, country, company, work profile, remarks.
//   - A follow-up dropdown (1 week / 2 weeks) arms a reminder; when the
//     date arrives the lead surfaces in a banner at the top of the view,
//     as a count badge on the nav item, and as a one-time toast after
//     login — so the reminder is seen even without opening Leads.
//   - BDM sees and manages only their own leads (backend enforces).
//     COO/Director can view all through the same endpoint.
// Loaded by bdm-po-patch.js. Uses window.apiCall.

(function () {
    'use strict';

    var TAG = '[bdm-leads]';
    var ACCENT = '#0e7490';

    var COUNTRIES = [
        'India', 'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Oman', 'Kuwait', 'Bahrain',
        'United States', 'Canada', 'United Kingdom', 'Ireland', 'Australia', 'New Zealand',
        'Singapore', 'Malaysia', 'Indonesia', 'Philippines', 'Vietnam', 'Thailand', 'Japan', 'South Korea',
        'Germany', 'France', 'Netherlands', 'Belgium', 'Norway', 'Sweden', 'Denmark', 'Finland',
        'Italy', 'Spain', 'Poland', 'South Africa', 'Nigeria', 'Kenya', 'Egypt',
        'Brazil', 'Mexico', 'Chile', 'Other'
    ];
    var WORK_PROFILES = [
        'Structural Steel Detailing', 'Rebar Detailing', 'Connection Design',
        'PEMB', 'Miscellaneous Steel', 'Precast', 'BIM Coordination',
        'Estimation Only', 'EPCM / Full Service', 'Other'
    ];
    var STATUS_META = {
        new:           { label: 'New',           bg: 'rgba(34,199,240,0.14)',  fg: '#0e7490' },
        contacted:     { label: 'Contacted',     bg: 'rgba(99,102,241,0.14)',  fg: '#4f46e5' },
        in_discussion: { label: 'In Discussion', bg: 'rgba(245,158,11,0.16)',  fg: '#b45309' },
        quoted:        { label: 'Quoted',        bg: 'rgba(168,85,247,0.14)',  fg: '#7e22ce' },
        won:           { label: 'Won',           bg: 'rgba(16,185,129,0.14)',  fg: '#059669' },
        lost:          { label: 'Lost',          bg: 'rgba(239,68,68,0.12)',   fg: '#dc2626' }
    };

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    function fmtDate(iso) {
        if (!iso) return '—';
        var d = new Date(iso);
        if (isNaN(d)) return '—';
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    }
    function role() {
        var el = document.getElementById('userRole');
        return el ? String(el.textContent || '').trim().toLowerCase() : '';
    }
    function canSee() { return ['bdm', 'coo', 'director'].includes(role()); }

    function statCard(value, label, color) {
        var c = color || ACCENT;
        return '<div style="border-top:3px solid ' + c + '; padding:1.15rem 1.1rem; background:#fff; border:1px solid #e6ebf2; border-radius:14px; box-shadow:0 10px 28px -14px rgba(15,23,42,0.18);">' +
            '<div style="color:' + c + '; font-size:1.5rem; font-weight:800; line-height:1.15;">' + value + '</div>' +
            '<div style="font-size:0.72rem; letter-spacing:0.6px; text-transform:uppercase; color:#64748b; margin-top:0.4rem; font-weight:600;">' + label + '</div>' +
        '</div>';
    }
    function selectHtml(id, options, selected, placeholder) {
        var opts = placeholder ? '<option value="">' + esc(placeholder) + '</option>' : '';
        options.forEach(function (o) {
            opts += '<option value="' + esc(o) + '"' + (o === selected ? ' selected' : '') + '>' + esc(o) + '</option>';
        });
        return '<select id="' + id + '" class="form-control">' + opts + '</select>';
    }
    function statusPill(status) {
        var m = STATUS_META[status] || STATUS_META.new;
        return '<span style="font-size:0.62rem; font-weight:800; letter-spacing:0.6px; padding:3px 9px; border-radius:10px; background:' + m.bg + '; color:' + m.fg + ';">' + m.label.toUpperCase() + '</span>';
    }

    var _cache = { leads: [], dueFollowUps: [], summary: {} };

    // ── Main view ───────────────────────────────────────────────────────
    window.showBdmLeads = async function () {
        var main = document.getElementById('mainContent');
        if (!main) return;
        if (typeof window.setActiveNav === 'function') { try { window.setActiveNav('nav-bdm-leads'); } catch (e) {} }

        if (!canSee()) {
            main.innerHTML = '<div class="page-header"><h2>🎯 Leads</h2></div>' +
                '<div class="card" style="padding:2rem; text-align:center; color:#b91c1c;">🔒 Leads are visible to BDM, COO and Director only.</div>';
            return;
        }

        main.innerHTML = '<div class="page-header"><h2>🎯 Leads</h2></div>' +
            '<div class="card" style="text-align:center; padding:2.5rem;">⏳ Loading leads…</div>';

        var resp;
        try { resp = await window.apiCall('leads'); }
        catch (e) { renderError(main, e.message); return; }
        if (!resp || !resp.success) { renderError(main, (resp && resp.error) || 'Failed to load'); return; }

        _cache = resp.data || { leads: [], dueFollowUps: [], summary: {} };
        renderView(main);
        updateNavBadge();
    };

    function renderError(main, msg) {
        main.innerHTML = '<div class="page-header"><h2>🎯 Leads</h2></div>' +
            '<div class="card" style="padding:2rem; text-align:center;">' +
                '<p style="color:#b91c1c; margin-bottom:1rem;">⚠️ ' + esc(msg) + '</p>' +
                '<button class="btn btn-primary" onclick="showBdmLeads()">🔄 Retry</button>' +
            '</div>';
    }

    function dueBanner() {
        var due = _cache.dueFollowUps || [];
        if (!due.length) return '';
        var items = due.slice(0, 5).map(function (l) {
            return '<li><strong>' + esc(l.leadName) + '</strong>' +
                (l.company ? ' — ' + esc(l.company) : '') +
                ' <span style="color:#92400e;">(due ' + fmtDate(l.followUpAt) + ')</span></li>';
        }).join('');
        return '<div style="margin-bottom:1.25rem; padding:1rem 1.25rem; border-radius:14px; background:rgba(245,158,11,0.10); border:1px solid rgba(245,158,11,0.4);">' +
            '<div style="font-weight:800; color:#92400e; margin-bottom:0.35rem;">🔔 Follow-ups due (' + due.length + ')</div>' +
            '<ul style="margin:0; padding-left:1.2rem; color:#92400e; font-size:0.85rem; line-height:1.7;">' + items +
                (due.length > 5 ? '<li>+' + (due.length - 5) + ' more below…</li>' : '') +
            '</ul></div>';
    }

    function renderView(main) {
        var s = _cache.summary || {};
        var isBdm = role() === 'bdm';
        main.innerHTML =
            '<div class="page-header" style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:1rem;">' +
                '<div><h2>' + (isBdm ? '🎯 Leads' : '📊 Lead Reports') + '</h2>' +
                '<p class="subtitle">' + (isBdm ? 'Prospects and follow-ups.' : 'Every lead recorded by the BDM team, with follow-up status.') + '</p></div>' +
                '<div style="display:flex; gap:0.6rem; flex-wrap:wrap;">' +
                    '<button class="btn btn-outline btn-sm" onclick="showBdmLeads()">🔄 Refresh</button>' +
                    (isBdm ? '' : '<button class="btn btn-outline btn-sm" onclick="window._leadExcel()">📥 Download Excel</button>') +
                    (isBdm ? '<button class="btn btn-primary" onclick="window._leadForm()">➕ Add Lead</button>' : '') +
                '</div>' +
            '</div>' +
            dueBanner() +
            '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:1rem; margin-bottom:1.25rem;">' +
                statCard(s.total || 0, '🎯 Total Leads') +
                statCard(s.due || 0, '🔔 Follow-ups Due', s.due ? '#dc2626' : ACCENT) +
                statCard(s.open || 0, '📂 Open') +
                statCard(s.won || 0, '🏆 Won', '#059669') +
            '</div>' +
            '<div class="card" style="padding:1.25rem 1.25rem 0.6rem;">' +
                '<div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center; margin-bottom:0.6rem;">' +
                    '<input id="leadFilter" class="form-control" placeholder="🔍 Filter by name / company / country…" style="max-width:300px;" oninput="window._leadFilter()">' +
                    (isBdm ? '' : bdmFilterHtml()) +
                '</div>' +
            '</div>' +
            '<div id="leadTableArea" style="margin-top:1rem;"></div>';
        renderTables();
    }

    function leadTableHtml(list, withEmptyText) {
        var head = '<div style="overflow-x:auto;"><table class="data-table"><thead><tr>' +
            '<th>Lead</th><th>Country</th><th>Company</th><th>Work Profile</th>' +
            '<th>Status</th><th>Follow-up</th><th>📎 Files</th><th>Remarks</th><th></th>' +
            '</tr></thead><tbody>';
        if (!list.length) {
            return head + '<tr><td colspan="9" style="text-align:center; color:#64748b; padding:1.6rem;">' +
                esc(withEmptyText) + '</td></tr></tbody></table></div>';
        }
        return head + list.map(leadRowHtml).join('') + '</tbody></table></div>';
    }

    // Attachment / share-link cell: everything the BDM uploaded with the
    // entry, viewable by management with one click.
    function leadFilesHtml(l) {
        var bits = [];
        if (l.fileUrl) {
            bits.push('<a href="' + esc(l.fileUrl) + '" target="_blank" rel="noopener" title="' + esc(l.fileName || 'Attached file') + '" ' +
                'style="display:inline-flex; align-items:center; gap:4px; font-size:0.74rem; font-weight:700; color:#0e7490; text-decoration:none; background:rgba(34,199,240,0.10); padding:3px 9px; border-radius:10px;">📎 ' +
                esc((l.fileName || 'File').length > 18 ? (l.fileName || 'File').slice(0, 16) + '…' : (l.fileName || 'File')) + '</a>');
        }
        if (l.shareLink) {
            bits.push('<a href="' + esc(l.shareLink) + '" target="_blank" rel="noopener" title="' + esc(l.shareLink) + '" ' +
                'style="display:inline-flex; align-items:center; gap:4px; font-size:0.74rem; font-weight:700; color:#7e22ce; text-decoration:none; background:rgba(168,85,247,0.10); padding:3px 9px; border-radius:10px;">🔗 Link</a>');
        }
        return bits.length ? '<div style="display:flex; flex-direction:column; gap:4px;">' + bits.join('') + '</div>' : '<span style="color:#94a3b8;">—</span>';
    }

    function leadRowHtml(l) {
        var fu;
        if (l.followUpDue) {
            fu = '<span style="font-size:0.62rem; font-weight:800; letter-spacing:0.6px; padding:3px 9px; border-radius:10px; background:rgba(239,68,68,0.12); color:#dc2626;">🔔 DUE ' + fmtDate(l.followUpAt) + '</span>';
        } else if (l.followUpAt && !l.followUpDone) {
            fu = '<span style="color:#64748b; font-size:0.78rem;">⏳ ' + fmtDate(l.followUpAt) + '</span>';
        } else if (l.followUpDone) {
            fu = '<span style="color:#059669; font-size:0.78rem;">✔ done</span>';
        } else {
            fu = '<span style="color:#94a3b8;">—</span>';
        }
        return '<tr' + (l.followUpDue ? ' style="background:rgba(245,158,11,0.05);"' : '') + '>' +
            '<td><strong>' + esc(l.leadName) + '</strong>' +
                '<div style="font-size:0.72rem; color:#94a3b8;">' + fmtDate(l.createdAt) + '</div></td>' +
            '<td>' + esc(l.country || '—') + '</td>' +
            '<td>' + esc(l.company || '—') +
                (l.phone ? '<div style="font-size:0.74rem; color:#64748b;">📞 ' + esc(l.phone) + '</div>' : '') + '</td>' +
            '<td style="font-size:0.82rem;">' + esc(l.workProfile || '—') + '</td>' +
            '<td>' + statusPill(l.status) + '</td>' +
            '<td style="white-space:nowrap;">' + fu + '</td>' +
            '<td>' + leadFilesHtml(l) + '</td>' +
            '<td style="max-width:200px;"><div style="font-size:0.78rem; color:#64748b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="' + esc(l.remarks) + '">' + esc(l.remarks || '—') + '</div></td>' +
            '<td style="white-space:nowrap;">' +
                (l.followUpDue ? '<button class="btn btn-success btn-sm" title="Mark follow-up done" onclick="window._leadDone(\'' + esc(l.id) + '\')">✔</button> ' : '') +
                '<button class="btn btn-outline btn-sm" title="Edit" onclick="window._leadForm(\'' + esc(l.id) + '\')">✏️</button> ' +
                '<button class="btn btn-danger btn-sm" title="Delete" onclick="window._leadDelete(\'' + esc(l.id) + '\')">🗑️</button>' +
            '</td>' +
        '</tr>';
    }

    // BDM: one table. Management: one professional section per BDM —
    // header strip with the BDM's name, lead count and due count, then
    // that BDM's own table underneath.
    function renderTables() {
        var area = document.getElementById('leadTableArea');
        if (!area) return;
        var list = filteredLeads();

        if (role() === 'bdm') {
            area.innerHTML = '<div class="card" style="padding:1.25rem;">' +
                leadTableHtml(list, 'No leads yet. Click ➕ Add Lead to record your first prospect.') + '</div>';
            return;
        }

        if (!list.length) {
            area.innerHTML = '<div class="card" style="padding:2rem; text-align:center; color:#64748b;">No leads recorded by the BDM team yet.</div>';
            return;
        }
        var byBdm = {};
        var order = [];
        list.forEach(function (l) {
            var n = l.createdByName || 'Unknown BDM';
            if (!byBdm[n]) { byBdm[n] = []; order.push(n); }
            byBdm[n].push(l);
        });
        order.sort();
        area.innerHTML = order.map(function (n) {
            var rows = byBdm[n];
            var due = rows.filter(function (l) { return l.followUpDue; }).length;
            var won = rows.filter(function (l) { return l.status === 'won'; }).length;
            return '<div class="card" style="padding:0; overflow:hidden; margin-bottom:1.25rem;">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap; padding:0.9rem 1.25rem; background:linear-gradient(135deg, rgba(14,116,144,0.08), rgba(34,199,240,0.05)); border-bottom:1px solid #e6ebf2;">' +
                    '<div style="display:flex; align-items:center; gap:0.7rem;">' +
                        '<div style="width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,#22c7f0,#0e9ed1); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800;">' + esc(n.charAt(0).toUpperCase()) + '</div>' +
                        '<div><div style="font-weight:800; color:#0f172a;">' + esc(n) + '</div>' +
                        '<div style="font-size:0.72rem; color:#64748b;">' + rows.length + ' lead' + (rows.length === 1 ? '' : 's') + '</div></div>' +
                    '</div>' +
                    '<div style="display:flex; gap:0.5rem;">' +
                        (due ? '<span style="font-size:0.66rem; font-weight:800; padding:3px 10px; border-radius:10px; background:rgba(239,68,68,0.12); color:#dc2626;">🔔 ' + due + ' DUE</span>' : '') +
                        (won ? '<span style="font-size:0.66rem; font-weight:800; padding:3px 10px; border-radius:10px; background:rgba(16,185,129,0.14); color:#059669;">🏆 ' + won + ' WON</span>' : '') +
                    '</div>' +
                '</div>' +
                '<div style="padding:0.8rem 1.25rem 1.1rem;">' + leadTableHtml(rows, '') + '</div>' +
            '</div>';
        }).join('');
    }

    function bdmFilterHtml() {
        var names = {};
        (_cache.leads || []).forEach(function (l) { if (l.createdByName) names[l.createdByName] = 1; });
        var opts = Object.keys(names).sort().map(function (n) {
            return '<option value="' + esc(n) + '">' + esc(n) + '</option>';
        }).join('');
        return '<select id="leadBdmFilter" class="form-control" style="max-width:220px;" onchange="window._leadFilter()">' +
            '<option value="">All BDMs</option>' + opts + '</select>';
    }

    function filteredLeads() {
        var q = ((document.getElementById('leadFilter') || {}).value || '').toLowerCase();
        var bdm = ((document.getElementById('leadBdmFilter') || {}).value || '');
        return (_cache.leads || []).filter(function (l) {
            if (bdm && l.createdByName !== bdm) return false;
            return !q || (l.leadName + ' ' + l.company + ' ' + l.country + ' ' + l.workProfile).toLowerCase().indexOf(q) !== -1;
        });
    }

    window._leadFilter = function () { renderTables(); };

    // ── Excel download — the rows currently visible (filters applied) ──
    // Uses the SheetJS build the app already ships for BDM Analytics;
    // falls back to CSV (which Excel opens) if it ever fails to load.
    window._leadExcel = function () {
        var list = filteredLeads();
        if (!list.length) { alert('No leads to export.'); return; }
        var mgmt = role() !== 'bdm';
        var header = (mgmt ? ['BDM'] : []).concat([
            'Lead Name', 'Country', 'Company', 'Phone', 'Work Profile',
            'Status', 'Follow-up Date', 'Follow-up State', 'Remarks',
            'Attached File', 'Share Link', 'Created'
        ]);
        var rows = list.map(function (l) {
            var fu = l.followUpDue ? 'DUE' : (l.followUpDone ? 'Done' : (l.followUpAt ? 'Scheduled' : '—'));
            var meta = STATUS_META[l.status] || STATUS_META.new;
            return (mgmt ? [l.createdByName || ''] : []).concat([
                l.leadName || '', l.country || '', l.company || '', l.phone || '',
                l.workProfile || '', meta.label,
                l.followUpAt ? fmtDate(l.followUpAt) : '', fu,
                l.remarks || '', l.fileUrl || '', l.shareLink || '', fmtDate(l.createdAt)
            ]);
        });
        var fname = (mgmt ? 'West-EPCM_Lead-Report_' : 'West-EPCM_My-Leads_') +
            new Date().toISOString().split('T')[0];
        try {
            if (typeof XLSX === 'undefined') throw new Error('XLSX not loaded');
            var wb = XLSX.utils.book_new();
            var ws = XLSX.utils.aoa_to_sheet([header].concat(rows));
            ws['!cols'] = header.map(function (h, i) {
                var w = h.length;
                rows.forEach(function (r) { w = Math.max(w, String(r[i] || '').length); });
                return { wch: Math.min(w + 2, 50) };
            });
            XLSX.utils.book_append_sheet(wb, ws, 'Leads');
            XLSX.writeFile(wb, fname + '.xlsx');
        } catch (err) {
            console.warn(TAG, 'xlsx failed, falling back to CSV:', err.message);
            var csv = [header].concat(rows).map(function (r) {
                return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
            }).join('\r\n');
            var a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
            a.download = fname + '.csv';
            document.body.appendChild(a); a.click(); a.remove();
        }
    };

    // ── Add / edit modal ────────────────────────────────────────────────
    window._leadForm = function (id) {
        var lead = null;
        if (id) {
            (_cache.leads || []).forEach(function (l) { if (l.id === id) lead = l; });
            if (!lead) { alert('Lead not found — refresh and try again.'); return; }
        }
        var overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML =
            '<div class="modal-content" style="max-width:560px; max-height:90vh; overflow-y:auto;">' +
                '<div class="modal-header"><h2>' + (lead ? '✏️ Edit Lead' : '➕ Add Lead') + '</h2>' +
                '<span class="close-modal" onclick="this.closest(\'.modal-overlay\').remove()">&times;</span></div>' +
                '<div style="padding:1.25rem;">' +
                    '<div class="form-group"><label>Lead Name *</label>' +
                        '<input id="leadName" class="form-control" maxlength="160" value="' + esc(lead ? lead.leadName : '') + '" placeholder="Contact person or lead title"></div>' +
                    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:0.9rem;">' +
                        '<div class="form-group"><label>Country</label>' +
                            selectHtml('leadCountry', COUNTRIES, lead ? lead.country : '', 'Select country…') + '</div>' +
                        '<div class="form-group"><label>Work Profile</label>' +
                            selectHtml('leadProfile', WORK_PROFILES, lead ? lead.workProfile : '', 'Select profile…') + '</div>' +
                    '</div>' +
                    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:0.9rem;">' +
                        '<div class="form-group"><label>Company</label>' +
                            '<input id="leadCompany" class="form-control" maxlength="160" value="' + esc(lead ? lead.company : '') + '" placeholder="Company / organisation"></div>' +
                        '<div class="form-group"><label>Phone Number</label>' +
                            '<input id="leadPhone" class="form-control" type="tel" maxlength="40" value="' + esc(lead ? lead.phone : '') + '" placeholder="+91 98765 43210"></div>' +
                    '</div>' +
                    (lead ? '<div class="form-group"><label>Status</label>' +
                        '<select id="leadStatus" class="form-control">' +
                            Object.keys(STATUS_META).map(function (k) {
                                return '<option value="' + k + '"' + (lead.status === k ? ' selected' : '') + '>' + STATUS_META[k].label + '</option>';
                            }).join('') +
                        '</select></div>' : '') +
                    '<div class="form-group"><label>Remarks</label>' +
                        '<textarea id="leadRemarks" class="form-control" rows="3" maxlength="2000" placeholder="Discussion notes, requirements, next steps…">' + esc(lead ? lead.remarks : '') + '</textarea></div>' +
                    '<div class="form-group"><label>🔗 Share Link (optional)</label>' +
                        '<input id="leadShareLink" class="form-control" type="url" maxlength="500" value="' + esc(lead ? lead.shareLink : '') + '" placeholder="https://drive.google.com/… or any document link">' +
                        '<div style="font-size:0.72rem; color:#64748b; margin-top:0.3rem;">Paste a Drive / OneDrive / SharePoint link — COO &amp; Director can open it from Lead Reports.</div></div>' +
                    '<div class="form-group"><label>📎 Attach Excel (optional)</label>' +
                        '<input id="leadFile" class="form-control" type="file" accept=".xls,.xlsx,.csv,.pdf">' +
                        (lead && lead.fileName
                            ? '<div style="font-size:0.72rem; color:#64748b; margin-top:0.3rem;">Current file: <b>' + esc(lead.fileName) + '</b> — choose a new file to replace it.</div>'
                            : '<div style="font-size:0.72rem; color:#64748b; margin-top:0.3rem;">Excel, CSV or PDF up to 20 MB. Viewable by COO &amp; Director alongside this lead.</div>') +
                    '</div>' +
                    '<div class="form-group"><label>🔔 Follow-up Reminder</label>' +
                        '<select id="leadFollowUp" class="form-control">' +
                            '<option value="0">No reminder</option>' +
                            '<option value="1">Remind me in 1 week</option>' +
                            '<option value="2">Remind me in 2 weeks</option>' +
                        '</select>' +
                        '<div style="font-size:0.74rem; color:#64748b; margin-top:0.35rem;">' +
                            (lead && lead.followUpAt && !lead.followUpDone
                                ? 'Current reminder: ' + fmtDate(lead.followUpAt) + '. Choosing a new period restarts it from today.'
                                : 'When the date arrives this lead appears as a reminder in the portal.') +
                        '</div></div>' +
                    '<div style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:1.25rem;">' +
                        '<button class="btn btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button>' +
                        '<button class="btn btn-success" onclick="window._leadSubmit(this, ' + (lead ? '\'' + esc(lead.id) + '\'' : 'null') + ')">' + (lead ? 'Save Changes' : 'Add Lead') + '</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(overlay);
        document.getElementById('leadName').focus();
    };

    window._leadSubmit = async function (btn, id) {
        var val = function (elId) { var el = document.getElementById(elId); return el ? el.value : ''; };
        var body = {
            leadName: val('leadName').trim(),
            country: val('leadCountry'),
            company: val('leadCompany').trim(),
            phone: val('leadPhone').trim(),
            workProfile: val('leadProfile'),
            remarks: val('leadRemarks').trim(),
            shareLink: val('leadShareLink').trim()
        };
        if (!body.leadName) { alert('Please enter the lead name.'); return; }
        if (body.shareLink && !/^https?:\/\//i.test(body.shareLink)) {
            alert('The share link must start with http:// or https://'); return;
        }
        var st = document.getElementById('leadStatus');
        if (st) body.status = st.value;
        var fu = parseInt(val('leadFollowUp'), 10) || 0;
        // On edit, only send followUpWeeks when the user picked a period —
        // sending 0 would clear an existing reminder they didn't touch.
        if (!id || fu > 0) body.followUpWeeks = fu;

        // A picked file switches the request to multipart; apiCall already
        // leaves Content-Type alone for FormData so the boundary survives.
        var fileEl = document.getElementById('leadFile');
        var payload;
        if (fileEl && fileEl.files && fileEl.files.length) {
            payload = new FormData();
            Object.keys(body).forEach(function (k) { payload.append(k, body[k]); });
            payload.append('leadFile', fileEl.files[0]);
        } else {
            payload = JSON.stringify(body);
        }

        btn.disabled = true;
        try {
            var resp = await window.apiCall('leads' + (id ? '?id=' + encodeURIComponent(id) : ''), {
                method: id ? 'PUT' : 'POST',
                body: payload
            });
            if (resp && resp.success) {
                btn.closest('.modal-overlay').remove();
                window.showBdmLeads();
            } else { alert('Save failed: ' + ((resp && resp.error) || 'unknown')); btn.disabled = false; }
        } catch (e) { alert('Save failed: ' + e.message); btn.disabled = false; }
    };

    window._leadDone = async function (id) {
        try {
            var resp = await window.apiCall('leads?id=' + encodeURIComponent(id), {
                method: 'PUT', body: JSON.stringify({ followUpDone: true })
            });
            if (resp && resp.success) window.showBdmLeads();
            else alert('Update failed: ' + ((resp && resp.error) || 'unknown'));
        } catch (e) { alert('Update failed: ' + e.message); }
    };

    window._leadDelete = async function (id) {
        if (!confirm('Delete this lead?')) return;
        try {
            var resp = await window.apiCall('leads?id=' + encodeURIComponent(id), { method: 'DELETE' });
            if (resp && resp.success) window.showBdmLeads();
            else alert('Delete failed: ' + ((resp && resp.error) || 'unknown'));
        } catch (e) { alert('Delete failed: ' + e.message); }
    };

    // ── Reminders visible across the portal ─────────────────────────────
    // Badge on the nav item + a one-time toast after login, so a due
    // follow-up is noticed even if the BDM never opens the Leads view.
    function updateNavBadge() {
        var a = document.getElementById('nav-bdm-leads');
        if (!a) return;
        var due = (_cache.dueFollowUps || []).length;
        var badge = document.getElementById('leadNavBadge');
        if (!due) { if (badge) badge.remove(); return; }
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'leadNavBadge';
            badge.style.cssText = 'margin-left:8px; background:#dc2626; color:#fff; font-size:0.66rem; font-weight:800; padding:1px 7px; border-radius:10px; vertical-align:middle;';
            a.appendChild(badge);
        }
        badge.textContent = due;
    }

    var _toastShown = false;
    function showReminderToast(due) {
        if (_toastShown || !due.length) return;
        _toastShown = true;
        var t = document.createElement('div');
        t.style.cssText = 'position:fixed; right:18px; bottom:18px; z-index:9999; max-width:340px; background:#fff; border:1px solid rgba(245,158,11,0.5); border-left:5px solid #f59e0b; border-radius:14px; box-shadow:0 18px 40px -12px rgba(15,23,42,0.35); padding:1rem 1.1rem; cursor:pointer;';
        t.innerHTML = '<div style="font-weight:800; color:#92400e; margin-bottom:0.25rem;">🔔 Lead follow-up' + (due.length > 1 ? 's' : '') + ' due</div>' +
            '<div style="font-size:0.82rem; color:#64748b;">' +
                esc(due.slice(0, 3).map(function (l) { return l.leadName; }).join(', ')) +
                (due.length > 3 ? ' +' + (due.length - 3) + ' more' : '') +
                ' — click to open Leads.</div>';
        t.onclick = function () { t.remove(); window.showBdmLeads(); };
        document.body.appendChild(t);
        setTimeout(function () { try { t.remove(); } catch (e) {} }, 15000);
    }

    async function checkReminders() {
        if (role() !== 'bdm' || typeof window.apiCall !== 'function') return;
        try {
            var resp = await window.apiCall('leads');
            if (resp && resp.success && resp.data) {
                _cache = resp.data;
                updateNavBadge();
                showReminderToast(resp.data.dueFollowUps || []);
            }
        } catch (e) { /* silent — reminders are best-effort */ }
    }

    // ── Nav injection (same pattern as account-variation-patch) ─────────
    function findDeptUL(deptId, headingRegex) {
        var dept = document.getElementById(deptId);
        if (dept) { var ul = dept.querySelector('ul.nav-dept-items, ul'); if (ul) return ul; }
        var headers = document.querySelectorAll('.nav-dept-header, .sidebar h3, nav h3, aside h3, .sidebar .dept-name');
        for (var i = 0; i < headers.length; i++) {
            if (headingRegex.test((headers[i].textContent || '').trim())) {
                var parent = headers[i].closest('li, .nav-department, .sidebar-section') || headers[i].parentElement;
                if (parent) { var u = parent.querySelector('ul'); if (u) return u; }
            }
        }
        return null;
    }

    function injectNav() {
        if (!canSee()) return false;
        if (document.getElementById('bdmLeadsNavItem')) return true;
        var ul = findDeptUL('deptBDM', /business\s*development|bdm/i);
        if (!ul) return false;
        var li = document.createElement('li');
        li.id = 'bdmLeadsNavItem';
        li.style.display = 'block';
        var navLabel = role() === 'bdm' ? 'Leads' : 'Lead Reports';
        li.innerHTML = '<a href="#" id="nav-bdm-leads" onclick="showBdmLeads(); return false;">' +
            '<span class="nav-icon">🎯</span>' + navLabel + '</a>';
        ul.appendChild(li);
        console.log(TAG, 'nav injected');
        return true;
    }

    var _started = false;
    var _retry = 0;
    function tryStart() {
        if (!role()) return;
        if (injectNav() && !_started) {
            _started = true;
            setTimeout(checkReminders, 1500);
        }
    }
    var _iv = setInterval(function () {
        tryStart();
        if (_started || _retry++ > 120) clearInterval(_iv);
    }, 500);
    document.addEventListener('DOMContentLoaded', tryStart);
    tryStart();
})();
