
import * as THREE from 'three';
import type { Game } from './engine';
import { CELL } from './world';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type State =
  | 'dormant'
  | 'patrol'
  | 'watch'
  | 'investigate'
  | 'chase'
  | 'search'
  | 'attack';

export class Observer {
  group = new THREE.Group();
  state: State = 'dormant';

  x = 0;
  z = 0;
  yaw = 0;

  detect = 0;
  hasLOS = false;
  threat = 0;
  harmless = false;

  private body = new THREE.Group();
  private modelRoot: THREE.Group | null = null;
  private leftArm: THREE.Object3D | null = null;
  private rightArm: THREE.Object3D | null = null;
  private jaw: THREE.Object3D | null = null;
  private eyeLight: THREE.PointLight | null = null;
  private bodyMesh: THREE.Mesh | null = null;
  private bodyBasePositions: Float32Array | null = null;

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

  constructor(private g: Game) {
    this.group.add(this.body);
    this.group.visible = false;
    this.g.level.add(this.group);

    const loader = new GLTFLoader();

    loader.load(
      '/models/monster.glb',
      (gltf) => {
        const model = gltf.scene;

        const bounds = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();

        bounds.getSize(size);
        bounds.getCenter(center);

        const scale = 3.35 / Math.max(size.y, 0.001);

        model.scale.setScalar(scale);

        model.position.set(
          -center.x * scale,
          -bounds.min.y * scale,
          -center.z * scale
        );

        const root = new THREE.Group();
        root.add(model);
        root.rotation.y = Math.PI;

        this.body.add(root);
        this.modelRoot = root;

        // Guardamos la malla original del cuerpo para animar
        // los dos lados inferiores sin separar el modelo.
        const bodyMesh = root.getObjectByName(
          'bady_low_lambert2_0'
        );

        if (bodyMesh instanceof THREE.Mesh) {
          this.bodyMesh = bodyMesh;

          const position = bodyMesh.geometry.getAttribute(
            'position'
          ) as THREE.BufferAttribute;

          this.bodyBasePositions = new Float32Array(
            position.array as ArrayLike<number>
          );

          position.setUsage(THREE.DynamicDrawUsage);
        }

        this.leftArm =
          root.getObjectByName('hand1_low') ??
          root.getObjectByName('hand1_low_lambert2_0') ??
          null;

        this.rightArm =
          root.getObjectByName('hand2_low') ??
          root.getObjectByName('hand2_low_lambert2_0') ??
          null;

        this.jaw =
          root.getObjectByName('teeth') ??
          root.getObjectByName('teeth_lambert2_0') ??
          null;

        const redLight = new THREE.PointLight(
          0xff2118,
          0.7,
          5
        );

        redLight.position.set(0, 2.65, -0.35);
        root.add(redLight);

        this.eyeLight = redLight;

        root.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
      },
      undefined,
      (error) => {
        console.error(
          'Error cargando /models/monster.glb:',
          error
        );
      }
    );
  }

  private canPass = (x: number, y: number) => {
    const w = this.g.world;

    if (!w.inb(x, y)) return false;

    const i = w.idx(x, y);

    if (w.solid[i] || w.crouchCell[i]) return false;

    const d = w.doors.get(i);

    return !d || !d.locked;
  };

  spawn(
    x: number,
    z: number,
    mode: 'watch' | 'patrol' | 'chase' | 'investigate',
    opts: { harmless?: boolean; yawToPlayer?: boolean } = {}
  ) {
    this.x = x;
    this.z = z;
    this.harmless = !!opts.harmless;

    this.group.visible = true;
    this.body.visible = true;

    this.detect = 0;
    this.attackCd = 1.0;
    this.spawnT = 0;

    this.speedNow = 0;
    this.attackT = 0;
    this.phase = 0;

    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);

    this.field = null;
    this.fieldKey = -1;
    this.lean = 0;

    const P = this.g.P;

    this.yaw = Math.atan2(
      -(P.x - x),
      -(P.z - z)
    );

    this.group.position.set(x, 0, z);
    this.group.rotation.y = this.yaw;

    if (mode === 'watch') {
      this.state = 'watch';
      this.watchT = 5 + Math.random() * 5;
    } else if (mode === 'chase') {
      this.startChase();
    } else if (mode === 'investigate') {
      this.state = 'investigate';
      this.target = { x: P.x, z: P.z };
    } else {
      this.state = 'patrol';
      this.pickWaypoint();
    }
  }

  despawn() {
    this.state = 'dormant';
    this.group.visible = false;
    this.threat = 0;
    this.detect = 0;
    this.g.audio.enemyBedUpdate(null, 0);
  }

  get active() {
    return this.state !== 'dormant';
  }

  get chasing() {
    return this.state === 'chase' || this.state === 'attack';
  }

  startChase() {
    if (this.state === 'chase') return;

    this.state = 'chase';
    this.chaseT = 0;
    this.lostT = 0;
    this.detect = 1;

    this.lastSeen = {
      x: this.g.P.x,
      z: this.g.P.z
    };

    this.g.audio.screech({
      x: this.x,
      y: 2,
      z: this.z
    });

    this.g.shake(0.5, 0.6);
    this.g.onEnemyAlert();
  }

  hear(nx: number, nz: number, r: number) {
    if (!this.active) return;

    const d = Math.hypot(
      nx - this.x,
      nz - this.z
    );

    const eff = this.g.world.los(
      this.x,
      this.z,
      nx,
      nz
    ) ? r : r * 0.62;

    if (this.chasing) {
      if (
        this.state === 'chase' &&
        d < eff &&
        !this.g.P.hidden
      ) {
        this.lastSeen = { x: nx, z: nz };
        this.lostT = 0;
      }

      return;
    }

    if (d > eff) return;

    if (this.state === 'watch' && this.harmless) return;

    this.state = 'investigate';
    this.target = { x: nx, z: nz };
    this.timer = 0;
    this.detect = Math.max(this.detect, 0.35);
  }

  private pickWaypoint() {
    const wp = this.g.waypoints;
    const P = this.g.P;

    let best = wp[
      Math.floor(Math.random() * wp.length)
    ];

    if (Math.random() < 0.4) {
      const near = wp.filter(
        (w: { x: number; y: number }) =>
          Math.hypot(
            (w.x + 0.5) * CELL - P.x,
            (w.y + 0.5) * CELL - P.z
          ) < 40
      );

      if (near.length) {
        best = near[
          Math.floor(Math.random() * near.length)
        ];
      }
    }

    this.target = {
      x: (best.x + 0.5) * CELL,
      z: (best.y + 0.5) * CELL
    };

    this.timer = 0;
  }

  private goto(
    tx: number,
    tz: number,
    speed: number,
    dt: number
  ): boolean {
    const w = this.g.world;

    const dist = Math.hypot(
      tx - this.x,
      tz - this.z
    );

    if (dist < 0.5) return true;

    let mx = tx;
    let mz = tz;

    if (
      !(dist < 18 && w.los(this.x, this.z, tx, tz))
    ) {
      const tcx = Math.floor(tx / CELL);
      const tcy = Math.floor(tz / CELL);

      const key = tcy * w.w + tcx;

      this.fieldAge += dt;

      if (
        this.fieldKey !== key ||
        !this.field ||
        this.fieldAge > 1.2
      ) {
        this.field = w.flow(
          tcx,
          tcy,
          this.canPass
        );

        this.fieldKey = key;
        this.fieldAge = 0;
      }

      const cx = Math.floor(this.x / CELL);
      const cy = Math.floor(this.z / CELL);

      const field = this.field;
      const cur = field[w.idx(cx, cy)];

      let best = -1;
      let bx = 0;
      let by = 0;
      let bd = cur < 0 ? 1e9 : cur;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;

          const nx = cx + dx;
          const ny = cy + dy;

          if (!w.inb(nx, ny)) continue;

          const d = field[w.idx(nx, ny)];

          if (d < 0) continue;

          if (
            dx &&
            dy &&
            (
              !this.canPass(cx + dx, cy) ||
              !this.canPass(cx, cy + dy)
            )
          ) {
            continue;
          }

          if (d < bd) {
            bd = d;
            best = 1;
            bx = nx;
            by = ny;
          }
        }
      }

      if (best < 0) return cur === 0 || cur < 0;

      mx = (bx + 0.5) * CELL;
      mz = (by + 0.5) * CELL;
    }

    // Abrir puertas cercanas.
    const dx0 = mx - this.x;
    const dz0 = mz - this.z;

    const dl = Math.hypot(dx0, dz0) || 1;

    const px = this.x + (dx0 / dl) * 1.4;
    const pz = this.z + (dz0 / dl) * 1.4;

    const door = w.doorAt(
      Math.floor(px / CELL),
      Math.floor(pz / CELL)
    );

    if (door && !door.open && !door.locked) {
      door.open = true;

      this.g.audio.doorSlide(
        { x: door.x, y: 1.5, z: door.z },
        door.heavy
      );
    }

    const wantYaw = Math.atan2(-dx0, -dz0);

    this.yaw = turn(
      this.yaw,
      wantYaw,
      (this.state === 'chase' ? 9 : 4) * dt
    );

    this.speedNow = speed;

    const step = Math.min(speed * dt, dl);

    const p = {
      x: this.x + (dx0 / dl) * step,
      z: this.z + (dz0 / dl) * step
    };

    w.resolve(p, 0.42, false);

    this.x = p.x;
    this.z = p.z;

    return false;
  }

  update(dt: number, time: number) {
    if (this.state === 'dormant') return;

    const g = this.g;
    const P = g.P;
    const w = g.world;

    const dx = P.x - this.x;
    const dz = P.z - this.z;

    const dist = Math.hypot(dx, dz);

    this.spawnT += dt;
    this.attackCd -= dt;
    this.speedNow = 0;

    // Percepción.
    this.hasLOS = w.los(
      this.x,
      this.z,
      P.x,
      P.z
    );

    const fwdx = -Math.sin(this.yaw);
    const fwdz = -Math.cos(this.yaw);

    const dot = dist > 0.01
      ? (dx * fwdx + dz * fwdz) / dist
      : 1;

    this.lightLevel = g.lightLevel;

    const range =
      7 +
      24 * this.lightLevel * (P.crouch ? 0.75 : 1) +
      (P.running ? 6 : 0);

    const inFov = dot > 0.2 || dist < 4;

    const canSee =
      !P.hidden &&
      this.hasLOS &&
      dist < range &&
      inFov;

    if (!this.harmless || this.state !== 'watch') {
      if (canSee && this.state !== 'attack') {
        let rate =
          0.35 +
          (1 - dist / range) * 1.8;

        if (dist < 6) rate *= 2;
        if (P.crouch) rate *= 0.6;
        if (P.speed < 0.2) rate *= 0.6;
        if (this.state === 'watch') rate *= 0.5;

        this.detect = Math.min(
          1.2,
          this.detect + rate * dt
        );
      } else {
        this.detect = Math.max(
          0,
          this.detect -
            dt * (this.state === 'chase' ? 0.1 : 0.35)
        );
      }
    }

    if (canSee) {
      this.lastSeen = { x: P.x, z: P.z };
    }

    this.threat = this.chasing
      ? 2
      : (
          (this.state !== 'patrol' || this.hasLOS) &&
          (
            this.detect > 0.25 ||
            (this.hasLOS && dist < 24)
          )
        )
        ? 1
        : (this.state === 'investigate' ? 1 : 0);

    if (
      this.detect >= 1 &&
      !this.chasing &&
      !(this.state === 'watch' && this.harmless)
    ) {
      this.startChase();
    }

    // Estados de la IA.
    switch (this.state) {
      case 'watch': {
        this.yaw = turn(
          this.yaw,
          Math.atan2(-dx, -dz),
          2.5 * dt
        );

        this.watchT -= dt;

        const looking =
          g.lookDot(this.x, this.z) > 0.6 &&
          this.hasLOS;

        if (
          !looking &&
          dist > 13 &&
          !this.harmless
        ) {
          this.goto(P.x, P.z, 1.1, dt);
        }

        if (this.harmless) {
          if (
            (dist < 11 && looking) ||
            this.watchT < -6
          ) {
            this.despawn();
            return;
          }
        } else if (
          this.watchT <= 0 ||
          dist < 9
        ) {
          if (!looking && dist > 14) {
            if (this.watchT < -6) {
              this.despawn();
              return;
            }
          } else if (
            Math.random() < 0.5 &&
            this.watchT < 0
          ) {
            this.startChase();
          } else if (
            this.watchT < -0.5 ||
            dist < 9
          ) {
            if (
              dist < 9 &&
              Math.random() < 0.5
            ) {
              this.startChase();
            } else {
              g.audio.creatureCall(
                { x: this.x, y: 2, z: this.z },
                0.35
              );

              this.despawn();
              return;
            }
          }
        }

        break;
      }

      case 'patrol': {
        const arrived = this.goto(
          this.target.x,
          this.target.z,
          1.8,
          dt
        );

        if (arrived) {
          this.timer += dt;
          this.idleLook += dt;

          if (this.timer > 3 + Math.random()) {
            this.pickWaypoint();
          }
        }

        break;
      }

      case 'investigate': {
        const arrived = this.goto(
          this.target.x,
          this.target.z,
          2.8,
          dt
        );

        if (arrived) {
          this.timer += dt;

          if (this.timer > 2.5) {
            this.state = 'search';
            this.searchLeft = 9;
            this.sniffT = 0;
          }
        }

        break;
      }

      case 'chase': {
        this.chaseT += dt;

        if (canSee) {
          this.lostT = 0;
        } else if (
          P.hidden ||
          Math.hypot(
            this.lastSeen.x - this.x,
            this.lastSeen.z - this.z
          ) < 1.6
        ) {
          this.lostT += dt;
        } else {
          this.lostT += dt * 0.15;
        }

        const sp = Math.min(
          5.6,
          4.3 + this.chaseT * 0.12
        );

        if (P.hidden) {
          if (g.hideSeen) {
            const arrived = this.goto(
              P.hidden.x,
              P.hidden.z,
              sp,
              dt
            );

            if (
              arrived ||
              Math.hypot(
                P.hidden.x - this.x,
                P.hidden.z - this.z
              ) < 1.8
            ) {
              g.grabPlayer(this);
              this.state = 'search';
              this.searchLeft = 6;
              this.sniffT = 0;
            }
          } else if (this.lostT > 0.8) {
            this.state = 'search';
            this.searchLeft = 12;
            this.sniffT = 0;

            this.target = {
              x: this.lastSeen.x,
              z: this.lastSeen.z
            };
          }

          break;
        }

        const tx = canSee ? P.x : this.lastSeen.x;
        const tz = canSee ? P.z : this.lastSeen.z;

        this.goto(tx, tz, sp, dt);

        if (
          dist < 1.9 &&
          this.hasLOS &&
          this.attackCd <= 0
        ) {
          this.state = 'attack';
          this.attackT = 0;
        }

        if (this.lostT > 6) {
          this.state = 'search';
          this.searchLeft = 10;
          this.sniffT = 0;

          this.target = {
            x: this.lastSeen.x,
            z: this.lastSeen.z
          };

          g.onEnemyLost();
        }

        break;
      }

      case 'attack': {
        this.attackT += dt;

        this.yaw = turn(
          this.yaw,
          Math.atan2(-dx, -dz),
          8 * dt
        );

        if (
          this.attackT > 0.38 &&
          this.attackCd <= 0
        ) {
          this.attackCd = 1.3;

          if (dist < 2.4 && !P.hidden) {
            g.damage(26, this.x, this.z);
          }

          g.audio.creatureCall(
            { x: this.x, y: 2, z: this.z },
            0.5
          );
        }

        if (this.attackT > 0.8) {
          this.state = 'chase';
        }

        break;
      }

      case 'search': {
        if (P.hidden && this.hasLOS === false) {
          // No ve al jugador.
        }

        this.searchLeft -= dt;

        const arrived = this.goto(
          this.target.x,
          this.target.z,
          2.3,
          dt
        );

        const nearHide =
          P.hidden &&
          Math.hypot(
            P.hidden.x - this.x,
            P.hidden.z - this.z
          ) < 3.2;

        if (nearHide) {
          this.sniffT += dt;

          g.nearHideTension = Math.min(
            1,
            this.sniffT / 4
          );

          if (
            this.sniffT > 4.5 &&
            Math.random() < dt * 0.35
          ) {
            g.grabPlayer(this);
            this.searchLeft = 5;
            this.sniffT = 0;
          }
        } else {
          g.nearHideTension = 0;
        }

        if (arrived) {
          this.timer += dt;

          if (this.timer > 1.8) {
            this.timer = 0;

            const wp = this.g.waypoints[
              Math.floor(
                Math.random() * this.g.waypoints.length
              )
            ];

            const near = Math.random() < 0.6;

            this.target = near
              ? {
                  x: this.x + (Math.random() - 0.5) * 20,
                  z: this.z + (Math.random() - 0.5) * 20
                }
              : {
                  x: (wp.x + 0.5) * CELL,
                  z: (wp.y + 0.5) * CELL
                };
          }
        }

        if (this.searchLeft <= 0) {
          this.state = 'patrol';
          this.pickWaypoint();
          g.nearHideTension = 0;
        }

        break;
      }
    }

    // Desaparece si queda demasiado lejos.
    if (
      dist > 90 &&
      this.state !== 'chase'
    ) {
      this.despawn();
      return;
    }

    this.animate(dt, time, dist);
  }

  private animate(
    dt: number,
    time: number,
    dist: number
  ) {
    const g = this.g;
    const spd = this.speedNow;

    const moving = spd > 0.1;
    const chasing = this.state === 'chase';
    const attacking = this.state === 'attack';

    // Un ciclo completo representa dos pasos:
    // primero una pierna y después la otra.
    const gaitSpeed = chasing ? 3.0 : 1.9;

    this.phase +=
      dt *
      Math.max(0.15, spd) *
      gaitSpeed;

    const stride = Math.sin(this.phase);

    const leftSwing = Math.max(
      0,
      Math.sin(this.phase)
    );

    const rightSwing = Math.max(
      0,
      Math.sin(this.phase + Math.PI)
    );

    // Animación del ataque.
    const attackProgress = attacking
      ? THREE.MathUtils.clamp(
          this.attackT / 0.8,
          0,
          1
        )
      : 0;

    const windup = attacking
      ? smooth01(attackProgress / 0.30)
      : 0;

    const strike = attacking
      ? smooth01(
          (attackProgress - 0.22) / 0.25
        ) *
        (
          1 -
          smooth01(
            (attackProgress - 0.58) / 0.30
          )
        )
      : 0;

    const recover = attacking
      ? smooth01(
          (attackProgress - 0.58) / 0.42
        )
      : 0;

    // La pisada alterna: nunca levantamos las dos piernas a la vez.
    const stepAmount = moving
      ? (chasing ? 1 : 0.72)
      : 0;

    const leftLift = leftSwing * stepAmount;
    const rightLift = rightSwing * stepAmount;

    // Deformación suave de la parte inferior de la malla original.
    // No crea piezas nuevas ni separa el modelo.
    if (this.bodyMesh && this.bodyBasePositions) {
      const geometry = this.bodyMesh.geometry;

      const position = geometry.getAttribute(
        'position'
      ) as THREE.BufferAttribute;

      const base = this.bodyBasePositions;

      for (let i = 0; i < position.count; i++) {
        const offset = i * 3;

        const x = base[offset];
        const y = base[offset + 1];
        const z = base[offset + 2];

        // Solo afecta la zona baja del cuerpo: las piernas.
        const legHeight =
          1 - smooth01((y - 7.8) / 4.2);

        // Diferencia ambos lados usando el eje X.
        const sideWeight = smooth01(
          (Math.abs(x) - 0.15) / 1.1
        );

        const leftSide = x < 0;

        const swing = leftSide
          ? leftLift
          : rightLift;

        // Elevación y avance alternados.
        // Los vértices vuelven a su posición original
        // antes de aplicar el siguiente fotograma.
        const lift =
          swing *
          2.0 *
          legHeight *
          sideWeight;

        const forward =
          swing *
          1.45 *
          legHeight *
          sideWeight;

        position.setXYZ(
          i,
          x,
          y + lift,
          z + forward
        );
      }

      position.needsUpdate = true;

      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
    }

    // Inclinación del cuerpo.
    const targetLean = attacking
      ? 0.16 + strike * 0.62
      : chasing
        ? 0.30
        : this.state === 'investigate'
          ? 0.12
          : moving
            ? 0.035
            : 0;

    this.lean +=
      (targetLean - this.lean) *
      Math.min(
        1,
        dt * (attacking ? 13 : 5)
      );

    // Respiración.
    const breathe =
      1 +
      Math.sin(
        time * (attacking ? 4.8 : 1.65)
      ) *
      (attacking ? 0.012 : 0.008);

    const bob = moving
      ? Math.abs(stride) *
        (chasing ? 0.055 : 0.025)
      : Math.sin(time * 1.25) * 0.012;

    this.body.position.y +=
      (bob - this.body.position.y) *
      Math.min(1, dt * 10);

    this.body.rotation.x +=
      (-this.lean - this.body.rotation.x) *
      Math.min(1, dt * 7);

    const sway = moving
      ? stride * (chasing ? 0.035 : 0.018)
      : Math.sin(time * 0.7) * 0.012;

    this.body.rotation.z +=
      (sway - this.body.rotation.z) *
      Math.min(1, dt * 5);

    if (this.modelRoot) {
      this.modelRoot.scale.y +=
        (breathe - this.modelRoot.scale.y) *
        Math.min(1, dt * 5);

      const lunge = attacking
        ? strike * 0.28 -
          windup * 0.06 -
          recover * 0.03
        : 0;

      this.modelRoot.position.z +=
        (lunge - this.modelRoot.position.z) *
        Math.min(1, dt * 10);
    }

    // Balanceo moderado de brazos.
    const leftArmTarget = attacking
      ? -0.12 -
        windup * 0.38 +
        strike * 0.72 -
        recover * 0.12
      : moving
        ? -stride * (chasing ? 0.20 : 0.12)
        : Math.sin(time * 0.8) * 0.018;

    const rightArmTarget = attacking
      ? -0.10 -
        windup * 0.32 +
        strike * 0.62 -
        recover * 0.10
      : moving
        ? stride * (chasing ? 0.20 : 0.12)
        : Math.sin(time * 0.8 + 1) * 0.018;

    if (this.leftArm) {
      this.leftArm.rotation.x +=
        (leftArmTarget - this.leftArm.rotation.x) *
        Math.min(
          1,
          dt * (attacking ? 10 : 5)
        );
    }

    if (this.rightArm) {
      this.rightArm.rotation.x +=
        (rightArmTarget - this.rightArm.rotation.x) *
        Math.min(
          1,
          dt * (attacking ? 10 : 5)
        );
    }

    // Movimiento de mandíbula.
    if (this.jaw) {
      const jawTarget = attacking
        ? 0.10 + strike * 0.16
        : 0.018 + Math.sin(time * 1.8) * 0.015;

      this.jaw.rotation.x +=
        (jawTarget - this.jaw.rotation.x) *
        Math.min(1, dt * 5);
    }

    // Luz de los ojos.
    if (this.eyeLight) {
      const glow =
        chasing || attacking
          ? 1.15
          : 0.58 + Math.sin(time * 4.5) * 0.16;

      this.eyeLight.intensity +=
        (glow - this.eyeLight.intensity) *
        Math.min(1, dt * 5);
    }

    this.group.position.set(
      this.x,
      0,
      this.z
    );

    this.group.rotation.y = this.yaw;
    this.group.visible = true;
    this.body.visible = true;

    // Sonidos sincronizados con los pasos.
    if (moving) {
      const cyc = Math.floor(
        this.phase / Math.PI
      );

      if (cyc !== this.lastStep) {
        this.lastStep = cyc;

        if (dist < 45) {
          g.audio.heavyStep(
            {
              x: this.x,
              y: 0.1,
              z: this.z
            },
            Math.min(0.8, 0.25 + spd * 0.1)
          );
        }
      }
    }

    this.clickT -= dt;

    if (this.clickT < 0 && dist < 50) {
      this.clickT = 2.5 + Math.random() * 4;

      g.audio.boneClick({
        x: this.x,
        y: 2.5,
        z: this.z
      });
    }

    const prox = Math.max(
      0,
      1 - dist / 35
    );

    g.audio.enemyBedUpdate(
      {
        x: this.x,
        y: 2,
        z: this.z
      },
      prox * (this.chasing ? 1.4 : 0.8)
    );
  }
}

function smooth01(v: number) {
  const t = THREE.MathUtils.clamp(v, 0, 1);

  return t * t * (3 - 2 * t);
}

function wrapAngle(a: number) {
  while (a > Math.PI) {
    a -= Math.PI * 2;
  }

  while (a < -Math.PI) {
    a += Math.PI * 2;
  }

  return a;
}

function turn(
  cur: number,
  want: number,
  maxStep: number
) {
  const d = wrapAngle(want - cur);

  return cur + Math.max(
    -maxStep,
    Math.min(maxStep, d)
  );
}
