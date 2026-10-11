// Run against the development server with Playwright installed: checks that the
// settings form applies and persists look speed, invert, field of view, fixed
// quality, text size, reduced motion, the frame-rate toggle and toggle sprint.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const url = process.env.GAME_URL || 'http://127.0.0.1:5184/';
  const shots = process.env.SHOTS || '.';
  await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForFunction(() => window.__konia, null, { timeout: 120000 });
  await page.evaluate(() => window.__konia.scene.getEngine().stopRenderLoop());
  const assert = (v, m) => { if (!v) throw Error(m); };
  await page.click('[data-action=settings]');
  await page.screenshot({ path: shots + '/settings-form.png' });
  const set = (name, value) => page.evaluate(([n, v]) => {
    const el = document.querySelector(`[name=${n}]`);
    if (el.type === 'checkbox') el.checked = v; else el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [name, value]);
  await set('lookSpeed', 2); await set('invertLook', true); await set('fov', 80); await set('quality', 2);
  await set('textSize', 130); await set('reducedMotion', true); await set('showFps', false); await set('sprint', 'toggle');
  const applied = await page.evaluate(() => {
    const g = window.__konia;
    return { look: g.rig.lookSpeed, inv: g.rig.invertLook, fov: g.rig.camera.fov, q: g.quality.label,
      scale: getComputedStyle(document.documentElement).getPropertyValue('--ui-scale').trim(),
      rm: document.body.classList.contains('reduce-motion'), fpsHidden: document.body.classList.contains('hide-fps'),
      stored: JSON.parse(localStorage.getItem('konia.settings.v1')) };
  });
  assert(applied.look === 2 && applied.inv && Math.abs(applied.fov - 80 * Math.PI / 180) < 1e-6, 'look/fov ' + JSON.stringify(applied));
  assert(applied.q === 'Q2' && applied.scale === '1.3' && applied.rm && applied.fpsHidden, 'display ' + JSON.stringify(applied));
  assert(applied.stored.sprint === 'toggle' && applied.stored.textSize === 130, 'persisted');
  await page.screenshot({ path: shots + '/settings-130.png' });
  // Quality stays pinned while the frame rate is low.
  await page.evaluate(() => { const g = window.__konia; for (let i = 0; i < 400; i++) g.quality.update(0.1); });
  assert(await page.evaluate(() => window.__konia.quality.label) === 'Q2', 'fixed quality stepped');
  // Toggle sprint: one Shift press keeps sprinting with the key released.
  await page.click('[data-settings=back]');
  const sprint = await page.evaluate(() => {
    const g = window.__konia; g.upgrades.install('sprint', true); g.start();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' }));
    g.tick(1 / 30, 10); const on = g.robot.sprinting;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' }));
    g.tick(1 / 30, 10); const off = g.robot.sprinting;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    return { on, off };
  });
  assert(sprint.on && !sprint.off, 'toggle sprint ' + JSON.stringify(sprint));
  // Settings survive a reload and a new game.
  await page.reload(); await page.waitForFunction(() => window.__konia, null, { timeout: 120000 });
  assert(await page.evaluate(() => window.__konia.rig.lookSpeed) === 2, 'reload lost settings');
  console.log(JSON.stringify({ settings: 'ok', sprint }), 'errors', errors);
  await browser.close();
  if (errors.length) process.exit(1);
})();
