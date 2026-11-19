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

  // ARMARIO / LOCKER CON RENDIJA VISIBLE
  const locker = (x: number, z: number, dir: 'n' | 's' | 'e' | 'w', hideId: string) => {
    const f = dirs[dir];
    const along = dir === 'n' || dir === 's';

    // 1. Pared trasera (detrás del jugador)
    W.prop('dark').box(
      x - f.dx * 0.38,
      1.1,
      z - f.dz * 0.38,
      along ? 0.8 : 0.04,
      2.2,
      along ? 0.04 : 0.8
    );

    // 2. Paredes laterales (izquierda y derecha)
    if (along) {
      W.prop('dark').box(x - 0.38, 1.1, z, 0.04, 2.2, 0.76);
      W.prop('dark').box(x + 0.38, 1.1, z, 0.04, 2.2, 0.76);
    } else {
      W.prop('dark').box(x, 1.1, z - 0.38, 0.76, 2.2, 0.04);
      W.prop('dark').box(x, 1.1, z + 0.38, 0.76, 2.2, 0.04);
    }

    // 3. Techo y Suelo del casillero
    W.prop('dark').box(x, 2.18, z, 0.8, 0.04, 0.8);
    W.prop('dark').box(x, 0.02, z, 0.8, 0.04, 0.8);

    // 4. Puerta frontal
    const doorX = x + f.dx * 0.38;
    const doorZ = z + f.dz * 0.38;

    // Panel inferior sólido (desde el suelo hasta el pecho: y = 0 a 1.25)
    W.prop('dark').box(
      doorX,
      0.625,
      doorZ,
      along ? 0.8 : 0.03,
      1.25,
      along ? 0.03 : 0.8
    );

    // Panel superior sólido (sobre los ojos: y = 1.75 a 2.20)
    W.prop('dark').box(
      doorX,
      1.975,
      doorZ,
      along ? 0.8 : 0.03,
      0.45,
      along ? 0.03 : 0.8
    );

    // Marcos laterales de la puerta (dejan 0.64m de visión horizontal)
    if (along) {
      W.prop('dark').box(doorX - 0.36, 1.5, doorZ, 0.08, 0.5, 0.03);
      W.prop('dark').box(doorX + 0.36, 1.5, doorZ, 0.08, 0.5, 0.03);
    } else {
      W.prop('dark').box(doorX, 1.5, doorZ - 0.36, 0.03, 0.5, 0.08);
      W.prop('dark').box(doorX, 1.5, doorZ + 0.36, 0.03, 0.5, 0.08);
    }

    // Tablillas de persiana (delgadas: 1.2cm). 
    // Dejamos un espacio despejado entre 1.42 y 1.62 justo a la altura de los ojos (1.52)
    const slats = [1.32, 1.40, 1.62, 1.70];
    for (const sy of slats) {
      W.prop('dark').box(
        doorX,
        sy,
        doorZ,
        along ? 0.64 : 0.02,
        0.012,
        along ? 0.02 : 0.64
      );
    }

    // Registro del escondite con cámara alineada y distancia de seguridad
    g.addHide(
      {
        id: hideId,
        x: x + f.dx * 0.16, // Separado 22cm de la puerta para evitar clipping de cámara
        z: z + f.dz * 0.16,
        yaw: f.yaw,
        eye: 1.52, // Justo en el centro de la ranura de observación
        type: 'locker',
        exit: { x: x + f.dx * 1.15, z: z + f.dz * 1.15 },
      },
      'Esconderte en el armario'
    );
  };

  // ESCRITORIO CON ESCONDITE DEBAJO
  const desk = (x: number, z: number, rot: number, hideId?: string, hideDir: 'n' | 's' | 'e' | 'w' = 's') => {
    W.prop('wood').box(x, 0.75, z, 1.6, 0.06, 0.8);
    // Patas
    W.prop('metal').box(x - 0.75, 0.37, z - 0.35, 0.06, 0.74, 0.06);
    W.prop('metal').box(x + 0.75, 0.37, z - 0.35, 0.06, 0.74, 0.06);
    W.prop('metal').box(x - 0.75, 0.37, z + 0.35, 0.06, 0.74, 0.06);
    W.prop('metal').box(x + 0.75, 0.37, z + 0.35, 0.06, 0.74, 0.06);

    // Computadora sobre el escritorio
    W.prop('dark').box(x, 0.95, z - 0.15, 0.45, 0.32, 0.05); // Pantalla
    W.prop('dark').box(x, 0.79, z - 0.15, 0.18, 0.04, 0.15); // Base
    W.prop('dark').box(x, 0.79, z + 0.15, 0.40, 0.02, 0.14); // Teclado

    if (hideId) {
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
    // Postes verticales
    W.prop('metal').box(x - sx / 2 + 0.03, 1.0, z - sz / 2 + 0.03, 0.05, 2.0, 0.05);
    W.prop('metal').box(x + sx / 2 - 0.03, 1.0, z - sz / 2 + 0.03, 0.05, 2.0, 0.05);
    W.prop('metal').box(x - sx / 2 + 0.03, 1.0, z + sz / 2 - 0.03, 0.05, 2.0, 0.05);
    W.prop('metal').box(x + sx / 2 - 0.03, 1.0, z + sz / 2 - 0.03, 0.05, 2.0, 0.05);
    // Baldas horizontales (y = 0.4, 0.85, 1.35, 1.85)
    [0.4, 0.85, 1.35, 1.85].forEach((y) => {
      W.prop('metal').box(x, y, z, sx, 0.03, sz);
    });
  };

  // --------------------------------------------------------------------------
  // CONSTRUCCIÓN DEL MAPA (ARQUITECTURA)
  // --------------------------------------------------------------------------

  // SUELO Y TECHO GENERAL DE LA INSTALACIÓN
  W.floor(0, 0, 120, 100, 'concrete_tiles');
  W.ceiling(0, 0, 120, 100, 3.2, 'ceiling_panels');

  // --- SECTOR 1: SALA DE DESPERTAR / CONTENCIÓN (Spawn x: 12, z: 12) ---
  W.wall(8, 8, 16, 8, 3.2);
  W.wall(8, 16, 16, 16, 3.2);
  W.wall(8, 8, 8, 16, 3.2);
  W.wall(16, 8, 16, 12, 3.2); // Puerta de salida en (16, 13)

  // Luces de emergencia del inicio
  g.addLight({ x: 12, y: 2.8, z: 12, color: 0xff3322, intensity: 1.2, distance: 8 });

  // Camilla y mesa médica
  W.prop('metal').box(12, 0.45, 12, 1.2, 0.45, 2.2);
  desk(10.5, 14.5, 0);

  // --- SECTOR 2: PASILLO CENTRAL (Conecta Despertar, Oficinas y Seguridad) ---
  W.wall(16, 8, 45, 8, 3.2);
  W.wall(16, 16, 35, 16, 3.2);
  W.wall(35, 16, 35, 38, 3.2);
  W.wall(45, 8, 45, 38, 3.2);

  // Armario del pasillo central
  locker(18, 9.2, 's', 'h_lock_hallway');

  // Luces parpadeantes de pasillo
  g.addLight({ x: 26, y: 2.9, z: 12, color: 0xffaa44, intensity: 1.5, distance: 10, flicker: true });
  g.addLight({ x: 40, y: 2.9, z: 24, color: 0x88ccff, intensity: 1.0, distance: 12 });

  // --- SECTOR 3: ZONA DE OFICINAS Y CUBÍCULOS (Este: x: 70 a 105, z: 8 a 30) ---
  W.wall(45, 8, 105, 8, 3.2);
  W.wall(105, 8, 105, 32, 3.2);
  W.wall(45, 32, 105, 32, 3.2);

  // Cubículos con escritorios (orientados correctamente hacia el pasillo)
  desk(76, 14, 0, 'h_desk_1', 's');
  desk(84, 14, 0, 'h_desk_2', 's');
  desk(92, 14, 0, 'h_desk_3', 's');

  desk(76, 26, 0, 'h_desk_4', 'n');
  desk(84, 26, 0, 'h_desk_5', 'n');
  // Corrección: Escritorio del fondo ahora orientado al Norte (no contra la pared)
  desk(93, 10.5, 0, 'h_desk_b', 'n');

  // Armarios de oficina
  locker(103.5, 14, 'w', 'h_lock_office_1');
  locker(103.5, 26, 'w', 'h_lock_office_2');

  // --- SECTOR 4: SALA DE SEGURIDAD (Norte: x: 45 a 65, z: 38 a 55) ---
  W.wall(45, 38, 52, 38, 3.2);
  W.wall(56, 38, 65, 38, 3.2); // Hueco para puerta blindada con teclado en (54, 38)
  W.wall(65, 38, 65, 55, 3.2);
  W.wall(45, 55, 65, 55, 3.2);
  W.wall(45, 38, 45, 55, 3.2);

  // Armario de seguridad
  locker(46.2, 44, 'e', 'h_lock_sec');

  // Estantes y consolas de seguridad
  shelf(63.5, 46, false);
  shelf(63.5, 50, false);

  // --- SECTOR 5: ALMACÉN Y MANTENIMIENTO (x: 10 a 40, z: 45 a 85) ---
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

  // --- SECTOR 6: SALIDA DE EMERGENCIA Y ESCLUSA (x: 80 a 110, z: 60 a 90) ---
  W.wall(80, 60, 110, 60, 3.2);
  W.wall(110, 60, 110, 90, 3.2);
  W.wall(80, 90, 110, 90, 3.2);
  W.wall(80, 60, 80, 90, 3.2);

  // --------------------------------------------------------------------------
  // PUERTAS Y TERMINALES
  // --------------------------------------------------------------------------

  // Puerta inicial
  g.addDoor({
    id: 'door_cell',
    x: 16,
    z: 13,
    yaw: Math.PI / 2,
    locked: false,
  });

  // Puerta de Seguridad con teclado de 4 dígitos
  g.addDoor({
    id: 'door_security',
    x: 54,
    z: 38,
    yaw: 0,
    locked: true,
    code: '4829',
  });

  // Teclado en la pared exterior de Seguridad
  g.addKeypad({
    id: 'keypad_sec',
    doorId: 'door_security',
    x: 55.4,
    y: 1.4,
    z: 37.8,
    yaw: Math.PI,
  });

  // Puerta final de evacuación
  g.addDoor({
    id: 'door_exit',
    x: 80,
    z: 75,
    yaw: Math.PI / 2,
    locked: true,
    requiresKey: 'item_keycard_master',
  });

  // --------------------------------------------------------------------------
  // OBJETOS (ITEMS) Y CORRECCIONES DE ALTURAS FLOTANTES
  // --------------------------------------------------------------------------

  // Batería en el suelo de la celda (y: 0.08)
  g.addItem({
    id: 'item_battery_1',
    name: 'Batería de Linterna',
    type: 'battery',
    x: 10.8,
    y: 0.08,
    z: 14.2,
    model: 'battery',
  });

  // Nota con la clave de Seguridad sobre el escritorio de Oficinas (y: 0.82)
  g.addItem({
    id: 'item_note_code',
    name: 'Nota arrugada: "Código Seguridad 4829"',
    type: 'note',
    x: 93,
    y: 0.82,
    z: 10.5,
    model: 'paper',
    text: 'Nota del guardia: No olvidar que cambiaron el código a 4829.',
  });

  // Cable eléctrico en el suelo del almacén (corrección de flotación: y: 0.08)
  g.addItem({
    id: 'p_wire1',
    name: 'Cable de Cobre',
    type: 'quest',
    x: 5.2,
    y: 0.08,
    z: 45,
    model: 'wire',
  });

  // Fusible colocado en la balda de la estantería (corrección de altura: y: 0.85)
  g.addItem({
    id: 'p_fuse',
    name: 'Fusible de 20A',
    type: 'quest',
    x: 53,
    y: 0.85,
    z: 62,
    model: 'fuse',
  });

  // Tarjeta de acceso en la sala de Seguridad (sobre la mesa: y: 0.82)
  g.addItem({
    id: 'item_keycard_master',
    name: 'Tarjeta de Evacuación Nivel 2',
    type: 'keycard',
    x: 63.2,
    y: 0.82,
    z: 46.2,
    model: 'keycard',
  });

  // Botiquín de primeros auxilios en el estante de mantenimiento (y: 0.85)
  g.addItem({
    id: 'item_medkit_1',
    name: 'Botiquín Médico',
    type: 'medkit',
    x: 14,
    y: 0.85,
    z: 60,
    model: 'medkit',
  });

  // Lata de refresco sobre el escritorio (y: 0.82)
  g.addItem({
    id: 'item_soda',
    name: 'Lata de Soda',
    type: 'drink',
    x: 76,
    y: 0.82,
    z: 14,
    model: 'can',
  });

  // --------------------------------------------------------------------------
  // OBJETIVOS DEL CAPÍTULO 1
  // --------------------------------------------------------------------------
  g.setObjective('Entra en Seguridad (norte): encuentra el código de 4 dígitos en las oficinas');

  // Trigger para actualizar objetivo al entrar a Seguridad
  g.addTrigger({
    x: 54,
    z: 42,
    radius: 3,
    once: true,
    action: () => {
      g.setObjective('Toma la tarjeta de evacuación y abre la Esclusa Sur');
    },
  });

  // Posición inicial del jugador (Spawn)
  g.spawnPlayer({
    x: 12,
    y: 1.6,
    z: 12,
    yaw: 0,
  });
}

export default loadChapter1;
