import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Game } from './engine';
import { CELL } from './world';

type State = 'dormant' | 'patrol' | 'watch' | 'investigate' | 'chase' | 'search' | 'attack';

interface LimbNode {
  obj: THREE.Object3D;
  initRot: THREE.Euler;
  initPos: THREE.Vector3;
}

export class Observer {
  group = new THREE.Group();
  state: State = 'dormant';
  x = 0; z = 0; yaw = 0;
  detect = 0;
  hasLOS = false;
  threat = 0;
  harmless = false;

  private model: THREE.Group | null = null;
  private wrapper = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;

  // Huesos/extremidades para la caminata alternada
  private frontLeftLimbs: LimbNode[] = [];
  private frontRightLimbs: LimbNode[] = [];
  private backLimbs: LimbNode[] = [];

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
  private walkCycle = 0;
  private lastStepIndex = 0;

  constructor(private g: Game) {
    const loader = new GLTFLoader();

    // El wrapper ahora apunta directo hacia el frente
    this.wrapper.rotation.y = 0;
    this.group.add(this.wrapper);

    loader.load(
      '/models/monster.glb',
      (gltf) => {
        this.model = gltf.scene;

        // Auto-escalado a 2.6 metros (altura de monstruo)
        const box = new THREE.Box3().setFromObject(this.model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const targetHeight = 2.6;
        const scale = targetHeight / (size.y || 1);
        this.model.scale.setScalar(scale);

        // Apoyar patas en el suelo (Y = 0)
        box.setFromObject(this.model);
        box.getCenter(center);
        this.model.position.x = -center.x;
        this.model.position.y = -box.min.y;
        this.model.position.z = -center.z;

        this.model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
          }

          // Detección de extremidades delanteras y traseras
          const name = child.name.toLowerCase();
          const isBoneOrMesh = (child as THREE.Bone).isBone || child.type === 'Mesh' || child.type === 'Group';

          if (isBoneOrMesh) {
            const isLeft = name.includes('left') || name.includes('_l') || name.includes('.l') || name.startsWith('l_');
            const isRight = name.includes('right') || name.includes('_r') || name.includes('.r') || name.startsWith('r_');
            const isFront = name.includes('arm') || name.includes('front') || name.includes('hand') || name.includes('fore') || name.includes('shoulder');
            const isBack = name.includes('leg') || name.includes('thigh') || name.includes('foot') || name.includes('hind') || name.includes('calf');

            if (isLeft && isFront) {
              this.frontLeftLimbs.push({ obj: child, initRot: child.rotation.clone(), initPos: child.position.clone() });
            } else if (isRight && isFront) {
              this.frontRightLimbs.push({ obj: child, initRot: child.rotation.clone(), initPos: child.position.clone() });
            } else if (isBack) {
              this.backLimbs.push({ obj: child, initRot: child.rotation.clone(), initPos: child.position.clone() });
            }
          }
        });

        this.wrapper.add(this.model);

        // Si el archivo incluye animación interna, reproducirla
        if (gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.model);
          const first = this.mixer.clipAction(gltf.animations[0]);
          first.play();
        }
      },
      undefined,
      (err) => console.error('Error cargando monstruo:', err)
    );

    this.group.visible = false;
    g.level.add(this.group);
  }

  private canPass = (x: number, y: number) => {
    const w = this.g.world;
    if (!w.inb(x, y)) return false;
    const i = w.idx(x, y);
    if (w.solid[i] || w.crouchCell[i]) return false;
    const d = w.doors.get(i);
    return !d || !d.locked;
  };

  spawn(x: number, z: number, mode: 'watch' | 'patrol' | 'chase' | 'investigate', opts: { harmless?: boolean; yawToPlayer?: boolean } = {}) {
    this.x = x; this.z = z; this.harmless = !!opts.harmless;
    this.group.visible = true; this.detect = 0; this.attackCd = 1.0; this.spawnT = 0;
    this.field = null; this.fieldKey = -1;
    const P = this.g.P;
    this.yaw = Math.atan2(-(P.x - x), -(P.z - z));
    this.group.position.set(x, 0, z);
    this.group.rotation.y = this.yaw;
    if (mode === 'watch') { this.state = 'watch'; this.watchT = 5 + Math.random() * 5; }
    else if (mode === 'chase') { this.startChase(); }
    else if (mode === 'investigate') { this.state = 'investigate'; this.target = { x: P.x, z: P.z }; }
    else { this.state = 'patrol'; this.pickWaypoint(); }
  }

  despawn() {
    this.state = 'dormant';
    this.group.visible = false;
    this.threat = 0;
    this.detect = 0;
    this.g.audio.enemyBedUpdate(null, 0);
  }

  get active() { return this.state !== 'dormant'; }
  get chasing() { return this.state === 'chase' || this.state === 'attack'; }

  startChase() {
    if (this.state === 'chase') return;
    this.state = 'chase'; this.chaseT = 0; this.lostT = 0; this.detect = 1;
    this.lastSeen = { x: this.g.P.x, z: this.g.P.z };
    this.g.audio.screech({ x: this.x, y: 2, z: this.z });
    this.g.shake(0.35, 0.5);
    this.g.onEnemyAlert();
  }

  hear(nx: number, nz: number, r: number) {
    if (!this.active) return;
    const d = Math.hypot(nx - this.x, nz - this.z);
    const eff = this.g.world.los(this.x, this.z, nx, nz) ? r : r * 0.62;
    if (this.chasing) {
      if (this.state === 'chase' && d < eff && !this.g.P.hidden) {
        this.lastSeen = { x: nx, z: nz };
        this.lostT = 0;
      }
      return;
    }
    if (d > eff) return;
    if (this.state === 'watch' && this.harmless) return;
    this.state = 'investigate'; this.target = { x: nx, z: nz }; this.timer = 0;
    this.detect = Math.max(this.detect, 0.35);
  }

  private pickWaypoint() {
    const wp = this.g.waypoints; const P = this.g.P;
    let best = wp[Math.floor(Math.random() * wp.length)];
    if (Math.random() < 0.4) {
      const near = wp.filter((w: { x: number; y: number }) => Math.hypot((w.x + 0.5) * CELL - P.x, (w.y + 0.5) * CELL - P.z) < 40);
      if (near.length) best = near[Math.floor(Math.random() * near.length)];
    }
    this.target = { x: (best.x + 0.5) * CELL, z: (best.y + 0.5) * CELL };
    this.timer = 0;
  }

  private goto(tx: number, tz: number, speed: number, dt: number): boolean {
    const w = this.g.world;
    const dist = Math.hypot(tx - this.x, tz - this.z);
    if (dist < 0.5) return true;
    let mx = tx, mz = tz;
    if (!(dist < 18 && w.los(this.x, this.z, tx, tz))) {
      const tcx = Math.floor(tx / CELL), tcy = Math.floor(tz / CELL);
      const key = tcy * w.w + tcx; this.fieldAge += dt;
      if (this.fieldKey !== key || !this.field || this.fieldAge > 1.2) {
        this.field = w.flow(tcx, tcy, this.canPass);
        this.fieldKey = key;
        this.fieldAge = 0;
      }
      const cx = Math.floor(this.x / CELL), cy = Math.floor(this.z / CELL);
      const field = this.field;
      const cur = field[w.idx(cx, cy)];
      let best = -1, bx = 0, by = 0, bd = cur < 0 ? 1e9 : cur;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!w.inb(nx, ny)) continue;
        const d = field[w.idx(nx, ny)];
        if (d < 0) continue;
        if (dx && dy && (!this.canPass(cx + dx, cy) || !this.canPass(cx, cy + dy))) continue;
        if (d < bd) { bd = d; best = 1; bx = nx; by = ny; }
      }
      if (best < 0) return cur === 0 || cur < 0;
      mx = (bx + 0.5) * CELL; mz = (by + 0.5) * CELL;
    }
    const dx0 = mx - this.x, dz0 = mz - this.z;
    const dl = Math.hypot(dx0, dz0) || 1;
    const px = this.x + (dx0 / dl) * 1.4, pz = this.z + (dz0 / dl) * 1.4;
    const door = w.doorAt(Math.floor(px / CELL), Math.floor(pz / CELL));
    if (door && !door.open && !door.locked) {
      door.open = true;
      this.g.audio.doorSlide({ x: door.x, y: 1.5, z: door.z }, door.heavy);
    }
    const wantYaw = Math.atan2(-dx0, -dz0);
    this.yaw = turn(this.yaw, wantYaw, (this.state === 'chase' ? 6 : 3) * dt);
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
    const dx = P.x - this.x, dz = P.z - this.z;
    const dist = Math.hypot(dx, dz);
    this.spawnT += dt; this.attackCd -= dt;
    this.speedNow = 0;
    this.hasLOS = w.los(this.x, this.z, P.x, P.z);
    const fwdx = -Math.sin(this.yaw), fwdz = -Math.cos(this.yaw);
    const dot = dist > 0.01 ? (dx * fwdx + dz * fwdz) / dist : 1;
    this.lightLevel = g.lightLevel;
    const range = 7 + 24 * this.lightLevel * (P.crouch ? 0.75 : 1) + (P.running ? 6 : 0);
    const inFov = dot > 0.2 || dist < 4;
    const canSee = !P.hidden && this.hasLOS && dist < range && inFov;

    if (!this.harmless || this.state !== 'watch') {
      if (canSee && this.state !== 'attack') {
        let rate = 0.35 + (1 - dist / range) * 1.8;
        if (dist < 6) rate *= 2;
        if (P.crouch) rate *= 0.6;
        if (P.speed < 0.2) rate *= 0.6;
        if (this.state === 'watch') rate *= 0.5;
        this.detect = Math.min(1.2, this.detect + rate * dt);
      } else this.detect = Math.max(0, this.detect - dt * (this.state === 'chase' ? 0.1 : 0.35));
    }
    if (canSee) this.lastSeen = { x: P.x, z: P.z };
    this.threat = this.chasing ? 2 : (this.state !== 'patrol' || this.hasLOS) && (this.detect > 0.25 || (this.hasLOS && dist < 24)) ? 1 : (this.state === 'investigate' ? 1 : 0);
    if (this.detect >= 1 && !this.chasing && !(this.state === 'watch' && this.harmless)) this.startChase();

    // ========================================================================
    // VELOCIDADES REDUCIDAS Y AMENAZANTES
    // ========================================================================
    switch (this.state) {
      case 'watch': {
        this.yaw = turn(this.yaw, Math.atan2(-dx, -dz), 2.5 * dt);
        this.watchT -= dt;
        const looking = g.lookDot(this.x, this.z) > 0.6 && this.hasLOS;
        if (!looking && dist > 13 && !this.harmless) this.goto(P.x, P.z, 0.8, dt);
        if (this.harmless) {
          if ((dist < 11 && looking) || this.watchT < -6) { this.despawn(); return; }
        } else if (this.watchT <= 0 || dist < 9) {
          if (!looking && dist > 14) { if (this.watchT < -6) { this.despawn(); return; } }
          else if (Math.random() < 0.5 && this.watchT < 0) this.startChase();
          else if (this.watchT < -0.5 || dist < 9) {
            if (dist < 9 && Math.random() < 0.5) this.startChase();
            else { g.audio.creatureCall({ x: this.x, y: 2, z: this.z }, 0.35); this.despawn(); return; }
          }
        }
        break;
      }
      case 'patrol': {
        // Patrulla lenta y sigilosa (0.9 m/s)
        const arrived = this.goto(this.target.x, this.target.z, 0.9, dt);
        if (arrived) {
          this.timer += dt; this.idleLook += dt;
          if (this.timer > 3 + Math.random()) this.pickWaypoint();
        }
        break;
      }
      case 'investigate': {
        // Acecho cauteloso (1.3 m/s)
        const arrived = this.goto(this.target.x, this.target.z, 1.3, dt);
        if (arrived) {
          this.timer += dt;
          if (this.timer > 2.5) { this.state = 'search'; this.searchLeft = 9; this.sniffT = 0; }
        }
        break;
      }
      case 'chase': {
        this.chaseT += dt;
        if (canSee) this.lostT = 0;
        else if (P.hidden || Math.hypot(this.lastSeen.x - this.x, this.lastSeen.z - this.z) < 1.6) this.lostT += dt;
        else this.lostT += dt * 0.15;

        // VELOCIDAD DE PERSECUCIÓN AJUSTADA: Empieza en 2.1 y sube suavemente hasta máximo 2.5 m/s
        const sp = Math.min(2.5, 2.1 + this.chaseT * 0.02);

        if (P.hidden) {
          if (g.hideSeen) {
            const arrived = this.goto(P.hidden.x, P.hidden.z, sp, dt);
            if (arrived || Math.hypot(P.hidden.x - this.x, P.hidden.z - this.z) < 1.8) {
              g.grabPlayer(this); this.state = 'search'; this.searchLeft = 6; this.sniffT = 0;
            }
          } else if (this.lostT > 0.8) {
            this.state = 'search'; this.searchLeft = 12; this.sniffT = 0; this.target = { x: this.lastSeen.x, z: this.lastSeen.z };
          }
          break;
        }
        const tx = canSee ? P.x : this.lastSeen.x, tz = canSee ? P.z : this.lastSeen.z;
        this.goto(tx, tz, sp, dt);
        if (dist < 2.0 && this.hasLOS && this.attackCd <= 0) { this.state = 'attack'; this.attackT = 0; }
        if (this.lostT > 6) {
          this.state = 'search'; this.searchLeft = 10; this.sniffT = 0; this.target = { x: this.lastSeen.x, z: this.lastSeen.z };
          g.onEnemyLost();
        }
        break;
      }
      case 'attack': {
        this.attackT += dt;
        this.yaw = turn(this.yaw, Math.atan2(-dx, -dz), 8 * dt);
        if (this.attackT > 0.35 && this.attackCd <= 0) {
          this.attackCd = 1.3;
          if (dist < 2.4 && !P.hidden) g.damage(26, this.x, this.z);
          g.audio.creatureCall({ x: this.x, y: 2, z: this.z }, 0.5);
        }
        if (this.attackT > 0.8) this.state = 'chase';
        break;
      }
      case 'search': {
        this.searchLeft -= dt;
        const arrived = this.goto(this.target.x, this.target.z, 1.1, dt);
        const nearHide = P.hidden && Math.hypot(P.hidden.x - this.x, P.hidden.z - this.z) < 3.2;
        if (nearHide) {
          this.sniffT += dt; g.nearHideTension = Math.min(1, this.sniffT / 4);
          if (this.sniffT > 4.5 && Math.random() < dt * 0.35) {
            g.grabPlayer(this); this.searchLeft = 5; this.sniffT = 0;
          }
        } else g.nearHideTension = 0;
        if (arrived) {
          this.timer += dt;
          if (this.timer > 1.8) {
            this.timer = 0;
            const wp = this.g.waypoints[Math.floor(Math.random() * this.g.waypoints.length)];
            const near = Math.random() < 0.6;
            this.target = near
              ? { x: this.x + (Math.random() - 0.5) * 20, z: this.z + (Math.random() - 0.5) * 20 }
              : { x: (wp.x + 0.5) * CELL, z: (wp.y + 0.5) * CELL };
          }
        }
        if (this.searchLeft <= 0) { this.state = 'patrol'; this.pickWaypoint(); g.nearHideTension = 0; }
        break;
      }
    }

    if (dist > 90 && this.state !== 'chase') { this.despawn(); return; }

    // ========================================================================
    // ANIMACIÓN DE CAMINATA CON PISADA ALTERNADA EN LAS PATAS DE ADELANTE
    // ========================================================================
    this.animateGait(dt, time);

    // Sonidos de pisadas pesadas sincronizadas con cada impacto de pata
    if (this.speedNow > 0.1) {
      const stepIdx = Math.floor(this.walkCycle / Math.PI);
      if (stepIdx !== this.lastStepIndex) {
        this.lastStepIndex = stepIdx;
        if (dist < 45) {
          g.audio.heavyStep({ x: this.x, y: 0.1, z: this.z }, Math.min(0.7, 0.28 + this.speedNow * 0.08));
        }
      }
    }

    this.clickT -= dt;
    if (this.clickT < 0 && dist < 50) {
      this.clickT = 2.5 + Math.random() * 4;
      g.audio.boneClick({ x: this.x, y: 2.5, z: this.z });
    }

    const prox = Math.max(0, 1 - dist / 35);
    g.audio.enemyBedUpdate({ x: this.x, y: 2, z: this.z }, prox * (this.chasing ? 1.4 : 0.8));

    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.yaw;
  }

  // Genera el ciclo de marcha alternado: pata delantera izq -> pata delantera der
  private animateGait(dt: number, time: number) {
    if (this.mixer) this.mixer.update(dt);

    const isMoving = this.speedNow > 0.1;
    const isAttacking = this.state === 'attack';

    if (isAttacking) {
      // Embestida frontal hacia adelante al atacar
      const prog = Math.min(1, this.attackT / 0.35);
      const strike = Math.sin(prog * Math.PI);
      this.wrapper.position.z = strike * 0.45;
      this.wrapper.rotation.x = -strike * 0.25;
      this.wrapper.rotation.z = 0;
      return;
    }

    if (isMoving) {
      // Velocidad del ritmo de paso
      const strideRate = this.chasing ? 4.5 : 3.2;
      this.walkCycle += dt * strideRate;

      const p = this.walkCycle;

      // 1. Pata delantera izquierda: fase P
      // 2. Pata delantera derecha: fase P + PI (180° opuesta: una pisa mientras la otra avanza)
      const strideL = Math.sin(p);
      const strideR = Math.sin(p + Math.PI);

      // Movimiento directo en las extremidades detectadas
      this.frontLeftLimbs.forEach((l) => {
        l.obj.rotation.x = l.initRot.x + strideL * 0.45;
        l.obj.position.y = l.initPos.y + Math.max(0, strideL) * 0.12;
      });

      this.frontRightLimbs.forEach((r) => {
        r.obj.rotation.x = r.initRot.x + strideR * 0.45;
        r.obj.position.y = r.initPos.y + Math.max(0, strideR) * 0.12;
      });

      // Patas traseras en paso cruzado
      this.backLimbs.forEach((b, idx) => {
        const offset = idx % 2 === 0 ? Math.PI * 0.5 : Math.PI * 1.5;
        b.obj.rotation.x = b.initRot.x + Math.sin(p + offset) * 0.35;
      });

      // Dinámica del torso:
      // - Cada vez que una pata delantera pisa, el cuerpo baja (impacto)
      // - El peso se traslada de izquierda a derecha (roll & yaw)
      const dipY = Math.abs(Math.sin(p)) * 0.055;
      const swayZ = Math.sin(p) * 0.065;
      const yawTwist = Math.cos(p) * 0.055;

      this.wrapper.position.y = -dipY;
      this.wrapper.position.z = 0;
      this.wrapper.rotation.z = swayZ;
      this.wrapper.rotation.y = yawTwist;
      this.wrapper.rotation.x = this.chasing ? 0.15 : 0.06; // Inclinación agresiva
    } else {
      // Estado de reposo / acecho: respiración pesada
      const breath = Math.sin(time * 1.6) * 0.02;
      this.wrapper.position.y = breath;
      this.wrapper.position.z = 0;
      this.wrapper.rotation.z = Math.sin(time * 0.8) * 0.015;
      this.wrapper.rotation.x = Math.sin(time * 1.1) * 0.02;

      // Regresar extremidades a la posición base suavemente
      this.frontLeftLimbs.forEach((l) => {
        l.obj.rotation.x = l.initRot.x;
        l.obj.position.y = l.initPos.y;
      });
      this.frontRightLimbs.forEach((r) => {
        r.obj.rotation.x = r.initRot.x;
        r.obj.position.y = r.initPos.y;
      });
      this.backLimbs.forEach((b) => {
        b.obj.rotation.x = b.initRot.x;
      });
    }
  }
}

function wrapAngle(a: number) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function turn(cur: number, want: number, maxStep: number) {
  const d = wrapAngle(want - cur);
  return cur + Math.max(-maxStep, Math.min(maxStep, d));
}
