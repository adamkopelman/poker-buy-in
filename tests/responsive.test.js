const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = req.url.split('?')[0];
      const filePath = path.join(ROOT, decodeURIComponent(urlPath === '/' ? '/index.html' : urlPath));
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Real-world phone viewports, covering a range of screen ratios from small
// older Android phones up through today's tall flagship screens, plus the
// CSS breakpoint boundary itself (480/481px).
const PHONE_VIEWPORTS = [
  { name: 'small Android (320x568)', width: 320, height: 568 },
  { name: 'Galaxy S22 (360x780)', width: 360, height: 780 },
  { name: 'iPhone SE (375x667)', width: 375, height: 667 },
  { name: 'iPhone 14 (390x844)', width: 390, height: 844 },
  { name: 'Pixel/OnePlus-class (412x915)', width: 412, height: 915 },
  { name: 'iPhone 14 Pro Max (430x932)', width: 430, height: 932 },
  { name: 'breakpoint boundary (480x800)', width: 480, height: 800 },
  { name: 'just above breakpoint (481x800)', width: 481, height: 800 }
];

test('buy-in editor (+/- buttons and count input) stays visible and usable on phones', async (t) => {
  const server = await startServer();
  const { port } = server.address();
  const browser = await chromium.launch();

  try {
    for (const vp of PHONE_VIEWPORTS) {
      await t.test(vp.name, async () => {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await context.newPage();
        try {
          await page.goto(`http://127.0.0.1:${port}/index.html`);
          await page.fill('#newPlayerName', 'Alice');
          await page.click('#addPlayerBtn');

          const plusBtn = page.locator('.plus-btn').first();
          const undoBtn = page.locator('.undo-btn').first();
          const countInput = page.locator('.buyins-input').first();

          await plusBtn.waitFor({ state: 'visible', timeout: 2000 });
          await undoBtn.waitFor({ state: 'visible', timeout: 2000 });
          await countInput.waitFor({ state: 'visible', timeout: 2000 });

          const before = Number(await countInput.inputValue());
          await plusBtn.click();
          const after = Number(await countInput.inputValue());
          assert.equal(after, before + 1, `+ button should increment buy-ins on ${vp.name}`);
        } finally {
          await context.close();
        }
      });
    }
  } finally {
    await browser.close();
    server.close();
  }
});

test('settle page cash-out inputs (chips, dollars, buy-ins) stay visible and usable on phones', async (t) => {
  const server = await startServer();
  const { port } = server.address();
  const browser = await chromium.launch();

  try {
    for (const vp of PHONE_VIEWPORTS) {
      await t.test(vp.name, async () => {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await context.newPage();
        try {
          await page.goto(`http://127.0.0.1:${port}/index.html`);
          await page.fill('#newPlayerName', 'Carl');
          await page.click('#addPlayerBtn');

          await page.goto(`http://127.0.0.1:${port}/settle.html`);
          const chipInput = page.locator('.chip-cashout-input').first();
          const dollarInput = page.locator('.dollar-cashout-input').first();
          const buyinsInput = page.locator('.buyins-cashout-input').first();

          await chipInput.waitFor({ state: 'visible', timeout: 2000 });
          await dollarInput.waitFor({ state: 'visible', timeout: 2000 });
          await buyinsInput.waitFor({ state: 'visible', timeout: 2000 });

          await chipInput.fill('40');
          await chipInput.dispatchEvent('input');
          assert.equal(await dollarInput.inputValue(), '40', `dollar field should reflect 40 chips on ${vp.name}`);
          assert.equal(await buyinsInput.inputValue(), '2', `buy-ins field should reflect 40 chips on ${vp.name}`);
        } finally {
          await context.close();
        }
      });
    }
  } finally {
    await browser.close();
    server.close();
  }
});

test('Buy-ins column stays visible on index.html but hides below the breakpoint on settle.html', async () => {
  const server = await startServer();
  const { port } = server.address();
  const browser = await chromium.launch();

  try {
    const context = await browser.newContext({ viewport: { width: 320, height: 568 } });
    const page = await context.newPage();

    await page.goto(`http://127.0.0.1:${port}/index.html`);
    const indexDisplay = await page.locator('#playersTable thead th').nth(1).evaluate(el => getComputedStyle(el).display);
    assert.notEqual(indexDisplay, 'none', 'index.html should not hide its Buy-ins editor column');

    await page.goto(`http://127.0.0.1:${port}/settle.html`);
    const settleDisplay = await page.locator('#playersTable thead th').nth(1).evaluate(el => getComputedStyle(el).display);
    assert.equal(settleDisplay, 'none', 'settle.html should hide its informational Buy-ins column below the breakpoint');

    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});
