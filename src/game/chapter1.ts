// Nivel: Capítulo 1 - Entrada a NEXUS B-01
export function buildChapter1(W: any) {
  if (!W) return;

  if (typeof W.clear === 'function') {
    W.clear();
  }

  // --- ARQUITECTURA DE LA SALA ---
  // Suelo
  W.prop('metal').box(0, -0.1, 0, 18, 0.2, 30);
  // Techo
  W.prop('dark').box(0, 4.0, 0, 18, 0.2, 30);
  // Pared izquierda y derecha
  W.prop('concrete').box(-9, 2.0, 0, 0.4, 4.0, 30);
  W.prop('concrete').box(9, 2.0, 0, 0.4, 4.0, 30);
  // Pared del fondo
  W.prop('concrete').box(0, 2.0, -15, 18, 4.0, 0.4);

  // --- VEHÍCULO ACCIDENTADO ---
  W.prop('dark').box(0, 0.6, 11, 3.2, 1.2, 4.8);
  W.prop('metal').box(0, 1.4, 11, 2.6, 0.4, 3.6);
  W.prop('rust').box(-1.8, 1.5, 13.8, 2.4, 3.2, 0.3);
  W.prop('rust').box(1.8, 1.3, 14.1, 2.2, 2.8, 0.3);

  // Escombros
  W.prop('metal').box(-2.5, 0.2, 9.5, 1.2, 0.4, 0.8);
  W.prop('rust').box(2.2, 0.15, 10.2, 0.9, 0.3, 1.1);

  // --- CASILLEROS (Con rendija limpia a la altura de los ojos) ---
  createLocker(W, -7.5, 0, 2.0);
  createLocker(W, -7.5, 0, 3.5);

  // --- LUCES ---
  if (typeof W.light === 'function') {
    W.light(0, 3.0, 10, '#ff3333', 1.8, 12);
    W.light(0, 3.5, 0, '#336688', 1.2, 16);
    W.light(0, 3.5, -10, '#225577', 1.0, 16);
  }

  // --- ITEMS INTERACTIVOS ---
  if (typeof W.item === 'function') {
    W.prop('metal').box(3.0, 0.4, 8.0, 1.0, 0.8, 1.0);
    W.item('flashlight', 3.0, 0.9, 8.0);
    W.item('battery', -6.0, 0.2, -4.0);
  }

  // --- PUNTO DE APARICIÓN ---
  if (typeof W.setSpawn === 'function') {
    W.setSpawn(0, 1.0, 7.5, Math.PI);
  }
}

function createLocker(W: any, x: number, y: number, z: number) {
  // Estructura del casillero
  W.prop('dark').box(x, y + 1.2, z, 0.9, 2.4, 0.9);
  
  // Puerta inferior
  W.prop('metal').box(x + 0.46, y + 0.65, z, 0.05, 1.3, 0.8);
  // Puerta superior (deja el hueco abierto de 1.35m a 1.70m para la vista del jugador)
  W.prop('metal').box(x + 0.46, y + 1.95, z, 0.05, 0.5, 0.8);

  // Rendijas delgadas decorativas
  W.prop('rust').box(x + 0.46, y + 1.35, z, 0.04, 0.03, 0.6);
  W.prop('rust').box(x + 0.46, y + 1.75, z, 0.04, 0.03, 0.6);
}

export const loadChapter1 = buildChapter1;
export default buildChapter1;
