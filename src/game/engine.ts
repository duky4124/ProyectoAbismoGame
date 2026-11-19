import * as THREE from 'three';
import { World } from './world';
import { Player } from './player';
import { Observer } from './observer';
import { AudioManager } from './audio';
import { createMaterials, GameMaterials } from './materials';
import { buildChapter1, ChapterRuntime } from './chapter1';
import { GameOptions } from './types';

export class Engine {
  public container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public mats: GameMaterials;
  public world!: World;
  public player!: Player;
  public enemy!: Observer;
  public audio: AudioManager;
  public rt: ChapterRuntime | null = null;
  public opts: GameOptions;
  public level: THREE.Group;
  public ambientLight!: THREE.AmbientLight;

  private clock: THREE.Clock;
  private isRunning: boolean = false;
  private animFrameId: number | null = null;

  constructor(container: HTMLElement, opts: GameOptions) {
    this.container = container;
    this.opts = opts;

    // 1. Escena y Niebla
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0c10);
    this.scene.fog = new THREE.FogExp2(0x0a0c10, 0.025);

    // 2. Cámara
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: opts.calidad !== 'bajo',
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.calidad === 'alto' ? 2 : 1));
    this.renderer.shadowMap.enabled = opts.sombras && opts.calidad !== 'bajo';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);

    // 4. Luz ambiental base para garantizar visibilidad
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(this.ambientLight);

    // 5. Materiales, Audio y Reloj
    this.mats = createMaterials();
    this.audio = new AudioManager();
    this.clock = new THREE.Clock();

    // 6. Grupo de Nivel
    this.level = new THREE.Group();
    this.scene.add(this.level);

    window.addEventListener('resize', this.onResize);
  }

  public start() {
    this.loadLevel();

    if (!this.isRunning) {
      this.isRunning = true;
      this.clock.start();
      this.animate();
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.audio.stopAll();
  }

  private loadLevel() {
    // Limpiar nivel previo
    while (this.level.children.length > 0) {
      this.level.remove(this.level.children[0]);
    }

    // 1. Instanciar World
    try {
      this.world = new World(128, 128);
    } catch (_) {
      this.world = {} as any;
    }

    // 2. Instanciar Jugador y Enemigo
    this.player = new Player(this);
    this.enemy = new Observer(this);

    // 3. Construir Capítulo 1
    let built: ChapterRuntime | null = null;
    try {
      built = buildChapter1(this) as ChapterRuntime;
    } catch (e) {
      console.warn("Aviso al construir capítulo:", e);
    }
    this.rt = built;

    // 4. Posicionar cámara y jugador en el spawn
    const spawnX = built?.spawnPos?.x ?? 0;
    const spawnY = built?.spawnPos?.y ?? 1.6;
    const spawnZ = built?.spawnPos?.z ?? 7.5;

    this.camera.position.set(spawnX, spawnY, spawnZ);
    this.camera.lookAt(0, 1.6, 0);

    if (this.player) {
      if ((this.player as any).camera) {
        (this.player as any).camera.position.set(spawnX, spawnY, spawnZ);
      }
      if ((this.player as any).position) {
        (this.player as any).position.set(spawnX, spawnY, spawnZ);
      }
      if ((this.player as any).pos) {
        (this.player as any).pos.set(spawnX, spawnY, spawnZ);
      }
    }
  }

  private animate = () => {
    if (!this.isRunning) return;
    this.animFrameId = requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.1);

    if (this.player && typeof this.player.update === 'function') {
      this.player.update(dt);
    }

    if (this.enemy && typeof this.enemy.update === 'function') {
      this.enemy.update(dt);
    }

    if (this.rt && typeof this.rt.update === 'function') {
      this.rt.update(dt);
    }

    this.renderer.render(this.scene, this.camera);
  };

  private onResize = () => {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  public destroy() {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    this.renderer.dispose();
  }
}
