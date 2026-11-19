// Nivel: Capítulo 1 - Entrada a NEXUS B-01
export function buildChapter1(arg: any) {
  try {
    const W = arg?.world || arg;
    if (!W) return;

    if (typeof W.clear === 'function') {
      try { W.clear(); } catch (_) {}
    }

    const box = (mat: string, x: number, y: number, z: number, w: number, h: number, d: number) => {
      try {
        if (typeof W.prop === 'function') {
          const p = W.prop(mat);
          if (p && typeof p.box === 'function') return p.box(x, y, z, w, h, d);
        }
        if (typeof W.box === 'function') {
          return W.box(x, y, z, w, h, d);
        }
      } catch (_) {}
    };

    // --- ARQUITECTURA DE LA SALA ---
    box('metal', 0, -0.1, 0, 18, 0.2, 30);      // Suelo
    box('dark', 0, 4.0, 0, 18, 0.2, 30);        // Techo
    box('concrete', -9, 2.0, 0, 0.4, 4.0, 30);  // Pared izq
    box('concrete', 9, 2.0, 0, 0.4, 4.0, 30);   // Pared der
    box('concrete', 0, 2.0, -15, 18, 4.0, 0.4); // Pared fondo

    // --- VEHÍCULO ACCIDENTADO ---
    box('dark', 0, 0.6, 11, 3.2, 1.2, 4.8);
    box('metal', 0, 1.4, 11, 2.6, 0.4, 3.6);
    box('rust', -1.8, 1.5, 13.8, 2.4, 3.2, 0.3);
    box('rust', 1.8, 1.3, 14.1, 2.2, 2.8, 0.3);

    // Escombros
    box('metal', -2.5, 0.2, 9.5, 1.2, 0.4, 0.8);
    box('rust', 2.2, 0.15, 10.2, 0.9, 0.3, 1.1);

    // --- CASILLEROS (Con rendija limpia para no obstruir la vista) ---
    const makeLocker = (x: number, y: number, z: number) => {
      box('dark', x, y + 1.2, z, 0.9, 2.4, 0.9);
      box('metal', x + 0.46, y + 0.65, z, 0.05, 1.3, 0.8);
      box('metal', x + 0.46, y + 1.95, z, 0.05, 0.5, 0.8);
      box('rust', x + 0.46, y + 1.35, z, 0.04, 0.03, 0.6);
      box('rust', x + 0.46, y + 1.75, z, 0.04, 0.03, 0.6);
    };

    makeLocker(-7.5, 0, 2.0);
    makeLocker(-7.5, 0, 3.5);

    // --- LUCES ---
    if (typeof W.light === 'function') {
      try {
        W.light(0, 3.0, 10, '#ff3333', 1.8, 12);
        W.light(0, 3.5, 0, '#336688', 1.2, 16);
        W.light(0, 3.5, -10, '#225577', 1.0, 16);
      } catch (_) {}
    }

    // --- ITEMS INTERACTIVOS ---
    if (typeof W.item === 'function') {
      try {
        box('metal', 3.0, 0.4, 8.0, 1.0, 0.8, 1.0);
        W.item('flashlight', 3.0, 0.9, 8.0);
        W.item('battery', -6.0, 0.2, -4.0);
      } catch (_) {}
    }

    // --- SPAWN ---
    if (typeof W.setSpawn === 'function') {
      try { W.setSpawn(0, 1.0, 7.5, Math.PI); } catch (_) {}
    }
  } catch (err) {
    console.warn('buildChapter1 caught:', err);
  }
}

export const loadChapter1 = buildChapter1;
export const chapter1 = buildChapter1;
export default buildChapter1;
