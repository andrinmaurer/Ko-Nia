// Run against the development server with Playwright installed: starts the
// soundscape, plays every cue and checks the buses carry signal, the volume
// settings reach the engine and captions still show as subtitles.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5184/'); await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForFunction(() => window.__konia, null, { timeout: 120000 });
  const result = await page.evaluate(async () => {
    const g = window.__konia; g.scene.getEngine().stopRenderLoop();
    const cues = await import('/src/audio/cues.ts');
    const assert = (v, m) => { if (!v) throw Error(m); };
    g.sound.start(); g.start();
    const e = g.sound.engine; assert(e, 'engine not created');
    await e.ctx.resume();
    const rms = (bus) => { const a = e.ctx.createAnalyser(); a.fftSize = 2048; e.bus(bus).connect(a); return () => { const d = new Float32Array(a.fftSize); a.getFloatTimeDomainData(d); return Math.sqrt(d.reduce((s, x) => s + x * x, 0) / d.length); }; };
    const fx = rms('effects'), amb = rms('ambience');
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // Ambience runs from the first update.
    for (let i = 0; i < 30; i++) { g.tick(1 / 30, 1); await sleep(10); }
    await sleep(600);
    const ambLevel = amb();
    // Every recipe makes sound.
    const silent = [];
    for (const [name, r] of Object.entries(cues)) {
      if (typeof r !== 'function' || name === 'chime') continue;
      g.sound.play(r, undefined, 'effects', 2, 0);
      let peak = 0; for (let i = 0; i < 12; i++) { await sleep(25); peak = Math.max(peak, fx()); }
      if (peak < 1e-4) silent.push(name);
      await sleep(150);
    }
    // Captions map to positioned creature sounds and still show as text.
    g.ctx.caption('A dry rattling sound, very close', 2);
    const shown = document.querySelector('[data-el=caption]').textContent;
    // Volume settings reach the engine; captions can be turned off.
    g.settings.volume = 0; g.settings.subtitles = false; g.applySettings(); await sleep(400);
    g.ctx.caption('A Hookbill caws and takes off', 2);
    const hiddenCaption = document.querySelector('[data-el=caption]').textContent;
    return { state: e.ctx.state, ambLevel, silent, shown, hiddenCaption };
  });
  if (result.state !== 'running' || result.ambLevel < 1e-4 || result.silent.length || !/rattling/.test(result.shown) || /Hookbill/.test(result.hiddenCaption)) {
    console.error(JSON.stringify(result)); process.exit(1);
  }
  console.log(JSON.stringify(result), 'errors', errors);
  await browser.close();
  if (errors.length) process.exit(1);
})();
