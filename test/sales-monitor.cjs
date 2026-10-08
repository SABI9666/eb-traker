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
            { id: '1', source: 'projects', kind: 'won', bdmUid: 'a', bdmName: 'Alice', projectName: 'Bridge expansion', projectNumber: 'P-101', client: 'Client A', value: 25000, currency: 'CAD', date: '2026-10-01', status: 'in_progress' },
            { id: '2', source: 'projects', kind: 'variation', bdmUid: 'a', bdmName: 'Alice', projectName: 'Bridge expansion', client: 'Client A', value: 3500, currency: 'CAD', date: '2026-10-02', status: 'approved' },
            { id: '3', source: 'projects', kind: 'quote', bdmUid: 'b', bdmName: 'Bob', projectName: '<img src=x onerror=alert(1)>', client: 'Client B', value: 10000, currency: 'CAD', date: '2026-09-10', status: 'priced' },
            { id: '4', source: 'manual', kind: 'won', bdmUid: 'b', bdmName: 'Bob', projectName: 'Warehouse', client: 'Client B', value: 7000, currency: 'USD', date: '2026-10-03', status: 'won' }
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
        }, { rows, bdms: [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }], generatedAt: '2026-10-08T12:00:00Z' });
        await page.addScriptTag({ content: script });
        await page.evaluate(() => { document.dispatchEvent(new Event('DOMContentLoaded')); showSalesMonitor(); });
        await page.waitForSelector('.sm-card');
        assert.equal(await page.locator('.sm-card strong').first().textContent(), '28,500.00');
        assert.equal(await page.locator('.sm img').count(), 0, 'HTML data is escaped');
        await page.selectOption('#sm-bdm', 'b');
        assert.equal(await page.locator('.sm-card strong').first().textContent(), '0.00');
        await page.click('#sm-reset');
        await page.fill('#sm-from', '2026-10-02');
        assert.equal(await page.locator('.sm-card strong').first().textContent(), '3,500.00');
        await page.fill('#sm-to', '2026-09-01');
        assert.match(await page.locator('#sm-results').textContent(), /start date/);
        await page.click('#sm-reset');
        await page.screenshot({ path: path.join(screenshotDir, 'sales-desktop.png'), fullPage: true });
        await page.selectOption('#sm-source', 'manual');
        assert.equal(await page.locator('#sm-currency').inputValue(), 'USD');
        assert.equal(await page.locator('.sm-card strong').first().textContent(), '7,000.00');
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
        console.log('PASS: totals, BDM/date/source/search filters, empty/error states, XSS escaping, mobile overflow.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
