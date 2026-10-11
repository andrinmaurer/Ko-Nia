// Run against the development server with Playwright installed: checks the boot lines,
// the HUD Logbook reminder, opening on the fresh page, field leads and the next-step lead.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5184/'); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForFunction(() => window.__konia, null, { timeout: 120000 });
  const out = [];
  const g = 'window.__konia';
  await page.evaluate(() => { const g = window.__konia; g.scene.getEngine().stopRenderLoop(); g.start(); g.tick(1/30, 30); });
  out.push(['caption1', await page.textContent('[data-el=caption]')]);
  await page.evaluate(() => window.__konia.tick(1/30, 120));
  out.push(['caption2', await page.textContent('[data-el=caption]'), await page.textContent('[data-el=hint]')]);
  await page.evaluate(() => { const g = window.__konia; g.scene.render(); });
  await page.screenshot({ path: (process.env.SHOTS || '.') + '/guidance-boot.png' });
  // Scan: create a page for the hookbill.
  await page.evaluate(() => { const g = window.__konia; g.logbook.recordScan('hookbill','visual',false,{day:1,hour:8},'loc-shrine-street',{x:0,z:0}); g.tick(1/30, 2); });
  out.push(['badge', await page.textContent('[data-el=logbook]'), await page.getAttribute('[data-el=logbook]','class')]);
  out.push(['hint after scan', await page.textContent('[data-el=hint]')]);
  await page.evaluate(() => { const g = window.__konia; g.scene.render(); });
  await page.screenshot({ path: (process.env.SHOTS || '.') + '/guidance-badge.png' });
  await page.evaluate(() => window.__konia.openLogbook());
  out.push(['selected title', await page.textContent('#logbook h2')]);
  out.push(['leads', await page.$$eval('.lb-leads li', ls => ls.map(l => l.textContent))]);
  out.push(['intro', !!(await page.$('.lb-intro')), 'lead', await page.textContent('.lb-hint')]);
  await page.screenshot({ path: (process.env.SHOTS || '.') + '/guidance-logbook.png' });
  await page.evaluate(() => window.__konia.closeLogbook());
  out.push(['badge after', await page.getAttribute('[data-el=logbook]','class')]);
  // Nothing-new scan notice via scanner announce path
  out.push(['unread', await page.evaluate(() => window.__konia.logbook.unread.size)]);
  console.log(JSON.stringify(out, null, 1)); console.log('errors', errors);
  await browser.close();
})();
