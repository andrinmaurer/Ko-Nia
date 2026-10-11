import { Color3, DynamicTexture, Scene, StandardMaterial, Texture } from "../babylon";

/**
 * Placeholder surface art, painted onto canvases at load time so the MVP ships
 * without texture files. Every texture tiles; world-scale UVs (see uv.ts) decide
 * how many metres one tile covers.
 */

export type Ctx = CanvasRenderingContext2D;

/** Small seeded random generator so the city looks the same on every load. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function paint(scene: Scene, name: string, size: number, draw: (c: Ctx, s: number, r: () => number) => void, alpha = false): DynamicTexture {
  const tex = new DynamicTexture(name, { width: size, height: size }, scene, true);
  const c = tex.getContext() as unknown as Ctx;
  let seed = 0;
  for (const ch of name) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
  draw(c, size, rng(seed));
  tex.update(false);
  tex.hasAlpha = alpha;
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.anisotropicFilteringLevel = 4;
  return tex;
}

/**
 * Bakes relief into a painted texture: its brightness is treated as height, and
 * each pixel is shaded as if lit from the upper left, so cracks, joints and grime
 * read as dents. Baked once at load, so it costs nothing per frame (a real
 * normal map halved the frame rate on Safari).
 */
function bakeRelief(source: DynamicTexture, strength: number): void {
  const size = source.getSize().width;
  const c = source.getContext() as unknown as Ctx;
  const img = c.getImageData(0, 0, size, size);
  const d = img.data;
  const h = new Float32Array(size * size);
  for (let i = 0; i < h.length; i++) h[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  // Light direction in texture space (x right, y down, z out of the surface).
  const lx = -0.45;
  const ly = -0.55;
  const lz = 0.7;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const lit = (-dx * lx - dy * ly + lz) / len / lz;
      const k = Math.min(1.35, Math.max(0.55, 0.35 + 0.65 * lit));
      const o = (y * size + x) * 4;
      d[o] = Math.min(255, d[o] * k);
      d[o + 1] = Math.min(255, d[o + 1] * k);
      d[o + 2] = Math.min(255, d[o + 2] * k);
    }
  }
  c.putImageData(img, 0, 0);
  source.update(false);
}

const rgba = (r: number, g: number, b: number, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;

/** Fills with a base colour and per-pixel-ish blotch noise. */
function noise(c: Ctx, s: number, r: () => number, base: [number, number, number], spread: number, blotches = 900): void {
  c.fillStyle = rgba(...base);
  c.fillRect(0, 0, s, s);
  for (let i = 0; i < blotches; i++) {
    const v = (r() - 0.5) * spread;
    const size = 2 + r() * s * 0.06;
    c.fillStyle = rgba(base[0] + v, base[1] + v, base[2] + v, 0.25 + r() * 0.3);
    wrapped(c, s, r() * s, r() * s, (x, y) => c.fillRect(x, y, size, size * (0.5 + r())));
  }
  for (let i = 0; i < s * 6; i++) {
    const v = (r() - 0.5) * spread * 1.6;
    c.fillStyle = rgba(base[0] + v, base[1] + v, base[2] + v, 0.5);
    c.fillRect(r() * s, r() * s, 1, 1);
  }
}

/** Draws at (x, y) and at the wrapped copies so the texture tiles seamlessly. */
function wrapped(c: Ctx, s: number, x: number, y: number, draw: (x: number, y: number) => void): void {
  for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) draw(x + dx, y + dy);
  void c;
}

function crack(c: Ctx, s: number, r: () => number, colour: string, width: number, steps: number): void {
  let x = r() * s;
  let y = r() * s;
  let a = r() * Math.PI * 2;
  c.strokeStyle = colour;
  c.lineWidth = width;
  c.lineCap = "round";
  for (let i = 0; i < steps; i++) {
    const nx = x + Math.cos(a) * (4 + r() * 8);
    const ny = y + Math.sin(a) * (4 + r() * 8);
    wrapped(c, s, 0, 0, (ox, oy) => {
      c.beginPath();
      c.moveTo(x + ox, y + oy);
      c.lineTo(nx + ox, ny + oy);
      c.stroke();
    });
    x = (nx + s) % s;
    y = (ny + s) % s;
    a += (r() - 0.5) * 1.2;
  }
}

/** Vertical rain streaks running down from the top of the tile. */
function streaks(c: Ctx, s: number, r: () => number, count: number, alpha: number): void {
  for (let i = 0; i < count; i++) {
    const x = r() * s;
    const len = s * (0.2 + r() * 0.8);
    const g = c.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, rgba(30, 32, 28, alpha));
    g.addColorStop(1, rgba(30, 32, 28, 0));
    c.fillStyle = g;
    c.fillRect(x, 0, 1 + r() * 4, len);
  }
}

/** Large soft stains: water marks, algae and sun-bleached patches. */
function stains(c: Ctx, s: number, r: () => number, count: number, tints: [number, number, number][], alpha: number): void {
  for (let i = 0; i < count; i++) {
    const [cr, cg, cb] = tints[Math.floor(r() * tints.length)];
    const rad = s * (0.08 + r() * 0.22);
    wrapped(c, s, r() * s, r() * s, (x, y) => {
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, rgba(cr, cg, cb, alpha * (0.5 + r() * 0.5)));
      g.addColorStop(1, rgba(cr, cg, cb, 0));
      c.fillStyle = g;
      c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    });
  }
}

/** Moss cushions: clusters of small green dots with a darker rim. */
function mossPatch(c: Ctx, s: number, r: () => number, x: number, y: number, radius: number, dots = 60): void {
  for (let i = 0; i < dots; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.pow(r(), 0.6) * radius;
    const g = r();
    c.fillStyle = rgba(46 + g * 40, 70 + g * 48, 28 + g * 16, 0.8);
    wrapped(c, s, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, (px, py) => {
      c.beginPath();
      c.arc(px, py, 1.5 + r() * 3, 0, Math.PI * 2);
      c.fill();
    });
  }
}

/** Fallen leaves: small warm flecks. */
function litter(c: Ctx, s: number, r: () => number, count: number): void {
  for (let i = 0; i < count; i++) {
    const g = r();
    c.fillStyle = rgba(84 + g * 40, 66 + g * 26, 36 + g * 10, 0.55);
    wrapped(c, s, r() * s, r() * s, (x, y) => {
      c.beginPath();
      c.ellipse(x, y, 2 + r() * 3, 1 + r() * 1.5, r() * Math.PI, 0, Math.PI * 2);
      c.fill();
    });
  }
}

function asphalt(c: Ctx, s: number, r: () => number): void {
  noise(c, s, r, [58, 60, 62], 22, 1400);
  stains(c, s, r, 10, [[40, 44, 40], [86, 84, 78], [52, 64, 40]], 0.35);
  for (let i = 0; i < 7; i++) crack(c, s, r, rgba(18, 18, 18, 0.9), 1.5 + r() * 1.5, 30);
  // Moss in the cracks.
  for (let i = 0; i < 6; i++) crack(c, s, r, rgba(70, 105, 40, 0.6), 3.5, 18);
  for (let i = 0; i < 5; i++) mossPatch(c, s, r, r() * s, r() * s, 10 + r() * 22, 50);
  litter(c, s, r, 160);
  // Wet patches.
  for (let i = 0; i < 6; i++) {
    c.fillStyle = rgba(25, 28, 32, 0.25);
    wrapped(c, s, r() * s, r() * s, (x, y) => {
      c.beginPath();
      c.ellipse(x, y, 20 + r() * 50, 10 + r() * 30, r() * 3, 0, Math.PI * 2);
      c.fill();
    });
  }
}

function concrete(base: [number, number, number]) {
  return (c: Ctx, s: number, r: () => number) => {
    noise(c, s, r, base, 26, 1100);
    stains(c, s, r, 8, [[base[0] * 0.6, base[1] * 0.62, base[2] * 0.55], [base[0] * 1.1, base[1] * 1.08, base[2] * 1.02], [70, 84, 56]], 0.4);
    streaks(c, s, r, 70, 0.26);
    for (let i = 0; i < 4; i++) crack(c, s, r, rgba(40, 40, 38, 0.7), 1, 22);
    // Moss gathering on the top edge of each panel.
    for (let i = 0; i < 4; i++) mossPatch(c, s, r, r() * s, 4 + r() * 8, 14 + r() * 24, 70);
    // Panel joints.
    c.fillStyle = rgba(base[0] * 0.6, base[1] * 0.6, base[2] * 0.6, 0.6);
    c.fillRect(0, 0, s, 2);
    c.fillRect(0, 0, 2, s);
  };
}

function plaster(c: Ctx, s: number, r: () => number): void {
  noise(c, s, r, [182, 170, 148], 20, 900);
  streaks(c, s, r, 30, 0.18);
  // Flaked-off patches showing brick.
  for (let i = 0; i < 4; i++) {
    const x = r() * s;
    const y = r() * s;
    const w = 20 + r() * 50;
    const h = 14 + r() * 30;
    c.fillStyle = rgba(120, 72, 52);
    c.fillRect(x, y, w, h);
    c.strokeStyle = rgba(150, 140, 120);
    for (let by = y; by < y + h; by += 8) {
      c.beginPath();
      c.moveTo(x, by);
      c.lineTo(x + w, by);
      c.stroke();
    }
  }
}

/**
 * Facade: 2 x 2 window bays. One tile = 8 m wide, 6.4 m tall (two storeys).
 */
function facade(base: [number, number, number]) {
  return (c: Ctx, s: number, r: () => number) => {
    concrete(base)(c, s, r);
    const bay = s / 2;
    for (let bx = 0; bx < 2; bx++) {
      for (let by = 0; by < 2; by++) {
        const x = bx * bay + bay * 0.18;
        const y = by * bay + bay * 0.22;
        const w = bay * 0.64;
        const h = bay * 0.5;
        // Floor slab line, with moss on its ledge and soot dripping below it.
        const slab = by * bay + bay * 0.88;
        const drip = c.createLinearGradient(0, slab, 0, slab + bay * 0.4);
        drip.addColorStop(0, rgba(30, 34, 28, 0.5));
        drip.addColorStop(1, rgba(30, 34, 28, 0));
        c.fillStyle = drip;
        c.fillRect(bx * bay, slab, bay, bay * 0.4);
        c.fillStyle = rgba(base[0] * 0.7, base[1] * 0.7, base[2] * 0.7);
        c.fillRect(bx * bay, slab, bay, bay * 0.06);
        for (let k = 0; k < 3; k++) mossPatch(c, s, r, bx * bay + r() * bay, slab - 2, 10 + r() * 18, 40);
        // Frame and glass.
        c.fillStyle = rgba(70, 72, 70);
        c.fillRect(x - 4, y - 4, w + 8, h + 8);
        const broken = r() < 0.4;
        const g = c.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, broken ? rgba(12, 14, 14) : rgba(70, 92, 102));
        g.addColorStop(1, broken ? rgba(22, 24, 22) : rgba(24, 32, 38));
        c.fillStyle = g;
        c.fillRect(x, y, w, h);
        if (broken) {
          // Jagged remaining shards.
          c.fillStyle = rgba(80, 100, 110, 0.8);
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + w * (0.2 + r() * 0.3), y);
          c.lineTo(x, y + h * (0.2 + r() * 0.5));
          c.fill();
        }
        c.fillStyle = rgba(70, 72, 70);
        c.fillRect(x + w / 2 - 2, y, 4, h);
        // Sill stain.
        const sg = c.createLinearGradient(0, y + h, 0, y + h + bay * 0.3);
        sg.addColorStop(0, rgba(40, 42, 36, 0.45));
        sg.addColorStop(1, rgba(40, 42, 36, 0));
        c.fillStyle = sg;
        c.fillRect(x, y + h + 4, w, bay * 0.3);
        // Ivy creeping out of some windows.
        if (r() < 0.35) {
          for (let i = 0; i < 40; i++) {
            c.fillStyle = rgba(50 + r() * 40, 90 + r() * 50, 30 + r() * 20, 0.9);
            c.beginPath();
            c.arc(x + r() * w, y + h + r() * bay * 0.35, 3 + r() * 6, 0, Math.PI * 2);
            c.fill();
          }
        }
      }
    }
  };
}

/** Rolled-down shop shutter, one tile = 4 m x 3.2 m. */
function shutter(c: Ctx, s: number, r: () => number): void {
  noise(c, s, r, [128, 122, 112], 18, 400);
  for (let y = 0; y < s; y += 8) {
    c.fillStyle = rgba(70, 66, 60, 0.55);
    c.fillRect(0, y, s, 2);
  }
  // Rust bleeding down.
  for (let i = 0; i < 16; i++) {
    const x = r() * s;
    const g = c.createLinearGradient(0, s * 0.2, 0, s);
    g.addColorStop(0, rgba(140, 70, 30, 0));
    g.addColorStop(1, rgba(120, 60, 28, 0.7));
    c.fillStyle = g;
    c.fillRect(x, s * 0.2, 6 + r() * 30, s);
  }
  // Faded graffiti-like paint marks.
  c.strokeStyle = rgba(60, 120, 140, 0.35);
  c.lineWidth = 6;
  c.beginPath();
  c.moveTo(s * 0.2, s * 0.6);
  c.bezierCurveTo(s * 0.4, s * 0.3, s * 0.5, s * 0.8, s * 0.75, s * 0.5);
  c.stroke();
  // Frame and kick plate.
  c.fillStyle = rgba(50, 48, 44);
  c.fillRect(0, 0, s, 10);
  c.fillRect(0, 0, 8, s);
  c.fillRect(s - 8, 0, 8, s);
}

function roof(c: Ctx, s: number, r: () => number): void {
  noise(c, s, r, [70, 72, 68], 24, 1200);
  for (let i = 0; i < 30; i++) {
    c.fillStyle = rgba(60 + r() * 30, 100 + r() * 40, 35, 0.6);
    wrapped(c, s, r() * s, r() * s, (x, y) => {
      c.beginPath();
      c.arc(x, y, 6 + r() * 24, 0, Math.PI * 2);
      c.fill();
    });
  }
}

function grass(c: Ctx, s: number, r: () => number): void {
  noise(c, s, r, [62, 92, 38], 30, 1600);
  for (let i = 0; i < 2600; i++) {
    c.strokeStyle = rgba(60 + r() * 50, 100 + r() * 60, 30 + r() * 20, 0.7);
    const x = r() * s;
    const y = r() * s;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (r() - 0.5) * 4, y - 4 - r() * 6);
    c.stroke();
  }
}

function dirt(c: Ctx, s: number, r: () => number): void {
  noise(c, s, r, [78, 74, 56], 26, 1400);
  for (let i = 0; i < 40; i++) {
    c.fillStyle = rgba(70, 104, 40, 0.5);
    wrapped(c, s, r() * s, r() * s, (x, y) => {
      c.beginPath();
      c.arc(x, y, 6 + r() * 30, 0, Math.PI * 2);
      c.fill();
    });
  }
}

function sidewalk(c: Ctx, s: number, r: () => number): void {
  noise(c, s, r, [118, 116, 108], 20, 900);
  stains(c, s, r, 8, [[70, 72, 62], [80, 96, 60]], 0.4);
  litter(c, s, r, 90);
  c.fillStyle = rgba(60, 60, 56, 0.8);
  for (let i = 0; i <= 4; i++) {
    c.fillRect((i * s) / 4, 0, 2, s);
    c.fillRect(0, (i * s) / 4, s, 2);
  }
  // Grass in the joints.
  for (let i = 0; i < 400; i++) {
    const onX = r() < 0.5;
    const line = (Math.floor(r() * 4) * s) / 4;
    const t = r() * s;
    c.fillStyle = rgba(70 + r() * 30, 110 + r() * 40, 40, 0.8);
    c.fillRect(onX ? line - 2 : t, onX ? t : line - 2, 4, 4);
  }
  for (let i = 0; i < 4; i++) crack(c, s, r, rgba(40, 40, 38, 0.7), 1, 14);
}

function bark(c: Ctx, s: number, r: () => number): void {
  noise(c, s, r, [72, 56, 40], 24, 500);
  for (let i = 0; i < 70; i++) {
    c.strokeStyle = rgba(30, 24, 18, 0.6);
    c.lineWidth = 1 + r() * 3;
    const x = r() * s;
    c.beginPath();
    c.moveTo(x, 0);
    c.bezierCurveTo(x + (r() - 0.5) * 20, s * 0.3, x + (r() - 0.5) * 20, s * 0.7, x, s);
    c.stroke();
  }
  for (let i = 0; i < 30; i++) {
    c.fillStyle = rgba(80, 120, 50, 0.5);
    c.fillRect(r() * s, r() * s, 6 + r() * 14, 4 + r() * 10);
  }
}

function wood(c: Ctx, s: number, r: () => number): void {
  noise(c, s, r, [104, 72, 46], 20, 300);
  for (let y = 0; y < s; y += s / 8) {
    c.fillStyle = rgba(40, 26, 16, 0.8);
    c.fillRect(0, y, s, 2);
    for (let i = 0; i < 6; i++) {
      c.strokeStyle = rgba(70, 46, 28, 0.5);
      c.beginPath();
      const yy = y + r() * (s / 8);
      c.moveTo(0, yy);
      c.bezierCurveTo(s * 0.3, yy + 3, s * 0.6, yy - 3, s, yy);
      c.stroke();
    }
  }
}

function leaves(c: Ctx, s: number, r: () => number): void {
  noise(c, s, r, [44, 86, 30], 30, 200);
  for (let i = 0; i < 1400; i++) {
    const g = r();
    c.fillStyle = rgba(30 + g * 60, 70 + g * 80, 20 + g * 25, 0.9);
    wrapped(c, s, r() * s, r() * s, (x, y) => {
      c.beginPath();
      c.ellipse(x, y, 3 + r() * 6, 2 + r() * 3, r() * Math.PI, 0, Math.PI * 2);
      c.fill();
    });
  }
}

function stone(c: Ctx, s: number, r: () => number): void {
  noise(c, s, r, [128, 128, 120], 24, 900);
  for (let i = 0; i < 50; i++) {
    c.fillStyle = rgba(70, 110, 45, 0.55);
    wrapped(c, s, r() * s, r() * s, (x, y) => {
      c.beginPath();
      c.arc(x, y, 4 + r() * 20, 0, Math.PI * 2);
      c.fill();
    });
  }
}

function rust(c: Ctx, s: number, r: () => number): void {
  noise(c, s, r, [118, 72, 44], 34, 1300);
  for (let i = 0; i < 30; i++) {
    c.fillStyle = rgba(150, 90, 50, 0.4);
    c.fillRect(r() * s, r() * s, 10 + r() * 30, 6 + r() * 20);
  }
}

function rubble(c: Ctx, s: number, r: () => number): void {
  noise(c, s, r, [112, 108, 100], 30, 600);
  for (let i = 0; i < 160; i++) {
    const v = 60 + r() * 80;
    c.fillStyle = rgba(v, v * 0.97, v * 0.92);
    wrapped(c, s, r() * s, r() * s, (x, y) => {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 6 + r() * 16, y + r() * 6);
      c.lineTo(x + r() * 10, y + 6 + r() * 14);
      c.fill();
    });
  }
  for (let i = 0; i < 20; i++) {
    c.fillStyle = rgba(70, 110, 45, 0.5);
    c.fillRect(r() * s, r() * s, 6 + r() * 20, 4 + r() * 10);
  }
}

/** Alpha card: a tuft of grass blades. */
function grassTuft(c: Ctx, s: number, r: () => number): void {
  c.clearRect(0, 0, s, s);
  for (let i = 0; i < 34; i++) {
    const x = s * 0.2 + r() * s * 0.6;
    const h = s * (0.35 + r() * 0.6);
    const lean = (r() - 0.5) * s * 0.45;
    const w = 2 + r() * 3;
    const g = r();
    // Tapered blade: wide at the root, a point at the tip.
    c.fillStyle = rgba(55 + g * 70, 95 + g * 80, 25 + g * 25);
    c.beginPath();
    c.moveTo(x - w, s);
    c.quadraticCurveTo(x + lean * 0.3, s - h * 0.6, x + lean, s - h);
    c.quadraticCurveTo(x + lean * 0.3 + w * 0.5, s - h * 0.55, x + w, s);
    c.fill();
  }
}

/** Alpha card: hanging vine curtain. */
function vine(c: Ctx, s: number, r: () => number): void {
  c.clearRect(0, 0, s, s);
  for (let i = 0; i < 14; i++) {
    let x = r() * s;
    const len = s * (0.4 + r() * 0.6);
    c.strokeStyle = rgba(60, 70, 40);
    c.lineWidth = 2;
    for (let y = 0; y < len; y += 5) {
      x += (r() - 0.5) * 3;
      const g = r();
      c.fillStyle = rgba(40 + g * 60, 80 + g * 70, 25 + g * 20);
      c.beginPath();
      c.ellipse(x + (r() - 0.5) * 12, y, 4 + r() * 5, 2.5 + r() * 2, r() * Math.PI, 0, Math.PI * 2);
      c.fill();
    }
  }
}

/** Alpha card: ivy patch for walls. */
function ivy(c: Ctx, s: number, r: () => number): void {
  c.clearRect(0, 0, s, s);
  const cx = s / 2;
  for (let i = 0; i < 900; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.pow(r(), 0.7) * s * 0.48;
    const g = r();
    c.fillStyle = rgba(36 + g * 60, 74 + g * 74, 22 + g * 22, 0.95);
    c.beginPath();
    c.ellipse(cx + Math.cos(a) * d, cx + Math.sin(a) * d * 1.1, 4 + r() * 4, 3 + r() * 2, r() * Math.PI, 0, Math.PI * 2);
    c.fill();
  }
}

/** Alpha card: fern fronds fanning out from the base, tips curling outwards. */
function fern(c: Ctx, s: number, r: () => number): void {
  c.clearRect(0, 0, s, s);
  for (let f = 0; f < 9; f++) {
    const angle = -Math.PI / 2 + (f / 8 - 0.5) * 2.3 + (r() - 0.5) * 0.2;
    const len = s * (0.55 + r() * 0.4);
    const bend = (f / 8 - 0.5) * 0.9;
    let x = s / 2;
    let y = s;
    let a = angle;
    const steps = 22;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const nx = x + Math.cos(a) * (len / steps);
      const ny = y + Math.sin(a) * (len / steps);
      a += bend * 0.06;
      c.strokeStyle = rgba(70, 90, 34);
      c.lineWidth = 2.2 * (1 - t) + 0.5;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(nx, ny);
      c.stroke();
      // Leaflets on both sides, shortest at the tip.
      const leaf = (1 - t) * s * 0.07 + 2;
      const g = r();
      c.fillStyle = rgba(64 + g * 50 + t * 40, 116 + g * 50 + t * 30, 30 + g * 20);
      for (const side of [-1, 1]) {
        const la = a + side * 1.2;
        c.beginPath();
        c.ellipse(nx + Math.cos(la) * leaf * 0.5, ny + Math.sin(la) * leaf * 0.5, leaf * 0.55, Math.max(1.2, leaf * 0.16), la, 0, Math.PI * 2);
        c.fill();
      }
      x = nx;
      y = ny;
    }
  }
}

/** Alpha card: ragged clumps of leaves with gaps, wrapped around canopies to break up their outline. */
function foliage(c: Ctx, s: number, r: () => number): void {
  c.clearRect(0, 0, s, s);
  for (let k = 0; k < 70; k++) {
    const cx = r() * s;
    const cy = r() * s;
    const n = 10 + r() * 14;
    for (let i = 0; i < n; i++) {
      const g = r();
      const a = r() * Math.PI * 2;
      const d = r() * 14;
      c.fillStyle = rgba(40 + g * 70, 78 + g * 88, 22 + g * 26);
      wrapped(c, s, cx + Math.cos(a) * d, cy + Math.sin(a) * d, (x, y) => {
        c.beginPath();
        c.ellipse(x, y, 3.5 + r() * 4.5, 2 + r() * 2.5, r() * Math.PI, 0, Math.PI * 2);
        c.fill();
      });
    }
  }
}

/** Alpha card: a few giant heart-shaped leaves on long stems (oversized, mutated taro). */
function bigLeaf(c: Ctx, s: number, r: () => number): void {
  c.clearRect(0, 0, s, s);
  for (let k = 0; k < 4; k++) {
    const cx = s * (0.25 + r() * 0.5);
    const cy = s * (0.2 + r() * 0.35);
    const w = s * (0.18 + r() * 0.12);
    const h = w * 1.25;
    const tilt = (r() - 0.5) * 0.9;
    c.strokeStyle = rgba(80, 110, 46);
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(s / 2 + (r() - 0.5) * 10, s);
    c.quadraticCurveTo(cx, cy + h, cx, cy + h * 0.45);
    c.stroke();
    c.save();
    c.translate(cx, cy);
    c.rotate(tilt);
    const g = c.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, rgba(96, 156, 58));
    g.addColorStop(1, rgba(44, 92, 34));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, -h / 2);
    c.bezierCurveTo(w, -h / 2, w * 0.9, h * 0.3, 0, h / 2);
    c.bezierCurveTo(-w * 0.9, h * 0.3, -w, -h / 2, 0, -h / 2);
    c.fill();
    // Veins.
    c.strokeStyle = rgba(150, 196, 110, 0.6);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, -h / 2);
    c.lineTo(0, h / 2);
    for (let v = -2; v <= 2; v++) {
      c.moveTo(0, v * h * 0.12);
      c.lineTo(w * 0.6, v * h * 0.12 - h * 0.12);
      c.moveTo(0, v * h * 0.12);
      c.lineTo(-w * 0.6, v * h * 0.12 - h * 0.12);
    }
    c.stroke();
    c.restore();
  }
}

/** Vertical shop sign with faded glyph-like marks (the old script is unreadable now). */
function sign(c: Ctx, s: number, r: () => number): void {
  const palettes: [number, number, number][] = [
    [176, 60, 48],
    [222, 210, 186],
    [60, 92, 120],
    [214, 170, 70],
  ];
  const cols = 4;
  const w = s / cols;
  for (let i = 0; i < cols; i++) {
    const p = palettes[i];
    c.save();
    c.beginPath();
    c.rect(i * w, 0, w, s);
    c.clip();
    c.fillStyle = rgba(...p);
    c.fillRect(i * w, 0, w, s);
    for (let k = 0; k < 120; k++) {
      c.fillStyle = rgba(255, 255, 255, 0.08 * r());
      c.fillRect(i * w + r() * w, r() * s, 4, 4);
    }
    const ink = i === 1 ? rgba(40, 36, 32, 0.8) : rgba(240, 232, 214, 0.75);
    c.strokeStyle = ink;
    c.lineWidth = w * 0.06;
    c.lineCap = "square";
    for (let g = 0; g < 3; g++) {
      const gy = s * 0.08 + g * s * 0.3;
      const size = w * 0.6;
      const gx = i * w + w * 0.2;
      for (let st = 0; st < 4 + r() * 3; st++) {
        c.beginPath();
        const horiz = r() < 0.5;
        const ax = gx + r() * size;
        const ay = gy + r() * size;
        c.moveTo(horiz ? gx : ax, horiz ? ay : gy);
        c.lineTo(horiz ? gx + size : ax + (r() - 0.5) * size * 0.4, horiz ? ay + (r() - 0.5) * 6 : gy + size);
        c.stroke();
      }
    }
    // Weathering.
    streaks(c, s, r, 12, 0.3);
    c.restore();
  }
}

/** Solar panel cells. */
function solar(c: Ctx, s: number, r: () => number): void {
  c.fillStyle = rgba(28, 32, 54);
  c.fillRect(0, 0, s, s);
  const n = 6;
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      const v = r() * 20;
      c.fillStyle = rgba(40 + v, 46 + v, 86 + v);
      c.fillRect((x * s) / n + 2, (y * s) / n + 2, s / n - 4, s / n - 4);
    }
  }
  c.fillStyle = rgba(170, 160, 130);
  c.fillRect(0, 0, s, 4);
  c.fillRect(0, s - 4, s, 4);
  for (let i = 0; i < 12; i++) {
    c.fillStyle = rgba(70, 110, 45, 0.7);
    c.beginPath();
    c.arc(r() * s, r() < 0.5 ? 0 : s, 6 + r() * 14, 0, Math.PI * 2);
    c.fill();
  }
}

/** Faded lane paint: dashed centre line, one tile = 6 m. */
function laneMark(c: Ctx, s: number, r: () => number): void {
  c.clearRect(0, 0, s, s);
  c.fillStyle = rgba(214, 206, 180, 0.55);
  c.fillRect(0, s * 0.35, s * 0.55, s * 0.3);
  for (let i = 0; i < 300; i++) c.clearRect(r() * s * 0.55, s * 0.35 + r() * s * 0.3, 4 + r() * 8, 3 + r() * 6);
}

export type Surface =
  | "asphalt"
  | "sidewalk"
  | "concrete"
  | "concreteDark"
  | "facadeLight"
  | "facadeDark"
  | "facadeWarm"
  | "plaster"
  | "shutter"
  | "roof"
  | "grass"
  | "dirt"
  | "bark"
  | "wood"
  | "leaves"
  | "stone"
  | "rust"
  | "rubble"
  | "solar";

/** `relief` is the strength of the baked-in relief shading; 0 leaves the surface flat. */
const SURFACES: Record<Surface, { draw: (c: Ctx, s: number, r: () => number) => void; size?: number; spec?: number; relief?: number }> = {
  asphalt: { draw: asphalt, spec: 0.3, relief: 4 },
  sidewalk: { draw: sidewalk, spec: 0.12, relief: 5 },
  concrete: { draw: concrete([150, 148, 140]), relief: 4 },
  concreteDark: { draw: concrete([108, 108, 104]), relief: 4 },
  facadeLight: { draw: facade([156, 152, 142]), relief: 3 },
  facadeDark: { draw: facade([104, 106, 102]), relief: 3 },
  facadeWarm: { draw: facade([150, 126, 104]), relief: 3 },
  plaster: { draw: plaster, relief: 4 },
  shutter: { draw: shutter, size: 256, relief: 6 },
  roof: { draw: roof },
  grass: { draw: grass, relief: 3 },
  dirt: { draw: dirt, relief: 3 },
  bark: { draw: bark, size: 256, relief: 8 },
  wood: { draw: wood, size: 256, relief: 5 },
  leaves: { draw: leaves, relief: 4 },
  stone: { draw: stone, size: 256, relief: 5 },
  rust: { draw: rust, size: 256, spec: 0.1, relief: 5 },
  rubble: { draw: rubble, relief: 7 },
  solar: { draw: solar, size: 256, spec: 0.6 },
};

/** Textured, matte material for a surface; created once and shared. */
export function surface(scene: Scene, kind: Surface): StandardMaterial {
  const name = `surface:${kind}`;
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) return existing;
  const def = SURFACES[kind];
  const m = new StandardMaterial(name, scene);
  const diffuse = paint(scene, `tex:${kind}`, def.size ?? 512, def.draw);
  m.diffuseTexture = diffuse;
  if (def.relief) bakeRelief(diffuse, def.relief);
  const spec = def.spec ?? 0.04;
  m.specularColor = new Color3(spec, spec, spec);
  m.specularPower = 48;
  return m;
}

export type Card = "grassTuft" | "vine" | "ivy" | "sign" | "laneMark" | "fern" | "foliage" | "bigLeaf";

const CARDS: Record<Card, { draw: (c: Ctx, s: number, r: () => number) => void; size: number; alpha: boolean }> = {
  grassTuft: { draw: grassTuft, size: 128, alpha: true },
  vine: { draw: vine, size: 256, alpha: true },
  ivy: { draw: ivy, size: 256, alpha: true },
  sign: { draw: sign, size: 256, alpha: false },
  laneMark: { draw: laneMark, size: 128, alpha: true },
  fern: { draw: fern, size: 256, alpha: true },
  foliage: { draw: foliage, size: 256, alpha: true },
  bigLeaf: { draw: bigLeaf, size: 256, alpha: true },
};

/** Material for cut-out cards (grass, vines, signs). Double-sided, alpha-tested. */
export function card(scene: Scene, kind: Card): StandardMaterial {
  const name = `card:${kind}`;
  const existing = scene.getMaterialByName(name);
  if (existing instanceof StandardMaterial) return existing;
  const def = CARDS[kind];
  const m = new StandardMaterial(name, scene);
  m.diffuseTexture = paint(scene, `tex:${kind}`, def.size, def.draw, def.alpha);
  // Alpha-tested (hasAlpha without useAlphaFromDiffuseTexture): no sorting, cheap on mobile GPUs.
  m.backFaceCulling = false;
  m.specularColor = Color3.Black();
  m.alphaCutOff = 0.4;
  // Leaf shells wrap closed canopies: only their outside is ever seen.
  if (kind === "foliage") m.backFaceCulling = true;
  return m;
}
