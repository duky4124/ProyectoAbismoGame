// Motor de audio procedural (WebAudio) — sin archivos externos, licencia propia.
export interface Vec3 { x: number; y: number; z: number }

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; musicBus!: GainNode; sfxBus!: GainNode; ambBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private layers: { calm: GainNode; tense: GainNode; chase: GainNode } | null = null;
  private danger = 0;
  private vol = { master: 0.8, music: 0.7, sfx: 0.9, ambience: 0.8 };
  private alarmTimer: number | null = null;
  private seqTimer: number | null = null;
  private nextNote = 0;
  private step16 = 0;
  private enemyBed: { gain: GainNode; pan: PannerNode; lp: BiquadFilterNode } | null = null;
  private started = false;
  private chaseOn = false;
  muted = false;
  private lx = 0; private lz = 0;

  init() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.sfxBus = ctx.createGain(); this.ambBus = ctx.createGain();
    this.musicBus.connect(this.master); this.sfxBus.connect(this.master); this.ambBus.connect(this.master);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
  }

  setVolumes(v: { master: number; music: number; sfx: number; ambience: number }) { this.vol = v; this.applyVolumes(); }
  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.8, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.vol.ambience, t, 0.05);
  }
  suspend() { void this.ctx?.suspend(); }
  resume() { void this.ctx?.resume(); }

  // ---------- helpers ----------
  private noise(dur: number, type: BiquadFilterType, f: number, q: number, gain: number, when = 0, dest?: AudioNode, f2?: number) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest || this.sfxBus);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  private tone(type: OscillatorType, f0: number, f1: number, dur: number, gain: number, when = 0, dest?: AudioNode, attack = 0.01) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  private panner(pos: Vec3 | null): AudioNode {
    const c = this.ctx!;
    if (!pos) return this.sfxBus;
    const p = c.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
    p.refDistance = 3; p.maxDistance = 80; p.rolloffFactor = 1.3;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
    p.connect(this.sfxBus);
    return p;
  }
  setListener(pos: Vec3, yaw: number) {
    const c = this.ctx; if (!c) return;
    this.lx = pos.x; this.lz = pos.z;
    const l = c.listener;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    if (l.positionX) {
      l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z;
      l.forwardX.value = fx; l.forwardY.value = 0; l.forwardZ.value = fz;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else { l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(fx, 0, fz, 0, 1, 0); }
  }

  // ---------- ambiente y música ----------
  startAmbient() {
    const c = this.ctx; if (!c || this.started) return;
    this.started = true;
    // Zumbido grave de instalación
    const drone = (f: number, g: number) => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.1;
      const lg = c.createGain(); lg.gain.value = 50; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
      const gn = c.createGain(); gn.gain.value = g;
      o.connect(lp); lp.connect(gn); gn.connect(this.ambBus); o.start();
    };
    drone(41, 0.16); drone(41.6, 0.14); drone(82.5, 0.05);
    // aire / ventilación
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 0.6;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.05;
    const lg = c.createGain(); lg.gain.value = 160; lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
    const gn = c.createGain(); gn.gain.value = 0.035;
    s.connect(bp); bp.connect(gn); gn.connect(this.ambBus); s.start();

    // Capas musicales
    const mk = () => { const g = c.createGain(); g.gain.value = 0; g.connect(this.musicBus); return g; };
    const calm = mk(), tense = mk(), chase = mk();
    this.layers = { calm, tense, chase };
    // calma: acorde menor lento
    [110, 130.8, 164.8, 196].forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = c.createGain(); g.gain.value = 0.05;
      const l = c.createOscillator(); l.frequency.value = 0.04 + i * 0.013;
      const lg2 = c.createGain(); lg2.gain.value = 0.04; l.connect(lg2); lg2.connect(g.gain); l.start();
      o.connect(g); g.connect(calm); o.start();
    });
    // tensión: tritono disonante con trémolo
    [58.3, 82.4, 116.5, 123.5].forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * (1 + i * 0.002);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420 + i * 60;
      const g = c.createGain(); g.gain.value = 0.05;
      const l = c.createOscillator(); l.frequency.value = 5 + i; const lg2 = c.createGain(); lg2.gain.value = 0.03; l.connect(lg2); lg2.connect(g.gain); l.start();
      o.connect(lp); lp.connect(g); g.connect(tense); o.start();
    });
    this.nextNote = c.currentTime + 0.1;
    this.seqTimer = window.setInterval(() => this.sequencer(), 40);
    this.setDanger(0, true);
  }

  private sequencer() {
    const c = this.ctx; if (!c || !this.layers) return;
    const bpm = 156, step = 60 / bpm / 4;
    // Notas de persecución solo si la capa es audible
    const active = this.danger >= 2 || this.chaseOn;
    while (this.nextNote < c.currentTime + 0.15) {
      const t = this.nextNote - c.currentTime;
      if (active) {
        const s = this.step16 % 16;
        if (s % 4 === 0) { this.tone('sine', 110, 40, 0.28, 0.9, t, this.layers.chase); this.noise(0.05, 'lowpass', 300, 1, 0.3, t, this.layers.chase); }
        if (s % 8 === 4) this.noise(0.12, 'highpass', 3000, 1, 0.2, t, this.layers.chase);
        const arp = [0, 0, 3, 0, 6, 0, 3, 5][s % 8];
        if (s % 2 === 0 || s % 8 === 7) this.tone('sawtooth', 55 * Math.pow(2, arp / 12) * (s >= 8 ? 1.0595 : 1), 55 * Math.pow(2, arp / 12), step * 1.6, 0.14, t, this.layers.chase, 0.005);
        if (s === 0) this.tone('sawtooth', 880, 830, 0.7, 0.03, t, this.layers.chase, 0.05);
      }
      this.step16++;
      this.nextNote += step;
    }
  }

  setDanger(level: 0 | 1 | 2, instant = false) {
    this.danger = level;
    this.chaseOn = level === 2;
    const c = this.ctx; if (!c || !this.layers) return;
    const t = c.currentTime, k = instant ? 0.01 : level === 2 ? 0.2 : 1.2;
    this.layers.calm.gain.setTargetAtTime(level === 0 ? 1 : 0.15, t, k);
    this.layers.tense.gain.setTargetAtTime(level === 1 ? 1 : level === 2 ? 0.4 : 0, t, k);
    this.layers.chase.gain.setTargetAtTime(level === 2 ? 1.1 : 0, t, level === 2 ? 0.15 : 1.5);
  }

  menuMode(on: boolean) { if (this.layers) { this.setDanger(on ? 1 : 0); } }

  // ---------- efectos ----------
  step(run: boolean, crouch: boolean, metal: boolean) {
    const g = crouch ? 0.05 : run ? 0.22 : 0.13;
    this.noise(0.09, 'lowpass', metal ? 1500 : 700, 1, g);
    this.tone('sine', 90, 50, 0.1, g * 1.2);
    if (metal && !crouch) this.tone('triangle', 1800 + Math.random() * 400, 1200, 0.12, g * 0.12);
  }
  land(hard: boolean) { this.noise(0.18, 'lowpass', 500, 1, hard ? 0.5 : 0.25); this.tone('sine', 80, 40, 0.2, hard ? 0.6 : 0.3); }
  jump() { this.noise(0.1, 'lowpass', 600, 1, 0.1); }
  click() { this.tone('square', 900, 700, 0.04, 0.06); }
  uiHover() { this.tone('sine', 520, 520, 0.03, 0.03); }
  flash(on: boolean) { this.tone('square', on ? 1400 : 900, on ? 1000 : 600, 0.05, 0.07); this.noise(0.03, 'highpass', 4000, 1, 0.05); }
  pickup() { this.tone('triangle', 520, 780, 0.12, 0.12); this.tone('triangle', 780, 1040, 0.14, 0.1, 0.07); }
  doc() { this.noise(0.25, 'bandpass', 2200, 1, 0.12); this.tone('sine', 400, 300, 0.2, 0.05); }
  deny() { this.tone('square', 180, 150, 0.18, 0.1); this.tone('square', 150, 120, 0.2, 0.1, 0.1); }
  success() { [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.35, 0.12, i * 0.1)); }
  craft() { this.noise(0.3, 'bandpass', 1800, 2, 0.15); this.tone('triangle', 300, 600, 0.2, 0.1, 0.15); this.tone('triangle', 600, 900, 0.25, 0.1, 0.3); }
  eat() { this.noise(0.4, 'bandpass', 900, 2, 0.15); this.noise(0.3, 'bandpass', 1200, 2, 0.12, 0.25); }
  heal() { this.tone('sine', 400, 900, 0.5, 0.12); this.tone('sine', 600, 1200, 0.5, 0.08, 0.1); }
  keypad(ok?: boolean) { if (ok === undefined) this.tone('square', 1200, 1200, 0.05, 0.07); else if (ok) this.success(); else this.deny(); }
  save() { [392, 523, 659].forEach((f, i) => this.tone('sine', f, f, 0.5, 0.1, i * 0.12)); }
  doorSlide(pos?: Vec3, heavy = false) {
    const p = this.panner(pos || null);
    this.noise(heavy ? 1.1 : 0.7, 'bandpass', 220, 3, 0.35, 0, p, heavy ? 120 : 400);
    this.tone('sawtooth', heavy ? 70 : 110, heavy ? 50 : 90, heavy ? 1.0 : 0.6, 0.08, 0, p);
    this.tone('square', 150, 90, 0.12, 0.2, heavy ? 1.0 : 0.62, p);
  }
  doorLocked(pos?: Vec3) { const p = this.panner(pos || null); this.tone('square', 220, 200, 0.08, 0.15, 0, p); this.tone('square', 200, 180, 0.1, 0.15, 0.12, p); this.noise(0.08, 'bandpass', 800, 3, 0.2, 0, p); }
  pry(pos?: Vec3) { const p = this.panner(pos || null); for (let i = 0; i < 4; i++) { this.noise(0.18, 'bandpass', 500 + i * 300, 4, 0.4, i * 0.22, p); this.tone('sawtooth', 120 + i * 40, 80, 0.2, 0.2, i * 0.22, p); } this.tone('square', 90, 40, 0.5, 0.5, 0.95, p); }
  thud(pos?: Vec3, g = 0.6) { const p = this.panner(pos || null); this.tone('sine', 90, 30, 0.5, g, 0, p); this.noise(0.35, 'lowpass', 400, 1, g * 0.7, 0, p); }
  crash() { this.noise(1.4, 'lowpass', 2500, 0.7, 0.9, 0, undefined, 200); this.tone('sine', 70, 25, 1.4, 0.9); for (let i = 0; i < 6; i++) this.noise(0.12, 'bandpass', 2500 + Math.random() * 3000, 3, 0.3, 0.1 + Math.random() * 0.8); }
  rumble() { this.noise(2.2, 'lowpass', 160, 1, 0.8); this.tone('sine', 48, 28, 2.2, 0.7); for (let i = 0; i < 5; i++) this.noise(0.1, 'bandpass', 3000, 2, 0.2, 0.2 + Math.random() * 1.6); }
  spark(pos?: Vec3) { const p = this.panner(pos || null); this.noise(0.15, 'highpass', 3500, 1, 0.4, 0, p); this.tone('square', 2400, 600, 0.08, 0.1, 0, p); }
  powerOn() { this.tone('sawtooth', 40, 220, 1.8, 0.3); this.noise(1.4, 'lowpass', 300, 1, 0.5, 0, undefined, 3000); this.tone('sine', 60, 60, 2, 0.2, 1.5); }
  powerOff() { this.tone('sawtooth', 200, 30, 1.2, 0.3); this.noise(0.5, 'lowpass', 2000, 1, 0.4, 0, undefined, 100); }
  ding() { this.tone('sine', 1320, 1320, 1.2, 0.25); this.tone('sine', 990, 990, 1.4, 0.2, 0.25); }
  beep(pos?: Vec3) { const p = this.panner(pos || null); this.tone('square', 1900, 1900, 0.09, 0.28, 0, p); }
  throwSfx() { this.noise(0.18, 'bandpass', 1500, 1, 0.15, 0, undefined, 600); }
  canHit(pos?: Vec3) { const p = this.panner(pos || null); this.noise(0.3, 'bandpass', 3000, 5, 0.5, 0, p); this.tone('triangle', 1600, 900, 0.25, 0.3, 0, p); }
  hurt(big = false) { this.tone('sawtooth', 160, 70, 0.3, big ? 0.5 : 0.3); this.noise(0.3, 'lowpass', 900, 1, big ? 0.7 : 0.4); this.tone('sine', 60, 30, 0.35, 0.6); }
  die() { this.tone('sawtooth', 120, 30, 2, 0.4); this.noise(1.8, 'lowpass', 600, 1, 0.5, 0, undefined, 60); }
  heart(fast: number) { this.tone('sine', 62, 38, 0.16, 0.5 + fast * 0.3); this.tone('sine', 55, 34, 0.18, 0.35 + fast * 0.2, 0.17); }
  breath(tired: boolean) {
    const d = tired ? 0.7 : 1.4, g = tired ? 0.22 : 0.07;
    this.noise(d, 'bandpass', tired ? 1100 : 800, 1.2, g, 0, undefined, tired ? 1500 : 600);
  }
  gasp() { this.noise(0.4, 'bandpass', 1200, 1.5, 0.3, 0, undefined, 2200); }
  radioOn() { this.noise(0.25, 'bandpass', 2000, 0.8, 0.3); this.tone('square', 1000, 1000, 0.05, 0.08, 0.24); }
  radioOff() { this.tone('square', 1000, 1000, 0.05, 0.08); this.noise(0.18, 'bandpass', 2000, 0.8, 0.25, 0.04); }
  voice(pitch: number, radio: boolean, gain = 0.07) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    const f = pitch * (0.85 + Math.random() * 0.4);
    o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * (0.9 + Math.random() * 0.25), t + 0.08);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = radio ? 1400 : 700 + Math.random() * 500; bp.Q.value = 2.5;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(bp); bp.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + 0.12);
    if (radio) this.noise(0.08, 'highpass', 3000, 1, 0.015);
  }
  alarm(on: boolean) {
    if (this.alarmTimer) { clearInterval(this.alarmTimer); this.alarmTimer = null; }
    if (!on || !this.ctx) return;
    const one = () => { this.tone('sawtooth', 520, 880, 0.55, 0.16, 0, this.ambBus); this.tone('sawtooth', 880, 520, 0.55, 0.16, 0.55, this.ambBus); };
    one(); this.alarmTimer = window.setInterval(one, 1100);
  }
  // sonidos lejanos / de criatura
  distant(kind?: number) {
    const k = kind ?? Math.floor(Math.random() * 5);
    const a = this.panner({ x: this.lx + (Math.random() - 0.5) * 50, y: 1, z: this.lz + (Math.random() - 0.5) * 50 });
    if (k === 0) { this.tone('sine', 70, 30, 0.7, 0.9, 0, a); this.noise(0.5, 'lowpass', 300, 1, 0.8, 0, a); }
    else if (k === 1) { this.tone('sawtooth', 90, 130, 1.6, 0.3, 0, a); this.tone('sawtooth', 93, 133, 1.6, 0.3, 0, a); }
    else if (k === 2) { for (let i = 0; i < 3; i++) this.noise(0.1, 'bandpass', 600 + i * 120, 6, 0.9, i * 0.35, a); }
    else if (k === 3) { this.creatureCall(null, 0.35, true); }
    else { this.noise(1.5, 'bandpass', 300, 2, 0.6, 0, a, 900); }
  }
  creatureCall(pos: Vec3 | null, g = 0.5, far = false) {
    const p = this.panner(pos || (far ? { x: this.lx + (Math.random() - 0.5) * 70, y: 1, z: this.lz + (Math.random() - 0.5) * 70 } : null));
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(75, t); o.frequency.exponentialRampToValueAtTime(190, t + 0.5); o.frequency.exponentialRampToValueAtTime(55, t + 1.6);
    const m = c.createOscillator(); m.frequency.value = 31; const mg = c.createGain(); mg.gain.value = 40; m.connect(mg); mg.connect(o.frequency);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = far ? 500 : 1100; lp.Q.value = 4;
    const gn = c.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + 0.25); gn.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    o.connect(lp); lp.connect(gn); gn.connect(p); o.start(t); m.start(t); o.stop(t + 1.9); m.stop(t + 1.9);
    this.noise(1.4, 'bandpass', 700, 2, g * 0.5, 0.1, p, 300);
  }
  screech(pos: Vec3 | null) {
    const p = this.panner(pos);
    this.tone('sawtooth', 1200, 2400, 0.5, 0.35, 0, p); this.tone('square', 1800, 900, 0.5, 0.2, 0, p); this.noise(0.6, 'highpass', 2500, 1, 0.5, 0, p);
    this.creatureCall(pos, 0.8);
  }
  boneClick(pos: Vec3) { const p = this.panner(pos); for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.noise(0.04, 'bandpass', 1800 + Math.random() * 1500, 8, 0.7, i * (0.05 + Math.random() * 0.09), p); }
  heavyStep(pos: Vec3, g = 0.5) { const p = this.panner(pos); this.tone('sine', 70, 35, 0.3, g, 0, p); this.noise(0.15, 'lowpass', 500, 1, g * 0.8, 0, p); this.tone('triangle', 1400, 900, 0.05, g * 0.1, 0, p); }

  enemyBedUpdate(pos: Vec3 | null, intensity: number) {
    const c = this.ctx; if (!c) return;
    if (!this.enemyBed) {
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 3;
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 38; const og = c.createGain(); og.gain.value = 0.5;
      const g = c.createGain(); g.gain.value = 0;
      const pan = c.createPanner(); pan.panningModel = 'equalpower'; pan.distanceModel = 'inverse'; pan.refDistance = 3; pan.rolloffFactor = 1.2;
      s.connect(lp); o.connect(og); og.connect(lp); lp.connect(g); g.connect(pan); pan.connect(this.sfxBus); s.start(); o.start();
      this.enemyBed = { gain: g, pan, lp };
    }
    const b = this.enemyBed;
    if (pos) { if (b.pan.positionX) { b.pan.positionX.value = pos.x; b.pan.positionY.value = pos.y; b.pan.positionZ.value = pos.z; } else b.pan.setPosition(pos.x, pos.y, pos.z); }
    b.gain.gain.setTargetAtTime(pos ? intensity * 0.5 : 0, c.currentTime, 0.2);
    b.lp.frequency.setTargetAtTime(200 + intensity * 400, c.currentTime, 0.2);
  }

  dispose() {
    if (this.seqTimer) clearInterval(this.seqTimer);
    if (this.alarmTimer) clearInterval(this.alarmTimer);
    void this.ctx?.close();
    this.ctx = null;
  }
}

export const audio = new AudioEngine();
