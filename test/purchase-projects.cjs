// Run with Playwright available: node test/purchase-projects.cjs. Uses fixtures only; no cloud calls.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const screenshotDir = process.env.PROJECT_SCREENSHOT_DIR || require('node:os').tmpdir();
const project = { id: 'p1', projectNumber: 'EB-2026-01', name: 'Plant shed <b>x</b>', client: 'Acme', location: 'Chennai', manager: 'Ravi', description: 'Steel shed', projectValue: 100000, currency: 'INR', awardDate: '2026-10-01', startDate: '2026-10-02', endDate: '2026-12-31', status: 'active', includeInSales: true, version: 3,
    approval: { status: 'pending', kind: 'edit' }, sales: { include: true, value: 90000, currency: 'INR', date: '2026-10-01' }, initialSales: { value: 90000, currency: 'INR', date: '2026-10-01', approvedAt: '2026-10-01T10:00:00Z' },
    totals: { material: 4000, manpower: 3600, machinery: 15000, manDays: 4, manHours: 32, machineHours: 6, entries: 3 }, lastEntryDate: '2026-10-08' };
const entries = [
    { id: 'e1', type: 'material', date: '2026-10-07', description: 'Cement', unit: 'bag', quantity: 10, rate: 400, amount: 4000, supplier: 'ACC', currency: 'INR', createdBy: { name: 'Anwar' } },
    { id: 'e2', type: 'manpower', date: '2026-10-07', description: 'Welder', workers: 4, hours: 8, rate: 900, amount: 3600, currency: 'INR', createdBy: { name: 'Anwar' } },
    { id: 'e3', type: 'machinery', date: '2026-10-08', description: 'Crane 25T', units: 1, hours: 6, rate: 2500, amount: 15000, currency: 'INR', createdBy: { name: 'Anwar' } },
    { id: 'e4', type: 'material', date: '2026-10-08', description: 'Paint', quantity: 1, rate: 50, amount: 50, currency: 'INR', deletedAt: '2026-10-08', deleteReason: 'Duplicate', createdBy: { name: 'Anwar' } }
];
async function setup(browser, role) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setContent('<html><body style="margin:0;font-family:Arial"><main id="mainContent"></main></body></html>');
    await page.evaluate(({ role, project, entries }) => {
        window.calls = [];
        window.firebase = { auth: () => ({ currentUser: { getIdToken: async () => 'token' } }) };
        window.fetch = async (url, options = {}) => {
            window.calls.push({ url, method: options.method || 'GET', body: options.body });
            const u = new URL(url);
            let body;
            if (u.pathname === '/api/purchase-projects') body = options.method === 'POST' ? { success: true, data: { id: 'p1' } } : { success: true, role, data: [project, { ...project, id: 'p2', projectNumber: 'EB-2026-02', name: 'Bridge', currency: 'USD', projectValue: 5000, approval: { status: 'approved' }, totals: {} }] };
            else if (u.pathname === '/api/purchase-projects/p1') body = { success: true, data: project, entries, activities: [{ action: 'submitted_edit', actor: { name: 'Anwar', role: 'purchase' }, at: '2026-10-08T10:00:00Z', details: { note: 'Revised', changed: [{ field: 'projectValue', before: 90000, after: 100000 }] } }] };
            else if (u.pathname === '/api/purchases') body = { success: true, data: [
                { id: 'x1', reference: 'PO-9', projectNumber: 'EB-2026-01', project: 'Plant shed', item: 'Bolts', qty: '100 nos', vendor: 'V', amount: 500, currency: 'INR', stage: 'po', requiredBy: '2026-01-05', priority: 'urgent', approval: { status: 'approved' }, createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-08T10:00:00Z' },
                { id: 'x2', reference: 'RFQ-2', project: 'Office', item: 'Chairs', qty: '10 nos', vendor: '', amount: 900, currency: 'USD', stage: 'rfq', priority: 'normal', approval: { status: 'pending' }, createdAt: '2026-10-02T10:00:00Z', updatedAt: '2026-10-09T10:00:00Z' }], next: null };
            else body = { success: true, data: { id: 'new' } };
            return { ok: true, json: async () => structuredClone(body) };
        };
    }, { role, project, entries });
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, '../public/purchase-projects-patch.js'), 'utf8') });
    await page.evaluate(() => window.showPurchaseProjects());
    await page.waitForSelector('.pp-table');
    return { page, errors };
}
(async () => {
    const launchOptions = { headless: true };
    if (process.env.CHROMIUM_EXECUTABLE_PATH) launchOptions.executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
    const browser = await chromium.launch(launchOptions);
    try {
        // COO: summary, report, approval.
        let { page, errors } = await setup(browser, 'coo');
        const text = await page.locator('.pp').textContent();
        assert.match(text, /1 project\(s\) await your approval/);
        assert.match(text, /INR 1,00,000\.00[\s\S]*USD 5,000\.00/, 'Contract value kept per currency');
        assert.equal(await page.locator('#ppNew').count(), 0, 'Management cannot create projects');
        assert.equal(await page.locator('.pp b b').count(), 0, 'HTML is escaped');
        await page.screenshot({ path: path.join(screenshotDir, 'projects-coo-list.png'), fullPage: true });
        assert.match(text, /Initial sales value[\s\S]*INR 90,000\.00/);
        await page.click('[data-view="schedule"]');
        assert.match(await page.locator('#ppRows').textContent(), /Planned completion[\s\S]*31 Dec 2026/);
        await page.screenshot({ path: path.join(screenshotDir, 'projects-coo-schedule-list.png'), fullPage: true });
        await page.click('[data-view="cost"]');
        // Purchase report.
        await page.click('#ppPurchaseReport'); await page.waitForSelector('#pr-project');
        const pr = await page.locator('.pp').textContent();
        assert.match(pr, /Overdue[\s\S]*1/); assert.match(pr, /EB-2026-01[\s\S]*Plant shed <b>x<\/b>/); assert.match(pr, /Not linked to a project/);
        assert.match(pr, /INR 500\.00[\s\S]*USD 900\.00/, 'Values per currency');
        await page.screenshot({ path: path.join(screenshotDir, 'purchase-report.png'), fullPage: true });
        await page.selectOption('#pr-project', 'EB-2026-01');
        assert.match(await page.locator('.pp-kpi').first().textContent(), /Purchases\s*1/);
        await page.click('#prProjects'); await page.waitForSelector('[data-review="p1"]');
        await page.click('[data-review="p1"]');
        await page.waitForSelector('#ppTab');
        const report = await page.locator('.pp').textContent();
        assert.match(report, /INR 22,600\.00/, 'Cost to date'); assert.match(report, /INR 77,400\.00/, 'Balance');
        assert.match(report, /Initial sales value[\s\S]*INR 90,000\.00/); assert.match(report, /Revision INR 10,000\.00/);
        // Cost report is the default tab.
        const cost = await page.locator('#ppTab').textContent();
        assert.match(cost, /Approved purchase commitments[\s\S]*INR 500\.00/); assert.match(cost, /Crane 25T[\s\S]*6[\s\S]*2,500\.00/); assert.match(cost, /Welder[\s\S]*4[\s\S]*32/);
        assert.match(cost, /Oct 2026[\s\S]*22,600\.00/);
        await page.screenshot({ path: path.join(screenshotDir, 'projects-cost-report.png'), fullPage: true });
        await page.click('[data-tab="schedule"]');
        const sched = await page.locator('#ppTab').textContent();
        assert.match(sched, /Planned duration[\s\S]*91 days/); assert.match(sched, /Site working days logged\s*2/);
        assert.match(sched, /5 Oct 2026 – 11 Oct 2026|05 Oct 2026 – 11 Oct 2026/);
        await page.screenshot({ path: path.join(screenshotDir, 'projects-schedule-report.png'), fullPage: true });
        await page.click('[data-tab="daily"]');
        assert.match(report, /4 man-days · 32 man-hours/); assert.match(report, /keeps the initial sales value INR 90,000\.00/);
        assert.match(await page.locator('#ppTab tfoot').textContent(), /22,600\.00/, 'Daily summary excludes removed entries');

        await page.click('[data-tab="material"]');
        assert.equal(await page.locator('#ppTab tr.removed').count(), 1); assert.match(await page.locator('#ppTab tfoot').textContent(), /4,000\.00/);
        assert.equal(await page.locator('[data-remove]').count(), 0, 'Management cannot remove logs');
        await page.click('[data-tab="purchases"]'); assert.match(await page.locator('#ppTab').textContent(), /PO-9/);
        await page.click('[data-tab="activity"]'); assert.match(await page.locator('#ppTab').textContent(), /projectValue: 90000 → 100000/);
        await page.click('[data-decide="rejected"]'); await page.click('.pp-modal [type=submit]');
        assert.match(await page.locator('#ppMsg').textContent(), /Decision note/, 'Rejection needs a note');
        await page.fill('#pp-dnote', 'Value not agreed'); await page.click('.pp-modal [type=submit]'); await page.waitForSelector('.pp-modal', { state: 'detached' });
        const decision = (await page.evaluate(() => window.calls)).find(c => c.url.endsWith('/decision'));
        assert.deepEqual(JSON.parse(decision.body), { version: 3, decision: 'rejected', note: 'Value not agreed' });
        assert.deepEqual(errors, []); await page.close();
        // Purchase: create project, daily logs with live amount, removal.
        ({ page, errors } = await setup(browser, 'purchase'));
        assert.equal(await page.locator('[data-review]').count(), 0);
        await page.click('#ppNew');
        await page.fill('#pp-projectNumber', 'EB-2026-03'); await page.fill('#pp-name', 'Tank farm'); await page.fill('#pp-projectValue', '250000');
        await page.screenshot({ path: path.join(screenshotDir, 'projects-new.png') });
        await page.click('.pp-modal [type=submit]'); await page.waitForSelector('.pp-modal', { state: 'detached' });
        let calls = await page.evaluate(() => window.calls);
        const created = JSON.parse(calls.find(c => c.method === 'POST' && c.url.endsWith('/api/purchase-projects')).body);
        assert.equal(created.projectValue, 250000); assert.equal(created.includeInSales, true); assert.equal(created.status, 'active');
        await page.waitForSelector('[data-add="machinery"]');
        await page.click('[data-add="machinery"]');
        await page.fill('#pp-description', 'JCB'); await page.fill('#pp-units', '2'); await page.fill('#pp-hours', '5'); await page.fill('#pp-rate', '1200');
        assert.match(await page.locator('#ppAmount').textContent(), /INR 12,000\.00 · 10 machine-hours/);
        await page.screenshot({ path: path.join(screenshotDir, 'projects-log.png') });
        await page.click('.pp-modal [type=submit]'); await page.waitForSelector('.pp-modal', { state: 'detached' });
        calls = await page.evaluate(() => window.calls);
        const entry = JSON.parse(calls.find(c => c.url.endsWith('/entries')).body);
        assert.equal(entry.type, 'machinery'); assert.equal(entry.units, 2); assert.equal(entry.hours, 5); assert.equal(entry.rate, 1200);
        await page.click('[data-tab="material"]'); await page.click('[data-remove="e1"]'); await page.fill('#pp-reason', 'Wrong project'); await page.click('.pp-modal [type=submit]');
        await page.waitForSelector('.pp-modal', { state: 'detached' });
        calls = await page.evaluate(() => window.calls);
        assert.ok(calls.some(c => c.url.endsWith('/entries/e1/delete') && JSON.parse(c.body).reason === 'Wrong project'));
        await page.setViewportSize({ width: 390, height: 900 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390), 'No horizontal page scroll on phones');
        await page.screenshot({ path: path.join(screenshotDir, 'projects-mobile.png'), fullPage: true });
        assert.deepEqual(errors, []);
        console.log('PASS: project summary per currency, report KPIs, removed entries excluded, linked purchases, approval/rejection, create, daily log calc and payload, removal, mobile layout, escaping.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
