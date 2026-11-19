// src/game/Observer.ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type State = 'patrol' | 'investigate' | 'chase';

export class Observer {
  // --- Velocidades (m/s) — reducidas a pedido ---
  private static readonly SPEED_PATROL = 0.9;
  private static readonly SPEED_INVESTIGATE = 1.3;
  private static readonly SPEED_CHASE_BASE = 2.1;
  private static readonly SPEED_CHASE_MAX = 2.5;
  private static readonly TARGET_HEIGHT = 2.6;

  // --- Detección ---
  private static readonly DETECT_RANGE = 12; // empieza persecución
  private static readonly LOSE_RANGE = 20;   // pierde al jugador

  readonly wrapper = new THREE.Group();
  private eyeLight = new THREE.PointLight(0xff2222, 1.5, 10);

  private state: State = 'patrol';
  private chaseT = 0;

  // --- Marcha (gait) ---
  private frontLimbs: { node: THREE.Object3D; baseX: number; baseZ: number }[] = [];
  private walkCycle = 0;
  private gaitAmp = 0;
  private wrapperBaseY = 0;
  private stepIdx = 0;

  // --- Patrulla ---
  private spawnPoint = new THREE.Vector2();
  private patrolRadius = 15;
  private patrolTarget = new THREE.Vector2();
  private lastNoise = new THREE.Vector2();

  /** Sonido de paso (se dispara sincronizado con la pisada). */
  onStep?: () => void;

  constructor() {
    // Luz roja de los ojos, dentro del wrapper para que gire con él
    this.eyeLight.position.set(0, 2.15, 0.5);
    this.wrapper.add(this.eyeLight);
  }

  /** Carga el modelo y lo agrega a la escena en el punto de aparición. */
  load(scene: THREE.Scene, spawn: THREE.Vector3) {
    this.spawnPoint.set(spawn.x, spawn.z);
    this.wrapper.position.copy(spawn);
    this.wrapperBaseY = spawn.y;
    scene.add(this.wrapper);
    this.pickPatrolTarget();

    new GLTFLoader().load(
      '/models/monster.glb',
      (gltf) => {
        const model = gltf.scene;

        // Auto-escala a ~2.6 m, pies en y = 0, centrado en el wrapper
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const s = Observer.TARGET_HEIGHT / Math.max(size.y, 0.001);
        model.scale.setScalar(s);
        model.position.x -= center.x * s;
        model.position.z -= center.z * s;
        model.position.y -= box.min.y * s;

        this.wrapper.add(model);
        this.setupModel(model);
      },
      undefined,
      (err) => console.error('Error cargando monster.glb:', err)
    );
  }

  /**
   * Detecta las patas delanteras del GLB UNA sola vez y guarda su
   * rotación original, para animarlas sin separarlas del cuerpo.
   */
  private setupModel(model: THREE.Object3D) {
    let left: THREE.Object3D | null = null;
    let right: THREE.Object3D | null = null;

    model.traverse((o) => {
      const n = o.name.toLowerCase();
      if (!/(arm|leg|hand|foot|claw|paw|front)/.test(n)) return;
      const isLeft = n.includes('left') || /(^|_|\.)l($|[0-9_.])/.test(n);
      const isRight = n.includes('right') || /(^|_|\.)r($|[0-9_.])/.test(n);
      if (isLeft && !left) left = o;
      if (isRight && !right) right = o;
    });

    this.frontLimbs = [left, right]
      .filter((n): n is THREE.Object3D => !!n)
      .map((node) => ({
        node,
        baseX: node.rotation.x,
        baseZ: node.rotation.z,
      }));

    if (this.frontLimbs.length === 0) {
      console.warn('[Observer] No se detectaron patas delanteras por nombre; el modelo quedará sin marcha.');
    }
  }

  /** El jugador hace ruido: va a investigar ese punto. */
  hearNoise(x: number, z: number) {
    if (this.state === 'chase') return;
    this.state = 'investigate';
    this.lastNoise.set(x, z);
  }

  get isChasing() {
    return this.state === 'chase';
  }

  /** Llamar cada frame con la posición del jugador. */
  update(delta: number, playerPos: THREE.Vector3) {
    const pos = this.wrapper.position;
    const dx = playerPos.x - pos.x;
    const dz = playerPos.z - pos.z;
    const dist = Math.hypot(dx, dz);

    // --- Máquina de estados ---
    if (this.state !== 'chase' && dist < Observer.DETECT_RANGE) {
      this.state = 'chase';
      this.chaseT = 0;
    } else if (this.state === 'chase' && dist > Observer.LOSE_RANGE) {
      this.state = 'investigate';
      this.lastNoise.set(playerPos.x, playerPos.z);
    }

    let speed = 0;
    let tx = 0;
    let tz = 0;

    if (this.state === 'chase') {
      // Persecución: arranca en 2.1 y sube hasta 2.5 (no exagerado)
      this.chaseT += delta;
      speed = Math.min(Observer.SPEED_CHASE_MAX,
        Observer.SPEED_CHASE_BASE + this.chaseT * 0.02);
      tx = playerPos.x;
      tz = playerPos.z;

      // CLAVE: persiguiendo SIEMPRE mira al jugador (aun si está parado)
      this.faceTowards(dx, dz, delta);
    } else if (this.state === 'investigate') {
      speed = Observer.SPEED_INVESTIGATE;
      tx = this.lastNoise.x;
      tz = this.lastNoise.y;
    } else {
      speed = Observer.SPEED_PATROL;
      tx = this.patrolTarget.x;
      tz = this.patrolTarget.y;
      if (Math.hypot(tx - pos.x, tz - pos.z) < 0.5) this.pickPatrolTarget();
    }

    // --- Movimiento ---
    const mdx = tx - pos.x;
    const mdz = tz - pos.z;
    const mdist = Math.hypot(mdx, mdz);
    const moving = mdist > 0.15 && speed > 0;

    if (moving) {
      pos.x += (mdx / mdist) * speed * delta;
      pos.z += (mdz / mdist) * speed * delta;
      // Patrullando/investigando mira hacia donde CAMINA
      if (this.state !== 'chase') this.faceTowards(mdx, mdz, delta);
    }

    this.animateGait(delta, moving);
  }

  /**
   * Gira el wrapper hacia la dirección indicada por el camino más corto.
   * El modelo mira hacia +Z (igual que en el menú).
   * Si en tu escena caminara de espaldas, cambia a:
   *   const targetYaw = Math.atan2(dirX, dirZ) + Math.PI;
   */
  private faceTowards(dirX: number, dirZ: number, delta: number) {
    const len = Math.hypot(dirX, dirZ);
    if (len < 0.0001) return;

    const targetYaw = Math.atan2(dirX, dirZ);
    let diff = targetYaw - this.wrapper.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.wrapper.rotation.y += diff * Math.min(1, delta * 6);
  }

  /**
   * Marcha: las DOS patas delanteras pisan alternadamente.
   * Solo rotación en X (adelante/atrás) — NUNCA en Z, para que
   * las piernas no se abran ni se separen del cuerpo.
   */
  private animateGait(delta: number, moving: boolean) {
    if (moving) {
      this.walkCycle += delta * (this.state === 'chase' ? 8.5 : 6.0);
    }
    const p = this.walkCycle;

    // La amplitud sube al caminar y vuelve a 0 suave al detenerse
    this.gaitAmp = THREE.MathUtils.lerp(
      this.gaitAmp,
      moving ? 0.45 : 0,
      Math.min(1, delta * 5)
    );
    const a = this.gaitAmp;

    // Pata izquierda primero, derecha 180° después
    this.frontLimbs.forEach((limb, i) => {
      const phase = i === 0 ? p : p + Math.PI;
      limb.node.rotation.x = limb.baseX + Math.sin(phase) * a;
      limb.node.rotation.z = limb.baseZ;
    });

    // Sube/baja el wrapper COMPLETO: todo el cuerpo se mueve junto
    this.wrapper.position.y =
      this.wrapperBaseY + Math.abs(Math.sin(p)) * 0.05 * a;

    // Sonido de paso sincronizado (cada media zancada = una pisada)
    const idx = Math.floor(p / Math.PI);
    if (moving && idx !== this.stepIdx) {
      this.stepIdx = idx;
      this.onStep?.();
    } else if (!moving) {
      this.stepIdx = idx;
    }
  }

  private pickPatrolTarget() {
    const ang = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * Math.max(1, this.patrolRadius - 4);
    this.patrolTarget.set(
      this.spawnPoint.x + Math.cos(ang) * r,
      this.spawnPoint.y + Math.sin(ang) * r
    );
  }
}
