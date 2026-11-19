
import * as THREE from 'three';
import { audio } from './audio';
import { buildMaterials, softCircle, type Mats } from './textures';
import { CELL, Door, World } from './world';
import { Observer } from './observer';
import { DEFAULT_SETTINGS, DOCS, ITEMS, RECIPES, writeSave, type SaveData, type Settings } from './data';
import { buildChapter1, type ChapterRuntime } from './chapter1';
export { audio };

export interface HideSpot { id: string; x: number; z: number; yaw: number; eye: number; type: 'locker' | 'desk' | 'crate'; exit: { x: number; z: number } }
export interface Interact { id: string; x: number; y: number; z: number; reach: number; label: () => string | null; use: () => void; noLos?: boolean; cone?: number; obj?: THREE.Object3D }
export interface LightDef { c: number; i: number; r: number }
export interface LightSrc {
  x: number; y: number; z: number; em?: LightDef; main?: LightDef; flicker: 'none' | 'slow' | 'fast' | 'dying'; alarm?: boolean;
  mat?: THREE.MeshBasicMaterial; phase: number; burst: number; expire?: number; cur: { c: number; i: number; r: number }; mult: number;
}
export interface HudState {
  health: number; stamina: number; hunger: number; thirst: number; battery: number; flash: boolean; score: number;
  objective: string; prompt: string | null; crouch: boolean; hidden: boolean; danger: number; detect: number; zone: string;
  exhausted: boolean; hideType: string; fade: number; hurt: number; time: number; noise: number; hasLight: boolean; slots: number; chase: number; tension: number; peek: boolean; deaths: number;
}
export type GameEvent = 'hud' | 'subtitle' | 'toast' | 'hint' | 'score' | 'modal' | 'doc' | 'keypad' | 'choice' | 'gameover' | 'complete' | 'chapter' | 'inventory' | 'zone' | 'hurt' | 'saved' | 'lockLost';
type Modal = 'none' | 'pause' | 'inventory' | 'doc' | 'keypad' | 'choice';

class PointPool {
  pos: Float32Array; col: Float32Array; vel: Float32Array; life: Float32Array; max: Float32Array; base: Float32Array; n: number; next = 0;
  pts: THREE.Points;
  constructor(n: number, size: number, map: THREE.Texture | null, grav: number, public gravity = grav, public drag = 0) {
    this.n = n; this.pos = new Float32Array(n * 3).fill(-999); this.col = new Float32Array(n * 3); this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n); this.max = new Float32Array(n).fill(1); this.base = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const m = new THREE.PointsMaterial({ size, ...(map ? { map } : {}), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false });
    this.pts = new THREE.Points(g, m); this.pts.frustumCulled = false;
  }
  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, r: number, g: number, b: number) {
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.base[i * 3] = r; this.base[i * 3 + 1] = g; this.base[i * 3 + 2] = b;
  }
  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -999; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      this.vel[i * 3 + 1] -= this.gravity * dt;
      const dr = 1 - this.drag * dt;
      this.vel[i * 3] *= dr; this.vel[i * 3 + 2] *= dr;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02 && this.gravity > 0) { this.pos[i * 3 + 1] = 0.02; this.vel[i * 3 + 1] *= -0.35; }
      this.col[i * 3] = this.base[i * 3] * k; this.col[i * 3 + 1] = this.base[i * 3 + 1] * k; this.col[i * 3 + 2] = this.base[i * 3 + 2] * k;
    }
    (this.pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.pts.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}

interface Emitter { x: number; y: number; z: number; kind: 'spark' | 'steam' | 'smoke'; rate: number; acc: number }
interface Trigger { x0: number; y0: number; x1: number; y1: number; fn: () => void; once: boolean; fired: boolean; inside: boolean }
interface Proj { mesh: THREE.Mesh; vx: number; vy: number; vz: number; landed: boolean; t: number; beepT: number; mat: THREE.MeshBasicMaterial }
const SAVE_SLOTS = 10;

export class Game {
  static inst: Game | null = null;
  static get(canvas: HTMLCanvasElement): Game { if (!Game.inst) Game.inst = new Game(canvas); return Game.inst; }
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  level = new THREE.Group();
  camera = new THREE.PerspectiveCamera(75, 1, 0.05, 90);
  settings: Settings = { ...DEFAULT_SETTINGS };
  mats: Mats;
  world!: World;
  audio = audio;
  rt: ChapterRuntime | null = null;
  chapter = 1;
  loaded = false;
  running = false;
  isTouch = false;

  // jugador
  P = {
    x: 0, z: 0, y: 0, vy: 0, yaw: 0, pitch: 0, speed: 0, crouch: false, running: false, hidden: null as HideSpot | null,
    health: 100, stamina: 100, hunger: 100, thirst: 100, battery: 100, hasLight: false, flashOn: false, exhausted: false,
    eye: 1.65, noise: 0, regenDelay: 0, vx: 0, vz: 0, onGround: true,
  };
  inv: { id: string; qty: number }[] = [];
  flags = new Set<string>();
  collected = new Set<string>();
  docs = new Set<string>();
  score = 0; time = 0; deaths = 0;
  stats = { pickups: 0, docs: 0, secrets: 0, crafts: 0, hides: 0, chases: 0, damage: 0 };
  checkpointSave: SaveData | null = null;
  state: 'playing' | 'dead' | 'done' = 'playing';
  modal: Modal = 'none';
  paused = true;
  expectUnlock = false;
  hideSeen = false;
  nearHideTension = 0;
  lightLevel = 0;
  waypoints: { x: number; y: number }[] = [];
  enemy!: Observer;
  objectiveFn: () => string = () => '';
  hideExitKey = false;

  // sistemas
  interacts: Interact[] = [];
  hides: HideSpot[] = [];
  lights: LightSrc[] = [];
  private pool: THREE.PointLight[] = [];
  private flash!: THREE.SpotLight;
  private flashTarget = new THREE.Object3D();
  private hemi!: THREE.HemisphereLight;
  private triggers: Trigger[] = [];
  private timers: { t: number; fn: () => void }[] = [];
  private projs: Proj[] = [];
  private emitters: Emitter[] = [];
  private sparks!: PointPool; private dust!: PointPool; private steam!: PointPool;
  private glintMat: THREE.SpriteMaterial; private glints: THREE.Sprite[] = [];
  private listeners = new Map<string, Set<(d: unknown) => void>>();
  private keys = new Set<string>();
  input = { moveX: 0, moveY: 0, lookX: 0, lookY: 0, run: false, crouchHold: false };
  private runToggle = false;
  private last = 0;
  private raf = 0;
  private shakeAmp = 0; private shakeT = 0;
  private bob = 0; private stepDist = 0; private breathT = 2; private heartT = 1;
  private best: Interact | null = null;
  private hud: HudState;
  private hudT = 0;
  hurt = 0; fade = 1; fadeTarget = 1; fadeSpeed = 1;
  private dialog: { who: string; text: string; radio: boolean; dur?: number }[] = [];
  private dialogCur: { t: number; end: number; radio: boolean; who: string } | null = null;
  private blipT = 0;
  private ambientT = 20;
  private directorT = 60;
  directorOn = false;
  directorGap: [number, number] = [45, 90];
  private enemyAge = 0;
  private lastDanger = -1;
  private chaseAwarded = false;
  private zoneName = '';
  private keypadCfg: { code: string; onOk: () => void } | null = null;
  private choiceCfg: { opts: { label: string; flag: string }[]; done?: () => void } | null = null;
  private deathT = 0;
  private fwd = new THREE.Vector3();
  private hintShown = new Set<string>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.mats = buildMaterials(Math.min(8, this.renderer.capabilities.getMaxAnisotropy()));
    const sc = softCircle();
    this.glintMat = new THREE.SpriteMaterial({ map: sc, color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8, fog: false });
    this.scene.add(this.level);
    this.scene.add(this.camera);
    this.camera.rotation.order = 'YXZ';
    this.sparks = new PointPool(120, 0.09, null, 9);
    this.dust = new PointPool(140, 0.045, sc, 0, 0, 0);
    this.steam = new PointPool(60, 1.1, sc, -0.4, -0.4, 0.4);
    this.scene.add(this.sparks.pts, this.dust.pts, this.steam.pts);
    for (let i = 0; i < 140; i++) this.dust.emit(0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    this.hud = this.makeHud();
    this.attachInput();
  }

  // ---------- eventos ----------
  on(ev: GameEvent, fn: (d: any) => void) { let s = this.listeners.get(ev); if (!s) this.listeners.set(ev, (s = new Set())); s.add(fn as (d: unknown) => void); return () => { s!.delete(fn as (d: unknown) => void); }; }
  emit(ev: GameEvent, d?: unknown) { this.listeners.get(ev)?.forEach((f) => f(d)); }
  applySettings(s: Settings) {
    this.settings = s;
    audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, ambience: s.ambience });
    this.camera.fov = s.fov; this.camera.updateProjectionMatrix();
    const dpr = Math.min(window.devicePixelRatio || 1, s.quality === 'alto' ? 2 : s.quality === 'medio' ? 1.5 : 1);
    this.renderer.setPixelRatio(dpr);
    this.resize();
    if (this.hemi) this.hemi.intensity = 0.1 + s.brightness * 1.2;
    this.renderer.toneMappingExposure = 1.0 + s.brightness * 0.8;
  }
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  // ---------- carga de nivel ----------
  loadLevel(chapter: number, save: SaveData | null) {
    // limpieza
    this.level.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
    this.level.clear();
    this.interacts = []; this.hides = []; this.lights = []; this.triggers = []; this.timers = []; this.projs = []; this.emitters = []; this.glints = [];
    this.dialog = []; this.dialogCur = null; this.pool = [];
    this.flags = new Set(save?.flags || []); this.collected = new Set(save?.collected || []); this.docs = new Set(save?.docs || []);
    this.inv = save ? save.inv.map((s) => ({ ...s })) : [];
    this.score = save?.score || 0; this.time = save?.time || 0; this.deaths = save?.deaths || 0;
    this.stats = { pickups: 0, docs: 0, secrets: 0, crafts: 0, hides: 0, chases: 0, damage: 0 };
    this.chapter = chapter; this.state = 'playing'; this.hurt = 0; this.deathT = 0; this.directorOn = false; this.directorT = 50;
    this.modal = 'none'; this.hideSeen = false; this.nearHideTension = 0;
    this.chaseAwarded = false; this.enemyAge = 0; this.ambientT = 15;
    this.objectiveFn = () => '';
    audio.alarm(false);
    const q = this.settings.quality;
    this.scene.background = new THREE.Color(0x020304);
    this.scene.fog = new THREE.FogExp2(0x030405, q === 'bajo' ? 0.07 : 0.052);
    this.hemi = new THREE.HemisphereLight(0x8899aa, 0x221a14, 0.1 + this.settings.brightness * 1.2);
    this.level.add(this.hemi);

    // linterna
    if (this.flash) this.camera.remove(this.flash);
    this.flash = new THREE.SpotLight(0xfff1d6, 0, 34, 0.5, 0.55, 1.6);
    this.flash.castShadow = q !== 'bajo';
    this.flash.shadow.mapSize.set(q === 'alto' ? 1024 : 512, q === 'alto' ? 1024 : 512);
    this.flash.shadow.camera.near = 0.2; this.flash.shadow.camera.far = 30; this.flash.shadow.bias = -0.0004;
    this.renderer.shadowMap.enabled = q !== 'bajo'; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.camera.add(this.flash); this.camera.add(this.flashTarget);
    this.flashTarget.position.set(0, 0, -5); this.flash.target = this.flashTarget; this.flash.position.set(0.15, -0.12, 0);
    const n = q === 'bajo' ? 3 : q === 'medio' ? 5 : 7;
    for (let i = 0; i < n; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); this.pool.push(l); this.level.add(l); }
    
    // Inicialización del mundo con dimensiones explícitas
    this.world = new World(128, 128);
    this.enemy = new Observer(this);
    
    let built: ChapterRuntime | null = null;
    try {
      built = buildChapter1(this) as ChapterRuntime;
    } catch (e) {
      console.warn("Aviso al construir capítulo:", e);
    }
    this.rt = built;

    try {
      this.world.finalize(this.mats, q !== 'bajo');
    } catch (e) {
      console.warn("Aviso al finalizar mundo:", e);
    }
    if (this.world.group) {
      this.level.add(this.world.group);
    }

    if (save && save.doors) {
      for (const [id, st] of Object.entries(save.doors)) {
        const d = this.world.doorList?.find((x) => x.id === id);
        if (d) { d.open = st.open; d.locked = st.locked; d.t = st.open ? 1 : 0; this.world.updateDoor(d); }
      }
    }
    
    const P = this.P;
    P.hidden = null; P.vy = 0; P.y = 0; P.crouch = false; P.vx = P.vz = 0; P.speed = 0; P.exhausted = false; P.running = false;
    if (save) {
      P.x = save.px; P.z = save.pz; P.yaw = save.yaw; P.health = save.health; P.stamina = save.stamina; P.hunger = save.hunger; P.thirst = save.thirst;
      P.battery = save.battery; P.hasLight = save.hasLight;
    } else {
      P.x = built?.start?.x ?? 8;
      P.z = built?.start?.z ?? 8;
      P.yaw = built?.start?.yaw ?? 0;
      P.health = 100; P.stamina = 100; P.hunger = 85; P.thirst = 80; P.battery = 70; P.hasLight = false;
    }
    P.flashOn = false; P.pitch = 0; P.eye = 1.65;
    this.checkpointSave = save ? save : null;
    this.fade = 1; this.fadeTarget = 0; this.fadeSpeed = 0.6;
    this.loaded = true;
    this.applySettings(this.settings);
    this.hud = this.makeHud();
    this.zoneName = '';
    
    try {
      built?.start?.run?.(!!save);
    } catch (e) {
      console.warn("Aviso al ejecutar inicio:", e);
    }

    if (!save) this.checkpoint('Inicio del capítulo', true);
    this.emit('inventory'); this.emit('chapter', { n: chapter });
    this.emit('modal', 'none');
  }

  // ---------- bucle ----------
  start() { if (this.running) return; this.running = true; this.last = performance.now(); const loop = (now: number) => { if (!this.running) return; this.raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.frame(dt); }; this.raf = requestAnimationFrame(loop); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  setModal(m: Modal) {
    const prev = this.modal; this.modal = m;
    this.paused = m === 'pause' || m === 'doc' || m === 'keypad' || m === 'choice' || (m === 'inventory' && this.settings.pauseInv) || !this.loaded;
    if (m !== 'none') { if (document.pointerLockElement) { this.expectUnlock = true; document.exitPointerLock(); } audio.menuMode(false); }
    if (m === 'none' && prev !== 'none' && !this.isTouch) this.requestLock();
    this.keys.clear(); this.input.lookX = this.input.lookY = 0;
    this.emit('modal', m);
  }
  requestLock() { if (this.isTouch) return; try { const p = this.canvas.requestPointerLock() as unknown; if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => undefined); } catch { /* */ } }
  resumeGame() { this.setModal('none'); audio.resume(); this.last = performance.now(); }
  private frame(dt: number) {
    if (!this.loaded) return;
    if (!this.paused) this.update(dt);
    else this.cameraUpdate(0);
    if (this.fade !== this.fadeTarget) { const s = this.fadeSpeed * dt; this.fade = this.fade < this.fadeTarget ? Math.min(this.fadeTarget, this.fade + s) : Math.max(this.fadeTarget, this.fade - s); }
    this.renderer.render(this.scene, this.camera);
  }

  // ---------- entrada ----------
  private attachInput() {
    const down = (e: KeyboardEvent) => {
      if (!this.loaded) return;
      const c = e.code;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
      if (e.repeat) return;
      if (this.state === 'dead') { if (c === 'KeyR' || c === 'Enter') this.emit('gameover', { restart: true }); return; }
      if (c === 'Tab' || c === 'KeyI') { if (this.modal === 'inventory') this.setModal('none'); else if (this.modal === 'none') this.setModal('inventory'); return; }
      if (c === 'Escape' || c === 'KeyP') { if (this.modal === 'none') this.setModal('pause'); else if (this.modal === 'pause') this.resumeGame(); else if (this.modal === 'inventory' || this.modal === 'doc' || this.modal === 'keypad') this.setModal('none'); return; }
      if (this.modal !== 'none') return;
      this.keys.add(c);
      if (c === 'KeyF') this.toggleFlash();
      if (c === 'KeyE' || c === 'Enter') this.interact();
      if (c === 'KeyC') { if (this.settings.toggleCrouch) this.toggleCrouch(); }
      if (c === 'ShiftLeft' || c === 'ShiftRight') { if (this.settings.toggleRun) this.runToggle = !this.runToggle; }
      if (c === 'KeyG') this.throwNoisemaker();
      if (c === 'KeyQ') this.quickHeal();
      if (c === 'Space') this.jump();
    };
    const up = (e: KeyboardEvent) => { this.keys.delete(e.code); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    window.addEventListener('blur', () => { this.keys.clear(); if (this.loaded && this.modal === 'none' && this.state === 'playing' && !this.isTouch) this.setModal('pause'); });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.canvas || this.paused) return;
      this.input.lookX += e.movementX; this.input.lookY += e.movementY;
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas) {
        if (this.expectUnlock) { this.expectUnlock = false; return; }
        if (this.loaded && this.modal === 'none' && this.state === 'playing') { this.setModal('pause'); this.emit('lockLost'); }
      }
    });
    window.addEventListener('resize', () => this.resize());
  }

  touchPress(a: 'interact' | 'jump' | 'flash' | 'crouch' | 'inv' | 'throw' | 'heal' | 'pause' | 'run') {
    if (!this.loaded || this.state !== 'playing') return;
    if (a === 'inv') { this.setModal(this.modal === 'inventory' ? 'none' : 'inventory'); return; }
    if (a === 'pause') { this.setModal('pause'); return; }
    if (this.modal !== 'none') return;
    if (a === 'interact') this.interact(); else if (a === 'jump') this.jump(); else if (a === 'flash') this.toggleFlash(); else if (a === 'crouch') this.toggleCrouch();
    else if (a === 'throw') this.throwNoisemaker(); else if (a === 'heal') this.quickHeal(); else if (a === 'run') this.runToggle = !this.runToggle;
  }
  get runToggled() { return this.runToggle; }

  // ---------- utilidades de juego ----------
  after(sec: number, fn: () => void) { this.timers.push({ t: sec, fn }); }
  flag(f: string) { return this.flags.has(f); }
  setFlag(f: string) { this.flags.add(f); }
  shake(amp: number, dur: number) { this.shakeAmp = Math.max(this.shakeAmp, amp * this.settings.shake); this.shakeT = Math.max(this.shakeT, dur); }
  toast(text: string, kind: 'info' | 'good' | 'bad' | 'warn' = 'info') { this.emit('toast', { text, kind, id: Math.random() }); }
  hint(key: string, text: string, force = false) { if (!this.settings.showHints && !force) return; if (this.hintShown.has(key)) return; this.hintShown.add(key); this.emit('hint', { text, id: Math.random() }); }
  say(who: string, text: string, radio = false) { this.dialog.push({ who, text, radio }); }
  addScore(n: number, label: string) { this.score += n; this.emit('score', { n, label, id: Math.random() }); }
  lookDot(x: number, z: number) {
    const dx = x - this.P.x, dz = z - this.P.z; const d = Math.hypot(dx, dz) || 1;
    return (dx * -Math.sin(this.P.yaw) + dz * -Math.cos(this.P.yaw)) / d;
  }
  makeNoise(x: number, z: number, r: number, fromPlayer = true) {
    if (fromPlayer) this.P.noise = Math.max(this.P.noise, r);
    if (this.enemy.active) this.enemy.hear(x, z, r);
  }
  onEnemyAlert() { this.stats.chases++; this.chaseAwarded = false; this.hint('chase', 'Te persigue. Corre, rompe la línea de visión y escóndete (E) antes de que te vea entrar.'); }
  onEnemyLost() { if (!this.chaseAwarded) { this.chaseAwarded = true; this.addScore(500, 'PERSECUCIÓN SUPERADA'); this.toast('Lo has perdido… por ahora.', 'good'); } }
  worldCell(cx: number, cy: number) { return { x: (cx + 0.5) * CELL, z: (cy + 0.5) * CELL }; }

  // ---------- inventario ----------
  count(id: string) { return this.inv.filter((s) => s.id === id).reduce((a, s) => a + s.qty, 0); }
  has(id: string) { return this.count(id) > 0; }
  canAdd(id: string) { const def = ITEMS[id]; return this.inv.some((s) => s.id === id && s.qty < def.stack) || this.inv.length < SAVE_SLOTS; }
  addItem(id: string, qty = 1): boolean {
    const def = ITEMS[id]; if (!def) return false;
    for (let k = 0; k < qty; k++) {
      const s = this.inv.find((x) => x.id === id && x.qty < def.stack);
      if (s) s.qty++; else if (this.inv.length < SAVE_SLOTS) this.inv.push({ id, qty: 1 }); else { this.emit('inventory'); return false; }
    }
    this.emit('inventory'); return true;
  }
  removeItem(id: string, qty = 1) {
    for (let k = 0; k < qty; k++) { const i = [...this.inv].reverse().findIndex((s) => s.id === id); if (i < 0) break; const ix = this.inv.length - 1 - i; this.inv[ix].qty--; if (this.inv[ix].qty <= 0) this.inv.splice(ix, 1); }
    this.emit('inventory');
  }
  useItem(slot: number) {
    const s = this.inv[slot]; if (!s) return; const P = this.P;
    switch (s.id) {
      case 'battery': if (!P.hasLight) { this.toast('Aún no tienes linterna.', 'warn'); return; } if (P.battery > 95) { this.toast('La batería ya está llena.', 'warn'); return; } P.battery = Math.min(100, P.battery + 55); audio.click(); audio.flash(true); this.toast('Linterna recargada +55 %', 'good'); break;
      case 'medkit': case 'bandage': case 'medkit_improv': {
        if (P.health >= 100) { this.toast('Estás en perfecto estado.', 'warn'); return; }
        P.health = Math.min(100, P.health + (s.id === 'medkit' ? 60 : s.id === 'bandage' ? 20 : 45)); audio.heal(); this.toast('Vida recuperada', 'good'); break;
      }
      case 'water': if (P.thirst > 92) { this.toast('No tienes sed.', 'warn'); return; } P.thirst = Math.min(100, P.thirst + 40); audio.eat(); break;
      case 'ration': case 'canned': if (P.hunger > 92) { this.toast('No tienes hambre.', 'warn'); return; } P.hunger = Math.min(100, P.hunger + (s.id === 'ration' ? 40 : 30)); audio.eat(); break;
      case 'noisemaker': this.setModal('none'); this.throwNoisemaker(); return;
      case 'glowstick': this.placeGlowstick(); break;
      default: return;
    }
    this.removeItem(s.id, 1);
  }
  dropItem(slot: number) {
    const s = this.inv[slot]; if (!s) return;
    const P = this.P; const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    const id = s.id; this.removeItem(id, 1);
    const x = P.x + fx * 0.9, z = P.z + fz * 0.9; const p = { x, z }; this.world.resolve(p, 0.2);
    this.addPickup({ id: `drop_${Math.random().toString(36).slice(2)}`, item: id, x: p.x, z: p.z, y: 0.12, track: false });
    audio.click(); this.toast(`Soltaste: ${ITEMS[id].name}`);
  }
  craft(rid: string) {
    const r = RECIPES.find((x) => x.id === rid); if (!r) return;
    for (const [id, n] of Object.entries(r.needs)) if (this.count(id) < n) { audio.deny(); this.toast('Faltan materiales.', 'warn'); return; }
    for (const [id, n] of Object.entries(r.needs)) this.removeItem(id, n);
    if (!this.addItem(r.gives)) { this.addPickup({ id: `drop_${Math.random()}`, item: r.gives, x: this.P.x, z: this.P.z, y: 0.1, track: false }); }
    audio.craft(); this.stats.crafts++; this.addScore(100, `FABRICADO: ${ITEMS[r.gives].name.toUpperCase()}`); this.toast(`Fabricado: ${ITEMS[r.gives].name}`, 'good');
    this.rt?.onCraft?.(r.gives);
  }
  quickHeal() {
    const order = ['bandage', 'medkit_improv', 'medkit'];
    if (this.P.health >= 100) { this.toast('Estás en perfecto estado.', 'warn'); return; }
    for (const id of order) { const i = this.inv.findIndex((s) => s.id === id); if (i >= 0) { this.useItem(i); return; } }
    this.toast('No tienes medicina.', 'warn');
  }

  // ---------- objetos y escenario ----------
  private itemMesh(id: string): THREE.Object3D {
    const def = ITEMS[id]; const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5, metalness: 0.3, emissive: def.color, emissiveIntensity: 0.12 });
    let mesh: THREE.Mesh;
    switch (id) {
      case 'battery': mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 10), m); mesh.rotation.z = Math.PI / 2; break;
      case 'pipe': case 'crowbar': mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), m); mesh.rotation.z = Math.PI / 2; break;
      case 'tape': case 'wire': mesh = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.03, 6, 12), m); mesh.rotation.x = Math.PI / 2; break;
      case 'medkit': case 'medkit_improv': mesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.22), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5, emissive: 0x333333 })); { const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.125, 0.05), new THREE.MeshBasicMaterial({ color: 0xdd2222 })); mesh.add(c1); const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.125, 0.16), new THREE.MeshBasicMaterial({ color: 0xdd2222 })); mesh.add(c2); } break;
      case 'keycard_blue': mesh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.012, 0.11), new THREE.MeshStandardMaterial({ color: 0x2f6df0, emissive: 0x2f6df0, emissiveIntensity: 0.9 })); break;
      case 'water': mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0x9cc8ff, transparent: true, opacity: 0.75, roughness: 0.1 })); break;
      case 'can': case 'canned': mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.11, 10), m); break;
      case 'fuse': case 'fuse_burnt': mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8), m); mesh.rotation.z = Math.PI / 2; break;
      case 'glowstick': mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 6), new THREE.MeshBasicMaterial({ color: 0x66ff88 })); mesh.rotation.z = Math.PI / 2; break;
      default: mesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.12), m);
    }
    mesh.castShadow = true; g.add(mesh); return g;
  }
  private addGlint(parent: THREE.Object3D, color = 0xffd27a, s = 0.55) {
    const sp = new THREE.Sprite(this.glintMat.clone()); sp.material.color.setHex(color); sp.scale.setScalar(s); sp.position.y = 0.12; parent.add(sp); this.glints.push(sp);
  }
  addPickup(o: { id: string; item: string; qty?: number; x: number; z: number; y: number; track?: boolean; ry?: number; label?: string; score?: number; secret?: boolean }) {
    const track = o.track !== false;
    if (track && this.collected.has(o.id)) return;
    const def = ITEMS[o.item];
    const mesh = this.itemMesh(o.item); mesh.position.set(o.x, o.y, o.z); mesh.rotation.y = o.ry ?? Math.random() * 6;
    this.addGlint(mesh, def.cat === 'tarjeta' ? 0x5aa0ff : 0xffd27a, 0.5);
    this.level.add(mesh);
    const it: Interact = {
      id: o.id, x: o.x, y: o.y + 0.1, z: o.z, reach: 2.7, obj: mesh,
      label: () => o.label || `Recoger ${def.name}`,
      use: () => {
        if (!this.addItem(o.item, o.qty ?? 1)) { audio.deny(); this.toast('Inventario lleno. Suelta algo (Tab).', 'warn'); this.hint('full', 'El inventario es limitado: usa o suelta objetos en la mochila (Tab).', true); return; }
        this.level.remove(mesh); this.interacts = this.interacts.filter((x) => x !== it);
        if (track) this.collected.add(o.id);
        audio.pickup(); this.stats.pickups++;
        this.toast(`${def.icon} ${def.name}`, 'good');
        if (track) this.addScore(o.score ?? (def.cat === 'tarjeta' ? 400 : 60), o.secret ? 'SECRETO' : 'OBJETO');
        this.rt?.onPickup?.(o.item, o.id);
      },
    };
    this.interacts.push(it);
    return it;
  }
  addDocPickup(o: { id: string; doc: string; x: number; z: number; y: number; ry?: number; label?: string; onRead?: () => void }) {
    const d = DOCS[o.doc];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.012, 0.19), new THREE.MeshStandardMaterial({ color: d.kind === 'audio' ? 0x222a33 : 0xe6dfc8, emissive: d.kind === 'audio' ? 0x335577 : 0x6b6450, emissiveIntensity: 0.5, roughness: 0.9 }));
    mesh.position.set(o.x, o.y, o.z); mesh.rotation.y = o.ry ?? Math.random() * 3;
    this.addGlint(mesh, d.secret ? 0xff6ad0 : 0x9ad0ff, 0.55);
    this.level.add(mesh);
    const it: Interact = {
      id: o.id, x: o.x, y: o.y, z: o.z, reach: 2.6, obj: mesh,
      label: () => o.label || (d.kind === 'audio' ? `Escuchar: ${d.title}` : `Leer: ${d.title}`),
      use: () => { this.readDoc(o.doc); o.onRead?.(); },
    };
    this.interacts.push(it);
    if (this.docs.has(o.doc)) { mesh.children.forEach((c) => { if ((c as THREE.Sprite).isSprite) c.visible = false; }); }
    return it;
  }
  readDoc(id: string) {
    const d = DOCS[id]; if (!d) return;
    const first = !this.docs.has(id);
    this.docs.add(id);
    if (first) { this.stats.docs++; if (d.secret) { this.stats.secrets++; this.addScore(600, 'SECRETO DESCUBIERTO'); } else this.addScore(150, d.kind === 'audio' ? 'GRABACIÓN' : 'DOCUMENTO'); this.setFlag('doc:' + id); }
    audio.doc();
    this.setModal('doc'); this.emit('doc', { doc: d, first });
    if (d.kind === 'audio') { let n = 0; const iv = window.setInterval(() => { audio.voice(150, true, 0.05); if (++n > 22 || this.modal !== 'doc') clearInterval(iv); }, 120); }
    this.rt?.onDoc?.(id);
  }
  addHide(h: HideSpot, label = 'Esconderte') {
    this.hides.push(h);
    this.interacts.push({
      id: 'hide_' + h.id, x: h.exit.x * 0.5 + h.x * 0.5, y: 1.0, z: h.exit.z * 0.5 + h.z * 0.5, reach: 2.4, cone: 0.7,
      label: () => (this.P.hidden ? null : label), use: () => this.hide(h),
    });
  }
  addInteract(i: Interact) { this.interacts.push(i); return i; }
  addTrigger(x0: number, y0: number, x1: number, y1: number, fn: () => void, once = true) { this.triggers.push({ x0, y0, x1, y1, fn, once, fired: false, inside: false }); }
  addEmitter(e: Omit<Emitter, 'acc'>) { this.emitters.push({ ...e, acc: 0 }); }
  makeDoor(o: { id: string; cx: number; cy: number; kind?: 'steel' | 'office' | 'secret'; heavy?: boolean; locked?: boolean; name?: string; check?: () => true | string | null; open?: boolean }) {
    const d = new Door(o.id, o.cx, o.cy, o.kind || 'steel', o.heavy ?? o.kind !== 'office');
    d.locked = !!o.locked; d.open = !!o.open; d.t = d.open ? 1 : 0;
    this.world.addDoor(d, this.mats);
    this.level.add(d.group);
    this.interacts.push({
      id: 'door_' + o.id, x: d.x, y: 1.3, z: d.z, reach: 2.9, noLos: true, cone: 0.5,
      label: () => (d.kind === 'secret' && d.locked ? null : d.open ? 'Cerrar puerta' : d.locked ? `${o.name || 'Puerta'} (bloqueada)` : 'Abrir puerta'),
      use: () => {
        if (d.locked) {
          if (!o.check) { audio.doorLocked({ x: d.x, y: 1.5, z: d.z }); this.toast('Está bloqueada.', 'warn'); return; }
          const r = o.check();
          if (r === true) { this.unlockDoor(d, true); return; }
          if (typeof r === 'string') { audio.doorLocked({ x: d.x, y: 1.5, z: d.z }); this.toast(r, 'warn'); }
          return;
        }
        this.toggleDoor(d);
      },
    });
    return d;
  }
  unlockDoor(d: Door, open: boolean) { d.locked = false; this.world.updateDoor(d); if (open) { d.open = true; audio.doorSlide({ x: d.x, y: 1.5, z: d.z }, d.heavy); this.makeNoise(d.x, d.z, 10); } }
  toggleDoor(d: Door) {
    if (!d.open) {
      d.open = true;
    } else {
      if (Math.hypot(this.P.x - d.x, this.P.z - d.z) < 1.4) { this.toast('Estás en medio.', 'warn'); return; }
      d.open = false;
    }
    audio.doorSlide({ x: d.x, y: 1.5, z: d.z }, d.heavy); this.makeNoise(d.x, d.z, d.heavy ? 11 : 8);
  }
  addLight(o: { x: number; y: number; z: number; em?: LightDef; main?: LightDef; flicker?: LightSrc['flicker']; fixture?: 'tube' | 'bulb' | 'alarm' | 'none'; rot?: boolean; alarm?: boolean; expire?: number }) {
    const l: LightSrc = { x: o.x, y: o.y, z: o.z, em: o.em, main: o.main, flicker: o.flicker || 'none', alarm: o.alarm, phase: Math.random() * 100, burst: 0, expire: o.expire, cur: { c: 0, i: 0, r: 8 }, mult: 1 };
    const fx = o.fixture ?? 'tube';
    if (fx !== 'none') {
      const mat = new THREE.MeshBasicMaterial({ color: 0x222222 });
      const geo = fx === 'tube' ? new THREE.BoxGeometry(o.rot ? 0.22 : 1.1, 0.06, o.rot ? 1.1 : 0.22) : fx === 'alarm' ? new THREE.CylinderGeometry(0.14, 0.14, 0.18, 8) : new THREE.SphereGeometry(0.12, 8, 6);
      const m = new THREE.Mesh(geo, mat); m.position.set(o.x, o.y + 0.04, o.z); this.level.add(m); l.mat = mat;
    }
    this.lights.push(l); return l;
  }
  powerOn = false;
  setPower(on: boolean) { this.powerOn = on; if (on) { audio.powerOn(); this.shake(0.3, 0.8); } }
  alarm(on: boolean) { audio.alarm(on); this.lights.forEach((l) => { if (l.alarm) l.burst = on ? -1 : 0; }); this.alarmOn = on; }
  alarmOn = false;
  private placeGlowstick() {
    const P = this.P; const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    const x = P.x + fx * 0.8, z = P.z + fz * 0.8;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 6), new THREE.MeshBasicMaterial({ color: 0x66ff88 })); m.rotation.z = Math.PI / 2; m.position.set(x, 0.03, z); this.level.add(m);
    this.addLight({ x, y: 0.4, z, em: { c: 0x44ff77, i: 10, r: 11 }, fixture: 'none', expire: this.time + 120 });
    this.after(120, () => this.level.remove(m));
    audio.click(); this.toast('Barra luminosa activada', 'good');
  }
  dustBurst(n: number) { const P = this.P; for (let i = 0; i < n; i++) this.steam.emit(P.x + (Math.random() - 0.5) * 8, 3.3, P.z + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 0.5, -0.9 - Math.random(), (Math.random() - 0.5) * 0.5, 2.2, 0.3, 0.3, 0.3); }
  throwNoisemaker() {
    if (!this.has('noisemaker')) { this.toast('No tienes distractores. Fabrícalos: lata + cable.', 'warn'); return; }
    if (this.state !== 'playing' || this.P.hidden || this.modal !== 'none') return;
    this.removeItem('noisemaker', 1);
    const P = this.P; this.camera.getWorldDirection(this.fwd);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8), mat); mesh.position.set(P.x, P.y + P.eye - 0.2, P.z); this.level.add(mesh);
    this.projs.push({ mesh, vx: this.fwd.x * 11, vy: this.fwd.y * 11 + 2.5, vz: this.fwd.z * 11, landed: false, t: 0, beepT: 0, mat });
    audio.throwSfx(); this.hint('throw', 'Los distractores atraen a las criaturas hacia el sonido. Úsalos para despejar el camino.');
  }
  toggleFlash() {
    const P = this.P;
    if (!P.hasLight) { this.toast('No tienes linterna.', 'warn'); return; }
    if (P.battery <= 0 && !P.flashOn) { audio.deny(); this.toast('Batería agotada. Busca pilas (🔋) o usa luces de emergencia.', 'warn'); return; }
    P.flashOn = !P.flashOn; audio.flash(P.flashOn);
  }
  toggleCrouch() { if (this.P.hidden) return; if (this.P.crouch && this.world.crouchCell[this.world.idx(Math.floor(this.P.x / CELL), Math.floor(this.P.z / CELL))]) return; this.P.crouch = !this.P.crouch; }
  jump() { const P = this.P; if (!P.onGround || P.hidden || P.stamina < 8 || P.crouch) return; P.vy = 4.1; P.onGround = false; P.stamina -= 8; P.regenDelay = 0.8; audio.jump(); this.makeNoise(P.x, P.z, 6); }
  hide(h: HideSpot) {
    const P = this.P;
    this.hideSeen = this.enemy.active && this.enemy.hasLOS && Math.hypot(this.enemy.x - P.x, this.enemy.z - P.z) < 17 && (this.enemy.chasing || this.enemy.state === 'watch');
    P.hidden = h; P.x = h.x; P.z = h.z; P.crouch = false; P.speed = 0; P.vx = P.vz = 0;
    P.yaw = h.yaw; P.pitch = 0; this.stats.hides++;
    audio.click(); this.hint('hide', 'Quédate quieto. Pulsa E para salir. Si te ven entrar, te encontrarán.');
    if (this.hideSeen) this.toast('¡Te ha visto esconderte!', 'bad');
    this.emit('hud', this.snapshot());
  }
  unhide() {
    const P = this.P; if (!P.hidden) return; const h = P.hidden;
    P.x = h.exit.x; P.z = h.exit.z; P.hidden = null; this.world.resolve(P, 0.32); audio.click(); this.hideSeen = false; this.nearHideTension = 0;
  }
  grabPlayer(en: Observer) {
    const P = this.P; if (!P.hidden) return;
    this.toast('¡Te encontró!', 'bad'); this.unhide(); en.x += 0; this.damage(30, en.x, en.z);
    const dx = P.x - en.x, dz = P.z - en.z, d = Math.hypot(dx, dz) || 1; P.x += (dx / d) * 1.0; P.z += (dz / d) * 1.0; this.world.resolve(P, 0.32);
    this.shake(1, 0.6); en.state = 'chase';
  }
  damage(n: number, sx: number, sz: number) {
    if (this.state !== 'playing') return;
    const P = this.P;
    P.health -= n; this.stats.damage += n; this.hurt = Math.min(1, this.hurt + 0.6); this.shake(0.9, 0.5);
    audio.hurt(n > 20);
    const ang = Math.atan2(-(sx - P.x), -(sz - P.z)) - P.yaw;
    this.emit('hurt', { angle: ang });
    if (P.health <= 0) this.die();
  }
  die() {
    if (this.state !== 'playing') return;
    this.state = 'dead'; this.P.health = 0; this.deaths++; this.deathT = 0;
    audio.die(); audio.setDanger(0); audio.alarm(false); audio.enemyBedUpdate(null, 0);
    this.fadeTarget = 0.0;
    this.score = Math.max(0, this.score - 300);
    if (document.pointerLockElement) { this.expectUnlock = true; document.exitPointerLock(); }
    this.after(0.01, () => undefined);
    window.setTimeout(() => this.emit('gameover', { restart: false, score: this.score, time: this.time, chapter: this.chapter, stats: this.stats }), 1600);
  }

  // ---------- guardado ----------
  serialize(point: string): SaveData {
    const P = this.P; const doors: SaveData['doors'] = {};
    this.world.doorList.forEach((d) => { doors[d.id] = { open: d.open, locked: d.locked }; });
    return { v: 1, chapter: this.chapter, point, when: Date.now(), px: P.x, pz: P.z, yaw: P.yaw, health: Math.max(30, P.health), stamina: 100, hunger: P.hunger, thirst: P.thirst, battery: P.battery, hasLight: P.hasLight, inv: this.inv.map((s) => ({ ...s })), flags: [...this.flags], collected: [...this.collected], doors, docs: [...this.docs], score: this.score, time: this.time, deaths: this.deaths };
  }
  checkpoint(point: string, silent = false) {
    const s = this.serialize(point); this.checkpointSave = s; writeSave(s);
    if (!silent) { audio.save(); this.toast('✔ Partida guardada — ' + point, 'good'); this.emit('saved', point); }
  }
  canSave() { return !this.enemy.chasing && this.enemy.threat < 2 && this.state === 'playing'; }

  // ---------- diálogo, claves, elecciones ----------
  openKeypad(code: string, onOk: () => void) { this.keypadCfg = { code, onOk }; this.setModal('keypad'); this.emit('keypad', { digits: code.length }); }
  submitKeypad(v: string): boolean {
    if (!this.keypadCfg) return false;
    if (v === this.keypadCfg.code) { const f = this.keypadCfg.onOk; this.keypadCfg = null; this.setModal('none'); audio.keypad(true); f(); return true; }
    audio.keypad(false); this.shake(0.2, 0.2); return false;
  }
  openChoice(title: string, opts: { label: string; flag: string }[], done?: () => void) { this.choiceCfg = { opts, done }; this.setModal('choice'); this.emit('choice', { title, opts: opts.map((o) => o.label) }); }
  resolveChoice(i: number) {
    if (!this.choiceCfg) return; const c = this.choiceCfg; this.choiceCfg = null; this.setFlag(c.opts[i].flag); this.setModal('none'); audio.click(); c.done?.();
  }
  complete(extra: { title: string; text: string }) {
    if (this.state !== 'playing') return;
    this.state = 'done';
    const timeBonus = Math.max(0, Math.round(1800 - this.time * 1.2));
    const noDmg = this.stats.damage === 0 ? 800 : 0;
    this.addScore(2000, 'CAPÍTULO COMPLETADO'); this.score += timeBonus + noDmg;
    audio.success(); audio.setDanger(0); audio.alarm(false);
    if (document.pointerLockElement) { this.expectUnlock = true; document.exitPointerLock(); }
    this.emit('complete', { score: this.score, time: this.time, timeBonus, noDmg, stats: this.stats, deaths: this.deaths, docs: this.docs.size, secrets: this.stats.secrets, flags: [...this.flags], ...extra });
  }

  // ---------- interacción ----------
  interact() {
    if (this.state !== 'playing' || this.modal !== 'none') return;
    if (this.P.hidden) { this.unhide(); return; }
    if (this.best) this.best.use();
  }
  private findBest() {
    const P = this.P; const ex = P.x, ey = P.y + P.eye, ez = P.z;
    this.camera.getWorldDirection(this.fwd); const f = this.fwd;
    let best: Interact | null = null, bs = -9;
    for (const it of this.interacts) {
      const dx = it.x - ex, dy = it.y - ey, dz = it.z - ez; const d = Math.hypot(dx, dy, dz);
      if (d > it.reach) continue;
      const dot = (dx * f.x + dy * f.y + dz * f.z) / (d || 1);
      const need = it.cone ?? (d < 1.1 ? 0.35 : 0.9 - Math.min(0.1, (it.reach - d) * 0.02));
      if (dot < need) continue;
      if (!it.noLos && !this.world.los(ex, ez, it.x, it.z)) continue;
      if (it.noLos && d > 1.5 && !this.world.los(ex, ez, it.x, it.z) && false) continue;
      const lab = it.label(); if (!lab) continue;
      const s = dot - d * 0.08; if (s > bs) { bs = s; best = it; }
    }
    this.best = best;
  }

  // ---------- spawn de enemigo ----------
  pickSpawn(minD: number, maxD: number, needLOS: boolean | null): { x: number; z: number } | null {
    const w = this.world, P = this.P;
    const pc = { x: Math.floor(P.x / CELL), y: Math.floor(P.z / CELL) };
    const field = w.flow(pc.x, pc.y, (x, y) => { if (!w.inb(x, y)) return false; const i = w.idx(x, y); if (w.solid[i]) return false; const d = w.doors.get(i); return !d || !d.locked; });
    const cands: { x: number; z: number }[] = [];
    for (const wp of this.waypoints) {
      const pd = field[w.idx(wp.x, wp.y)]; if (pd < 0) continue;
      const x = (wp.x + 0.5) * CELL, z = (wp.y + 0.5) * CELL; const d = Math.hypot(x - P.x, z - P.z);
      if (d < minD || d > maxD) continue;
      const los = w.los(P.x, P.z, x, z);
      if (needLOS === true && !los) continue; if (needLOS === false && los) continue;
      cands.push({ x, z });
    }
    if (!cands.length) return null;
    return cands[Math.floor(Math.random() * cands.length)];
  }
  spawnEnemy(mode: 'watch' | 'patrol' | 'chase' | 'investigate', o: { minD?: number; maxD?: number; los?: boolean | null; harmless?: boolean; at?: { x: number; z: number } } = {}) {
    if (this.enemy.active) return false;
    const spot = o.at || this.pickSpawn(o.minD ?? 22, o.maxD ?? 70, o.los ?? (mode === 'watch' ? true : false)) || this.pickSpawn(14, 120, null);
    if (!spot) return false;
    this.enemy.spawn(spot.x, spot.z, mode, { harmless: o.harmless }); this.enemyAge = 0; return true;
  }

  // ---------- actualización ----------
  private makeHud(): HudState {
    return { health: 100, stamina: 100, hunger: 100, thirst: 100, battery: 100, flash: false, score: 0, objective: '', prompt: null, crouch: false, hidden: false, danger: 0, detect: 0, zone: '', exhausted: false, hideType: '', fade: 1, hurt: 0, time: 0, noise: 0, hasLight: false, slots: 0, chase: 0, tension: 0, peek: false, deaths: 0 };
  }
  snapshot(): HudState {
    const P = this.P;
    return {
      health: P.health, stamina: P.stamina, hunger: P.hunger, thirst: P.thirst, battery: P.battery, flash: P.flashOn, score: this.score,
      objective: this.objectiveFn(), prompt: this.best && this.state === 'playing' ? this.best.label() : (P.hidden ? 'Salir del escondite' : null), crouch: P.crouch, hidden: !!P.hidden,
      danger: this.lastDanger, detect: Math.min(1, this.enemy?.detect || 0), zone: this.zoneName, exhausted: P.exhausted, hideType: P.hidden ? P.hidden.type : '', fade: this.fade, hurt: this.hurt, time: this.time,
      noise: Math.min(1, P.noise / 16), hasLight: P.hasLight, slots: this.inv.length, chase: this.lastDanger === 2 ? 1 : 0, tension: this.nearHideTension, peek: !!P.hidden, deaths: this.deaths,
    };
  }
  private update(dt: number) {
    const P = this.P, w = this.world, s = this.settings;
    if (this.state === 'dead') { this.deathT += dt; this.cameraUpdate(dt); this.hud = this.snapshot(); this.emit('hud', this.hud); this.particlesAndLights(dt); return; }
    if (this.state === 'done') { this.cameraUpdate(dt); this.particlesAndLights(dt); return; }
    this.time += dt;
    this.hurt = Math.max(0, this.hurt - dt * 0.8);
    P.noise = Math.max(0, P.noise - dt * 12);
    // timers
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; t.t -= dt; if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); } }
    // ----- movimiento -----
    const k = this.keys;
    let mx = this.input.moveX, my = this.input.moveY;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1; if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1; if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
    const moving = ml > 0.08 && !P.hidden;
    // mirada
    const sens = 0.0022 * s.sensitivity;
    P.yaw -= this.input.lookX * sens; P.pitch -= this.input.lookY * sens * (s.invertY ? -1 : 1);
    this.input.lookX = this.input.lookY = 0;
    P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch));
    if (P.hidden) { const dy = Math.atan2(Math.sin(P.yaw - P.hidden.yaw), Math.cos(P.yaw - P.hidden.yaw)); if (Math.abs(dy) > 0.9) P.yaw = P.hidden.yaw + Math.sign(dy) * 0.9; P.pitch = Math.max(-0.5, Math.min(0.5, P.pitch)); }
    const inDuct = !!w.crouchCell[w.idx(Math.floor(P.x / CELL), Math.floor(P.z / CELL))];
    if (inDuct) P.crouch = true;
    if (!s.toggleCrouch) P.crouch = k.has('KeyC') || k.has('ControlLeft') || this.input.crouchHold || inDuct;
    else if (k.has('ControlLeft') && !P.hidden) P.crouch = true;
    const wantRun = (k.has('ShiftLeft') || k.has('ShiftRight') || this.input.run || this.runToggle) && moving && !P.crouch;
    if (P.exhausted && P.stamina > 30) P.exhausted = false;
    P.running = wantRun && P.stamina > 0 && !P.exhausted;
    if (P.running) { P.stamina -= 17 * dt; P.regenDelay = 0.9; if (P.stamina <= 0) { P.stamina = 0; P.exhausted = true; P.running = false; audio.gasp(); this.hint('stam', 'Sin aliento: descansa para recuperar resistencia.'); } }
    else { P.regenDelay -= dt; if (P.regenDelay <= 0) P.stamina = Math.min(100, P.stamina + (moving ? 9 : 22) * dt * (P.hunger < 15 || P.thirst < 15 ? 0.5 : 1)); }
    const target = P.crouch ? 1.55 : P.running ? 5.7 : P.exhausted ? 2.4 : 3.2;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
    const tvx = (fx * -my + rx * mx) * target, tvz = (fz * -my + rz * mx) * target;
    const acc = moving ? 12 : 9;
    P.vx += (tvx - P.vx) * Math.min(1, acc * dt); P.vz += (tvz - P.vz) * Math.min(1, acc * dt);
    if (!P.hidden) {
      P.x += P.vx * dt; P.z += P.vz * dt; w.resolve(P, 0.32);
    }
    P.speed = Math.hypot(P.vx, P.vz);
    // vertical
    if (!P.onGround) { P.vy -= 12 * dt; P.y += P.vy * dt; if (P.y <= 0) { P.y = 0; if (P.vy < -2) { audio.land(P.vy < -3.5); this.shake(0.25, 0.2); this.makeNoise(P.x, P.z, 10); } P.vy = 0; P.onGround = true; } }
    const wantEye = P.hidden ? P.hidden.eye : P.crouch ? 1.0 : 1.65;
    P.eye += (wantEye - P.eye) * Math.min(1, 9 * dt);
    // pasos
    if (moving && P.onGround) {
      this.stepDist += P.speed * dt; const stride = P.running ? 2.3 : P.crouch ? 1.4 : 1.8; this.bob += P.speed * dt * (P.running ? 1.55 : 1.9);
      if (this.stepDist > stride) {
        this.stepDist = 0;
        const metal = w.floorKey[w.idx(Math.floor(P.x / CELL), Math.floor(P.z / CELL))] === 'floor_metal';
        audio.step(P.running, P.crouch, metal);
        this.makeNoise(P.x, P.z, P.running ? 15 : P.crouch ? 2.5 : 7);
      }
    }
    // ----- estadísticas vitales -----
    P.hunger = Math.max(0, P.hunger - dt * 0.06); P.thirst = Math.max(0, P.thirst - dt * 0.085);
    if (P.hunger <= 0 || P.thirst <= 0) { P.health -= dt * 0.9; if (P.health <= 0) this.die(); }
    if (P.hunger < 25 && !this.hintShown.has('hungry')) { this.hintShown.add('hungry'); this.toast('Tienes hambre. Come algo.', 'warn'); }
    if (P.thirst < 25 && !this.hintShown.has('thirsty')) { this.hintShown.add('thirsty'); this.toast('Tienes sed. Busca agua.', 'warn'); }
    if (P.flashOn) {
      P.battery -= dt * 0.5; if (P.battery <= 0) { P.battery = 0; P.flashOn = false; audio.flash(false); this.toast('¡La linterna se ha apagado! Busca baterías.', 'bad'); }
      else if (P.battery < 15 && !this.hintShown.has('lowbat')) { this.hintShown.add('lowbat'); this.toast('Batería baja…', 'warn'); }
    }
    // respiración y latidos
    this.breathT -= dt;
    if (this.breathT <= 0) { const tired = P.stamina < 40 || P.exhausted; this.breathT = tired ? 0.9 : 3.8; if (tired || this.lastDanger > 0) audio.breath(tired); }
    const inten = Math.max(this.lastDanger === 2 ? 1 : this.lastDanger === 1 ? 0.5 : 0, P.health < 35 ? 1 : 0, this.nearHideTension);
    this.heartT -= dt;
    if (this.heartT <= 0 && inten > 0.25) { audio.heart(inten); this.heartT = 1.0 - inten * 0.45; this.shake(0.05 * inten, 0.1); }
    // ----- sistemas -----
    this.world.tickDoors(dt);
    this.findBest();
    this.updateLightLevel(dt);
    if (this.enemy.active) { this.enemy.update(dt, this.time); this.enemyAge += dt; }
    this.updateProjectiles(dt);
    this.updateDialog(dt);
    this.updateTriggers();
    this.director(dt);
    this.ambient(dt);
    this.rt?.update?.(dt);
    this.particlesAndLights(dt);
    // zona
    const room = w.roomAt(P.x, P.z);
    if (room && room.name !== this.zoneName && !room.silent) { this.zoneName = room.name; this.emit('zone', room.name); }
    // peligro/música
    const danger = this.enemy.active ? Math.max(0, this.enemy.threat) : 0;
    const dl = (danger >= 2 ? 2 : danger >= 1 ? 1 : 0) as 0 | 1 | 2;
    if (dl !== this.lastDanger) { this.lastDanger = dl; audio.setDanger(dl); }
    if (this.enemy.active && Math.hypot(this.enemy.x - P.x, this.enemy.z - P.z) > 40 && this.enemy.threat < 1) audio.enemyBedUpdate(null, 0);
    if (!this.enemy.active) audio.enemyBedUpdate(null, 0);
    this.cameraUpdate(dt);
    audio.setListener({ x: P.x, y: P.y + P.eye, z: P.z }, P.yaw);
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.hud = this.snapshot(); this.emit('hud', this.hud); }
  }
  private cameraUpdate(dt: number) {
    const P = this.P, c = this.camera;
    let ox = 0, oy = 0, roll = 0;
    if (this.shakeT > 0) { this.shakeT -= dt; const a = this.shakeAmp * Math.min(1, this.shakeT * 3); ox = (Math.random() - 0.5) * 0.06 * a; oy = (Math.random() - 0.5) * 0.06 * a; roll = (Math.random() - 0.5) * 0.04 * a; if (this.shakeT <= 0) this.shakeAmp = 0; }
    const bobAmp = P.hidden ? 0.004 : P.running ? 0.06 : P.speed > 0.3 ? 0.03 : 0.006;
    const by = Math.sin(this.bob * 2) * bobAmp + (P.speed < 0.3 ? Math.sin(this.time * 1.3) * 0.004 : 0);
    const bx = Math.cos(this.bob) * bobAmp * 0.6;
    let eyeY = P.y + P.eye;
    let pitchAdd = 0;
    if (this.state === 'dead') { const k = Math.min(1, this.deathT / 1.2); eyeY = P.eye * (1 - k) + 0.25 * k; roll = 0.7 * k; pitchAdd = -0.3 * k; }
    c.position.set(P.x + bx * Math.cos(P.yaw) + ox, eyeY + by + oy, P.z - bx * Math.sin(P.yaw));
    const strafe = this.state === 'dead' ? 0 : (this.input.moveX + (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0)) * 0.012;
    c.rotation.set(P.pitch + pitchAdd, P.yaw, roll - strafe, 'YXZ');
    const fovT = this.settings.fov + (P.running ? 7 : 0) + (this.lastDanger === 2 ? 3 : 0);
    if (Math.abs(c.fov - fovT) > 0.05) { c.fov += (fovT - c.fov) * Math.min(1, (dt || 0.016) * 6); c.updateProjectionMatrix(); }
    // linterna
    const f = this.flash;
    if (f) {
      let inten = 0;
      if (P.flashOn && P.battery > 0) {
        inten = 300; if (P.battery < 15) inten *= 0.55 + 0.45 * Math.abs(Math.sin(this.time * 17) * Math.sin(this.time * 5.3)); if (P.battery < 5 && Math.random() < 0.15) inten = 0;
        inten *= 0.4 + Math.min(1, P.battery / 30) * 0.6;
        if (this.settings.reduceFlash && P.battery < 15) inten = 300 * 0.5;
      }
      f.intensity = inten;
      this.flashTarget.position.set(0, 0, -5);
    }
  }
  private updateLightLevel(dt: number) {
    const P = this.P; let l = 0;
    if (P.flashOn && P.battery > 0) l = 1;
    else {
      for (const s of this.lights) { if (!s.cur.i) continue; const d = Math.hypot(s.x - P.x, s.z - P.z); if (d < 9) l += (1 - d / 9) * Math.min(1, s.cur.i * s.mult / 30) * 0.8; }
      l = Math.min(0.75, l);
    }
    this.lightLevel += (l - this.lightLevel) * Math.min(1, dt * 4);
  }
  private particlesAndLights(dt: number) {
    const P = this.P;
    // luces
    const cam = this.camera.position; const t = this.time; const rf = this.settings.reduceFlash;
    const cands: { l: LightSrc; d: number }[] = [];
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i];
      if (l.expire && this.time > l.expire) { if (l.mat) l.mat.color.setHex(0); this.lights.splice(i, 1); continue; }
      const def = (this.powerOn && l.main) ? l.main : l.em;
      let m = 1;
      if (!def) { l.cur.i = 0; if (l.mat) l.mat.color.setHex(0x1b1b1b); continue; }
      if (l.alarm && this.alarmOn) m = rf ? 0.55 + 0.45 * Math.sin(t * 5) : (Math.sin(t * 6.5 + l.phase) > 0 ? 1.3 : 0.05);
      else if (!this.powerOn || !l.main) {
        if (l.flicker === 'slow') m = 0.75 + 0.25 * Math.sin(t * 2 + l.phase);
        else if (l.flicker === 'fast') m = rf ? 0.8 : (Math.sin(t * 31 + l.phase) * Math.sin(t * 13.7 + l.phase * 2) > -0.25 ? 1 : 0.1);
        else if (l.flicker === 'dying') { l.burst -= dt; if (l.burst <= -1 && Math.random() < dt * 0.35) l.burst = 0.15 + Math.random() * 0.5; m = l.burst > 0 ? (rf ? 0.5 : (Math.random() > 0.5 ? 0.9 : 0)) : 1; if (l.burst < -1) l.burst = -1; }
      }
      l.mult = m; l.cur.c = def.c; l.cur.i = def.i; l.cur.r = def.r;
      if (l.mat) l.mat.color.setHex(def.c).multiplyScalar(0.25 + 0.75 * Math.max(0, Math.min(1.3, m)));
      const d = (l.x - cam.x) ** 2 + (l.z - cam.z) ** 2 + (l.y - cam.y) ** 2;
      if (d < 26 * 26) cands.push({ l, d });
    }
    cands.sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i], c = cands[i];
      if (c) { p.position.set(c.l.x, c.l.y - 0.2, c.l.z); p.color.setHex(c.l.cur.c); p.intensity = c.l.cur.i * c.l.mult; p.distance = c.l.cur.r; }
      else p.intensity = 0;
    }
    // glints
    const gp = 0.55 + 0.45 * Math.sin(t * 3);
    for (const g of this.glints) g.material.opacity = 0.35 + gp * 0.45;
    // emisores
    for (const e of this.emitters) {
      if (Math.hypot(e.x - P.x, e.z - P.z) > 32) continue;
      e.acc += dt * e.rate;
      while (e.acc >= 1) {
        e.acc -= 1;
        if (e.kind === 'spark') { const a = Math.random() * 6.28, sp = 1 + Math.random() * 3; this.sparks.emit(e.x, e.y, e.z, Math.cos(a) * sp, 1.5 + Math.random() * 3, Math.sin(a) * sp, 0.5 + Math.random() * 0.7, 1, 0.6, 0.15); if (Math.random() < 0.08) audio.spark({ x: e.x, y: e.y, z: e.z }); }
        else if (e.kind === 'steam') this.steam.emit(e.x, e.y, e.z, (Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3, 2 + Math.random(), 0.22, 0.24, 0.26);
        else this.steam.emit(e.x + (Math.random() - 0.5) * 0.4, e.y, e.z + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.2, 0.8, (Math.random() - 0.5) * 0.2, 3, 0.16, 0.16, 0.17);
      }
    }
    this.sparks.update(dt); this.steam.update(dt);
    // polvo alrededor del jugador
    const d = this.dust;
    for (let i = 0; i < d.n; i++) {
      if (d.life[i] <= 0) { d.life[i] = 8 + Math.random() * 6; d.max[i] = d.life[i]; d.pos[i * 3] = cam.x + (Math.random() - 0.5) * 14; d.pos[i * 3 + 1] = Math.random() * 3.2; d.pos[i * 3 + 2] = cam.z + (Math.random() - 0.5) * 14; d.vel[i * 3] = (Math.random() - 0.5) * 0.08; d.vel[i * 3 + 1] = (Math.random() - 0.5) * 0.05; d.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.08; d.base[i * 3] = 0.45; d.base[i * 3 + 1] = 0.47; d.base[i * 3 + 2] = 0.5; }
    }
    d.update(dt);
  }
  private updateProjectiles(dt: number) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i]; p.t += dt;
      if (!p.landed) {
        p.vy -= 12 * dt;
        const nx = p.mesh.position.x + p.vx * dt, ny = p.mesh.position.y + p.vy * dt, nz = p.mesh.position.z + p.vz * dt;
        if (this.world.blockedCell(Math.floor(nx / CELL), Math.floor(nz / CELL))) { p.vx *= -0.3; p.vz *= -0.3; audio.canHit({ x: nx, y: ny, z: nz }); this.makeNoise(nx, nz, 12, false); }
        else { p.mesh.position.x = nx; p.mesh.position.z = nz; }
        p.mesh.position.y = ny; p.mesh.rotation.x += dt * 12;
        if (ny <= 0.06) { p.mesh.position.y = 0.06; p.landed = true; p.t = 0; audio.canHit({ x: p.mesh.position.x, y: 0.1, z: p.mesh.position.z }); this.makeNoise(p.mesh.position.x, p.mesh.position.z, 20, false); }
      } else {
        p.beepT -= dt;
        if (p.beepT <= 0) { p.beepT = 0.7; audio.beep({ x: p.mesh.position.x, y: 0.3, z: p.mesh.position.z }); this.makeNoise(p.mesh.position.x, p.mesh.position.z, 24, false); p.mat.color.setHex(0xffffff); this.after(0.1, () => p.mat.color.setHex(0xff3a1a)); }
        if (p.t > 8) { this.level.remove(p.mesh); this.projs.splice(i, 1); }
      }
    }
  }
  private updateDialog(dt: number) {
    const c = this.dialogCur;
    if (c) {
      c.t += dt; this.blipT -= dt;
      if (this.blipT <= 0 && c.t < c.end - 0.25) { this.blipT = 0.07 + Math.random() * 0.06; audio.voice(c.who === 'LENA' ? 260 : c.who === 'VOSS' ? 110 : c.who === '???' ? 85 : 170, c.radio, 0.06); }
      if (c.t >= c.end) { this.dialogCur = null; if (c.radio) audio.radioOff(); }
    }
    if (!this.dialogCur && this.dialog.length) {
      const d = this.dialog.shift()!; const dur = d.dur ?? Math.max(2.4, d.text.length * 0.058);
      this.dialogCur = { t: 0, end: dur, radio: d.radio, who: d.who };
      if (d.radio) audio.radioOn();
      this.emit('subtitle', { who: d.who, text: d.text, dur: dur + 0.6, radio: d.radio, id: Math.random() });
    }
  }
  get talking() { return !!this.dialogCur || this.dialog.length > 0; }
  private updateTriggers() {
    const P = this.P; const cx = P.x / CELL, cy = P.z / CELL;
    for (const t of this.triggers) {
      const inside = cx >= t.x0 && cx <= t.x1 + 1 && cy >= t.y0 && cy <= t.y1 + 1;
      if (inside && !t.inside && !(t.once && t.fired)) { t.fired = true; t.fn(); }
      t.inside = inside;
    }
  }
  private director(dt: number) {
    if (!this.directorOn) return;
    const e = this.enemy;
    if (e.active) {
      if (e.state === 'patrol' && this.enemyAge > 80 && !e.hasLOS && Math.hypot(e.x - this.P.x, e.z - this.P.z) > 25) { e.despawn(); this.directorT = this.directorGap[0] + Math.random() * (this.directorGap[1] - this.directorGap[0]); }
      return;
    }
    this.directorT -= dt;
    if (this.directorT > 0) return;
    this.directorT = this.directorGap[0] + Math.random() * (this.directorGap[1] - this.directorGap[0]);
    const r = Math.random();
    if (r < 0.45) this.spawnEnemy('watch', { minD: 16, maxD: 40, los: true });
    else if (r < 0.85) this.spawnEnemy('patrol', { minD: 28, maxD: 80, los: false });
    else this.spawnEnemy('investigate', { minD: 22, maxD: 60, los: false });
  }
  private ambient(dt: number) {
    this.ambientT -= dt;
    if (this.ambientT > 0) return;
    this.ambientT = 10 + Math.random() * 22;
    const r = Math.random(); const P = this.P;
    if (r < 0.5) audio.distant();
    else if (r < 0.65) { this.shake(0.15, 0.4); audio.rumble(); for (let i = 0; i < 12; i++) this.steam.emit(P.x + (Math.random() - 0.5) * 6, 3.2, P.z + (Math.random() - 0.5) * 6, 0, -0.4, 0, 2, 0.2, 0.2, 0.2); }
    else if (r < 0.8) {
      const cands = this.world.doorList.filter((d) => !d.open && !d.locked && d.kind !== 'secret' && Math.hypot(d.x - P.x, d.z - P.z) > 7 && Math.hypot(d.x - P.x, d.z - P.z) < 26);
      if (cands.length) { const d = cands[Math.floor(Math.random() * cands.length)]; d.open = true; audio.doorSlide({ x: d.x, y: 1.5, z: d.z }, d.heavy); }
      else audio.distant(2);
    } else if (r < 0.92) { const l = this.lights.filter((x) => x.flicker !== 'none' || !!x.main); const x = l[Math.floor(Math.random() * l.length)]; if (x) x.burst = 1.2; audio.spark({ x: x?.x || P.x, y: 3, z: x?.z || P.z }); }
    else audio.distant(3);
  }
  quitToMenu() {
    this.loaded = false; this.paused = true; this.modal = 'none'; this.state = 'playing';
    audio.alarm(false); audio.enemyBedUpdate(null, 0); audio.setDanger(0); audio.menuMode(true);
    if (document.pointerLockElement) { this.expectUnlock = true; document.exitPointerLock(); }
    this.keys.clear();
  }

  // ---------- reinicio ----------
  restartFromCheckpoint() {
    const dc = this.deaths; const cp = this.checkpointSave;
    this.loadLevel(this.chapter, cp);
    this.deaths = dc; this.score = Math.max(0, (cp?.score || 0) - 300 * 0) ; if (cp) this.score = Math.max(0, cp.score - 300);
    this.setModal('none'); this.fade = 1; this.fadeTarget = 0; this.fadeSpeed = 1.6;
  }
}
export { SAVE_SLOTS };
