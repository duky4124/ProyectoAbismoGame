import * as THREE from 'three';

export interface ChapterRuntime {
  spawnPos: { x: number; y: number; z: number };
  items: THREE.Object3D[];
  lights: THREE.Light[];
  update?: (dt: number) => void;
}

// Creador de materiales de contingencia con acabado sci-fi / horror
function getMaterial(matName: string, mats?: any): THREE.Material {
  if (mats && mats[matName]) {
    return mats[matName];
  }
  switch (matName) {
    case 'metal':
      return new THREE.MeshStandardMaterial({
        color: 0x3d434d,
        roughness: 0.35,
        metalness: 0.75,
      });
    case 'dark':
      return new THREE.MeshStandardMaterial({
        color: 0x16181c,
        roughness: 0.85,
        metalness: 0.2,
      });
    case 'concrete':
      return new THREE.MeshStandardMaterial({
        color: 0x5a5e66,
        roughness: 0.9,
        metalness: 0.1,
      });
    case 'rust':
      return new THREE.MeshStandardMaterial({
        color: 0x7c3f1d,
        roughness: 0.8,
        metalness: 0.3,
      });
    default:
      return new THREE.MeshStandardMaterial({
        color: 0x444444,
        roughness: 0.7,
      });
  }
}

// Nivel: Capítulo 1 - Entrada a NEXUS B-01
export function buildChapter1(engine: any): ChapterRuntime {
  const targetGroup: THREE.Group = engine?.level || engine?.scene || new THREE.Group();
  const mats = engine?.mats;
  const items: THREE.Object3D[] = [];
  const lights: THREE.Light[] = [];

  // Función constructora de bloques 3D
  const box = (matName: string, x: number, y: number, z: number, w: number, h: number, d: number) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = getMaterial(matName, mats);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    targetGroup.add(mesh);
    return mesh;
  };

  // Función constructora de luces
  const addLight = (x: number, y: number, z: number, color: string | number, intensity: number, distance: number) => {
    const light = new THREE.PointLight(color, intensity, distance);
    light.position.set(x, y, z);
    light.castShadow = true;
    targetGroup.add(light);
    lights.push(light);

    // Foco emisor visual en el techo
    const bulbMat = new THREE.MeshBasicMaterial({ color });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), bulbMat);
    bulb.position.set(x, y, z);
    targetGroup.add(bulb);
  };

  // 1. Estructura principal de la sala
  // Piso
  box('metal', 0, -0.1, 0, 18, 0.2, 30);
  // Techo
  box('dark', 0, 4.0, 0, 18, 0.2, 30);
  // Pared Izquierda
  box('concrete', -9, 2.0, 0, 0.4, 4.0, 30);
  // Pared Derecha
  box('concrete', 9, 2.0, 0, 0.4, 4.0, 30);
  // Pared Fondo
  box('concrete', 0, 2.0, -15, 18, 4.0, 0.4);
  // Pared Trasera (cierra la sala para no caer al vacío)
  box('concrete', 0, 2.0, 15, 18, 4.0, 0.4);

  // 2. Casilleros (Lockers)
  const makeLocker = (x: number, y: number, z: number) => {
    box('dark', x, y + 1.2, z, 0.9, 2.4, 0.9);
    box('metal', x + 0.46, y + 0.65, z, 0.05, 1.3, 0.8);
    box('metal', x + 0.46, y + 1.95, z, 0.05, 0.5, 0.8);
    box('rust', x + 0.46, y + 1.35, z, 0.04, 0.03, 0.6);
    box('rust', x + 0.46, y + 1.75, z, 0.04, 0.03, 0.6);
  };

  makeLocker(-7.5, 0, 2.0);
  makeLocker(-7.5, 0, 3.5);
  makeLocker(-7.5, 0, 5.0);

  // 3. Mesa de suministros
  box('metal', 3.0, 0.4, 8.0, 1.2, 0.8, 1.2);

  // 4. Linterna recolectable sobre la mesa
  const flashGroup = new THREE.Group();
  const flashBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.22, 12),
    new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 })
  );
  flashBody.rotation.x = Math.PI / 2;
  const flashLens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.04, 0.06, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffaa })
  );
  flashLens.position.z = 0.12;
  flashLens.rotation.x = Math.PI / 2;
  flashGroup.add(flashBody, flashLens);
  flashGroup.position.set(3.0, 0.86, 8.0);
  targetGroup.add(flashGroup);
  items.push(flashGroup);

  // 5. Batería en el suelo
  const battery = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.1, 12),
    new THREE.MeshStandardMaterial({ color: 0x22aa33, metalness: 0.5, roughness: 0.4 })
  );
  battery.position.set(-6.0, 0.05, -4.0);
  battery.rotation.z = Math.PI / 2;
  targetGroup.add(battery);
  items.push(battery);

  // 6. Iluminación ambiental y focos de emergencia
  addLight(0, 3.2, 10, '#ff3333', 2.2, 16);  // Luz roja de alarma
  addLight(0, 3.5, 0, '#3377aa', 1.8, 20);   // Luz azulada central
  addLight(0, 3.2, -10, '#ffaa44', 1.4, 14); // Luz ámbar al fondo

  // 7. Ubicación de inicio del jugador (Spawn)
  const spawnPos = { x: 0, y: 1.6, z: 7.5 };

  if (engine?.player) {
    if (engine.player.camera) engine.player.camera.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
    if (engine.player.position) engine.player.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
    if (engine.player.pos) engine.player.pos.set(spawnPos.x, spawnPos.y, spawnPos.z);
  }
  if (engine?.camera) {
    engine.camera.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
  }

  // Compatibilidad con objetos Proxy antiguos
  if (engine?.world) {
    engine.world.box = box;
    engine.world.light = addLight;
  }

  return {
    spawnPos,
    items,
    lights,
    update: (_dt: number) => {
      // Leve oscilación o animación de las luces si se desea
    }
  };
}

export const loadChapter1 = buildChapter1;
export const chapter1 = buildChapter1;
export default buildChapter1;
