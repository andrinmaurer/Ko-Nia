// Checks that every Logbook entry can be completed. Run against the development server
// with Playwright installed: `node tests/achievable.cjs` (takes several minutes).
//
// For each block it samples every floor the robot can stand on, then checks:
// - every location has a floor point inside its zone with something scannable in range,
// - every artefact and origin can be seen from a floor point within scan range,
// - every organism can be Biologically scanned (8 m) and has its behavior observed from
//   some floor point at some hour, with the robot standing still.
// A few organisms need the robot to do something (walk up, wade, approach a nest) or wander
// at random, which would make this test flaky; those are listed in NEEDS_PLAYER and were
// completed by hand in the 2026-10-13 playtest.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const NEEDS_PLAYER = {
  'sun-lotus': 'opens when the robot steps into the pothole',
  'drainback': 'comes out of the drain only after the robot has walked up and stopped',
  'moss-tanuki': 'reacts to the robot approaching the gate',
  'gutter-lily': 'closes and reopens when the robot wades through',
  'pale-crayfish': 'reacts to the robot wading in the pool',
  'tunnel-hound': 'reacts to the robot approaching',
  'ledge-kite': 'observed at the nest while the kite is out hunting',
  'snapping-eel': 'surfaces to strike only when the robot comes near the water',
  'plaza-deer': 'the herd wanders; walk slowly to within 10 m of a grazing deer',
};

// Where to wait for behaviors that only happen with the robot standing at one spot.
const STAND = {
  'gilded-carp': [[141.75, 10.8, -12]], // still on the bridge
};

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(0);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:5184/');
  await page.waitForFunction(() => window.__konia);
  const out = await page.evaluate(async (STAND) => {
    const g = window.__konia;
    g.scene.getEngine().stopRenderLoop();
    g.start();
    const { Vector3, Ray } = await import('/src/babylon.ts');
    const { ENTRIES, stepsFor } = await import('/src/discovery/entries.ts');
    const { locationAt } = await import('/src/discovery/locations.ts');
    const scene = g.scene;
    const REGIONS = { street: [-40, 115], temple: [60, 260], arcade: [240, 420], station: [380, 580], tower: [520, 680] };
    const solid = (m) => m.checkCollisions && m.isEnabled() && m.isVisible;
    const up = (y) => new Vector3(0, y, 0);
    // Floors: upward-facing surfaces with headroom, per block.
    const floors = {};
    for (const [rid, [x0, x1]] of Object.entries(REGIONS)) {
      g.regions.activate(rid);
      for (const m of scene.meshes) m.computeWorldMatrix(true);
      const pts = [];
      for (let x = x0; x <= x1; x += 1.5) for (let z = -50; z <= 52; z += 1.5) {
        const hits = (scene.multiPickWithRay(new Ray(new Vector3(x, 140, z), up(-1), 200), solid) || []).sort((a, b) => a.distance - b.distance);
        hits.forEach((h, i) => {
          const n = h.getNormal(true);
          const y = h.pickedPoint.y;
          if (!n || n.y < 0.7 || y < -19 || (i > 0 && hits[i - 1].pickedPoint.y - y < 1.3)) return;
          pts.push(new Vector3(x, y + 0.05, z));
        });
      }
      floors[rid] = pts;
    }
    const regionOf = (s) => Object.keys(REGIONS).find((rid) => (g.regions.activate(rid), s.meshes[0]?.isEnabled()));
    const EYE = g.robot.eyePosition.y - g.robot.position.y;
    const visible = (from, to, s) => g.scanner.visible(from, to, s);
    const failures = [];

    // Locations.
    const located = {};
    for (const [rid, pts] of Object.entries(floors)) {
      g.regions.activate(rid);
      const ss = g.scannables.filter((s) => s.meshes[0]?.isEnabled());
      for (const pt of pts) {
        const id = locationAt(pt);
        if (located[id]) continue;
        const eye = pt.add(up(EYE));
        if (ss.some((s) => Vector3.Distance(eye, s.getPosition()) <= 24 && visible(eye, s.getPosition(), s))) located[id] = true;
      }
    }
    for (const e of ENTRIES.filter((e) => e.category === 'locations')) if (!located[e.id]) failures.push(`${e.id}: no floor in the zone with anything to scan`);

    // Artefacts and origins.
    for (const e of ENTRIES.filter((e) => e.category === 'artifacts' || e.category === 'origin')) {
      const ok = g.scannables.filter((s) => s.entryId === e.id).some((s) => {
        const rid = regionOf(s);
        if (!rid) return false;
        g.regions.activate(rid);
        const sp = s.getPosition();
        return floors[rid].some((pt) => { const eye = pt.add(up(EYE)); return Vector3.Distance(eye, sp) <= 24 && visible(eye, sp, s); });
      });
      if (!ok) failures.push(`${e.id}: not visible from any floor within scan range`);
    }

    // Organisms.
    const organisms = {};
    for (const e of ENTRIES.filter((e) => stepsFor(e) === 3)) {
      const ss = g.scannables.filter((s) => s.entryId === e.id);
      const r = { bio: false, observed: false };
      organisms[e.id] = r;
      if (!ss.length) { failures.push(`${e.id}: nothing to scan`); continue; }
      const rid = regionOf(ss[0]);
      g.regions.activate(rid);
      const cands = (STAND[e.id] || []).map((p) => ({ pt: new Vector3(...p) }));
      for (const s of ss.slice(0, 24)) {
        const sp = s.getPosition();
        const vis = floors[rid]
          .map((pt) => ({ pt, d: Vector3.Distance(pt.add(up(EYE)), sp) }))
          .filter((o) => o.d <= 24 && visible(o.pt.add(up(EYE)), sp, s))
          .sort((a, b) => a.d - b.d);
        if (vis[0]) cands.push(vis[0]);
        if (ss.length <= 3) {
          const hi = [...vis].sort((a, b) => b.pt.y - a.pt.y)[0];
          if (hi && hi !== vis[0]) cands.push(hi);
          const mid = vis.find((o) => o.d > 6 && o.d < 12);
          if (mid) cands.push(mid);
        }
      }
      for (const c of cands) {
        if (r.bio && r.observed) break;
        g.robot.teleport(c.pt.add(up(0.3)), 0);
        for (let h = 0.5; h < 24 && !(r.bio && r.observed); h += 1) {
          g.time.hours = h;
          for (let k = 0; k < 20; k++) {
            g.status.restore();
            g.tick(0.15);
            if (g.state() !== 'playing') g.start();
            const eye = g.robot.eyePosition;
            for (const s of ss) {
              if (!s.meshes[0]?.isEnabled() || !(s.isAvailable?.() ?? true)) continue;
              const d = Vector3.Distance(eye, s.getPosition());
              if (d > 25 || !visible(eye, s.getPosition(), s)) continue;
              if (d <= 8) r.bio = true;
              if (s.isConditionMet?.()) { r.observed = true; r.hour = h; }
            }
          }
        }
      }
    }
    return { failures, organisms };
  }, STAND);
  for (const [id, r] of Object.entries(out.organisms)) {
    if (r.bio && r.observed) continue;
    const missing = [!r.bio && 'Biological scan', !r.observed && 'behavior'].filter(Boolean).join(' and ');
    if (NEEDS_PLAYER[id]) console.log(`skip ${id}: ${missing} ${NEEDS_PLAYER[id]}`);
    else out.failures.push(`${id}: ${missing} never possible standing still`);
  }
  await browser.close();
  if (errors.length) out.failures.push(...errors.map((e) => 'page error: ' + e));
  if (out.failures.length) {
    console.error(out.failures.join('\n'));
    process.exit(1);
  }
  console.log(`achievable: all entries pass (${Object.keys(NEEDS_PLAYER).length} interaction behaviors checked by hand)`);
})();
