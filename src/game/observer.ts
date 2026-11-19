
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type State = 'patrol' | 'investigate' | 'chase';

export class Observer {
  private static readonly SPEED_PATROL = 0.9;
  private static readonly SPEED_INVESTIGATE = 1.3;
  private static readonly SPEED_CHASE_BASE = 2.1;
  private static readonly SPEED_CHASE_MAX = 2.5;
  private static readonly TARGET_HEIGHT = 2.6;
  private static readonly DETECT_RANGE = 12;
  private static readonly LOSE_RANGE = 20;

  readonly wrapper = new THREE.Group();
  private eyeLight = new THREE.PointLight(0xff2222, 1.5, 10);

  private state: State = 'patrol';
  private chaseT = 0;

  private frontLimbs: { node: THREE.Object3D; baseX: number; baseZ: number }[] = [];
  private walkCycle = 0;
  private gaitAmp = 0;
  private wrapperBaseY = 0;
  private stepIdx = 0;

  private spawnPoint = new THREE.Vector2();
  private patrolRadius = 15;
  private patrolTarget = new THREE.Vector2();
  private lastNoise = new THREE.Vector2();

  onStep?: () => void;

  constructor() {
    this.eyeLight.position.set(0, 2.15, 0.5);
    this.wrapper.add(this.eyeLight);
  }

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

        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3(), center = new THREE.Vector3();
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

  private setupModel(model: THREE.Object3D) {
    let left: THREE.Object3D | null = null;
    let right: THREE.Object3D | null = null;

    // Diagnóstico: lista todos los nodos con nombre (borrable después)
    model.traverse((o) => {
      if (o.name) console.log('[Observer v4] nodo:', o.name);
    });

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
      .map((node) => ({ node, baseX: node.rotation.x, baseZ: node.rotation.z }));

    console.log('%c[Observer v4] patas detectadas:',
      'color:lime',
      this.frontLimbs.map((l) => l.node.name));
  }

  hearNoise(x: number, z: number) {
    if (this.state === 'chase') return;
    this.state = 'investigate';
    this.lastNoise.set(x, z);
  }

  get isChasing() {
    return this.state === 'chase';
  }

  update(delta: number, playerPos: THREE.Vector3) {
    const pos = this.wrapper.position;
    const dx = playerPos.x - pos.x;
    const dz = playerPos.z - pos.z;
    const dist = Math.hypot(dx, dz);

    if (this.state !== 'chase' && dist < Observer.DETECT_RANGE) {
      this.state = 'chase';
      this.chaseT = 0;
    } else if (this.state === 'chase' && dist > Observer.LOSE_RANGE) {
      this.state = 'investigate';
      this.lastNoise.set(playerPos.x, playerPos.z);
    }

    let speed = 0, tx = 0, tz = 0;

    if (this.state === 'chase') {
      this.chaseT += delta;
      speed = Math.min(Observer.SPEED_CHASE_MAX,
        Observer.SPEED_CHASE_BASE + this.chaseT * 0.02);
      tx = playerPos.x;
      tz = playerPos.z;
      // Persiguiendo: SIEMPRE mira al jugador
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

    const mdx = tx - pos.x;
    const mdz = tz - pos.z;
    const mdist = Math.hypot(mdx, mdz);
    const moving = mdist > 0.15 && speed > 0;

    if (moving) {
      pos.x += (mdx / mdist) * speed * delta;
      pos.z += (mdz / mdist) * speed * delta;
      if (this.state !== 'chase') this.faceTowards(mdx, mdz, delta);
    }

    this.animateGait(delta, moving);
  }

  /**
   * Gira hacia la dirección por el camino más corto.
   * SI CAMINARA DE ESPALDAS, cambiar esta línea a:
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
   * Marcha: pierna izquierda pisa, luego la derecha (180° después).
   * SOLO rotación en X — nunca en Z (eso abría/separaba las piernas).
   */
  private animateGait(delta: number, moving: boolean) {
    if (moving) {
      this.walkCycle += delta * (this.state === 'chase' ? 8.5 : 6.0);
    }
    const p = this.walkCycle;

    this.gaitAmp = THREE.MathUtils.lerp(
      this.gaitAmp, moving ? 0.45 : 0, Math.min(1, delta * 5)
    );
    const a = this.gaitAmp;

    this.frontLimbs.forEach((limb, i) => {
      const phase = i === 0 ? p : p + Math.PI;
      limb.node.rotation.x = limb.baseX + Math.sin(phase) * a;
      limb.node.rotation.z = limb.baseZ;
    });

    // Todo el cuerpo sube/baja JUNTO (nada se separa del torso)
    this.wrapper.position.y =
      this.wrapperBaseY + Math.abs(Math.sin(p)) * 0.05 * a;

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
