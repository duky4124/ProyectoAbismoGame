import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Game } from './engine';
import { CELL } from './world';

type State = 'dormant' | 'patrol' | 'watch' | 'investigate' | 'chase' | 'search' | 'attack';

export class Observer {
  group = new THREE.Group();
  state: State = 'dormant';
  x = 0; z = 0; yaw = 0;
  detect = 0;
  hasLOS = false;
  threat = 0;
  harmless = false;

  private model: THREE.Group | null = null;
  private wrapper = new THREE.Group(); // Contenedor para giro y animación de caminata
  private mixer: THREE.AnimationMixer | null = null;
  private actions: { [key: string]: THREE.AnimationAction } = {};
  private currentAction: THREE.AnimationAction | null = null;

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
  private stepPhase = 0;
  private lastStep = 0;

  constructor(private g: Game) {
    const loader = new GLTFLoader();

    // El wrapper gira 180° para que el bicho quede mirando de frente hacia el jugador
    this.wrapper.rotation.y = Math.PI;
    this.group.add(this.wrapper);

    loader.load(
      '/models/monster.glb',
      (gltf) => {
        this.model = gltf.scene;

        // Auto-escalado a 2.7m de altura (tamaño imponente)
        const box = new THREE.Box3().setFromObject(this.model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const targetHeight = 2.7;
        const scale = targetHeight / (size.y || 1);
        this.model.scale.setScalar(scale);

        // Apoyar pies exactamente en el suelo
        box.setFromObject(this.model);
        box.getCenter(center);
        this.model.position.x = -center.x;
        this.model.position.y = -box.min.y;
        this.model.position.z = -center.z;

        this.model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
          }
        });

        this.wrapper.add(this.model);

        // Si el archivo GLB incluye animaciones integradas
        if (gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.model);
          gltf.animations.forEach((clip) => {
            const name = clip.name.toLowerCase();
            this.actions[name] = this.mixer!.clipAction(clip);
          });
          // Reproduce la primera animación por defecto
          const firstAction = Object.values(this.actions)[0];
          if (firstAction) firstAction.play();
        }
      },
      undefined,
      (err) => console.error('Error cargando monstruo:', err)
    );

    this.group.visible = false;
    g.level.add(this.group);
  }

  private playAnim(name: string) {
    if (!this.mixer) return;
    const target = this.actions[name] || Object.values(this.actions)[0];
    if (!target || target === this.currentAction) return;

    if (this.currentAction) {
      this.currentAction.fadeOut(0.3);
    }
    target.reset().fadeIn(0.3).play();
    this.currentAction = target;
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
    this.g.shake(0.4, 0.5);
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
    this.yaw = turn(this.yaw, wantYaw, (this.state === 'chase' ? 7 : 3.5) * dt);
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
    // VELOCIDADES CALIBRADAS (Más lento y terrorífico)
    // ========================================================================
    switch (this.state) {
      case 'watch': {
        this.yaw = turn(this.yaw, Math.atan2(-dx, -dz), 2.5 * dt);
        this.watchT -= dt;
        const looking = g.lookDot(this.x, this.z) > 0.6 && this.hasLOS;
        if (!looking && dist > 13 && !this.harmless) this.goto(P.x, P.z, 0.9, dt);
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
        // Velocidad de patrulla lenta (1.1 m/s)
        const arrived = this.goto(this.target.x, this.target.z, 1.1, dt);
        if (arrived) {
          this.timer += dt; this.idleLook += dt;
          if (this.timer > 3 + Math.random()) this.pickWaypoint();
        }
        break;
      }
      case 'investigate': {
        // Velocidad de acecho (1.6 m/s)
        const arrived = this.goto(this.target.x, this.target.z, 1.6, dt);
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

        // VELOCIDAD DE PERSECUCIÓN AJUSTADA: Empieza en 2.8 y sube máximo a 3.4 m/s (puedes correr para escapar)
        const sp = Math.min(3.4, 2.8 + this.chaseT * 0.03);

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
        const arrived = this.goto(this.target.x, this.target.z, 1.3, dt);
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
    // ANIMACIÓN PROCEDURAL DE CAMINATA / ACECHO / ATAQUE
    // ========================================================================
    this.animateMotion(dt, time);

    // Sonidos de pasos pesados al avanzar
    if (this.speedNow > 0.1) {
      this.stepPhase += dt * this.speedNow * 2.5;
      const cyc = Math.floor(this.stepPhase / Math.PI);
      if (cyc !== this.lastStep) {
        this.lastStep = cyc;
        if (dist < 45) g.audio.heavyStep({ x: this.x, y: 0.1, z: this.z }, Math.min(0.8, 0.3 + this.speedNow * 0.1));
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

  // Genera caminata viva con bamboleo de hombros, respiración y zancadas
  private animateMotion(dt: number, time: number) {
    if (this.mixer) this.mixer.update(dt);

    const isMoving = this.speedNow > 0.1;
    const isChasing = this.state === 'chase';
    const isAttacking = this.state === 'attack';

    if (isAttacking) {
      // Embestida hacia adelante al golpear
      const prog = Math.min(1, this.attackT / 0.4);
      const strike = Math.sin(prog * Math.PI);
      this.wrapper.position.z = strike * 0.45;
      this.wrapper.rotation.x = -strike * 0.25;
      this.wrapper.rotation.z = 0;
    } else if (isMoving) {
      // Marcha pesada: sube y baja al dar pasos y se balancea de izquierda a derecha
      const stepSpeed = isChasing ? 6.2 : 4.2;
      const stepCycle = time * stepSpeed;

      const bobY = Math.abs(Math.sin(stepCycle)) * (isChasing ? 0.08 : 0.045);
      const swayZ = Math.sin(stepCycle) * (isChasing ? 0.09 : 0.05);
      const leanX = isChasing ? 0.18 : 0.06; // Se inclina hacia adelante al correr

      this.wrapper.position.y = -bobY;
      this.wrapper.position.z = 0;
      this.wrapper.rotation.z = swayZ;
      this.wrapper.rotation.x = leanX;
    } else {
      // Respiración siniestra y suave cuando está quieto
      const breath = Math.sin(time * 1.8) * 0.02;
      this.wrapper.position.y = breath;
      this.wrapper.position.z = 0;
      this.wrapper.rotation.z = Math.sin(time * 0.9) * 0.02;
      this.wrapper.rotation.x = Math.sin(time * 1.3) * 0.02;
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
