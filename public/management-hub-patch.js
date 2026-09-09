// management-hub-patch.js
// Compatibility loader for the original COO/Director management hub plus
// Corporate > Sales grouping. The original implementation is preserved in
// management-hub-core.js; this wrapper only changes the Corporate drill-down.
(function () {
    'use strict';

    if (window._managementHubSalesWrapperLoaded) return;
    window._managementHubSalesWrapperLoaded = true;

    var CORE_SRC = 'management-hub-core.js?v=corporate-sales-v1';
    var SALES_LABELS = {
        'BDM Analytics': { key: 'analytics', display: 'BDM Analytics', icon: '📊', fn: 'showBdmAnalytics' },
        'Upload Quote / Won': { key: 'quotes', display: 'Upload Quotes', icon: '📝', fn: 'showBdmEntries' },
        'Upload Quote Entry': { key: 'quotes', display: 'Upload Quotes', icon: '📝', fn: 'showBdmEntries' },
        'Lead Reports': { key: 'leads', display: 'Lead Reports', icon: '🎯', fn: 'showBdmLeads' },
        'Sample Projects': { key: 'samples', display: 'Sample Projects', icon: '🖼️', fn: 'showSampleProjects' }
    };

    var salesState = { tiles: [] };

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function tileLabel(tile) {
        var el = tile && tile.querySelector('.hub-tile__label');
        return el ? String(el.textContent || '').trim() : '';
    }

    function canonical(label) {
        var meta = SALES_LABELS[label];
        return meta ? meta.key : null;
    }

    function fallbackTile(meta) {
        return '<div class="glass-surface hub-tile" onclick="window._hubSalesRun(\'' + meta.key + '\')">' +
            '<div class="hub-tile__icon">' + esc(meta.icon) + '</div>' +
            '<div class="hub-tile__label">' + esc(meta.display) + '</div>' +
        '</div>';
    }

    function metaByKey(key) {
        var found = null;
        Object.keys(SALES_LABELS).some(function (label) {
            var m = SALES_LABELS[label];
            if (m.key === key) { found = m; return true; }
            return false;
        });
        return found;
    }

    window._hubSalesRun = function (key) {
        var meta = metaByKey(key);
        if (!meta) return;

        // Prefer the core hub's guaranteed runner where available so its
        // navigation state stays consistent with the rest of the portal.
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

    function groupCorporateSales() {
        var main = document.getElementById('mainContent');
        var grid = main && main.querySelector('.hub-tilegrid');
        if (!grid) return;

        var found = {};
        Array.prototype.slice.call(grid.children).forEach(function (tile) {
            var label = tileLabel(tile);
            var key = canonical(label);
            if (!key) return;

            if (!found[key]) {
                var clone = tile.cloneNode(true);
                var meta = metaByKey(key);
                var lbl = clone.querySelector('.hub-tile__label');
                if (lbl && meta) lbl.textContent = meta.display;
                found[key] = clone.outerHTML;
            }
            tile.remove();
        });

        // Always expose the four requested Sales tools. If an asynchronously
        // injected sidebar item is not ready yet, use its direct view function.
        ['analytics', 'quotes', 'leads', 'samples'].forEach(function (key) {
            if (!found[key]) found[key] = fallbackTile(metaByKey(key));
        });
        salesState.tiles = ['analytics', 'quotes', 'leads', 'samples'].map(function (key) { return found[key]; });

        var salesTile = document.createElement('div');
        salesTile.className = 'glass-surface hub-tile';
        salesTile.setAttribute('onclick', 'window._hubOpenSales()');
        salesTile.innerHTML =
            '<div class="hub-tile__icon">💼</div>' +
            '<div class="hub-tile__label">Sales</div>' +
            '<div style="margin-top:0.35rem;color:#9fb0c4;font-size:0.72rem;">4 tools</div>';

        // Sales appears first in Corporate, followed by the remaining HR/IT/Admin tools.
        if (grid.firstChild) grid.insertBefore(salesTile, grid.firstChild);
        else grid.appendChild(salesTile);
    }

    function renderSales() {
        var main = document.getElementById('mainContent');
        if (!main) return;
        var tiles = salesState.tiles.join('');

        main.innerHTML =
            '<div class="mgmt-hub" data-hub-sales-view="sales"><div class="mgmt-hub__inner">' +
                '<div style="display:flex; align-items:center; gap:1rem; margin:0.2rem 0 1.6rem; flex-wrap:wrap;">' +
                    '<button onclick="window._hubOpenPhase(\'corporate\')" class="hub-back">← Corporate</button>' +
                    '<div style="display:flex; align-items:center; gap:0.7rem;">' +
                        '<div class="hub-phase__icon" style="width:46px; height:46px; border-radius:12px; font-size:1.4rem;">💼</div>' +
                        '<div><h2 style="font-size:1.5rem; font-weight:800; color:#f5f8fc; margin:0;">Sales</h2>' +
                        '<div style="color:#9fb0c4; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.4px;">Business Development</div></div>' +
                    '</div>' +
                '</div>' +
                '<div class="hub-tilegrid">' + tiles + '</div>' +
            '</div></div>';
        main.scrollTop = 0;
    }

    function installSalesGrouping() {
        if (typeof window._hubOpenPhase !== 'function' || window._hubOpenPhase._corporateSalesWrapped) return false;

        var originalOpenPhase = window._hubOpenPhase;
        var wrapped = function (key) {
            var result = originalOpenPhase.apply(this, arguments);
            if (key === 'corporate') groupCorporateSales();
            return result;
        };
        wrapped._corporateSalesWrapped = true;
        wrapped._original = originalOpenPhase;
        window._hubOpenPhase = wrapped;

        window._hubOpenSales = function () {
            // Rebuild from the current live menu each time so late-loaded patches,
            // role visibility and notification badges stay accurate.
            originalOpenPhase('corporate');
            groupCorporateSales();
            renderSales();
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
            installSalesGrouping();
            // The role/top-menu mode is applied asynchronously after login.
            [250, 800, 1800, 3500].forEach(function (ms) {
                setTimeout(installSalesGrouping, ms);
            });
        };
        s.onerror = function () {
            console.error('[management-hub] Failed to load core management hub:', CORE_SRC);
        };
        (document.head || document.documentElement).appendChild(s);
    }

    loadCore();
})();