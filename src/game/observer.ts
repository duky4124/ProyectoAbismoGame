import * as THREE from 'three';
import type { Game } from './engine';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CELL } from './world';

type State = 'dormant' | 'patrol' | 'watch' | 'investigate' | 'chase' | 'search' | 'attack';

function limb(len: number, r0: number, r1: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 7), mat);
  m.position.y = -len / 2; m.castShadow = true; return m;
}

export class Observer {
  group = new THREE.Group();
  state: State = 'dormant';
  x = 0; z = 0; yaw = 0;
  detect = 0;
  hasLOS = false;
  threat = 0;
  harmless = false;
  private body = new THREE.Group();
  private legs: { hip: THREE.Group; knee: THREE.Group }[] = [];
  private arms: { sh: THREE.Group; el: THREE.Group }[] = [];
  private head = new THREE.Group();
  private chest!: THREE.Mesh;
  private eyes: THREE.Mesh[] = [];
  private phase = 0;
  private lastStep = 0;
  private lean = 0;
  private timer = 0;
  private lastSeen = { x: 0, z: 0 };
  private target = { x: 0, z: 0 };
  private lostT = 0;
  private chaseT = 0;
  private field: Int16Array | null = null;
  private fieldKey = -1;
  private fieldAge = 0;
  private clickT = 3;
  private attackT = 0;
  private attackCd = 0;
  private searchLeft = 0;
  private sniffT = 0;
  private watchT = 0;
  private idleLook = 0;
  private lightLevel = 0;
  private speedNow = 0;
  private spawnT = 0;
  private mixer: THREE.AnimationMixer | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private currentModelAction: THREE.AnimationAction | null = null;

  constructor(private g: Game) {
    const skin = new THREE.MeshStandardMaterial({ color: 0x9c9c92, roughness: 0.55, metalness: 0.05, emissive: 0x1c1c18 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1 });
    const flesh = new THREE.MeshStandardMaterial({ color: 0x6a4a48, roughness: 0.5, emissive: 0x120606 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
    this.group.add(this.body);
    // El modelo procedural queda oculto: se utiliza únicamente el GLB.
    this.body.visible = false;
    // pelvis + torso
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.22), skin); pelvis.position.y = 1.5; this.body.add(pelvis);
    this.chest = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.13, 1.0, 8), skin); this.chest.scale.z = 0.62; this.chest.position.y = 2.05; this.chest.castShadow = true; this.body.add(this.chest);
    for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.16 - i * 0.005, 0.012, 4, 10, Math.PI), flesh); r.rotation.set(Math.PI / 2, 0, Math.PI / 2); r.scale.set(1, 0.62, 1); r.position.set(0, 1.75 + i * 0.1, 0.0); this.body.add(r); }
    for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 5), flesh); s.rotation.x = Math.PI / 2 + 0.3; s.position.set(0, 1.65 + i * 0.13, 0.15); this.body.add(s); }
    // cuello + cabeza
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 6), skin); neck.position.y = 2.65; this.body.add(neck);
    this.head.position.set(0, 2.82, 0); this.body.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skin); skull.scale.set(0.8, 1.45, 0.95); skull.castShadow = true; this.head.add(skull);
    for (const sx of [-1, 1]) {
      const so = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), dark); so.position.set(sx * 0.07, 0.08, -0.17); so.scale.set(1, 1.5, 0.6); this.head.add(so);
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), eyeMat); e.position.set(sx * 0.07, 0.07, -0.2); this.head.add(e); this.eyes.push(e);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.22, 0.02), dark); mouth.position.set(0, -0.15, -0.19); this.head.add(mouth);
    // piernas
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(sx * 0.13, 1.45, 0); this.body.add(hip);
      hip.add(limb(0.75, 0.07, 0.05, skin));
      const knee = new THREE.Group(); knee.position.y = -0.75; hip.add(knee);
      knee.add(limb(0.75, 0.05, 0.035, skin));
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.3), skin); foot.position.set(0, -0.76, -0.1); knee.add(foot);
      this.legs.push({ hip, knee });
    }
    // brazos largos
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * 0.24, 2.48, 0); this.body.add(sh);
      sh.add(limb(0.85, 0.055, 0.04, skin));
      const el = new THREE.Group(); el.position.y = -0.85; sh.add(el);
      el.add(limb(0.95, 0.04, 0.03, skin));
      for (let f = 0; f < 4; f++) { const fi = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.3, 4), dark); fi.position.set((f - 1.5) * 0.025, -1.1, 0); fi.rotation.x = 0.1; el.add(fi); }
      this.arms.push({ sh, el });
    }
    this.group.visible = false;
    g.level.add(this.group);
    this.loadMonsterModel();
  }

  /**
   * Carga el modelo riggeado desde public/models/monster.glb.
   * No utiliza el monstruo procedural como respaldo.
   */
  private loadMonsterModel() {
    const loader = new GLTFLoader();
    loader.load(
      '/models/monster.glb',
      (gltf) => {
        const model = gltf.scene;
        model.name = 'ObserverMonsterModel';

        // El GLB está orientado al eje contrario al que usa la IA (-Z).
        // Este giro local hace que mire hacia donde apunta yaw y no ataque de espaldas.
        model.rotation.y = Math.PI;

        // Ajusta el tamaño del GLB a la altura que tenía el modelo anterior.
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const targetHeight = 3.05;
        const scale = targetHeight / Math.max(size.y, 0.001);
        model.scale.setScalar(scale);
        model.position.set(
          -center.x * scale,
          -bounds.min.y * scale,
          -center.z * scale
        );

        model.traverse((obj) => {
          if (obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });

        this.group.add(model);
        this.mixer = new THREE.AnimationMixer(model);
        const walk = gltf.animations.find((clip) => clip.name.toLowerCase() === 'walk');
        const idle = gltf.animations.find((clip) => clip.name.toLowerCase() === 'idle');

        if (walk) {
          this.walkAction = this.mixer.clipAction(walk);
          this.walkAction.setLoop(THREE.LoopRepeat, Infinity);
          this.walkAction.enabled = true;
        }
        if (idle) {
          this.idleAction = this.mixer.clipAction(idle);
          this.idleAction.setLoop(THREE.LoopRepeat, Infinity);
          this.idleAction.enabled = true;
        }
        if (!walk || !idle) {
          console.warn('[Observer] Animaciones disponibles:', gltf.animations.map((clip) => clip.name));
        }

        const initialAction = this.idleAction ?? this.walkAction;
        if (initialAction) {
          initialAction.reset();
          initialAction.play();
          this.currentModelAction = initialAction;
        }
      },
      undefined,
      (error) => {
        console.error('[Observer] No se pudo cargar /models/monster.glb. Comprueba que esté en public/models/monster.glb.', error);
      }
    );
  }

  private setModelAction(next: THREE.AnimationAction | null, fade = 0.2) {
    if (!next || next === this.currentModelAction) return;
    const previous = this.currentModelAction;
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(1);
    next.play();
    if (previous) previous.crossFadeTo(next, fade, false);
    this.currentModelAction = next;
  }

  private canPass = (x: number, y: number) => {
    const w = this.g.world;
    if (!w.inb(x, y)) return false; const i = w.idx(x, y);
    if (w.solid[i] || w.crouchCell[i]) return false;
    const d = w.doors.get(i); return !d || !d.locked;
  };

  spawn(x: number, z: number, mode: 'watch' | 'patrol' | 'chase' | 'investigate', opts: { harmless?: boolean; yawToPlayer?: boolean } = {}) {
    this.x = x; this.z = z; this.harmless = !!opts.harmless;
    this.group.visible = true; this.detect = 0; this.attackCd = 1.0; this.spawnT = 0;
    this.field = null; this.fieldKey = -1; this.lean = 0;
    const P = this.g.P;
    this.yaw = Math.atan2(-(P.x - x), -(P.z - z));
    this.group.position.set(x, 0, z); this.group.rotation.y = this.yaw;
    if (mode === 'watch') { this.state = 'watch'; this.watchT = 5 + Math.random() * 5 }
    else if (mode === 'chase') { this.startChase(); }
    else if (mode === 'investigate') { this.state = 'investigate'; this.target = { x: P.x, z: P.z }; }
    else { this.state = 'patrol'; this.pickWaypoint(); }
  }
  despawn() { this.state = 'dormant'; this.group.visible = false; this.threat = 0; this.detect = 0; this.g.audio.enemyBedUpdate(null, 0); }
  get active() { return this.state !== 'dormant'; }
  get chasing() { return this.state === 'chase' || this.state === 'attack'; }

  startChase() {
    if (this.state === 'chase') return;
    this.state = 'chase'; this.chaseT = 0; this.lostT = 0; this.detect = 1;
    this.lastSeen = { x: this.g.P.x, z: this.g.P.z };
    this.g.audio.screech({ x: this.x, y: 2, z: this.z });
    this.g.shake(0.5, 0.6);
    this.g.onEnemyAlert();
  }

  hear(nx: number, nz: number, r: number) {
    if (!this.active) return;
    const d = Math.hypot(nx - this.x, nz - this.z);
    const eff = this.g.world.los(this.x, this.z, nx, nz) ? r : r * 0.62;
    if (this.chasing) { if (this.state === 'chase' && d < eff && !this.g.P.hidden) { this.lastSeen = { x: nx, z: nz }; this.lostT = 0; } return; }
    if (d > eff) return;
    if (this.state === 'watch' && this.harmless) return;
    this.state = 'investigate'; this.target = { x: nx, z: nz }; this.timer = 0; this.detect = Math.max(this.detect, 0.35);
  }

  private pickWaypoint() {
    const wp = this.g.waypoints; const P = this.g.P;
    let best = wp[Math.floor(Math.random() * wp.length)];
    // preferencia por zonas cercanas al jugador con cierta probabilidad, para variar
    if (Math.random() < 0.4) { const near = wp.filter((w: { x: number; y: number }) => Math.hypot((w.x + 0.5) * CELL - P.x, (w.y + 0.5) * CELL - P.z) < 40); if (near.length) best = near[Math.floor(Math.random() * near.length)]; }
    this.target = { x: (best.x + 0.5) * CELL, z: (best.y + 0.5) * CELL };
    this.timer = 0;
  }

  /** Mueve hacia un punto usando línea recta o campo de flujo. Devuelve true si llegó. */
  private goto(tx: number, tz: number, speed: number, dt: number): boolean {
    const w = this.g.world;
    const dist = Math.hypot(tx - this.x, tz - this.z);
    if (dist < 0.5) return true;
    let mx = tx, mz = tz;
    if (!(dist < 18 && w.los(this.x, this.z, tx, tz))) {
      const tcx = Math.floor(tx / CELL), tcy = Math.floor(tz / CELL);
      const key = tcy * w.w + tcx; this.fieldAge += dt;
      if (this.fieldKey !== key || !this.field || this.fieldAge > 1.2) { this.field = w.flow(tcx, tcy, this.canPass); this.fieldKey = key; this.fieldAge = 0; }
      const cx = Math.floor(this.x / CELL), cy = Math.floor(this.z / CELL);
      const field = this.field;
      const cur = field[w.idx(cx, cy)];
      let best = -1, bx = 0, by = 0, bd = cur < 0 ? 1e9 : cur;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy; if (!w.inb(nx, ny)) continue;
        const d = field[w.idx(nx, ny)]; if (d < 0) continue;
        if (dx && dy && (!this.canPass(cx + dx, cy) || !this.canPass(cx, cy + dy))) continue;
        if (d < bd) { bd = d; best = 1; bx = nx; by = ny; }
      }
      if (best < 0) return cur === 0 || cur < 0;
      mx = (bx + 0.5) * CELL; mz = (by + 0.5) * CELL;
    }
    // abrir puertas cercanas
    const dx0 = mx - this.x, dz0 = mz - this.z; const dl = Math.hypot(dx0, dz0) || 1;
    const px = this.x + (dx0 / dl) * 1.4, pz = this.z + (dz0 / dl) * 1.4;
    const door = w.doorAt(Math.floor(px / CELL), Math.floor(pz / CELL));
    if (door && !door.open && !door.locked) { door.open = true; this.g.audio.doorSlide({ x: door.x, y: 1.5, z: door.z }, door.heavy); }
    const wantYaw = Math.atan2(-dx0, -dz0);
    this.yaw = turn(this.yaw, wantYaw, (this.state === 'chase' ? 9 : 4) * dt);
    this.speedNow = speed;
    const step = Math.min(speed * dt, dl);
    const p = { x: this.x + (dx0 / dl) * step, z: this.z + (dz0 / dl) * step };
    w.resolve(p, 0.42, false);
    this.x = p.x; this.z = p.z;
    return false;
  }

  update(dt: number, time: number) {
    if (this.state === 'dormant') return;
    const g = this.g, P = g.P, w = g.world;
    const dx = P.x - this.x, dz = P.z - this.z; const dist = Math.hypot(dx, dz);
    this.spawnT += dt; this.attackCd -= dt;
    this.speedNow = 0;

    // ---- percepción ----
    this.hasLOS = w.los(this.x, this.z, P.x, P.z);
    const fwdx = -Math.sin(this.yaw), fwdz = -Math.cos(this.yaw);
    const dot = dist > 0.01 ? (dx * fwdx + dz * fwdz) / dist : 1;
    this.lightLevel = g.lightLevel;
    const range = 7 + 24 * this.lightLevel * (P.crouch ? 0.75 : 1) + (P.running ? 6 : 0);
    const inFov = dot > 0.2 || dist < 4; // ~ 156° de visión
    const canSee = !P.hidden && this.hasLOS && dist < range && inFov;
    if (!this.harmless || this.state !== 'watch') {
      if (canSee && this.state !== 'attack') {
        let rate = 0.35 + (1 - dist / range) * 1.8; if (dist < 6) rate *= 2; if (P.crouch) rate *= 0.6; if (P.speed < 0.2) rate *= 0.6;
        if (this.state === 'watch') rate *= 0.5;
        this.detect = Math.min(1.2, this.detect + rate * dt);
      } else this.detect = Math.max(0, this.detect - dt * (this.state === 'chase' ? 0.1 : 0.35));
    }
    if (canSee) this.lastSeen = { x: P.x, z: P.z };

    this.threat = this.chasing ? 2 : (this.state !== 'patrol' || this.hasLOS) && (this.detect > 0.25 || (this.hasLOS && dist < 24)) ? 1 : (this.state === 'investigate' ? 1 : 0);

    if (this.detect >= 1 && !this.chasing && !(this.state === 'watch' && this.harmless)) this.startChase();

    // ---- estados ----
    switch (this.state) {
      case 'watch': {
        this.yaw = turn(this.yaw, Math.atan2(-dx, -dz), 2.5 * dt);
        this.watchT -= dt;
        const looking = g.lookDot(this.x, this.z) > 0.6 && this.hasLOS;
        // se acerca sigilosamente cuando no se le mira
        if (!looking && dist > 13 && !this.harmless) this.goto(P.x, P.z, 1.1, dt);
        if (this.harmless) {
          if ((dist < 11 && looking) || this.watchT < -6) { this.despawn(); return; }
        } else if (this.watchT <= 0 || dist < 9) {
          if (!looking && dist > 14) { if (this.watchT < -6) { this.despawn(); return; } }
          else if (Math.random() < 0.5 && this.watchT < 0) this.startChase();
          else if (this.watchT < -0.5 || dist < 9) { if (dist < 9 && Math.random() < 0.5) this.startChase(); else { g.audio.creatureCall({ x: this.x, y: 2, z: this.z }, 0.35); this.despawn(); return; } }
        }
        break;
      }
      case 'patrol': {
        const arrived = this.goto(this.target.x, this.target.z, 1.8, dt);
        if (arrived) { this.timer += dt; this.idleLook += dt; if (this.timer > 3 + Math.random()) this.pickWaypoint(); }
        break;
      }
      case 'investigate': {
        const arrived = this.goto(this.target.x, this.target.z, 2.8, dt);
        if (arrived) { this.timer += dt; if (this.timer > 2.5) { this.state = 'search'; this.searchLeft = 9; this.sniffT = 0; } }
        break;
      }
      case 'chase': {
        this.chaseT += dt;
        if (canSee) this.lostT = 0;
        else if (P.hidden || Math.hypot(this.lastSeen.x - this.x, this.lastSeen.z - this.z) < 1.6) this.lostT += dt;
        else this.lostT += dt * 0.15;
        const sp = Math.min(5.6, 4.3 + this.chaseT * 0.12);
        if (P.hidden) {
          // Si lo vio esconderse, va directo a su escondite
          if (g.hideSeen) {
            const arrived = this.goto(P.hidden.x, P.hidden.z, sp, dt);
            if (arrived || Math.hypot(P.hidden.x - this.x, P.hidden.z - this.z) < 1.8) { g.grabPlayer(this); this.state = 'search'; this.searchLeft = 6; this.sniffT = 0; }
          } else if (this.lostT > 0.8) { this.state = 'search'; this.searchLeft = 12; this.sniffT = 0; this.target = { x: this.lastSeen.x, z: this.lastSeen.z }; }
          break;
        }
        const tx = canSee ? P.x : this.lastSeen.x, tz = canSee ? P.z : this.lastSeen.z;
        this.goto(tx, tz, sp, dt);
        if (dist < 1.9 && this.hasLOS && this.attackCd <= 0) { this.state = 'attack'; this.attackT = 0; }
        if (this.lostT > 6) { this.state = 'search'; this.searchLeft = 10; this.sniffT = 0; this.target = { x: this.lastSeen.x, z: this.lastSeen.z }; g.onEnemyLost(); }
        break;
      }
      case 'attack': {
        this.attackT += dt;
        this.yaw = turn(this.yaw, Math.atan2(-dx, -dz), 8 * dt);
        if (this.attackT > 0.38 && this.attackCd <= 0) {
          this.attackCd = 1.3;
          if (dist < 2.4 && !P.hidden) g.damage(26, this.x, this.z);
          g.audio.creatureCall({ x: this.x, y: 2, z: this.z }, 0.5);
        }
        if (this.attackT > 0.8) this.state = 'chase';
        break;
      }
      case 'search': {
        if (P.hidden && this.hasLOS === false) { /* no ve al jugador */ }
        this.searchLeft -= dt;
        const arrived = this.goto(this.target.x, this.target.z, 2.3, dt);
        const nearHide = P.hidden && Math.hypot(P.hidden.x - this.x, P.hidden.z - this.z) < 3.2;
        if (nearHide) {
          this.sniffT += dt; g.nearHideTension = Math.min(1, this.sniffT / 4);
          if (this.sniffT > 4.5 && Math.random() < dt * 0.35) { g.grabPlayer(this); this.searchLeft = 5; this.sniffT = 0; }
        } else g.nearHideTension = 0;
        if (arrived) { this.timer += dt; if (this.timer > 1.8) { this.timer = 0; const wp = this.g.waypoints[Math.floor(Math.random() * this.g.waypoints.length)]; const near = Math.random() < 0.6; this.target = near ? { x: this.x + (Math.random() - 0.5) * 20, z: this.z + (Math.random() - 0.5) * 20 } : { x: (wp.x + 0.5) * CELL, z: (wp.y + 0.5) * CELL }; } }
        if (this.searchLeft <= 0) { this.state = 'patrol'; this.pickWaypoint(); g.nearHideTension = 0; }
        break;
      }
    }
    // Nunca queda demasiado lejos: si está > 90 m, desaparece
    if (dist > 90 && this.state !== 'chase') { this.despawn(); return; }

    this.animate(dt, time, dist);
  }

  private animate(dt: number, time: number, dist: number) {
    const g = this.g;
    const spd = this.speedNow;
    const moving = spd > 0.1;

    // El GLB utiliza sus propios clips Walk e Idle; la IA sigue controlando
    // posición, orientación, estados y velocidades como antes.
    if (this.mixer) {
      // En persecución se mantiene Walk incluso durante pequeños parones de navegación.
      const shouldWalk = moving || (this.state === 'chase' && dist > 2.2);
      this.setModelAction(shouldWalk ? (this.walkAction ?? this.idleAction) : (this.idleAction ?? this.walkAction));
      if (this.currentModelAction) {
        this.currentModelAction.enabled = true;
        this.currentModelAction.setEffectiveWeight(1);
        this.currentModelAction.timeScale = shouldWalk ? (this.state === 'chase' ? 1.3 : 1.0) : 1.0;
      }
      this.mixer.update(Math.max(0, Math.min(dt, 0.1)));
    }

    this.phase += dt * spd * 1.55;
    const run = this.state === 'chase' ? 1 : 0;
    const amp = moving ? Math.min(0.95, 0.25 + spd * 0.16) : 0;
    const s = Math.sin(this.phase);
    this.legs.forEach((l, i) => {
      const ph = i ? s : -s;
      l.hip.rotation.x = ph * amp;
      l.knee.rotation.x = moving ? Math.max(0, (i ? Math.cos(this.phase) : -Math.cos(this.phase))) * amp * 1.3 + 0.05 : 0.04;
    });
    const attack = this.state === 'attack';
    const aw = attack ? Math.min(1, this.attackT / 0.35) : 0;
    this.arms.forEach((a, i) => {
      const ph = i ? -s : s;
      const sw = moving ? ph * amp * 0.9 : Math.sin(time * 0.8 + i) * 0.03;
      a.sh.rotation.x = attack ? -1.5 * aw + 0.2 : sw + (run ? 0.5 : 0);
      a.sh.rotation.z = (i ? -1 : 1) * (0.05 + (attack ? 0.35 * aw : 0) + Math.sin(time * 1.3 + i * 2) * 0.02);
      a.el.rotation.x = attack ? -0.4 : -0.15 - (moving ? Math.max(0, ph) * 0.4 : 0) - (run ? 0.6 : 0);
    });
    const targetLean = this.state === 'chase' ? 0.38 : this.state === 'investigate' ? 0.14 : moving ? 0.06 : 0;
    this.lean += (targetLean - this.lean) * Math.min(1, dt * 5);
    this.body.rotation.x = -this.lean + (attack ? -0.25 * aw : 0);
    this.body.position.y = moving ? Math.abs(Math.sin(this.phase)) * 0.06 - 0.03 : Math.sin(time * 1.1) * 0.012;
    this.chest.scale.x = 1 + Math.sin(time * 1.6) * 0.03;
    // cabeza: sigue al jugador cuando observa, o se inclina al azar
    const P = g.P;
    const headYawWorld = Math.atan2(-(P.x - this.x), -(P.z - this.z));
    let rel = wrapAngle(headYawWorld - this.yaw);
    const lookAt = (this.state === 'watch' || this.state === 'chase' || this.state === 'attack' || (this.hasLOS && dist < 22)) && Math.abs(rel) < 1.6;
    const wantH = lookAt ? rel : Math.sin(time * 0.5) * 0.4;
    this.head.rotation.y += (wantH - this.head.rotation.y) * Math.min(1, dt * 6);
    const tilt = this.state === 'watch' ? 0.35 + Math.sin(time * 0.7) * 0.12 : this.state === 'investigate' ? 0.15 : 0;
    this.head.rotation.z += (tilt - this.head.rotation.z) * Math.min(1, dt * 3);
    if (this.state === 'patrol' && Math.random() < dt * 0.4) this.head.rotation.y += (Math.random() - 0.5) * 0.8;
    const em = this.chasing ? 1 : 0.5 + Math.sin(time * 5) * 0.2;
    this.eyes.forEach((e) => e.scale.setScalar(em * 1.2 + 0.2));
    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.yaw;

    // sonidos propios
    if (moving) {
      const cyc = Math.floor(this.phase / Math.PI);
      if (cyc !== this.lastStep) { this.lastStep = cyc; if (dist < 45) g.audio.heavyStep({ x: this.x, y: 0.1, z: this.z }, Math.min(0.8, 0.25 + spd * 0.1)); }
    }
    this.clickT -= dt;
    if (this.clickT < 0 && dist < 50) { this.clickT = 2.5 + Math.random() * 4; g.audio.boneClick({ x: this.x, y: 2.5, z: this.z }); }
    const prox = Math.max(0, 1 - dist / 35);
    g.audio.enemyBedUpdate({ x: this.x, y: 2, z: this.z }, prox * (this.chasing ? 1.4 : 0.8));
  }
}

function wrapAngle(a: number) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
function turn(cur: number, want: number, maxStep: number) {
  const d = wrapAngle(want - cur);
  return cur + Math.max(-maxStep, Math.min(maxStep, d));
}
