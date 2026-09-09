// management-hub-patch.js
// Compatibility loader for the original COO/Director management hub plus
// Corporate > Sales and Corporate > People grouping. The original
// implementation is preserved in management-hub-core.js; this wrapper only
// changes the Corporate drill-down.
(function () {
    'use strict';

    if (window._managementHubSalesWrapperLoaded) return;
    window._managementHubSalesWrapperLoaded = true;

    var CORE_SRC = 'management-hub-core.js?v=corporate-groups-v3';
    var SALES_LABELS = {
        'All Proposals': { key: 'proposals', display: 'All Proposals', icon: '📋', fn: 'showProposals' },
        'Analytics': { key: 'analytics', display: 'Analytics', icon: '📈', fn: 'showAnalyticsDashboard' },
        'BDM Analytics': { key: 'bdmAnalytics', display: 'BDM Analytics', icon: '📊', fn: 'showBdmAnalytics' },
        'Upload Quote / Won': { key: 'quotes', display: 'Upload Quotes', icon: '📝', fn: 'showBdmEntries' },
        'Upload Quote Entry': { key: 'quotes', display: 'Upload Quotes', icon: '📝', fn: 'showBdmEntries' },
        'Lead Reports': { key: 'leads', display: 'Lead Reports', icon: '🎯', fn: 'showBdmLeads' },
        'Sample Projects': { key: 'samples', display: 'Sample Projects', icon: '🖼️', fn: 'showSampleProjects' }
    };
    var PEOPLE_LABELS = {
        'Leave Approval': { key: 'leaveApproval', display: 'Leave Approval', icon: '✅' },
        'Leave Approvals': { key: 'leaveApproval', display: 'Leave Approval', icon: '✅' },
        'Candidate Screening': { key: 'candidateScreening', display: 'Candidate Screening', icon: '🧑‍💼' }
    };

    var SALES_ORDER = ['proposals', 'quotes', 'analytics', 'bdmAnalytics', 'leads', 'samples'];
    var PEOPLE_ORDER = ['leaveApproval', 'candidateScreening'];
    var salesState = { tiles: [] };
    var peopleState = { tiles: [] };

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;');
    }

    function tileLabel(tile) {
        var el = tile && tile.querySelector('.hub-tile__label');
        return el ? String(el.textContent || '').trim() : '';
    }

    function canonical(label, map) {
        var meta = map[label];
        return meta ? meta.key : null;
    }

    function fallbackTile(meta) {
        return '<div class="glass-surface hub-tile" onclick="window._hubSalesRun(\'' + meta.key + '\')">' +
            '<div class="hub-tile__icon">' + esc(meta.icon) + '</div>' +
            '<div class="hub-tile__label">' + esc(meta.display) + '</div>' +
        '</div>';
    }

    function metaByKey(key, map) {
        var found = null;
        Object.keys(map).some(function (label) {
            var m = map[label];
            if (m.key === key) { found = m; return true; }
            return false;
        });
        return found;
    }

    window._hubSalesRun = function (key) {
        var meta = metaByKey(key, SALES_LABELS);
        if (!meta) return;

        if ((key === 'leads' || key === 'samples') && typeof window._hubRun === 'function') {
            window._hubRun(meta.display);
            return;
        }
        if (typeof window[meta.fn] === 'function') {
            window[meta.fn]();
            return;
        }
        alert(meta.display + ' is still loading. Please try again in a moment.');
    };

    function collectTiles(grid, map, order, options) {
        var found = {};
        Array.prototype.slice.call(grid.children).forEach(function (tile) {
            var label = tileLabel(tile);
            var key = canonical(label, map);
            if (!key) return;

            if (!found[key]) {
                var clone = tile.cloneNode(true);
                var meta = metaByKey(key, map);
                var lbl = clone.querySelector('.hub-tile__label');
                if (lbl && meta) lbl.textContent = meta.display;
                found[key] = clone.outerHTML;
            }
            tile.remove();
        });

        if (options && options.allowFallbacks) {
            order.forEach(function (key) {
                if (!found[key]) found[key] = fallbackTile(metaByKey(key, map));
            });
        }
        return order.map(function (key) { return found[key]; }).filter(Boolean);
    }

    function makeGroupTile(label, icon, count, handler) {
        var tile = document.createElement('div');
        tile.className = 'glass-surface hub-tile';
        tile.setAttribute('onclick', handler);
        tile.innerHTML =
            '<div class="hub-tile__icon">' + icon + '</div>' +
            '<div class="hub-tile__label">' + label + '</div>' +
            '<div style="margin-top:0.35rem;color:#9fb0c4;font-size:0.72rem;">' + count + ' tools</div>';
        return tile;
    }

    function groupCorporateTools() {
        var main = document.getElementById('mainContent');
        var grid = main && main.querySelector('.hub-tilegrid');
        if (!grid) return;

        salesState.tiles = collectTiles(grid, SALES_LABELS, SALES_ORDER, { allowFallbacks: true });
        peopleState.tiles = collectTiles(grid, PEOPLE_LABELS, PEOPLE_ORDER, { allowFallbacks: false });

        var salesTile = makeGroupTile('Sales', '💼', salesState.tiles.length, 'window._hubOpenSales()');
        var peopleTile = makeGroupTile('People', '👥', peopleState.tiles.length, 'window._hubOpenPeople()');

        if (grid.firstChild) {
            grid.insertBefore(peopleTile, grid.firstChild);
            grid.insertBefore(salesTile, grid.firstChild);
        } else {
            grid.appendChild(salesTile);
            grid.appendChild(peopleTile);
        }
    }

    function renderGroup(title, icon, subtitle, tiles, marker) {
        var main = document.getElementById('mainContent');
        if (!main) return;
        main.innerHTML =
            '<div class="mgmt-hub" data-hub-group-view="' + marker + '"><div class="mgmt-hub__inner">' +
                '<div style="display:flex; align-items:center; gap:1rem; margin:0.2rem 0 1.6rem; flex-wrap:wrap;">' +
                    '<button onclick="window._hubOpenPhase(\'corporate\')" class="hub-back">← Corporate</button>' +
                    '<div style="display:flex; align-items:center; gap:0.7rem;">' +
                        '<div class="hub-phase__icon" style="width:46px; height:46px; border-radius:12px; font-size:1.4rem;">' + icon + '</div>' +
                        '<div><h2 style="font-size:1.5rem; font-weight:800; color:#f5f8fc; margin:0;">' + esc(title) + '</h2>' +
                        '<div style="color:#9fb0c4; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.4px;">' + esc(subtitle) + '</div></div>' +
                    '</div>' +
                '</div>' +
                '<div class="hub-tilegrid">' + tiles.join('') + '</div>' +
            '</div></div>';
        main.scrollTop = 0;
    }

    function installCorporateGrouping() {
        if (typeof window._hubOpenPhase !== 'function' || window._hubOpenPhase._corporateSalesWrapped) return false;

        var originalOpenPhase = window._hubOpenPhase;
        var wrapped = function (key) {
            var result = originalOpenPhase.apply(this, arguments);
            if (key === 'corporate') groupCorporateTools();
            return result;
        };
        wrapped._corporateSalesWrapped = true;
        wrapped._original = originalOpenPhase;
        window._hubOpenPhase = wrapped;

        window._hubOpenSales = function () {
            originalOpenPhase('corporate');
            groupCorporateTools();
            renderGroup('Sales', '💼', 'Business Development', salesState.tiles, 'sales');
        };

        window._hubOpenPeople = function () {
            originalOpenPhase('corporate');
            groupCorporateTools();
            renderGroup('People', '👥', 'People & Talent', peopleState.tiles, 'people');
        };
        return true;
    }

    function loadCore() {
        if (window._managementHubCoreLoading) return;
        window._managementHubCoreLoading = true;
        var s = document.createElement('script');
        s.id = '_managementHubCoreScript';
        s.src = CORE_SRC;
        s.async = false;
        s.onload = function () {
            installCorporateGrouping();
            [250, 800, 1800, 3500].forEach(function (ms) {
                setTimeout(installCorporateGrouping, ms);
            });
        };
        s.onerror = function () {
            console.error('[management-hub] Failed to load core management hub:', CORE_SRC);
        };
        (document.head || document.documentElement).appendChild(s);
    }

    loadCore();
})();