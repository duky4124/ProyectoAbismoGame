import * as THREE from 'three';
import type { Game } from './engine';
import { CELL, World, WALL_H } from './world';
import { audio } from './audio';
import { bloodCanvas, canvasTexture, rng, signCanvas } from './textures';

export interface ChapterRuntime {
  start: { x: number; z: number; yaw: number; run: (fromSave: boolean) => void };
  update?: (dt: number) => void;
  onPickup?: (item: string, id: string) => void;
  onDoc?: (id: string) => void;
  onCraft?: (item: string) => void;
}

const FACE: Record<string, { dx: number; dz: number; yaw: number }> = {
  n: { dx: 0, dz: -1, yaw: 0 },
  s: { dx: 0, dz: 1, yaw: Math.PI },
  e: { dx: 1, dz: 0, yaw: -Math.PI / 2 },
  w: { dx: -1, dz: 0, yaw: Math.PI / 2 },
};

const bloodTex: THREE.CanvasTexture[] = [];

export function buildChapter1(g: Game): ChapterRuntime {
  const W = new World(62, 44);
  g.world = W;
  const R = rng(4049);
  const m = (c: number) => c * CELL;

  // ======================= HABITACIONES =======================
  const room = (id: string, name: string, x0: number, y0: number, x1: number, y1: number, floor: string, wall: string, extra: object = {}) => W.carve({ id, name, x0, y0, x1, y1, floor, wall, ...extra });
  room('hangar', 'HANGAR 7 — Zona de llegada', 2, 12, 19, 27, 'floor_concrete', 'wall_concrete');
  room('cor_a', 'Pasillo de servicio A', 20, 19, 27, 19, 'floor_metal', 'wall_metal');
  room('atrio', 'Vestíbulo NEXUS', 28, 13, 41, 25, 'floor_tile', 'wall_dark');
  room('link_n', 'Pasillo norte', 34, 10, 34, 12, 'floor_metal', 'wall_metal', { silent: true });
  room('hall_n', 'Corredor de oficinas', 24, 8, 46, 9, 'floor_carpet', 'wall_dark');
  room('ofi_a', 'Oficina de Dirección', 24, 2, 31, 6, 'floor_carpet', 'wall_concrete');
  room('seg', 'Sala de Seguridad', 34, 2, 40, 6, 'floor_metal', 'wall_metal');
  room('ofi_b', 'Oficinas — Cubículos', 43, 2, 48, 6, 'floor_tile', 'wall_tile');
  room('dw1', '', 27, 7, 27, 7, 'floor_metal', 'wall_metal', { silent: true });
  room('dw2', '', 37, 7, 37, 7, 'floor_metal', 'wall_metal', { silent: true });
  room('dw3', '', 45, 7, 45, 7, 'floor_metal', 'wall_metal', { silent: true });
  room('link_s', 'Pasillo sur', 34, 26, 34, 28, 'floor_metal', 'wall_metal', { silent: true });
  room('almacen', 'Almacén B', 24, 29, 43, 36, 'floor_concrete', 'wall_concrete');
  room('secret', 'Sala sin nombre', 28, 38, 36, 42, 'floor_tile', 'wall_tile');
  room('dws', '', 32, 37, 32, 37, 'floor_tile', 'wall_tile', { silent: true });
  room('duct1', 'Conducto de mantenimiento', 20, 26, 22, 26, 'floor_metal', 'wall_metal', { crouch: true, ceilH: 1.4 });
  room('duct2', 'Conducto de mantenimiento', 22, 27, 22, 33, 'floor_metal', 'wall_metal', { crouch: true, ceilH: 1.4 });
  room('duct3', 'Conducto de mantenimiento', 23, 33, 23, 33, 'floor_metal', 'wall_metal', { crouch: true, ceilH: 1.4 });
  room('cor_e', 'Pasillo de la esclusa', 42, 19, 47, 19, 'floor_metal', 'wall_metal');
  room('exclusa', 'Esclusa 3 — Ascensor de servicio', 48, 14, 56, 24, 'floor_metal', 'wall_metal');
  room('lift', 'Ascensor', 58, 18, 60, 20, 'floor_metal', 'wall_metal', { silent: true });
  room('dwl', '', 57, 19, 57, 19, 'floor_metal', 'wall_metal', { silent: true });

  // ======================= UTILIDADES DE PROPS =======================
  const crate = (x: number, z: number, s = 1, y = 0, ry = 0, col = true) => W.boxProp('crate', x, y + s / 2, z, s, s, s, col, ry);
  const barrel = (x: number, z: number, k = 'rust') => W.cylProp(k, x, 0.5, z, 0.32, 1.0, true, 10);
  const pillar = (x: number, z: number) => { W.cylProp('steel', x, WALL_H / 2, z, 0.45, WALL_H, true, 12); W.prop('yellow').cyl(x, 0.9, z, 0.47, 0.5, 12); };
  const pipeRun = (x0: number, z0: number, x1: number, z1: number, y: number, r = 0.12, k = 'pipe') => {
    if (z0 === z1) W.prop(k).cyl((x0 + x1) / 2, y, z0, r, Math.abs(x1 - x0), 8, Math.PI / 2, 0);
    else W.prop(k).cyl(x0, y, (z0 + z1) / 2, r, Math.abs(z1 - z0), 8, 0, Math.PI / 2);
  };
  const cableHang = (x: number, z: number, h = 1.2) => W.prop('black').cyl(x, WALL_H - h / 2, z, 0.025, h, 5);

  const shelf = (x: number, z: number, len: number, alongX = true, items = true) => {
    const sx = alongX ? len : 0.6, sz = alongX ? 0.6 : len;
    for (let i = 0; i < 4; i++) W.prop('steel').box(x, 0.2 + i * 0.6, z, sx, 0.05, sz);
    const n = Math.max(2, Math.floor(len / 1.5) + 1);
    for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : i / (n - 1) - 0.5; const px = alongX ? x + t * (len - 0.1) : x - (alongX ? 0 : 0.3) + (alongX ? 0 : 0.3); const pz = alongX ? z : z + t * (len - 0.1); W.prop('steel').box(px, 1.1, pz, alongX ? 0.06 : 0.6, 2.3, alongX ? 0.6 : 0.06); }
    if (items) for (let i = 0; i < 4; i++) for (let k = 0; k < Math.floor(len / 0.8); k++) if (R() < 0.7) { const t = (k + 0.5) * 0.8 - len / 2; const s = 0.25 + R() * 0.25; W.prop(R() < 0.6 ? 'crate' : R() < 0.5 ? 'white' : 'dark').box(alongX ? x + t : x, 0.225 + i * 0.6 + s / 2, alongX ? z : z + t, s * 1.2, s, s, R() * 0.4); }
    W.addCollider({ x0: x - sx / 2, x1: x + sx / 2, z0: z - sz / 2, z1: z + sz / 2 });
  };

  // ======================= NUEVA TAQUILLA HUECA CON MIRILLA FUNCIONAL =======================
  const locker = (x: number, z: number, face: 'n' | 's' | 'e' | 'w', hideId?: string) => {
    const f = FACE[face];
    const along = f.dx === 0;

    // Pared trasera
    W.prop('lockerblue').box(
      x - f.dx * 0.27, 1.0, z - f.dz * 0.27,
      along ? 0.86 : 0.04, 2.0, along ? 0.04 : 0.86
    );

    // Techo y suelo
    W.prop('lockerblue').box(x, 1.98, z, along ? 0.86 : 0.58, 0.04, along ? 0.58 : 0.86);
    W.prop('lockerblue').box(x, 0.02, z, along ? 0.86 : 0.58, 0.04, along ? 0.58 : 0.86);

    // Laterales izquierdo y derecho
    if (along) {
      W.prop('lockerblue').box(x - 0.41, 1.0, z, 0.04, 2.0, 0.58);
      W.prop('lockerblue').box(x + 0.41, 1.0, z, 0.04, 2.0, 0.58);
    } else {
      W.prop('lockerblue').box(x, 1.0, z - 0.41, 0.58, 2.0, 0.04);
      W.prop('lockerblue').box(x, 1.0, z + 0.41, 0.58, 2.0, 0.04);
    }

    // Puerta frontal con apertura para espiar
    const doorX = x + f.dx * 0.28;
    const doorZ = z + f.dz * 0.28;

    // Parte inferior de la puerta (hasta 1.35m)
    W.prop('lockerblue').box(
      doorX, 0.675, doorZ,
      along ? 0.82 : 0.03, 1.35, along ? 0.03 : 0.82
    );

    // Parte superior de la puerta (de 1.72m a 2.0m)
    W.prop('lockerblue').box(
      doorX, 1.86, doorZ,
      along ? 0.82 : 0.03, 0.28, along ? 0.03 : 0.82
    );

    // Bordes laterales de la rejilla
    if (along) {
      W.prop('lockerblue').box(doorX - 0.28, 1.535, doorZ, 0.26, 0.37, 0.03);
      W.prop('lockerblue').box(doorX + 0.28, 1.535, doorZ, 0.26, 0.37, 0.03);
    } else {
      W.prop('lockerblue').box(doorX, 1.535, doorZ - 0.28, 0.03, 0.37, 0.26);
      W.prop('lockerblue').box(doorX, 1.535, doorZ + 0.28, 0.03, 0.37, 0.26);
    }

    // Lamas / rejillas horizontales con hueco real para mirar entre ellas
    const slats = [1.38, 1.46, 1.54, 1.62, 1.70];
    for (const sy of slats) {
      W.prop('dark').box(
        doorX, sy, doorZ,
        along ? 0.34 : 0.035, 0.02, along ? 0.035 : 0.34
      );
    }

    // Manija metálica
    W.prop('steel').box(
      doorX + (along ? 0.32 : f.dx * 0.02),
      1.1,
      doorZ + (along ? f.dz * 0.02 : 0.32),
      along ? 0.03 : 0.06, 0.14, along ? 0.06 : 0.03
    );

    // Colisión física para no atravesar la taquilla caminando
    W.addCollider({
      x0: x - (along ? 0.43 : 0.29),
      x1: x + (along ? 0.43 : 0.29),
      z0: z - (along ? 0.29 : 0.43),
      z1: z + (along ? 0.29 : 0.43),
    });

    // Escondite: coloca la cámara justo detrás de las rendijas mirando hacia afuera
    if (hideId) {
      g.addHide(
        {
          id: hideId,
          x: x - f.dx * 0.06,
          z: z - f.dz * 0.06,
          yaw: f.yaw,
          eye: 1.50, // justo en el espacio entre lamas para ver el pasillo
          type: 'locker',
          exit: { x: x + f.dx * 1.15, z: z + f.dz * 1.15 },
        },
        'Esconderte en el armario'
      );
    }
  };

  const desk = (x: number, z: number, ry = 0, hideId?: string, face: 'n' | 's' | 'e' | 'w' = 's') => {
    const a = Math.abs(Math.cos(ry)) > 0.5;
    const sx = a ? 1.6 : 0.8, sz = a ? 0.8 : 1.6;
    W.prop('wood').box(x, 0.75, z, sx, 0.06, sz);
    if (a) { W.prop('wood').box(x - 0.75, 0.37, z, 0.06, 0.74, sz); W.prop('wood').box(x + 0.75, 0.37, z, 0.06, 0.74, sz); W.prop('wood').box(x, 0.45, z + (face === 'n' ? 0.36 : -0.36), 1.5, 0.5, 0.04); }
    else { W.prop('wood').box(x, 0.37, z - 0.75, sx, 0.74, 0.06); W.prop('wood').box(x, 0.37, z + 0.75, sx, 0.74, 0.06); }
    W.addCollider({ x0: x - sx / 2, x1: x + sx / 2, z0: z - sz / 2, z1: z + sz / 2 });
    if (hideId) { const f = FACE[face]; g.addHide({ id: hideId, x, z, yaw: f.yaw, eye: 0.52, type: 'desk', exit: { x: x + f.dx * 1.3, z: z + f.dz * 1.3 } }, 'Esconderte debajo de la mesa'); }
  };

  const monitor = (x: number, y: number, z: number, ry = 0, k = 'screen') => { W.prop('dark').box(x, y + 0.14, z, 0.44, 0.3, 0.05, ry); W.prop(k).box(x - Math.sin(ry) * -0.03, y + 0.14, z + Math.cos(ry) * -0.03 * -1, 0.38, 0.24, 0.02, ry); };
  const chair = (x: number, z: number, ry = 0) => { W.boxProp('dark', x, 0.45, z, 0.5, 0.06, 0.5, true, ry); W.prop('dark').box(x + Math.sin(ry) * 0.24, 0.8, z + Math.cos(ry) * 0.24, 0.5, 0.7, 0.06, ry); W.prop('steel').cyl(x, 0.22, z, 0.04, 0.44, 5); };
  const terminal = (x: number, z: number, face: 'n' | 's' | 'e' | 'w', k = 'screen') => {
    const f = FACE[face]; const along = f.dx === 0;
    W.boxProp('steel', x, 0.55, z, along ? 0.7 : 0.5, 1.1, along ? 0.5 : 0.7);
    W.prop(k).box(x + f.dx * 0.12, 1.2, z + f.dz * 0.12, along ? 0.55 : 0.1, 0.35, along ? 0.1 : 0.55, 0, -0.5 * (along ? 1 : 0), 0);
  };
  const debris = (x: number, z: number, rad: number, n: number) => { for (let i = 0; i < n; i++) { const a = R() * 6.28, d = R() * rad, s = 0.1 + R() * 0.35; W.prop(R() < 0.5 ? 'rust' : 'dark').box(x + Math.cos(a) * d, s / 2 * 0.7, z + Math.sin(a) * d, s * 1.5, s * 0.7, s, R() * 3, R() * 0.4, R() * 0.4); } };
  const signAt = (lines: string[], bg: string, fg: string, x: number, y: number, z: number, ry: number, w = 1.8, h = 0.9) => {
    const cv = signCanvas(lines, bg, fg, 256, Math.round(256 * h / w)); const t = canvasTexture(cv);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.6 }));
    mesh.position.set(x, y, z); mesh.rotation.y = ry; g.level.add(mesh);
  };
  const blood = (x: number, z: number, s: number, wall?: { y: number; ry: number }) => {
    if (!bloodTex.length) for (let i = 0; i < 3; i++) bloodTex.push(canvasTexture(bloodCanvas(i * 17 + 3)));
    const mat = new THREE.MeshStandardMaterial({ map: bloodTex[Math.floor(R() * 3)], transparent: true, depthWrite: false, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -3 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s, s), mat);
    if (wall) { mesh.position.set(x, wall.y, z); mesh.rotation.y = wall.ry; } else { mesh.position.set(x, 0.015, z); mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = R() * 6; }
    g.level.add(mesh);
  };
  const body = (x: number, z: number, ry: number) => {
    W.prop('fabric').box(x, 0.16, z, 0.5, 0.2, 1.0, ry); W.prop('white').box(x + Math.sin(ry) * -0.62, 0.14, z + Math.cos(ry) * -0.62, 0.22, 0.22, 0.24, ry);
    W.prop('fabric').box(x + Math.cos(ry) * 0.3, 0.1, z - Math.sin(ry) * 0.3 + Math.sin(ry) * 0.5, 0.45, 0.12, 0.2, ry + 0.8); blood(x, z, 2.2);
  };

  // luces
  const em = (c: number, i: number, r: number) => ({ c, i, r });
  const tube = (cx: number, cz: number, state: 'dead' | 'flicker' | 'dim' | 'steady', rot = false) => {
    const x = m(cx), z = m(cz);
    g.addLight({ x, y: WALL_H - 0.25, z, rot, flicker: state === 'flicker' ? 'dying' : 'none', em: state === 'dead' ? undefined : state === 'steady' ? em(0xb8d0ff, 10, 11) : em(0xc9dcff, state === 'dim' ? 7 : 12, 11), main: em(0xe6efff, 34, 16), fixture: 'tube' });
  };
  const redLight = (cx: number, cz: number, y = WALL_H - 0.4) => g.addLight({ x: m(cx), y, z: m(cz), em: em(0xff2415, 14, 13), main: undefined, alarm: true, flicker: 'slow', fixture: 'alarm' });

  // ======================= HANGAR =======================
  for (const px of [14, 26, 34]) for (const pz of [32, 50]) pillar(px, pz);
  pillar(8, 32); pillar(8, 50);

  // vehículo estrellado
  W.boxProp('yellow', 12, 0.9, 37, 5.6, 1.2, 2.6);
  W.prop('dark').box(10.6, 1.85, 37, 2.2, 1.0, 2.4); W.prop('glass').box(11.75, 1.85, 37, 0.05, 0.8, 2.2);
  W.prop('red').box(10.6, 2.4, 37, 0.3, 0.12, 1.6);
  W.prop('rust').box(15.1, 0.75, 37, 0.9, 0.9, 2.5, 0.05, 0, 0.1);
  for (const wx of [10, 14.1]) for (const wz of [35.7, 38.3]) W.prop('black').cyl(wx, 0.45, wz, 0.45, 0.35, 10, 0, Math.PI / 2);
  W.prop('lamp_off').box(14.45, 1.0, 36, 0.1, 0.18, 0.4); W.prop('lamp_off').box(14.45, 1.0, 38, 0.1, 0.18, 0.4);
  g.addLight({ x: 15.3, y: 1.0, z: 36.3, em: em(0xfff0cc, 22, 14), flicker: 'dying', fixture: 'none' });
  g.addEmitter({ x: 14.5, y: 1.5, z: 37, kind: 'smoke', rate: 5 }); g.addEmitter({ x: 14.9, y: 1.0, z: 37.8, kind: 'spark', rate: 1.2 });
  debris(16.5, 37, 3, 14); blood(18, 41, 1.4);

  // pared rota
  W.prop('dark').box(4.3, 1.8, 36, 0.4, 3.6, 7); debris(6, 37, 2.5, 10);

  // estanterías y cajas
  shelf(10, 24.8, 4.2); shelf(17, 24.8, 3.2); shelf(26, 24.8, 4.4);
  W.boxProp('steel', 22, 0.45, 25.2, 2.2, 0.9, 0.9); W.prop('dark').box(22, 0.92, 25.2, 2.2, 0.06, 0.9);
  crate(32, 26.5, 1.1); crate(33.2, 26.5, 1.0); crate(32.5, 26.5, 0.9, 1.1, 0.3, false);
  barrel(36.5, 27); barrel(37.3, 27.8, 'red'); barrel(36.4, 28.6);
  crate(6.5, 28, 1.0); crate(7.6, 28.2, 1.2); crate(6.9, 28.1, 1.0, 1.2, 0.4, false);
  crate(30, 46, 1.1); crate(31.3, 46, 1.0); crate(30.5, 46.1, 1.0, 1.1, 0.2, false);
  W.boxProp('crate', 24, 1.1, 51.4, 1.4, 2.2, 1.4, true, 0.1); W.boxProp('crate', 26.2, 1.1, 51.4, 1.4, 2.2, 1.4, true, -0.1); W.boxProp('crate', 25, 0.55, 53.1, 1.4, 1.1, 1.4, true);

  // carretilla y generador
  W.boxProp('yellow', 30.5, 0.7, 53, 2.2, 1.0, 1.3); W.prop('dark').box(30, 1.5, 53, 1.1, 0.9, 1.2); W.prop('steel').box(32.1, 1.4, 53, 0.1, 2.4, 1.1);
  W.boxProp('steel', 37.2, 0.8, 51, 1.2, 1.6, 2.6); W.prop('screen').box(36.58, 1.2, 51, 0.02, 0.4, 0.8); W.prop('red').box(37.2, 1.65, 50.4, 0.8, 0.12, 0.3);
  g.addEmitter({ x: 37, y: 1.7, z: 50, kind: 'spark', rate: 0.5 });

  // tuberías y cables
  pipeRun(4, 26, 40, 26, 3.2, 0.14); pipeRun(4, 28, 40, 28, 3.3, 0.1, 'pipe_rust'); pipeRun(5, 24.5, 5, 55.5, 3.2, 0.12); pipeRun(39, 24.5, 39, 55.5, 3.2, 0.12, 'pipe_rust');
  for (let i = 0; i < 9; i++) cableHang(8 + i * 3.7 + R(), 28 + R() * 24, 0.8 + R() * 1.4);
  g.addEmitter({ x: 20, y: 3.0, z: 26.2, kind: 'steam', rate: 3 });

  // señales y cuerpo
  body(29, 40, 0.5); body(21, 48, 2.4);
  signAt(['HANGAR 7', 'NEXUS CORP · NIVEL −8000 m'], '#1d2226', '#e5b43a', 22, 2.8, 24.05, 0, 2.6, 0.9);
  signAt(['PELIGRO', 'ZONA DE ALTA PROFUNDIDAD'], '#b9962a', '#111', 4.05, 2.4, 44, Math.PI / 2, 2.2, 0.9);
  signAt(['ATRIO →', 'Acceso Nivel 1'], '#1d3a52', '#e8f4ff', 39.95, 2.6, 33, -Math.PI / 2, 1.8, 0.8);
  signAt(['MANTENIMIENTO', 'CONDUCTO 4B'], '#222', '#9ad', 39.95, 1.2, 55.0, -Math.PI / 2, 1.4, 0.6);
  W.prop('dark').box(40.1, 2.5, 53, 0.3, 2.2, 2.0); W.prop('dark').box(47.9, 2.5, 67, 0.3, 2.2, 2.0);

  // Escondites del hangar
  locker(5.0, 52, 'e', 'h_lock1');
  W.boxProp('crate', 18, 1.1, 51.6, 1.5, 2.2, 1.2, true); W.boxProp('crate', 19.6, 1.1, 51.6, 1.5, 2.2, 1.2, true);
  g.addHide({ id: 'h_crate1', x: 18.8, z: 52.8, yaw: 0, eye: 0.85, type: 'crate', exit: { x: 18.8, z: 49.8 } }, 'Esconderte detrás de las cajas');

  // terminal
  terminal(39.2, 34, 'w', 'screen2');
  g.addInteract({ id: 'save_hangar', x: 39.2, y: 1.1, z: 34, reach: 2.5, label: () => 'Terminal — Guardar partida', use: () => saveTerm('Hangar 7') });

  // luces
  redLight(4, 14); redLight(17, 14); redLight(4, 25); redLight(17, 25); redLight(10, 19.5);
  tube(7, 16, 'flicker'); tube(13, 16, 'dead'); tube(7, 23, 'dim'); tube(14, 23, 'flicker'); tube(11, 19.5, 'dead', true);

  // ---- OBJETOS DEL HANGAR ----
  g.addPickup({ id: 'p_pipe', item: 'pipe', x: 16.8, z: 34.8, y: 0.08 });
  g.addPickup({ id: 'p_tape', item: 'tape', x: 22.6, z: 25.2, y: 0.95, label: 'Coger cinta americana' });
  g.addPickup({ id: 'p_can1', item: 'can', x: 35.2, z: 29.4, y: 0.08 });
  g.addPickup({ id: 'p_wire1', item: 'wire', x: 5.2, z: 45, y: 0.08, label: 'Coger cable pelado' });
  g.addPickup({ id: 'p_water1', item: 'water', x: 23.2, z: 50, y: 0.08 });
  g.addPickup({ id: 'p_bat1', item: 'battery', x: 36.4, z: 47.4, y: 0.08 });
  g.addPickup({ id: 'p_band1', item: 'bandage', x: 7.2, z: 26.4, y: 0.08 });
  g.addPickup({ id: 'p_alc1', item: 'alcohol', x: 10, z: 24.8, y: 0.85 });
  g.addPickup({ id: 'p_ration1', item: 'ration', x: 17, z: 24.8, y: 0.85 });
  g.addDocPickup({ id: 'dp_manifest', doc: 'd_manifest', x: 10.6, z: 38.6, y: 0.95 });

  // cabina del vehículo
  g.addInteract({
    id: 'cab', x: 10.6, y: 1.5, z: 38.3, reach: 3.0, cone: 0.55,
    label: () => (g.P.hasLight ? null : 'Registrar la guantera'),
    use: () => {
      g.P.hasLight = true; g.P.battery = Math.max(g.P.battery, 55); audio.pickup(); g.toast('🔦 Linterna encontrada', 'good'); g.addScore(100, 'LINTERNA');
      g.say('DAN', 'Sigue funcionando… Poca batería. Tengo que ahorrarla.');
      g.hint('flash', 'Pulsa F para encender y apagar la linterna. Gasta batería: úsala con cabeza.', true);
      g.after(5, () => g.hint('move', 'Shift = correr (gasta resistencia) · C = agacharte · Espacio = saltar', true));
      g.after(10, () => g.hint('inv', 'Pulsa Tab para abrir la mochila y fabricar objetos.', true));
      g.after(16, () => firstEncounter());
    },
  });

  // conducto
  g.addTrigger(18, 25, 19, 27, () => { if (!g.flag('ductHint')) { g.setFlag('ductHint'); g.say('DAN', 'Hay un conducto de mantenimiento al fondo. Estrecho, pero quizá evite la puerta del pasillo.'); } });
  g.addTrigger(20, 26, 22, 26, () => { if (!g.flag('vent')) { g.setFlag('vent'); g.addScore(150, 'RUTA ALTERNATIVA'); g.hint('duct', 'En los conductos te mueves agachado. Las criaturas grandes no pueden seguirte aquí.', true); } });

  // ======================= PASILLO A =======================
  const d1 = g.makeDoor({
    id: 'd1', cx: 20, cy: 19, kind: 'steel', locked: true, name: 'Compuerta atascada',
    check: () => {
      if (!g.has('crowbar')) return 'La compuerta está deformada por el impacto. Necesitas una palanca (tubo + cinta: Tab → Fabricación).';
      audio.pry({ x: m(20.5), y: 1.2, z: m(19.5) }); g.shake(0.4, 0.9); g.makeNoise(m(20.5), m(19.5), 16);
      g.after(1.2, () => { g.unlockDoor(d1, true); g.setFlag('d1_open'); g.addScore(200, 'COMPUERTA FORZADA'); g.say('DAN', 'Cedió. Adelante.'); });
      return null;
    },
  });
  signAt(['SERVICIO A', '→ VESTÍBULO'], '#1d2226', '#9ad0ff', m(24), 2.3, m(19) - 0.99, 0, 1.6, 0.7);
  pipeRun(m(20), m(19) - 0.8, m(28), m(19) - 0.8, 3.1, 0.1); pipeRun(m(20), m(19) + 0.85, m(28), m(19) + 0.85, 2.9, 0.07, 'pipe_rust');
  cableHang(m(23), m(19), 0.7); cableHang(m(26), m(19.3), 1.0);
  tube(22.5, 19.5, 'flicker', true); tube(25.5, 19.5, 'dead', true); redLight(21.5, 19.5);
  g.addEmitter({ x: m(25), y: 3.0, z: m(19) + 0.6, kind: 'steam', rate: 2 });
  g.addPickup({ id: 'p_bat_a', item: 'battery', x: m(26.5) + 0.6, z: m(19.5) + 0.4, y: 0.08 });
  blood(m(22), m(19.5), 1.3);

  // ======================= ATRIO =======================
  for (const px of [31, 38]) for (const pz of [15, 23]) pillar(m(px + 0.5), m(pz + 0.5));
  W.boxProp('white', 70, 0.55, 46, 8, 1.1, 1.0); W.prop('dark').box(70, 1.12, 46, 8.2, 0.07, 1.2);
  monitor(67, 1.15, 46.1, Math.PI); monitor(72, 1.15, 46.1, Math.PI, 'screen2');
  g.addHide({ id: 'h_recep', x: 70, z: 47.5, yaw: 0, eye: 0.7, type: 'desk', exit: { x: 70, z: 44.2 } }, 'Esconderte tras el mostrador');
  signAt(['NEXUS', 'Innovación bajo la superficie'], '#0e1216', '#66d0e0', 70, 2.6, 52.0 - 0.05, Math.PI, 3.6, 1.0);

  for (let i = 0; i < 4; i++) W.boxProp('fabric', 60 + i * 1.3, 0.28, 31.4, 1.1, 0.55, 0.7); chair(78.5, 30, 2.5); chair(80.2, 31, 4); W.boxProp('dark', 78.5, 0.35, 32.3, 1.6, 0.7, 0.8);
  W.boxProp('red', 82, 1.0, 27.2, 1.1, 2.0, 0.9); W.prop('lamp').box(82, 1.3, 26.74, 0.8, 1.1, 0.02);

  g.addPickup({ id: 'p_water2', item: 'water', x: 81.4, z: 28.6, y: 0.08 });
  g.addPickup({ id: 'p_ration2', item: 'ration', x: 82.5, z: 28.7, y: 0.08 });
  terminal(57.2, 34, 'e', 'screen2');
  g.addInteract({ id: 'save_atrio', x: 57.2, y: 1.1, z: 34, reach: 2.5, label: () => 'Terminal — Guardar partida', use: () => saveTerm('Vestíbulo NEXUS') });
  g.addPickup({ id: 'p_band2', item: 'bandage', x: 58.5, z: 29.3, y: 0.08 });
  g.addPickup({ id: 'p_bat2', item: 'battery', x: 78.5, z: 32.3, y: 0.74 });
  g.addPickup({ id: 'p_can2', item: 'can', x: 64.4, z: 31.6, y: 0.08 });
  g.addPickup({ id: 'p_glow1', item: 'glowstick', x: 62, z: 50.6, y: 0.08 });
  debris(66, 36, 3, 14); debris(78, 44, 2, 8); blood(68, 40, 2.6); blood(72, 31, 1.6);
  body(62.8, 43, 1.2);
  W.prop('yellow').box(65.5, 0.5, 38, 0.4, 0.6, 0.4, 0.3);
  signAt(['OFICINAS', '↑ Seguridad · Dirección'], '#1d3a52', '#e8f4ff', 68.0, 2.3, 26.05, 0, 1.8, 0.8);
  signAt(['ESCLUSA 3', 'ACCESO RESTRINGIDO →'], '#4a1414', '#ffd6d6', 83.95, 2.4, 40, -Math.PI / 2, 2.0, 0.8);
  signAt(['ALMACÉN B', '↓'], '#2a2a2a', '#d4d4d4', 68.0, 2.3, 51.95, Math.PI, 1.6, 0.7);
  pipeRun(56.5, 28, 83.5, 28, 3.3, 0.12); pipeRun(56.5, 50, 83.5, 50, 3.3, 0.1, 'pipe_rust');
  tube(31, 16, 'flicker'); tube(37, 16, 'dead'); tube(31, 22, 'dim'); tube(37, 22, 'flicker'); tube(34.5, 19.5, 'dead'); redLight(28.5, 13.5); redLight(41, 25);
  g.addEmitter({ x: 84, y: 1.0, z: 30, kind: 'steam', rate: 1.5 });

  g.addTrigger(28, 17, 29, 21, () => {
    if (g.flag('atrio')) return; g.setFlag('atrio');
    g.say('LENA', 'Dan, te recibo mejor. Eso es el vestíbulo de NEXUS. Más adentro necesitas acceso de Nivel 2.', true);
    g.say('LENA', 'La tarjeta debería estar en Seguridad, en la zona de oficinas, al norte. Ten cuidado… hay algo en los sensores.', true);
    g.directorOn = true; g.directorGap = [40, 80]; g.checkpoint('Vestíbulo NEXUS', true);
  });

  // ======================= CORREDOR NORTE / OFICINAS =======================
  g.makeDoor({ id: 'dn', cx: 34, cy: 11, kind: 'office', heavy: false, name: 'Puerta' });
  g.makeDoor({ id: 'doa', cx: 27, cy: 7, kind: 'office', heavy: false });
  g.makeDoor({ id: 'dob', cx: 45, cy: 7, kind: 'office', heavy: false });
  const dseg = g.makeDoor({
    id: 'dseg', cx: 37, cy: 7, kind: 'steel', locked: true, name: 'Seguridad — teclado',
    check: () => {
      if (!g.flag('doc:d_memo') && !g.flag('doc:d_calendar')) g.hint('code', 'Un teclado de 4 dígitos. Alguien dejó pistas en las oficinas…', true);
      g.openKeypad('1403', () => { g.unlockDoor(dseg, true); g.setFlag('seg_open'); g.addScore(300, 'CÓDIGO CORRECTO'); g.say('DAN', 'El cumpleaños de su hija… Entramos.'); });
      return null;
    },
  });

  W.prop('dark').box(73.2, 1.3, 16.1, 0.42, 0.55, 0.12); W.prop('screen2').box(73.2, 1.36, 16.17, 0.3, 0.2, 0.02); W.prop('lamp_red').box(73.2, 1.1, 16.17, 0.2, 0.05, 0.02);
  signAt(['SEGURIDAD', 'Solo personal autorizado'], '#4a1414', '#ffd6d6', 76.2, 2.8, 16.05, 0, 1.6, 0.6);
  signAt(['DIRECCIÓN'], '#1b1b1b', '#e8e0c0', 53.2, 2.7, 16.05, 0, 1.4, 0.5);
  signAt(['CUBÍCULOS B'], '#1b1b1b', '#e8e0c0', 89.2, 2.7, 16.05, 0, 1.4, 0.5);
  for (let i = 0; i < 6; i++) tube(26 + i * 4, 9, i % 3 === 0 ? 'flicker' : i % 3 === 1 ? 'dead' : 'dim', true);
  pipeRun(48, 16.4, 94, 16.4, 3.2, 0.09); cableHang(60, 18, 0.8); cableHang(80, 17.5, 1.2);
  locker(49, 16.65, 's', 'h_lock_hall'); locker(50, 16.65, 's');
  W.boxProp('white', 92.5, 0.5, 16.55, 1.2, 1.0, 0.5);
  blood(66, 18, 1.8); blood(86, 17.6, 1.2); debris(70, 18.5, 2, 8);
  g.addEmitter({ x: 90, y: 3.1, z: 17.5, kind: 'spark', rate: 0.6 });

  // --- Oficina de Dirección ---
  desk(53, 7.5, 0); chair(53, 9, 3.14); monitor(53.6, 0.78, 7.4, 0);
  desk(60.5, 6, Math.PI / 2); chair(59, 6, 1.6);
  shelf(49, 12, 3.2, false); shelf(63.4, 11, 3.0, false, true);
  W.boxProp('dark', 56, 0.3, 5.2, 3.0, 0.6, 0.9); W.boxProp('fabric', 56, 0.28, 11.6, 2.2, 0.55, 0.9);
  locker(62.7, 5.3, 'w', 'h_lock_a');
  signAt(['NEXUS', 'Calidad · Seguridad · Futuro'], '#101418', '#9fd8e8', 56, 2.4, 4.05, 0, 2.2, 0.9);
  g.addDocPickup({ id: 'dp_memo', doc: 'd_memo', x: 52.5, z: 7.7, y: 0.82 });
  g.addInteract({ id: 'drawer_a', x: 53, y: 0.6, z: 8, reach: 2.2, cone: 0.6, label: () => (g.collected.has('drawer_a') ? null : 'Abrir cajón'), use: () => { if (!g.canAdd('medkit')) { g.toast('Inventario lleno.', 'warn'); return; } g.collected.add('drawer_a'); g.addItem('medkit'); audio.pickup(); g.toast('🩹 Botiquín en el cajón', 'good'); g.addScore(80, 'ESCONDITE'); } });
  g.addPickup({ id: 'p_ration3', item: 'canned', x: 60.5, z: 5.4, y: 0.82 });
  blood(58, 9, 1.8);
  tube(52, 8, 'flicker'); tube(60, 8, 'dead'); tube(56, 12, 'dim');

  // --- Cubículos B ---
  for (let i = 0; i < 3; i++) { desk(89 + i * 3.4, 6, Math.PI / 2); W.boxProp('white', 90.8 + i * 3.4, 0.8, 8, 0.1, 1.6, 3.0); chair(88.3 + i * 3.4, 6, 1.6); monitor(89.3 + i * 3.4, 0.78, 6.4, 0, i === 1 ? 'screen2' : 'screen'); }
  desk(93, 10.5, 0, 'h_desk_b', 'n'); chair(93, 11.8, 0);
  g.addDocPickup({ id: 'dp_calendar', doc: 'd_calendar', x: 92.8, z: 10.4, y: 0.82 });
  g.addDocPickup({ id: 'dp_audio1', doc: 'd_audio1', x: 92.0, z: 6.4, y: 0.82, label: 'Escuchar grabadora' });
  g.addPickup({ id: 'p_bat3', item: 'battery', x: 96.6, z: 12.6, y: 0.08 });
  g.addPickup({ id: 'p_wire2', item: 'wire', x: 87, z: 12.4, y: 0.08 });
  g.addPickup({ id: 'p_band3', item: 'bandage', x: 95.5, z: 5.5, y: 0.82 });
  body(88, 11, 0.4); blood(91, 11, 1.6);
  signAt(['“Nunca mires', 'a los ojos”'], '#2a1010', '#d33', 86.05, 1.8, 11, Math.PI / 2, 1.7, 0.8);
  tube(90, 5, 'flicker'); tube(94.5, 11, 'dead'); tube(88, 11, 'dim');

  // --- Seguridad ---
  desk(75, 6.5, 0, 'h_desk_seg', 's'); chair(75, 8.2, 3.14); monitor(75.5, 0.78, 6.4, 0, 'screen2'); monitor(74.4, 0.78, 6.4, 0);
  for (let i = 0; i < 4; i++) { W.boxProp('dark', 69.2, 0.6, 5 + i * 1.7, 0.5, 1.2, 1.4); W.prop('screen').box(69.47, 1.0, 5 + i * 1.7, 0.02, 0.4, 0.9); }
  W.boxProp('steel', 81, 1.0, 6, 0.9, 2.0, 2.4); W.prop('red').box(80.54, 1.0, 6, 0.02, 1.8, 2.2);
  locker(79.8, 11.2, 'w', 'h_lock_seg'); locker(79.8, 9.8, 'w');
  g.addPickup({ id: 'p_keycard', item: 'keycard_blue', x: 76.2, z: 6.6, y: 0.82, score: 400 });
  g.addDocPickup({ id: 'dp_incident', doc: 'd_incident', x: 73.6, z: 6.6, y: 0.82 });
  g.addPickup({ id: 'p_medkit_seg', item: 'medkit', x: 72, z: 12.5, y: 0.08 });
  g.addPickup({ id: 'p_noise_seg', item: 'wire', x: 81.2, z: 4.5, y: 0.08 });
  blood(72, 9, 2.0, undefined); blood(80, 7, 1.4);
  tube(72, 7, 'steady'); tube(77, 11, 'flicker'); redLight(36, 5);

  // ======================= ALMACÉN B =======================
  g.makeDoor({ id: 'ds', cx: 34, cy: 27, kind: 'office', heavy: false });
  for (const sx of [53, 63, 74, 82]) for (const sz of [62, 68]) if (!(sx === 63 && sz === 68)) shelf(sx, sz, 7, true, true);
  crate(50, 60, 1.2); crate(51.3, 60, 1.0); crate(50.4, 60, 1.0, 1.0, 0.4, false);
  barrel(86.5, 61); barrel(87.3, 61.8, 'red'); barrel(86.6, 62.7);
  barrel(86.6, 68.6, 'red'); barrel(85.8, 69.4); barrel(86.8, 70.2, 'rust');
  W.boxProp('yellow', 56, 0.35, 71.6, 2.4, 0.7, 1.0); W.boxProp('crate', 58.8, 0.5, 71.4, 1.4, 1.0, 1.0); W.boxProp('crate', 60.4, 0.5, 71.5, 1.1, 1.0, 1.1);
  
  g.addHide({ id: 'h_crate_alm', x: 84.5, z: 70.8, yaw: Math.PI / 2, eye: 0.85, type: 'crate', exit: { x: 82.5, z: 69.5 } }, 'Esconderte detrás de los barriles');
  W.boxProp('crate', 83.6, 1.0, 71.8, 1.3, 2.0, 1.3); W.boxProp('crate', 83.6, 1.0, 70.2, 1.3, 2.0, 1.3);
  locker(49, 66, 'e', 'h_lock_alm');

  pipeRun(48, 60, 88, 60, 3.3, 0.12); pipeRun(48, 72, 88, 72, 3.2, 0.1, 'pipe_rust');
  for (let i = 0; i < 6; i++) cableHang(52 + i * 6 + R(), 61 + R() * 12, 0.7 + R());
  g.addEmitter({ x: 70, y: 3.1, z: 60.4, kind: 'steam', rate: 2.5 }); g.addEmitter({ x: 55, y: 3.1, z: 72, kind: 'spark', rate: 0.7 });
  debris(66, 66, 3, 16); blood(74, 70, 2.2); body(70, 65, 1.9);
  signAt(['ALMACÉN B', 'Suministros · Sector Lab'], '#1d2226', '#e5b43a', 68, 2.8, 58.05, 0, 2.6, 0.9);
  signAt(['ELLOS ESTÁN', 'DETRÁS DE LA PARED'], '#14110f', '#b22', 65, 1.7, 71.95, Math.PI, 2.2, 1.0);
  blood(65, 71.93, 1.8, { y: 1.1, ry: Math.PI });

  g.addPickup({ id: 'p_fuse', item: 'fuse_burnt', x: 53, z: 62, y: 0.85, label: 'Coger fusible quemado' });
  g.addPickup({ id: 'p_wire3', item: 'wire', x: 63, z: 61.8, y: 0.85 });
  g.addPickup({ id: 'p_can3', item: 'can', x: 74, z: 62.2, y: 0.85 });
  g.addPickup({ id: 'p_bat4', item: 'battery', x: 82, z: 67.8, y: 0.85 });
  g.addPickup({ id: 'p_water3', item: 'water', x: 51.2, z: 71, y: 0.08 });
  g.addPickup({ id: 'p_alc2', item: 'alcohol', x: 74, z: 68, y: 0.85 });
  g.addPickup({ id: 'p_ration4', item: 'ration', x: 53, z: 68, y: 0.85 });
  g.addPickup({ id: 'p_glow2', item: 'glowstick', x: 49.3, z: 70.0, y: 0.08 });
  g.addDocPickup({ id: 'dp_supply', doc: 'd_supply', x: 63, z: 67.9, y: 0.85 });

  // palanca oculta
  W.prop('dark').box(87.9, 1.2, 70, 0.18, 0.5, 0.3); W.prop('red').box(87.7, 1.35, 70, 0.1, 0.34, 0.06, 0, 0, 0.5);
  g.addInteract({
    id: 'lever', x: 87.7, y: 1.2, z: 70, reach: 2.6, cone: 0.6, label: () => (g.flag('secret_open') ? null : 'Tirar de la palanca oculta'),
    use: () => {
      g.setFlag('secret_open'); audio.rumble(); g.shake(0.5, 1.2); g.addScore(300, 'PASAJE SECRETO');
      const sd = W.doorList.find((d) => d.id === 'secret')!; g.after(1.2, () => { g.unlockDoor(sd, true); g.say('DAN', '¿Una sala escondida? ¿Qué demonios hacían aquí…?'); });
    },
  });
  g.makeDoor({ id: 'secret', cx: 32, cy: 37, kind: 'secret', locked: true });
  tube(52, 31, 'dim'); tube(60, 34, 'dead'); tube(68, 31, 'flicker'); tube(76, 34, 'dim'); tube(83, 31, 'flicker'); tube(60, 31, 'dead'); redLight(24.5, 29.5);

  // sala secreta
  W.boxProp('white', 65, 0.45, 80, 1.2, 0.9, 2.4); W.prop('steel').box(65, 0.95, 80, 1.3, 0.05, 2.5); for (const dz of [-0.6, 0.6]) W.prop('black').box(65, 1.0, 80 + dz, 1.3, 0.04, 0.12);
  W.boxProp('dark', 70, 0.6, 77, 1.0, 1.2, 0.6); W.prop('screen2').box(70, 1.45, 76.8, 1.4, 0.7, 0.04);
  W.boxProp('steel', 58.6, 0.5, 84.4, 1.6, 1.0, 0.8); monitor(58.4, 1.0, 84.4, 0, 'screen'); monitor(59, 1.0, 84.4, 0, 'screen2');
  chair(72, 83, 2.4); W.boxProp('white', 57.4, 1.0, 80, 0.6, 2.0, 1.4);
  blood(66, 83, 2.8); blood(60, 78, 1.6); blood(71, 85.9, 1.6, { y: 1.3, ry: Math.PI });
  signAt(['0-ECO', 'PROTOCOLO · REINTEGRACIÓN'], '#10161a', '#79e0c0', 65, 2.6, 85.9, Math.PI, 2.4, 0.9);
  signAt(['¿DÓNDE ESTÁ', 'DANIEL?'], '#12100f', '#c33', 56.1, 1.8, 83, Math.PI / 2, 1.8, 0.9);
  g.addDocPickup({ id: 'dp_secret', doc: 'd_secret', x: 70, z: 77.5, y: 1.05 });
  g.addDocPickup({ id: 'dp_secret_audio', doc: 'd_secret_audio', x: 58.8, z: 84.4, y: 1.02, label: 'Escuchar grabación oculta' });
  g.addPickup({ id: 'p_medkit_sec', item: 'medkit', x: 62.5, z: 84.6, y: 0.08, secret: true, score: 200 });
  g.addPickup({ id: 'p_bat_sec', item: 'battery', x: 72.4, z: 79, y: 0.08, secret: true, score: 200 });
  g.addPickup({ id: 'p_glow_sec', item: 'glowstick', x: 71, z: 84, y: 0.08, secret: true, score: 200 });
  g.addLight({ x: 65, y: 3.2, z: 80, em: em(0x66ffcc, 11, 12), flicker: 'slow', fixture: 'tube', rot: true });
  g.addLight({ x: 60, y: 3.2, z: 84, em: em(0xff3344, 6, 8), flicker: 'dying', fixture: 'alarm' });
  g.addTrigger(28, 38, 36, 42, () => { if (g.flag('secret_found')) return; g.setFlag('secret_found'); g.addScore(500, 'SALA OCULTA'); g.toast('Has descubierto una sala oculta.', 'good'); });

  // ======================= CONDUCTO DE MANTENIMIENTO =======================
  g.addLight({ x: m(21), y: 1.2, z: m(26.5), em: em(0xffb060, 5, 5), flicker: 'slow', fixture: 'bulb' });
  g.addLight({ x: m(22.5), y: 1.2, z: m(30), em: em(0xffb060, 5, 5), fixture: 'bulb' });
  g.addPickup({ id: 'p_duct_item', item: 'glowstick', x: m(22.5), z: m(31), y: 0.08, secret: true, score: 100 });
  g.addPickup({ id: 'p_duct_item2', item: 'wire', x: m(21.5), z: m(26.5), y: 0.08 });

  // ======================= PASILLO ESCLUSA / ESCLUSA =======================
  const d5 = g.makeDoor({
    id: 'd5', cx: 44, cy: 19, kind: 'steel', locked: true, name: 'Esclusa — lector de tarjeta',
    check: () => {
      if (!g.has('keycard_blue')) return 'Lector de tarjetas Nivel 2. Necesitas la tarjeta azul de Seguridad.';
      g.unlockDoor(d5, true); g.setFlag('d5'); g.addScore(200, 'ACCESO CONCEDIDO'); audio.success();
      if (g.alarmOn) g.after(2, () => g.alarm(false));
      return null;
    },
  });
  signAt(['NIVEL 2', 'Tarjeta requerida'], '#14243a', '#7cc0ff', 88, 2.5, 38 - 0.9, 0, 1.6, 0.7);
  tube(43.5, 19.5, 'flicker', true); tube(46.5, 19.5, 'dead', true); redLight(45, 19.5);
  pipeRun(84, 38.3, 96, 38.3, 3.0, 0.09); cableHang(92, 39, 1);
  g.addEmitter({ x: 93, y: 2.9, z: 39.4, kind: 'steam', rate: 2 });
  blood(92, 39, 1.4);

  // Esclusa
  for (const px of [102, 108]) pillar(px, 32);
  for (const px of [102, 108]) pillar(px, 46);
  W.boxProp('steel', 105, 0.7, 28.9, 2.4, 1.4, 0.7); W.prop('dark').box(105, 1.5, 28.55, 1.0, 1.0, 0.1); W.prop('lamp_red').box(105, 1.5, 28.49, 0.8, 0.8, 0.02);

  terminal(112.4, 36.2, 'w', 'screen2'); W.prop('yellow').box(112.4, 0.1, 36.2, 1.0, 0.1, 1.0);
  locker(96.6, 31, 'e', 'h_lock_ex'); locker(96.6, 32.4, 'e');
  W.boxProp('crate', 109, 1.0, 46.2, 1.4, 2.0, 1.3, true); W.boxProp('crate', 110.6, 0.55, 46.2, 1.4, 1.1, 1.3, true); W.boxProp('crate', 99.5, 0.5, 46.3, 1.0, 1.0, 1.0);

  g.addHide({ id: 'h_crate_ex', x: 110, z: 46.2, yaw: 0, eye: 0.85, type: 'crate', exit: { x: 110, z: 43.8 } }, 'Esconderte detrás de las cajas');
  terminal(97.4, 44, 'e', 'screen2');
  g.addInteract({ id: 'save_ex', x: 97.4, y: 1.1, z: 44, reach: 2.5, label: () => 'Terminal — Guardar partida', use: () => saveTerm('Esclusa 3') });

  g.addPickup({ id: 'p_bat5', item: 'battery', x: 99.5, z: 31, y: 0.08 });
  g.addPickup({ id: 'p_medkit_ex', item: 'medkit', x: 108.5, z: 30, y: 0.08 });
  g.addPickup({ id: 'p_water4', item: 'water', x: 100.5, z: 45.4, y: 0.08 });
  g.addPickup({ id: 'p_noise_ex', item: 'can', x: 104, z: 40, y: 0.08 });
  g.addPickup({ id: 'p_wire_ex', item: 'wire', x: 99, z: 40, y: 0.08 });

  pipeRun(96.5, 30, 113.5, 30, 3.2, 0.14); pipeRun(96.5, 48, 113.5, 48, 3.3, 0.11, 'pipe_rust'); pipeRun(113.4, 29, 113.4, 49, 3.1, 0.12);
  signAt(['ESCLUSA 3', 'ASCENSOR DE SERVICIO'], '#4a1414', '#ffd6d6', 113.95, 2.8, 41.3, -Math.PI / 2, 2.4, 0.9);
  signAt(['FUSIBLE', 'PRINCIPAL'], '#222', '#ffcc33', 105, 2.4, 28.05, 0, 1.4, 0.6);
  g.addEmitter({ x: 100, y: 3.1, z: 30.5, kind: 'steam', rate: 2 }); g.addEmitter({ x: 105, y: 1.5, z: 28.9, kind: 'spark', rate: 0.5 });
  blood(104, 38, 3); body(100, 36, 0.8);
  tube(101, 15.5, 'flicker'); tube(105, 19.5, 'dead'); tube(109, 22.5, 'flicker'); tube(101, 22.5, 'dim'); tube(109, 15.5, 'dead'); redLight(48.5, 14.5); redLight(56, 24);

  // caja de fusibles
  g.addInteract({
    id: 'fusebox', x: 105, y: 1.4, z: 28.9, reach: 2.8, cone: 0.65,
    label: () => (g.flag('power') ? null : g.has('fuse') ? 'Colocar fusible reparado' : 'Caja de fusibles (vacía)'),
    use: () => {
      if (g.has('fuse')) {
        g.removeItem('fuse', 1); g.setFlag('power'); g.setPower(true); g.addScore(500, 'ENERGÍA RESTAURADA'); audio.success();
        g.alarm(false); g.toast('⚡ Energía restaurada', 'good');
        g.say('LENA', '¡Tengo lectura de energía! El ascensor de servicio está al este. Llámalo desde la consola.', true);
      } else if (g.has('fuse_burnt')) { audio.deny(); g.say('DAN', 'El fusible está quemado. Con un cable podría puentearlo… Tab → Fabricación.'); }
      else { audio.deny(); g.say('DAN', 'Falta el fusible principal. Según el albarán, hay uno en el Almacén B.'); }
    },
  });

  // consola del ascensor
  let liftT = 0;
  g.addInteract({
    id: 'console', x: 112.4, y: 1.2, z: 36.2, reach: 2.8, cone: 0.6,
    label: () => (g.flag('lift_called') ? null : g.flag('power') ? 'Llamar al ascensor' : 'Consola (sin energía)'),
    use: () => {
      if (!g.flag('power')) { audio.deny(); g.say('DAN', 'Sin energía. Hay una caja de fusibles en la pared norte.'); return; }
      g.setFlag('lift_called'); liftT = 28; audio.rumble(); g.shake(0.6, 1.5); g.alarm(true);
      g.say('LENA', 'El ascensor está bajando… ¡veintiocho segundos! Dan, algo viene por el pasillo. ¡Aguanta!', true);
      g.after(3, () => {
        if (g.enemy.active) { g.enemy.startChase(); } else {
          const spot = g.pickSpawn(20, 60, false);
          g.spawnEnemy('chase', spot ? { at: spot } : { minD: 16, maxD: 120, los: null });
        }
      });
    },
  });

  const lift = g.makeDoor({ id: 'lift', cx: 57, cy: 19, kind: 'steel', locked: true, name: 'Ascensor' });
  g.addLight({ x: m(59.5), y: 3.2, z: m(19.5), em: em(0xbfffd0, 18, 10), fixture: 'tube', rot: true });
  W.prop('steel').box(121.6, 1.0, 39, 0.12, 0.08, 4.0); W.prop('yellow').box(116.3, 0.06, 39, 0.5, 0.03, 4.0);

  g.addTrigger(58, 18, 60, 20, () => {
    if (!g.flag('lift_open') || g.state !== 'playing') return;
    g.say('LENA', 'Dan, escúchame. Central pregunta qué has visto ahí abajo. ¿Les cuento todo?', true);
    g.after(1.5, () => g.openChoice('LA ELECCIÓN DE DAN', [
      { label: 'Confiar en Lena: informar de todo a Central.', flag: 'choice_trust' },
      { label: 'Ocultar lo que sabes y responder a la señal desconocida.', flag: 'choice_signal' },
    ], () => finish()));
  });

  const finish = () => {
    const trust = g.flag('choice_trust'); const secret = g.flag('doc:d_secret');
    if (!trust) g.say('???', 'Bien hecho, Dan. Sigue descendiendo. Hay cosas sobre ti que necesitas recordar.', true);
    else g.say('LENA', 'Bien. Voy a pedir refuerzos. Pero Dan… la señal de tu transpondedor lleva años registrada en este edificio.', true);
    g.after(2.5, () => g.complete({
      title: 'CAPÍTULO 1 COMPLETADO',
      text: (trust ? 'Has confiado en Lena. Central enviará un equipo… si puede fiarse de lo que le has contado. ' : 'Has respondido a la señal desconocida. Alguien en las profundidades sabe quién eres. ') + (secret ? 'El expediente 0-ECO no sale de tu cabeza: ¿y si tú nunca fuiste el rescatista?' : 'Algo no encaja: el edificio parece conocerte. Quizá haya más en las salas ocultas.') + ' — Capítulo 2: LA INSTALACIÓN (en desarrollo).',
    }));
  };

  // ======================= OBJETIVO Y WAYPOINTS =======================
  g.waypoints = [
    [30, 15], [38, 15], [30, 23], [38, 23], [35, 19], [34, 11], [26, 8], [30, 9], [35, 8], [40, 9], [45, 8], [28, 4], [29, 5], [45, 4], [37, 4],
    [34, 27], [27, 32], [34, 31], [40, 34], [30, 35], [38, 31], [24, 19], [46, 19], [10, 19], [15, 14], [6, 24], [16, 24], [4, 14], [17, 14], [4, 25], [17, 25], [10, 13], [10, 26], [12, 22], [14, 18],
    [52, 19], [54, 22], [50, 16], [52, 23], [54, 16],
  ].map(([x, y]) => ({ x, y }));

  g.objectiveFn = () => {
    const P = g.P;
    if (!P.hasLight) return 'Recupera la linterna de la cabina de tu vehículo';
    if (g.flag('lift_open')) return 'Entra en el ascensor de servicio';
    if (g.flag('lift_called')) return `Sobrevive hasta que llegue el ascensor (${Math.max(0, Math.ceil(liftT))} s)`;
    if (g.flag('power')) return 'Llama al ascensor desde la consola de la esclusa';
    if (g.flag('d5')) return g.has('fuse') ? 'Coloca el fusible reparado en la caja de fusibles' : g.has('fuse_burnt') ? 'Repara el fusible con cable (Tab → Fabricación)' : 'Encuentra el fusible principal (revisa el Almacén B, al sur)';
    if (g.has('keycard_blue')) return 'Usa la tarjeta en la puerta de la esclusa (este del vestíbulo)';
    if (g.flag('seg_open')) return 'Recoge la tarjeta azul del escritorio de Seguridad';
    if (g.flag('atrio')) return 'Entra en Seguridad (norte): encuentra el código de 4 dígitos en las oficinas';
    if (g.flag('d1_open') || g.flag('vent')) return 'Avanza hacia el vestíbulo';
    return 'Sal del hangar: fabrica una palanca (Tab) o busca otra ruta';
  };

  // ======================= LÓGICA DE EVENTOS =======================
  const saveTerm = (name: string) => {
    if (!g.canSave()) { audio.deny(); g.toast('No puedes guardar mientras algo te persigue.', 'bad'); return; }
    g.checkpoint('Terminal — ' + name);
  };

  const firstEncounter = () => {
    if (g.flag('enc1')) return; g.setFlag('enc1');
    audio.distant(3);
    g.after(2.5, () => {
      const ok = g.spawnEnemy('watch', { harmless: true, minD: 20, maxD: 60, los: true });
      if (ok) {
        g.shake(0.25, 0.5); audio.creatureCall({ x: g.enemy.x, y: 2, z: g.enemy.z }, 0.5);
        g.say('LENA', '¿Qué ha sido ese ruido? Dan… ¿hay alguien contigo ahí dentro?', true);
        g.say('DAN', 'Hay… algo muy alto al fondo del hangar. No se mueve. Solo… me mira.');
        g.hint('enc', 'No corras en línea recta. Apaga la linterna (F) y rompe su línea de visión.', true);
      }
    });
  };

  const onPickup = (item: string) => {
    if (item === 'keycard_blue' && !g.flag('keycard_event')) {
      g.setFlag('keycard_event');
      g.shake(0.7, 1.2); audio.powerOff(); g.alarm(true); audio.rumble();
      g.say('LENA', '¡Dan! ¡Ha saltado la alarma de contención! ¡Algo se ha liberado, sal de ahí ya!', true);
      g.say('DAN', 'Genial… Tengo que esconderme o salir sin que me vea.');
      g.hint('hideflee', 'Escóndete (E) en armarios o bajo mesas ANTES de que te vea entrar. Si ves que patrulla, no hagas ruido.', true);
      g.after(7, () => { if (!g.enemy.active) { const sp = g.pickSpawn(24, 70, false); g.spawnEnemy('chase', sp ? { at: sp } : { minD: 16, maxD: 120, los: null }); } });
      g.directorGap = [30, 55];
    }
    if (item === 'pipe' || item === 'tape') { if (g.has('pipe') && g.has('tape')) g.hint('craftA', 'Tienes tubo y cinta. Abre la mochila (Tab) y fabrica una palanca.', true); }
    if (item === 'fuse_burnt') g.say('DAN', 'Un fusible quemado. Si lo puenteo con cable de cobre…');
    if (item === 'can' || item === 'wire') { if (g.has('can') && g.has('wire')) g.hint('craftB', 'Lata + cable = distractor sonoro (G para lanzar). Atrae a las criaturas.'); }
  };

  const onCraft = (item: string) => { if (item === 'fuse') g.say('DAN', 'Listo. Ahora hay que llevárselo a la caja de la esclusa.'); };
  const onDoc = (id: string) => {
    if (id === 'd_secret') g.say('DAN', '…Daniel Ortega. Ese soy yo. No… no puede ser.');
    if (id === 'd_manifest') g.hint('doc', 'Todos los documentos quedan guardados en la mochila → pestaña Archivo.');
  };

  const tickEnding = (dt: number) => {
    if (g.flag('lift_called') && !g.flag('lift_open')) {
      liftT -= dt;
      if (liftT <= 0) {
        g.setFlag('lift_open'); g.unlockDoor(lift, true); audio.ding(); g.alarm(false);
        g.toast('El ascensor ha llegado. ¡Corre!', 'good'); g.say('LENA', '¡Ya está abierto! ¡Entra, Dan, entra!', true);
      }
    }
  };

  return {
    start: {
      x: 11, z: 41, yaw: 0,
      run: (fromSave) => {
        if (g.flag('power')) { g.powerOn = true; }
        if (g.flag('atrio')) { g.directorOn = true; g.directorGap = g.flag('keycard_event') ? [30, 55] : [40, 80]; }
        if (fromSave) { g.toast('Partida cargada', 'info'); return; }
        g.fadeSpeed = 0.5; g.alarm(true); audio.crash(); g.shake(1, 1.2);
        g.after(24, () => { if (!g.flag('keycard_event')) g.alarm(false); });
        g.after(1.2, () => { g.say('LENA', 'Dan… ¿me recibes? Perdimos tu telemetría. Dan, contesta.', true); });
        g.after(5.5, () => g.say('DAN', 'Ugh… la cabeza… El vehículo… ¿dónde estoy?'));
        g.after(9, () => { g.say('LENA', 'Tu transpondedor te sitúa en el hangar siete, a ocho mil metros. Busca luz y sal de ahí.', true); });
        g.after(3, () => g.hint('wasd', 'WASD para moverte · ratón para mirar · busca algo de luz', true));
        g.after(12, () => { g.shake(0.8, 1.0); audio.rumble(); g.dustBurst(40);});
      },
    },
    update: tickEnding,
    onPickup, onDoc, onCraft,
  };
}
