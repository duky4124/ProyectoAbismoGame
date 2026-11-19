import * as THREE from 'three';
import type { Mats } from './textures';

export const CELL = 2;
export const WALL_H = 3.6;

export interface RoomDef {
  id: string; name: string;
  x0: number; y0: number; x1: number; y1: number;
  floor: string; wall: string; ceilH?: number; crouch?: boolean; silent?: boolean;
}

// ---------- Constructor de geometría por lotes ----------
export class GeoBuilder {
  pos: number[] = []; nor: number[] = []; uv: number[] = []; idx: number[] = [];
  private tmp = new THREE.Matrix4();
  quad(p: number[][], n: number[], uvs: number[][]) {
    const b = this.pos.length / 3;
    for (let i = 0; i < 4; i++) { this.pos.push(p[i][0], p[i][1], p[i][2]); this.nor.push(n[0], n[1], n[2]); this.uv.push(uvs[i][0], uvs[i][1]); }
    // orientación según la normal
    const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1], az = p[1][2] - p[0][2];
    const bx = p[3][0] - p[0][0], by = p[3][1] - p[0][1], bz = p[3][2] - p[0][2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    if (cx * n[0] + cy * n[1] + cz * n[2] > 0) this.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    else this.idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0, uvScale = 0.5) {
    const m = this.tmp.makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
    const h = [sx / 2, sy / 2, sz / 2];
    const sizes = [sx, sy, sz];
    const v = new THREE.Vector3();
    const T = (x: number, y: number, z: number) => { v.set(x, y, z).applyMatrix4(m); return [v.x + cx, v.y + cy, v.z + cz]; };
    for (let a = 0; a < 3; a++) for (const s of [1, -1]) {
      const u = (a + 1) % 3, w = (a + 2) % 3;
      const mk = (su: number, sw: number) => { const c = [0, 0, 0]; c[a] = s * h[a]; c[u] = su * h[u]; c[w] = sw * h[w]; return T(c[0], c[1], c[2]); };
      const nn = [0, 0, 0]; nn[a] = s;
      const nv = v.set(nn[0], nn[1], nn[2]).transformDirection(m);
      const uu = sizes[u] * uvScale, ww = sizes[w] * uvScale;
      this.quad([mk(-1, -1), mk(1, -1), mk(1, 1), mk(-1, 1)], [nv.x, nv.y, nv.z], [[0, 0], [uu, 0], [uu, ww], [0, ww]]);
    }
  }
  cyl(cx: number, cy: number, cz: number, r: number, hgt: number, seg = 10, rz = 0, rx = 0, rTop?: number) {
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz));
    const v = new THREE.Vector3(); const rt = rTop ?? r;
    const base = this.pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      for (let k = 0; k < 2; k++) {
        const rr = k ? rt : r;
        v.set(c * rr, (k ? 0.5 : -0.5) * hgt, s * rr).applyMatrix4(m); this.pos.push(v.x + cx, v.y + cy, v.z + cz);
        v.set(c, 0, s).transformDirection(m); this.nor.push(v.x, v.y, v.z); this.uv.push((i / seg) * Math.max(1, r * 3), k * hgt * 0.5);
      }
    }
    for (let i = 0; i < seg; i++) { const a = base + i * 2; this.idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    // tapas
    for (const k of [0, 1]) {
      const cb = this.pos.length / 3; const rr = k ? rt : r;
      v.set(0, (k ? 0.5 : -0.5) * hgt, 0).applyMatrix4(m); this.pos.push(v.x + cx, v.y + cy, v.z + cz);
      const nd = v.set(0, k ? 1 : -1, 0).transformDirection(m); this.nor.push(nd.x, nd.y, nd.z); this.uv.push(0.5, 0.5);
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        v.set(Math.cos(a) * rr, (k ? 0.5 : -0.5) * hgt, Math.sin(a) * rr).applyMatrix4(m); this.pos.push(v.x + cx, v.y + cy, v.z + cz);
        this.nor.push(nd.x, nd.y, nd.z); this.uv.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
      }
      for (let i = 0; i < seg; i++) { if (k) this.idx.push(cb, cb + 2 + i, cb + 1 + i); else this.idx.push(cb, cb + 1 + i, cb + 2 + i); }
    }
  }
  build(mat: THREE.Material, shadow = true): THREE.Mesh | null {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.castShadow = shadow; m.receiveShadow = true;
    return m;
  }
}

export interface AABB { x0: number; z0: number; x1: number; z1: number }

export class Door {
  open = false; t = 0; locked = false;
  group = new THREE.Group();
  panel!: THREE.Mesh;
  lamp!: THREE.Mesh;
  lampMat!: THREE.MeshBasicMaterial;
  axis: 'x' | 'z' = 'x';
  x: number; z: number;
  label = '';
  heavy: boolean;
  constructor(public id: string, public cx: number, public cy: number, public kind: 'steel' | 'office' | 'secret', heavy = true) {
    this.x = (cx + 0.5) * CELL; this.z = (cy + 0.5) * CELL; this.heavy = heavy;
  }
  get speed() { return this.heavy ? 0.9 : 1.8; }
  get blocking() { return this.t < 0.9; }
}

export class World {
  w: number; h: number;
  solid: Uint8Array; roomIdx: Int16Array; ceilH: Float32Array; crouchCell: Uint8Array; silent: Uint8Array;
  floorKey: string[]; rooms: RoomDef[] = [];
  doors = new Map<number, Door>();
  doorList: Door[] = [];
  colliders: AABB[] = [];
  bucket = new Map<number, AABB[]>();
  props = new Map<string, GeoBuilder>();
  group = new THREE.Group();

  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    this.solid = new Uint8Array(w * h).fill(1);
    this.roomIdx = new Int16Array(w * h).fill(-1);
    this.ceilH = new Float32Array(w * h).fill(WALL_H);
    this.crouchCell = new Uint8Array(w * h);
    this.silent = new Uint8Array(w * h);
    this.floorKey = new Array(w * h).fill('floor_concrete');
  }
  idx(x: number, y: number) { return y * this.w + x; }
  inb(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  carve(r: RoomDef) {
    const ri = this.rooms.length; this.rooms.push(r);
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
      const i = this.idx(x, y); this.solid[i] = 0; this.roomIdx[i] = ri; this.floorKey[i] = r.floor; this.ceilH[i] = r.ceilH ?? WALL_H;
      if (r.crouch) this.crouchCell[i] = 1;
    }
  }
  prop(key: string) { let b = this.props.get(key); if (!b) { b = new GeoBuilder(); this.props.set(key, b); } return b; }
  addCollider(a: AABB) {
    this.colliders.push(a);
    const x0 = Math.floor(a.x0 / CELL), x1 = Math.floor(a.x1 / CELL), y0 = Math.floor(a.z0 / CELL), y1 = Math.floor(a.z1 / CELL);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = this.idx(x, y); const l = this.bucket.get(k); if (l) l.push(a); else this.bucket.set(k, [a]); }
  }
  boxProp(mat: string, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, collide = true, ry = 0) {
    this.prop(mat).box(cx, cy, cz, sx, sy, sz, ry);
    if (collide) {
      const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
      const hx = (sx * c + sz * s) / 2, hz = (sx * s + sz * c) / 2;
      this.addCollider({ x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz });
    }
  }
  cylProp(mat: string, cx: number, cy: number, cz: number, r: number, h: number, collide = true, seg = 10) {
    this.prop(mat).cyl(cx, cy, cz, r, h, seg);
    if (collide) this.addCollider({ x0: cx - r, x1: cx + r, z0: cz - r, z1: cz + r });
  }

  addDoor(d: Door, mats: Mats) {
    this.doors.set(this.idx(d.cx, d.cy), d); this.doorList.push(d);
    const lr = this.isOpenCell(d.cx - 1, d.cy) && this.isOpenCell(d.cx + 1, d.cy);
    d.axis = lr ? 'x' : 'z';
    const secret = d.kind === 'secret';
    const matKey = secret ? 'wall_concrete_1' : d.kind === 'steel' ? 'steel' : 'lockerblue';
    const hgt = secret ? WALL_H : 3.0;
    const geo = new THREE.BoxGeometry(d.axis === 'x' ? 0.28 : CELL, hgt, d.axis === 'x' ? CELL : 0.28);
    d.panel = new THREE.Mesh(geo, mats[matKey]);
    d.panel.position.y = hgt / 2; d.panel.castShadow = true; d.panel.receiveShadow = true;
    d.group.add(d.panel);
    if (!secret) {
      d.lampMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
      d.lamp = new THREE.Mesh(new THREE.BoxGeometry(d.axis === 'x' ? 0.34 : 0.22, 0.2, d.axis === 'x' ? 0.22 : 0.34), d.lampMat);
      d.lamp.position.set(0, 1.55, d.axis === 'x' ? -0.7 : 0); d.lamp.position.x = d.axis === 'z' ? -0.7 : 0;
      d.panel.add(d.lamp); d.lamp.position.y = 1.55 - hgt / 2;
      // dintel
      const lin = new THREE.Mesh(new THREE.BoxGeometry(d.axis === 'x' ? 0.5 : CELL, WALL_H - hgt, d.axis === 'x' ? CELL : 0.5), mats['dark']);
      lin.position.y = hgt + (WALL_H - hgt) / 2; d.group.add(lin);
      // franja de peligro
      const st = new THREE.Mesh(new THREE.BoxGeometry(d.axis === 'x' ? 0.32 : 1.6, 0.18, d.axis === 'x' ? 1.6 : 0.32), mats['yellow']);
      st.position.y = 0.5 - hgt / 2; d.panel.add(st);
    }
    d.group.position.set(d.x, 0, d.z);
    this.group.add(d.group);
    this.updateDoor(d);
  }
  isOpenCell(x: number, y: number) { return this.inb(x, y) && !this.solid[this.idx(x, y)]; }
  updateDoor(d: Door) {
    const off = d.t * (CELL - 0.1);
    if (d.axis === 'x') d.panel.position.z = off; else d.panel.position.x = off;
    if (d.lampMat) d.lampMat.color.setHex(d.locked ? 0xff2a1a : 0x2aff6a);
  }
  setDoor(d: Door, open: boolean) { d.open = open; }
  tickDoors(dt: number) {
    for (const d of this.doorList) {
      const target = d.open ? 1 : 0;
      if (d.t !== target) { d.t = d.t < target ? Math.min(target, d.t + dt * d.speed) : Math.max(target, d.t - dt * d.speed); this.updateDoor(d); }
    }
  }
  doorAt(x: number, y: number) { return this.doors.get(this.idx(x, y)); }
  blockedCell(x: number, y: number) {
    if (!this.inb(x, y)) return true;
    const i = this.idx(x, y);
    if (this.solid[i]) return true;
    const d = this.doors.get(i);
    return !!d && d.blocking;
  }
  roomAt(wx: number, wz: number) {
    const x = Math.floor(wx / CELL), y = Math.floor(wz / CELL);
    if (!this.inb(x, y)) return null;
    const i = this.roomIdx[this.idx(x, y)];
    return i >= 0 ? this.rooms[i] : null;
  }

  /** Resuelve la colisión de un círculo con muros, puertas y mobiliario */
  resolve(p: { x: number; z: number }, r: number, props = true) {
    for (let iter = 0; iter < 2; iter++) {
      const cx = Math.floor(p.x / CELL), cy = Math.floor(p.z / CELL);
      for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
        if (this.blockedCell(x, y)) this.push(p, r, x * CELL, y * CELL, (x + 1) * CELL, (y + 1) * CELL);
        const bl = this.bucket.get(this.idx(x, y)); // límites seguros: bucket usa idx sin comprobar rango
        if (props && bl && this.inb(x, y)) for (const a of bl) this.push(p, r, a.x0, a.z0, a.x1, a.z1);
      }
    }
  }
  private push(p: { x: number; z: number }, r: number, x0: number, z0: number, x1: number, z1: number) {
    const qx = Math.max(x0, Math.min(p.x, x1)), qz = Math.max(z0, Math.min(p.z, z1));
    let dx = p.x - qx, dz = p.z - qz; const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x += (dx / d) * (r - d); p.z += (dz / d) * (r - d); return; }
    // dentro de la caja
    const l = p.x - x0, rr = x1 - p.x, t = p.z - z0, b = z1 - p.z; const m = Math.min(l, rr, t, b);
    if (m === l) p.x = x0 - r; else if (m === rr) p.x = x1 + r; else if (m === t) p.z = z0 - r; else p.z = z1 + r;
    dx = 0; dz = 0;
  }

  los(ax: number, az: number, bx: number, bz: number) {
    const dx = bx - ax, dz = bz - az; const d = Math.hypot(dx, dz);
    const n = Math.ceil(d / 0.5);
    for (let i = 1; i < n; i++) {
      const t = i / n; if (this.blockedCell(Math.floor((ax + dx * t) / CELL), Math.floor((az + dz * t) / CELL))) return false;
    }
    return true;
  }
  /** Campo de distancias BFS (8 vecinos) desde una celda destino */
  flow(tx: number, ty: number, canPass: (x: number, y: number) => boolean): Int16Array {
    const dist = new Int16Array(this.w * this.h).fill(-1);
    if (!this.inb(tx, ty)) return dist;
    const q: number[] = [this.idx(tx, ty)]; dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % this.w, y = (i / this.w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (!this.inb(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        if (dist[ni] >= 0 || !canPass(nx, ny)) continue;
        if (dx && dy && (!canPass(x + dx, y) || !canPass(x, y + dy))) continue;
        dist[ni] = dist[i] + 1; q.push(ni);
      }
    }
    return dist;
  }

  /** Construye mallas fijas: suelo, techo, paredes y lotes de mobiliario */
  finalize(mats: Mats, shadows: boolean) {
    const walls = new Map<string, GeoBuilder>(); const floors = new Map<string, GeoBuilder>(); const ceils = new Map<string, GeoBuilder>();
    const gb = (m: Map<string, GeoBuilder>, k: string) => { let b = m.get(k); if (!b) { b = new GeoBuilder(); m.set(k, b); } return b; };
    const S = CELL;
    const variant = (x: number, y: number) => (x * 7 + y * 13 + ((x * y) % 5)) % 3;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = this.idx(x, y);
      if (this.solid[i]) continue;
      const x0 = x * S, z0 = y * S, x1 = x0 + S, z1 = z0 + S, H = this.ceilH[i];
      const room = this.rooms[this.roomIdx[i]];
      gb(floors, this.floorKey[i]).quad([[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      const ck = H < WALL_H - 0.5 ? 'floor_metal' : 'ceil';
      gb(ceils, ck).quad([[x0, H, z0], [x1, H, z0], [x1, H, z1], [x0, H, z1]], [0, -1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      const vh = H / WALL_H;
      const wk = `${room.wall}_${variant(x, y)}`;
      // caras de pared hacia esta celda abierta
      const nb: [number, number, number[], number[][]][] = [
        [-1, 0, [1, 0, 0], [[x0, 0, z1], [x0, 0, z0], [x0, H, z0], [x0, H, z1]]],
        [1, 0, [-1, 0, 0], [[x1, 0, z0], [x1, 0, z1], [x1, H, z1], [x1, H, z0]]],
        [0, -1, [0, 0, 1], [[x0, 0, z0], [x1, 0, z0], [x1, H, z0], [x0, H, z0]]],
        [0, 1, [0, 0, -1], [[x1, 0, z1], [x0, 0, z1], [x0, H, z1], [x1, H, z1]]],
      ];
      for (const [dx, dy, n, p] of nb) {
        const nx = x + dx, ny = y + dy;
        if (this.inb(nx, ny) && !this.solid[this.idx(nx, ny)]) continue;
        gb(walls, wk).quad(p, n, [[0, 0], [1, 0], [1, vh], [0, vh]]);
      }
    }
    const add = (m: Map<string, GeoBuilder>, shadow: boolean) => {
      for (const [k, b] of m) { const mesh = b.build(mats[k] || mats['wall_concrete_0'], shadow); if (mesh) { mesh.receiveShadow = shadows; this.group.add(mesh); } }
    };
    add(walls, shadows); add(floors, false); add(ceils, false);
    for (const [k, b] of this.props) { const mesh = b.build(mats[k] || mats['steel'], shadows); if (mesh) { mesh.receiveShadow = shadows; this.group.add(mesh); } }
  }
}
