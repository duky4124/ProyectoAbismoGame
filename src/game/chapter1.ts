// ============================================================================
// PROYECTO ABISMO - CAPÍTULO 1: EL DESPERTAR
// src/game/chapter1.ts
// ============================================================================

export function buildChapter1(g: any) {
  const W = g.world;

  // --------------------------------------------------------------------------
  // CONSTANTES Y DIRECCIONES
  // --------------------------------------------------------------------------
  const dirs = {
    n: { dx: 0, dz: -1, yaw: 0 },
    s: { dx: 0, dz: 1, yaw: Math.PI },
    e: { dx: 1, dz: 0, yaw: -Math.PI / 2 },
    w: { dx: -1, dz: 0, yaw: Math.PI / 2 },
  };

  // --------------------------------------------------------------------------
  // HELPERS DE PROPS Y ESCONDITES
  // --------------------------------------------------------------------------

  // ARMARIO / LOCKER CON VISIÓN CINEMATOGRÁFICA
  const locker = (x: number, z: number, dir: 'n' | 's' | 'e' | 'w', hideId: string) => {
    const f = dirs[dir];
    const along = dir === 'n' || dir === 's';

    // Pared trasera
    W.prop('dark').box(x - f.dx * 0.38, 1.1, z - f.dz * 0.38, along ? 0.8 : 0.04, 2.2, along ? 0.04 : 0.8);
    
    // Laterales corregidos (usando W.prop('dark').box)
    if (along) {
      W.prop('dark').box(x - 0.38, 1.1, z, 0.04, 2.2, 0.76);
      W.prop('dark').box(x + 0.38, 1.1, z, 0.04, 2.2, 0.76);
    } else {
      W.prop('dark').box(x, 1.1, z - 0.38, 0.76, 2.2, 0.04);
      W.prop('dark').box(x, 1.1, z + 0.38, 0.76, 2.2, 0.04);
    }

    // Techo y suelo
    W.prop('dark').box(x, 2.18, z, 0.8, 0.04, 0.8);
    W.prop('dark').box(x, 0.02, z, 0.8, 0.04, 0.8);

    // Puerta frontal
    const doorX = x + f.dx * 0.38;
    const doorZ = z + f.dz * 0.38;

    W.prop('dark').box(doorX, 0.6, doorZ, along ? 0.8 : 0.03, 1.2, along ? 0.03 : 0.8);
    W.prop('dark').box(doorX, 2.02, doorZ, along ? 0.8 : 0.03, 0.35, along ? 0.03 : 0.8);

    if (along) {
      W.prop('dark').box(doorX - 0.38, 1.52, doorZ, 0.04, 0.65, 0.03);
      W.prop('dark').box(doorX + 0.38, 1.52, doorZ, 0.04, 0.65, 0.03);
    } else {
      W.prop('dark').box(doorX, 1.52, doorZ - 0.38, 0.03, 0.65, 0.04);
      W.prop('dark').box(doorX, 1.52, doorZ + 0.38, 0.03, 0.65, 0.04);
    }

    // Tablillas de visión
    const slats = [1.35, 1.75]; 
    for (const sy of slats) {
      W.prop('dark').box(doorX, sy, doorZ, along ? 0.72 : 0.02, 0.02, along ? 0.02 : 0.72);
    }

    if (typeof g.addHide === 'function') {
      g.addHide({
        id: hideId,
        x: x + f.dx * 0.30, 
        z: z + f.dz * 0.30,
        yaw: f.yaw,
        eye: 1.55,
        type: 'locker',
        exit: { x: x + f.dx * 1.2, z: z + f.dz * 1.2 },
      }, 'Esconderte en el armario');
    }
  };

  // ESCRITORIO
  const desk = (x: number, z: number, rot: number, hideId?: string, hideDir: 'n' | 's' | 'e' | 'w' = 's') => {
    W.prop('wood').box(x, 0.75, z, 1.6, 0.06, 0.8);
    W.prop('metal').box(x - 0.75, 0.37, z - 0.35, 0.06, 0.74, 0.06);
    W.prop('metal').box(x + 0.75, 0.37, z - 0.35, 0.06, 0.74, 0.06);
    W.prop('metal').box(x - 0.75, 0.37, z + 0.35, 0.06, 0.74, 0.06);
    W.prop('metal').box(x + 0.75, 0.37, z + 0.35, 0.06, 0.74, 0.06);

    W.prop('dark').box(x, 0.95, z - 0.15, 0.45, 0.32, 0.05);
    W.prop('dark').box(x, 0.79, z - 0.15, 0.18, 0.04, 0.15);
    W.prop('dark').box(x, 0.79, z + 0.15, 0.40, 0.02, 0.14);

    if (hideId && typeof g.addHide === 'function') {
      const f = dirs[hideDir];
      g.addHide(
        {
          id: hideId,
          x,
          z,
          yaw: f.yaw,
          eye: 0.42,
          type: 'desk',
          exit: { x: x + f.dx * 1.1, z: z + f.dz * 1.1 },
        },
        'Esconderte bajo el escritorio'
      );
    }
  };

  // ESTANTERÍA METÁLICA
  const shelf = (x: number, z: number, alongX: boolean) => {
    const sx = alongX ? 2.0 : 0.6;
    const sz = alongX ? 0.6 : 2.0;
    W.prop('metal').box(x - sx / 2 + 0.03, 1.0, z - sz / 2 + 0.03, 0.05, 2.0, 0.05);
    W.prop('metal').box(x + sx / 2 - 0.03, 1.0, z - sz / 2 + 0.03, 0.05, 2.0, 0.05);
    W.prop('metal').box(x - sx / 2 + 0.03, 1.0, z + sz / 2 - 0.03, 0.05, 2.0, 0.05);
    W.prop('metal').box(x + sx / 2 - 0.03, 1.0, z + sz / 2 - 0.03, 0.05, 2.0, 0.05);
    [0.4, 0.85, 1.35, 1.85].forEach((y) => {
      W.prop('metal').box(x, y, z, sx, 0.03, sz);
    });
  };

  // --------------------------------------------------------------------------
  // ARQUITECTURA
  // --------------------------------------------------------------------------
  W.floor(0, 0, 120, 100, 'concrete_tiles');
  W.ceiling(0, 0, 120, 100, 3.2, 'ceiling_panels');

  // Spawn
  W.wall(8, 8, 16, 8, 3.2);
  W.wall(8, 16, 16, 16, 3.2);
  W.wall(8, 8, 8, 16, 3.2);
  W.wall(16, 8, 16, 12, 3.2);

  if (typeof g.addLight === 'function') {
    g.addLight({ x: 12, y: 2.8, z: 12, color: 0xff3322, intensity: 1.2, distance: 8 });
  }
  W.prop('metal').box(12, 0.45, 12, 1.2, 0.45, 2.2);
  desk(10.5, 14.5, 0);

  // Pasillo Central
  W.wall(16, 8, 45, 8, 3.2);
  W.wall(16, 16, 35, 16, 3.2);
  W.wall(35, 16, 35, 38, 3.2);
  W.wall(45, 8, 45, 38, 3.2);

  locker(18, 9.2, 's', 'h_lock_hallway');

  if (typeof g.addLight === 'function') {
    g.addLight({ x: 26, y: 2.9, z: 12, color: 0xffaa44, intensity: 1.5, distance: 10, flicker: true });
    g.addLight({ x: 40, y: 2.9, z: 24, color: 0x88ccff, intensity: 1.0, distance: 12 });
  }

  // Oficinas
  W.wall(45, 8, 105, 8, 3.2);
  W.wall(105, 8, 105, 32, 3.2);
  W.wall(45, 32, 105, 32, 3.2);

  desk(76, 14, 0, 'h_desk_1', 's');
  desk(84, 14, 0, 'h_desk_2', 's');
  desk(92, 14, 0, 'h_desk_3', 's');

  desk(76, 26, 0, 'h_desk_4', 'n');
  desk(84, 26, 0, 'h_desk_5', 'n');
  desk(93, 10.5, 0, 'h_desk_b', 'n');

  locker(103.5, 14, 'w', 'h_lock_office_1');
  locker(103.5, 26, 'w', 'h_lock_office_2');

  // Seguridad
  W.wall(45, 38, 52, 38, 3.2);
  W.wall(56, 38, 65, 38, 3.2);
  W.wall(65, 38, 65, 55, 3.2);
  W.wall(45, 55, 65, 55, 3.2);
  W.wall(45, 38, 45, 55, 3.2);

  locker(46.2, 44, 'e', 'h_lock_sec');
  shelf(63.5, 46, false);
  shelf(63.5, 50, false);

  // Almacén
  W.wall(10, 45, 40, 45, 3.2);
  W.wall(10, 45, 10, 85, 3.2);
  W.wall(10, 85, 40, 85, 3.2);
  W.wall(40, 45, 40, 85, 3.2);

  shelf(14, 52, true);
  shelf(14, 60, true);
  shelf(14, 68, true);
  shelf(26, 52, true);
  shelf(26, 60, true);
  shelf(26, 68, true);

  locker(11.2, 78, 'e', 'h_lock_storage');

  // Salida
  W.wall(80, 60, 110, 60, 3.2);
  W.wall(110, 60, 110, 90, 3.2);
  W.wall(80, 90, 110, 90, 3.2);
  W.wall(80, 60, 80, 90, 3.2);

  // --------------------------------------------------------------------------
  // PUERTAS
  // --------------------------------------------------------------------------
  if (typeof g.addDoor === 'function') {
    g.addDoor({ id: 'door_cell', x: 16, z: 13, yaw: Math.PI / 2, locked: false });
    g.addDoor({ id: 'door_security', x: 54, z: 38, yaw: 0, locked: true, code: '4829' });
    g.addDoor({ id: 'door_exit', x: 80, z: 75, yaw: Math.PI / 2, locked: true, requiresKey: 'item_keycard_master' });
  }

  if (typeof g.addKeypad === 'function') {
    g.addKeypad({ id: 'keypad_sec', doorId: 'door_security', x: 55.4, y: 1.4, z: 37.8, yaw: Math.PI });
  }

  // --------------------------------------------------------------------------
  // ITEMS
  // --------------------------------------------------------------------------
  if (typeof g.addItem === 'function') {
    g.addItem({ id: 'item_battery_1', name: 'Batería de Linterna', type: 'battery', x: 10.8, y: 0.08, z: 14.2, model: 'battery' });
    g.addItem({ id: 'item_note_code', name: 'Nota: "Código Seguridad 4829"', type: 'note', x: 93, y: 0.82, z: 10.5, model: 'paper', text: 'Nota: Código cambiado a 4829.' });
    g.addItem({ id: 'p_wire1', name: 'Cable de Cobre', type: 'quest', x: 5.2, y: 0.08, z: 45, model: 'wire' });
    g.addItem({ id: 'p_fuse', name: 'Fusible de 20A', type: 'quest', x: 53, y: 0.85, z: 62, model: 'fuse' });
    g.addItem({ id: 'item_keycard_master', name: 'Tarjeta Nivel 2', type: 'keycard', x: 63.2, y: 0.82, z: 46.2, model: 'keycard' });
    g.addItem({ id: 'item_medkit_1', name: 'Botiquín', type: 'medkit', x: 14, y: 0.85, z: 60, model: 'medkit' });
    g.addItem({ id: 'item_soda', name: 'Lata de Soda', type: 'drink', x: 76, y: 0.82, z: 14, model: 'can' });
  }

  // --------------------------------------------------------------------------
  // OBJETIVOS Y SPAWN SEGURO
  // --------------------------------------------------------------------------
  if (typeof g.setObjective === 'function') {
    g.setObjective('Entra en Seguridad (norte): encuentra el código de 4 dígitos en las oficinas');
  }

  if (typeof g.addTrigger === 'function') {
    g.addTrigger({
      x: 54,
      z: 42,
      radius: 3,
      once: true,
      action: () => {
        if (typeof g.setObjective === 'function') {
          g.setObjective('Toma la tarjeta de evacuación y abre la Esclusa Sur');
        }
      },
    });
  }

  // Spawn seguro del jugador
  if (typeof g.spawnPlayer === 'function') {
    g.spawnPlayer({ x: 12, y: 1.6, z: 12, yaw: 0 });
  } else if (g.P) {
    g.P.x = 12;
    g.P.y = 1.6;
    g.P.z = 12;
    g.P.yaw = 0;
  }
}

export const loadChapter1 = buildChapter1;
export default buildChapter1;
