// Run with Playwright available: node test/sales-monitor.cjs
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const screenshotDir = process.env.SALES_SCREENSHOT_DIR || require('node:os').tmpdir();
(async () => {
    const launchOptions = { headless: true };
    if (process.env.CHROMIUM_EXECUTABLE_PATH) launchOptions.executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
    const browser = await chromium.launch(launchOptions);
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        const rows = [
            { id: '1', source: 'proposals', kind: 'won', bdmUid: 'a', bdmName: 'Alice', projectName: 'Bridge expansion', projectNumber: 'P-101', client: 'Client A', reference: 'PO-77', value: 25000, currency: 'CAD', poValue: 20000, poCurrency: 'CAD', date: '2026-10-01', status: 'won' },
            { id: '2', source: 'accounts', kind: 'variation', bdmUid: 'a', bdmName: 'Alice', projectName: 'Bridge expansion', reference: 'VAR-1', value: 3500, currency: 'CAD', date: '2026-10-02', status: 'uploaded by accounts' },
            { id: '3', source: 'estimator', kind: 'rfq', bdmUid: 'b', bdmName: 'Bob', projectName: '<img src=x onerror=alert(1)>', client: 'Client B', value: 10000, currency: 'CAD', date: '2026-09-10', status: 'submitted to client' },
            { id: '5', source: 'estimator', kind: 'rfq', bdmUid: 'a', bdmName: 'Alice', projectName: 'Bridge expansion', client: 'Client A', value: 26000, currency: 'CAD', date: '2026-08-20', status: 'won' },
            { id: '6', source: 'estimator', kind: 'rfq', bdmUid: 'b', bdmName: 'Bob', projectName: 'Depot', client: '=cmd', value: 4000, currency: 'CAD', date: '2026-08-21', status: 'lost' },
            { id: '4', source: 'proposals', kind: 'won', bdmUid: 'b', bdmName: 'Bob', projectName: 'Warehouse', client: 'Client B', reference: 'PO-9', value: 7000, currency: 'USD', date: '2026-10-03', status: 'won', wonDateEdited: true, wonDateEditedBy: 'Bob', duplicateOf: { projectName: 'Warehouse', date: '2026-09-01', bdmName: 'Bob', samePo: false } },
            { id: '8', source: 'purchase', kind: 'purchase', bdmUid: 'purchase-portal', bdmName: 'Purchase portal', projectName: 'Tank farm', projectNumber: 'EB-01', client: 'Acme', value: 50000, currency: 'INR', date: '2026-10-03', status: 'approved' },
            { id: '9', source: 'proposals', kind: 'won', bdmUid: 'a', bdmName: 'Alice', projectName: 'Older win', client: 'Client A', value: 1000, currency: 'INR', date: '2025-06-01', status: 'won' },
            { id: '7', source: 'proposals', kind: 'won', bdmUid: 'c', bdmName: 'GERARD MOSS', projectName: 'Old job', client: 'Client C', value: 999, currency: 'INR', date: '2025-12-15', status: 'won' }
        ];
        const css = fs.readFileSync(path.join(__dirname, '../public/sales-monitor.css'), 'utf8');
        const script = fs.readFileSync(path.join(__dirname, '../public/sales-monitor-patch.js'), 'utf8');
        await page.setContent('<html><head></head><body style="margin:0;font-family:Arial"><div id="appContainer" class="sales-portal" style="display:block;padding:24px"><main id="mainContent"></main></div></body></html>');
        await page.addStyleTag({ content: css });
        await page.evaluate(data => {
            window.authListeners = [];
            window.firebase = { auth: () => ({ onAuthStateChanged: fn => window.authListeners.push(fn) }) };
            window.currentUser = { uid: 'sales', email: 'sales.edanbrook@outlook.com' };
            window.apiCall = async endpoint => { if (endpoint !== 'sales-monitor') throw new Error('Unexpected API'); return { success: true, data }; };
        }, { rows, bdms: [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }, { id: 'c', name: 'GERARD MOSS' }], generatedAt: '2026-10-08T12:00:00Z' });
        await page.addScriptTag({ content: script });
        await page.evaluate(() => { document.dispatchEvent(new Event('DOMContentLoaded')); showSalesMonitor(); });
        await page.waitForSelector('.sm-card');
        const cardText = label => page.locator('.sm-card', { has: page.locator('span', { hasText: new RegExp('^' + label + '$') }) }).locator('strong').textContent();
        // Default: everything from 1 Dec 2025, converted to INR, monthly view.
        assert.equal(await page.locator('#sm-currency').inputValue(), 'ALL_INR');
        assert.equal(await page.locator('#sm-from').inputValue(), '2025-12-01', 'Report starts in December 2025');
        // Won 25,000 CAD = 15,25,000 + 7,000 USD = 6,30,000 + 999; variation 3,500 CAD = 2,13,500; purchase 50,000.
        assert.equal(await cardText('Won projects'), '21,55,999.00');
        assert.equal(await cardText('Variations \\(Accounts\\)'), '2,13,500.00');
        assert.equal(await cardText('Purchase projects'), '50,000.00');
        assert.equal(await cardText('Total sales'), '24,19,499.00');
        assert.equal(await cardText('BDM sales'), '23,69,499.00');
        assert.equal(await cardText('RFQ value \\(Estimator\\)'), '24,40,000.00', 'RFQ value reported but not added to sales');
        assert.match(await page.locator('#sm-results').textContent(), /Gerard Moss/, 'Capitalised names are title-cased');
        const bdmTable = page.locator('.sm-panel', { has: page.locator('h2', { hasText: /^BDM performance$/ }) });
        assert.doesNotMatch(await bdmTable.locator('tbody').textContent(), /Purchase portal/, 'Purchase projects are not credited to BDMs');
        assert.match(await bdmTable.locator('tfoot').textContent(), /23,69,499\.00/);
        const periods = page.locator('.sm-trend-table');
        assert.match(await periods.textContent(), /Oct 2026[\s\S]*Dec 2025/, 'Every month from Dec 2025');
        assert.match(await periods.locator('tfoot').textContent(), /24,19,499\.00/, 'Period table has a total row');
        await page.click('[data-view="week"]');
        const week = periods.locator('tr', { hasText: '28 Sep – 4 Oct 2026' });
        assert.equal(await week.locator('.sm-total').textContent(), '24,18,500.00', 'Weekly total includes won, variations and purchase');
        await page.click('[data-view="day"]');
        assert.equal(await periods.locator('tbody tr').count(), 7, 'Date-wise view lists only dates with activity');
        await page.screenshot({ path: path.join(screenshotDir, 'sales-all.png'), fullPage: true });
        // Record lists are separate per source.
        assert.match(await page.locator('.sm-details').textContent(), /PO-77[\s\S]*PO-9|PO-9[\s\S]*PO-77/);
        assert.match(await page.locator('.sm-details tbody').textContent(), /CAD 20,000\.00[\s\S]*15,25,000\.00/, 'Won list shows typed P.O. value beside the quote value');
        assert.match(await page.locator('#sm-results').textContent(), /1 won proposal\(s\) dated before/, 'Wins before the range are reported');
        assert.match(await page.locator('.sm-alert-dup').textContent(), /1 possible duplicate win\(s\)[\s\S]*Warehouse/, 'Possible duplicate wins are called out');
        assert.equal(await page.locator('.sm-details .sm-dup').count(), 1, 'Duplicate win is marked in the list');
        assert.equal(await page.locator('.sm-details .sm-flag').count(), 1, 'Edited won date is marked');
        await page.click('[data-tab="purchase"]');
        assert.match(await page.locator('.sm-details tbody').textContent(), /EB-01[\s\S]*Tank farm[\s\S]*50,000\.00/);
        await page.click('[data-tab="rfq"]');
        assert.equal(await page.locator('.sm img').count(), 0, 'HTML data is escaped');
        await page.selectOption('#sm-currency', 'CAD');
        assert.equal(await cardText('Total sales'), '28,500.00');
        const [download] = await Promise.all([page.waitForEvent('download'), page.click('#sm-csv')]);
        const csv = fs.readFileSync(await download.path(), 'utf8');
        assert.match(csv, /"'=cmd"/, 'CSV neutralises formulas');
        assert.equal(csv.trim().split('\r\n').length, 6, 'CSV has header + filtered rows');
        await page.selectOption('#sm-bdm', 'b');
        assert.equal(await cardText('Total sales'), '0.00', 'A single BDM excludes purchase projects');
        await page.click('#sm-reset');
        await page.fill('#sm-from', '2026-10-02');
        assert.equal(await cardText('Total sales'), '8,93,500.00');
        await page.fill('#sm-to', '2026-09-01');
        assert.match(await page.locator('#sm-results').textContent(), /start date/);
        await page.click('#sm-reset');
        await page.click('[data-preset="ever"]');
        assert.equal(await page.locator('#sm-from').inputValue(), '2025-06-01', 'All time starts at the oldest record');
        assert.equal(await cardText('Won projects'), '21,56,999.00', 'All time includes wins before Dec 2025');
        await page.click('#sm-reset');
        await page.fill('#sm-search', 'no match');
        assert.match(await page.locator('#sm-results').textContent(), /No records match/);
        await page.click('#sm-reset');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: path.join(screenshotDir, 'sales-mobile.png'), fullPage: true });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No mobile page overflow');
        await page.evaluate(() => { window.apiCall = async () => { throw new Error('Offline'); }; });
        await page.click('#sm-refresh');
        await page.waitForSelector('[role="alert"]');
        assert.match(await page.locator('#sm-results').textContent(), /Offline/);
        assert.equal(await page.locator('.sm-card').count(), 0, 'Failed refresh clears stale totals');
        // A delayed legacy navigation render is restored to the Sales screen.
        await page.evaluate(() => { document.getElementById('mainContent').innerHTML = '<h1>Legacy dashboard</h1>'; });
        await page.waitForSelector('.sm');
        await page.evaluate(() => { window.currentUser = null; window.authListeners.forEach(fn => fn(null)); });
        assert.equal(await page.locator('.sm').count(), 0, 'Logout clears sales data');
        assert.deepEqual(errors, []);
        console.log('PASS: INR totals by source, monthly/weekly/date-wise views with totals, BDM table, separate record tabs, CSV export, BDM/date/currency/search filters, empty/error states, XSS escaping, mobile overflow.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
