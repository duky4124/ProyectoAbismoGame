import * as THREE from 'three';

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
type Ctx = CanvasRenderingContext2D;
function mk(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')!];
}
function speck(g: Ctx, w: number, h: number, n: number, r: () => number, light: number, amt: number, size = 1.6) {
  for (let i = 0; i < n; i++) {
    const v = r() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${r() * amt * (v ? light : 1)})`;
    g.fillRect(r() * w, r() * h, 1 + r() * size, 1 + r() * size);
  }
}
function stains(g: Ctx, w: number, h: number, n: number, r: () => number, col: string) {
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, rad = 20 + r() * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, col.replace('A', String(0.1 + r() * 0.18)));
    gr.addColorStop(1, col.replace('A', '0'));
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}
function streaks(g: Ctx, w: number, h: number, n: number, r: () => number, col: string) {
  for (let i = 0; i < n; i++) {
    const x = r() * w, len = 40 + r() * h * 0.7, y = r() * h * 0.5;
    const gr = g.createLinearGradient(0, y, 0, y + len);
    gr.addColorStop(0, col.replace('A', '0')); gr.addColorStop(0.3, col.replace('A', String(0.1 + r() * 0.2))); gr.addColorStop(1, col.replace('A', '0'));
    g.fillStyle = gr; g.fillRect(x, y, 1 + r() * 4, len);
  }
}
function tex(c: HTMLCanvasElement, aniso = 4): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
  return t;
}

function concreteWall(seed: number, tint: [number, number, number]) {
  const r = rng(seed); const w = 256, h = 448; const [c, g] = mk(w, h);
  g.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`; g.fillRect(0, 0, w, h);
  speck(g, w, h, 9000, r, 0.5, 0.18, 2.2);
  stains(g, w, h, 14, r, 'rgba(20,18,14,A)');
  streaks(g, w, h, 22, r, 'rgba(60,40,20,A)');
  // juntas de paneles
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h);
  g.fillRect(0, h * 0.5, w, 2); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(3, 0, 1, h);
  // suciedad inferior
  const gr = g.createLinearGradient(0, h * 0.7, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(8,6,4,0.55)');
  g.fillStyle = gr; g.fillRect(0, h * 0.7, w, h * 0.3);
  // franja de zócalo
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, h - 40, w, 3);
  // grietas
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.2;
  if (r() < 0.7) { let x = r() * w, y = r() * h * 0.5; g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 12; i++) { x += (r() - 0.5) * 22; y += 8 + r() * 14; g.lineTo(x, y); } g.stroke(); }
  return c;
}
function metalWall(seed: number) {
  const r = rng(seed); const w = 256, h = 448; const [c, g] = mk(w, h);
  g.fillStyle = '#3b4650'; g.fillRect(0, 0, w, h);
  speck(g, w, h, 6000, r, 0.4, 0.15);
  for (let y = 0; y <= h; y += h / 3) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, y, w, 3); g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, y + 3, w, 1); }
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h);
  for (let y = 14; y < h; y += h / 3) for (let x = 14; x < w; x += 38) { g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(x - 1, y - 1, 1.3, 0, 7); g.fill(); }
  // franja de peligro
  g.save(); g.beginPath(); g.rect(0, h - 70, w, 26); g.clip();
  for (let x = -40; x < w + 40; x += 28) { g.fillStyle = '#c9a227'; g.beginPath(); g.moveTo(x, h - 44); g.lineTo(x + 14, h - 44); g.lineTo(x + 40, h - 70); g.lineTo(x + 26, h - 70); g.fill(); }
  g.restore(); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h - 70, w, 26);
  stains(g, w, h, 10, r, 'rgba(70,35,10,A)'); streaks(g, w, h, 25, r, 'rgba(110,50,15,A)');
  return c;
}
function tileWall(seed: number) {
  const r = rng(seed); const w = 256, h = 448; const [c, g] = mk(w, h);
  g.fillStyle = '#9aa29c'; g.fillRect(0, 0, w, h);
  const tw = 32, th = 32;
  for (let y = 0; y < h; y += th) for (let x = 0; x < w; x += tw) {
    const v = 150 + r() * 25; g.fillStyle = `rgb(${v},${v + 6},${v + 2})`; g.fillRect(x + 1, y + 1, tw - 2, th - 2);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 1, y + 1, tw - 2, 2);
  }
  g.fillStyle = 'rgba(30,35,30,0.55)'; for (let y = 0; y < h; y += th) g.fillRect(0, y, w, 1.5); for (let x = 0; x < w; x += tw) g.fillRect(x, 0, 1.5, h);
  stains(g, w, h, 12, r, 'rgba(40,20,10,A)'); streaks(g, w, h, 20, r, 'rgba(50,30,10,A)'); speck(g, w, h, 3000, r, 0.3, 0.1);
  // salpicadura oscura
  if (r() < 0.6) for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${70 + r() * 30},8,8,${0.4 + r() * 0.4})`; g.beginPath(); g.arc(w * 0.5 + (r() - 0.5) * 100, h * 0.45 + (r() - 0.5) * 120, r() * 6, 0, 7); g.fill(); }
  const gr = g.createLinearGradient(0, h * 0.75, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = gr; g.fillRect(0, h * 0.75, w, h * 0.25);
  return c;
}
function floorTex(kind: string, seed: number) {
  const r = rng(seed); const w = 256, h = 256; const [c, g] = mk(w, h);
  if (kind === 'concrete') {
    g.fillStyle = '#3a3b3b'; g.fillRect(0, 0, w, h); speck(g, w, h, 9000, r, 0.4, 0.2, 2.5); stains(g, w, h, 12, r, 'rgba(0,0,0,A)');
    stains(g, w, h, 4, r, 'rgba(60,40,15,A)');
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); let x = r() * w, y = 0; g.moveTo(x, y); for (let i = 0; i < 14; i++) { x += (r() - 0.5) * 30; y += 18; g.lineTo(x, y); } g.stroke();
    g.fillStyle = 'rgba(200,170,40,0.55)'; g.fillRect(0, 0, w, 6);
  } else if (kind === 'metal') {
    g.fillStyle = '#3d4247'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { const o = ((x / 16 + y / 16) % 2) * 8; g.fillStyle = 'rgba(255,255,255,0.22)'; g.save(); g.translate(x + 4 + o * 0.2, y + 8); g.rotate(((x / 16 + y / 16) % 2 ? 1 : -1) * 0.7); g.fillRect(-6, -1.5, 12, 3); g.restore(); }
    speck(g, w, h, 5000, r, 0.4, 0.15); stains(g, w, h, 10, r, 'rgba(70,35,10,A)'); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
  } else if (kind === 'tile') {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = (x + y) % 2 ? 120 : 92; const j = r() * 14; g.fillStyle = `rgb(${v + j},${v + j + 4},${v + j})`; g.fillRect(x * 64, y * 64, 64, 64); }
    g.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = 0; i <= 4; i++) { g.fillRect(i * 64 - 1, 0, 2, h); g.fillRect(0, i * 64 - 1, w, 2); }
    speck(g, w, h, 5000, r, 0.4, 0.15); stains(g, w, h, 12, r, 'rgba(20,10,5,A)');
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${60 + r() * 30},6,6,${0.3 + r() * 0.4})`; g.beginPath(); g.arc(r() * w, r() * h, r() * 4, 0, 7); g.fill(); }
  } else { // carpet
    g.fillStyle = '#2b3438'; g.fillRect(0, 0, w, h); speck(g, w, h, 14000, r, 0.5, 0.22, 1.5); stains(g, w, h, 8, r, 'rgba(0,0,0,A)'); stains(g, w, h, 3, r, 'rgba(80,10,10,A)');
  }
  return c;
}
function ceilingTex(seed: number) {
  const r = rng(seed); const w = 256, h = 256; const [c, g] = mk(w, h);
  g.fillStyle = '#2c2e30'; g.fillRect(0, 0, w, h); speck(g, w, h, 6000, r, 0.3, 0.15);
  g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(0, 0, w, 4); g.fillRect(0, 0, 4, h); g.fillRect(w / 2 - 2, 0, 4, h); g.fillRect(0, h / 2 - 2, w, 4);
  stains(g, w, h, 10, r, 'rgba(40,25,10,A)');
  return c;
}
function woodTex(seed: number, base: string) {
  const r = rng(seed); const w = 128, h = 128; const [c, g] = mk(w, h);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${0.05 + r() * 0.15})`; g.lineWidth = 1; const y = r() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 10, w * 0.6, y + (r() - 0.5) * 10, w, y + (r() - 0.5) * 6); g.stroke(); }
  speck(g, w, h, 1000, r, 0.2, 0.1);
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
  return c;
}
function rustTex(seed: number, base: string) {
  const r = rng(seed); const w = 128, h = 128; const [c, g] = mk(w, h);
  g.fillStyle = base; g.fillRect(0, 0, w, h); speck(g, w, h, 3500, r, 0.3, 0.2, 2);
  stains(g, w, h, 8, r, 'rgba(110,50,15,A)'); stains(g, w, h, 4, r, 'rgba(0,0,0,A)'); streaks(g, w, h, 10, r, 'rgba(120,55,15,A)');
  return c;
}
export function signCanvas(lines: string[], bg: string, fg: string, w = 256, h = 128, border = true) {
  const [c, g] = mk(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const r = rng(lines.join('').length * 13 + 7); speck(g, w, h, 1500, r, 0.3, 0.2);
  if (border) { g.strokeStyle = fg; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12); }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((ln, i) => { const size = i === 0 ? Math.min(46, (w - 40) / (ln.length * 0.62)) : Math.min(26, (w - 40) / (ln.length * 0.6)); g.font = `bold ${size}px sans-serif`; g.fillText(ln, w / 2, (h / (n + 1)) * (i + 1)); });
  return c;
}
export function bloodCanvas(seed: number) {
  const r = rng(seed); const [c, g] = mk(128, 128);
  for (let i = 0; i < 26; i++) { const x = 64 + (r() - 0.5) * 90, y = 64 + (r() - 0.5) * 90, rad = r() * 14 * (1 - Math.hypot(x - 64, y - 64) / 110) + 1; g.fillStyle = `rgba(${55 + r() * 40},4,6,${0.5 + r() * 0.4})`; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); }
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 36); gr.addColorStop(0, 'rgba(70,4,6,0.85)'); gr.addColorStop(1, 'rgba(70,4,6,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return c;
}
export function softCircle() {
  const [c, g] = mk(64, 64); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
export function canvasTexture(c: HTMLCanvasElement) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

export type Mats = Record<string, THREE.Material>;

export function buildMaterials(aniso: number): Mats {
  const M: Mats = {};
  const std = (c: HTMLCanvasElement, rough: number, metal: number, bump = 1.2, key = '') => {
    const t = tex(c, aniso);
    const m = new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: bump, roughness: rough, metalness: metal });
    if (key) M[key] = m; return m;
  };
  // paredes (variantes)
  for (let i = 0; i < 3; i++) {
    std(concreteWall(11 + i * 7, [92, 94, 92]), 0.95, 0.02, 1.5, `wall_concrete_${i}`);
    std(metalWall(31 + i * 5), 0.55, 0.6, 1.0, `wall_metal_${i}`);
    std(tileWall(51 + i * 3), 0.6, 0.05, 1.0, `wall_tile_${i}`);
    std(concreteWall(71 + i * 9, [70, 74, 80]), 0.9, 0.05, 1.5, `wall_dark_${i}`);
  }
  std(floorTex('concrete', 3), 0.9, 0.05, 1.5, 'floor_concrete');
  std(floorTex('metal', 5), 0.45, 0.7, 1.4, 'floor_metal');
  std(floorTex('tile', 8), 0.35, 0.1, 0.8, 'floor_tile');
  std(floorTex('carpet', 9), 1, 0, 1, 'floor_carpet');
  std(ceilingTex(4), 0.9, 0.1, 1, 'ceil');
  std(woodTex(2, '#4a3524'), 0.8, 0, 0.8, 'wood');
  std(woodTex(6, '#6b5230'), 0.85, 0, 1, 'crate');
  std(rustTex(3, '#5a4030'), 0.7, 0.7, 1.5, 'rust');
  std(rustTex(7, '#2d3238'), 0.5, 0.8, 1, 'steel');
  std(rustTex(9, '#74798a'), 0.55, 0.7, 1, 'lockerblue');
  std(rustTex(12, '#5d3030'), 0.6, 0.6, 1, 'red');
  std(rustTex(15, '#8a8a82'), 0.7, 0.3, 1, 'white');
  std(rustTex(17, '#a08a2a'), 0.65, 0.5, 1, 'yellow');
  std(rustTex(19, '#1a1c1e'), 0.7, 0.2, 0.8, 'dark');
  std(rustTex(21, '#36443c'), 0.9, 0, 0.8, 'fabric');
  M.screen = new THREE.MeshBasicMaterial({ color: 0x2a9d8f });
  M.screen2 = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
  M.lamp = new THREE.MeshBasicMaterial({ color: 0xcfe3ff });
  M.lamp_red = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  M.lamp_off = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
  M.glass = new THREE.MeshStandardMaterial({ color: 0x8aa8b0, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.35 });
  M.pipe = new THREE.MeshStandardMaterial({ color: 0x5b6269, roughness: 0.45, metalness: 0.85 });
  M.pipe_rust = new THREE.MeshStandardMaterial({ color: 0x6a4630, roughness: 0.6, metalness: 0.7 });
  M.black = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.9 });
  return M;
}
