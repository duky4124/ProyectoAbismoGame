// Nivel del Capítulo 1: Acceso a Estación NEXUS B-01
export function buildChapter1(W: any) {
  if (!W) return;

  // Limpiar escena si existe el método
  if (typeof W.clear === 'function') {
    W.clear();
  }

  // --- 1. SALA DE ENTRADA / COMPUERTA B-01 DESTROZADA ---
  // Suelo principal
  W.prop('metal').box(0, -0.1, 0, 18, 0.2, 30);
  // Techo
  W.prop('dark').box(0, 4.0, 0, 18, 0.2, 30);
  // Paredes laterales
  W.prop('concrete').box(-9, 2.0, 0, 0.4, 4.0, 30);
  W.prop('concrete').box(9, 2.0, 0, 0.4, 4.0, 30);
  // Pared trasera (fondo)
  W.prop('concrete').box(0, 2.0, -15, 18, 4.0, 0.4);

  // --- 2. RESTOS DEL VEHÍCULO DE EXPLORACIÓN ESTRELLADO ---
  // Chasis aplastado del submarino
  W.prop('dark').box(0, 0.6, 11, 3.2, 1.2, 4.8);
  // Techo deformado del vehículo
  W.prop('metal').box(0, 1.4, 11, 2.6, 0.4, 3.6);
  // Compuerta NEXUS retorcida por el impacto
  W.prop('rust').box(-1.8, 1.5, 13.8, 2.4, 3.2, 0.3);
  W.prop('rust').box(1.8, 1.3, 14.1, 2.2, 2.8, 0.3);

  // Restos y escombros de metal
  W.prop('metal').box(-2.5, 0.2, 9.5, 1.2, 0.4, 0.8);
  W.prop('rust').box(2.2, 0.15, 10.2, 0.9, 0.3, 1.1);

  // --- 3. CASILLERO CON RENDIJA A LA ALTURA DE LOS OJOS ---
  createLocker(W, -7.5, 0, 2.0, 'east');
  createLocker(W, -7.5, 0, 3.5, 'east');

  // --- 4. ILUMINACIÓN AMBIENTAL Y DE EMERGENCIA ---
  // Luz de emergencia roja intermitente sobre el transporte accidentado
  if (typeof W.light === 'function') {
    W.light(0, 3.2, 10, '#ff2222', 1.8, 12);
    // Luz fría de los pasillos de NEXUS
    W.light(0, 3.5, 0, '#336688', 1.2, 16);
    W.light(0, 3.5, -10, '#225577', 1.0, 16);
  }

  // --- 5. OBJETOS INTERACTIVOS (Linterna y Baterías) ---
  if (typeof W.item === 'function') {
    // Linterna sobre un contenedor cerca del vehículo
    W.prop('metal').box(3.0, 0.4, 8.0, 1.0, 0.8, 1.0); // Contenedor
    W.item('flashlight', 3.0, 0.9, 8.0);
    
    // Batería en el pasillo interior
    W.item('battery', -6.0, 0.2, -4.0);
  }

  // --- 6. PUNTO DE INICIO DEL JUGADOR (Frente al transporte) ---
  if (typeof W.setSpawn === 'function') {
    W.setSpawn(0, 1.0, 7.5, Math.PI); // Mirando hacia el pasillo
  }
}

// Función auxiliar para construir el casillero con mirilla despejada (1.55m)
function createLocker(W: any, x: number, y: number, z: number, facing: string) {
  // Marco y paredes del casillero
  W.prop('dark').box(x, y + 1.2, z, 0.9, 2.4, 0.9);
  
  // Panel inferior de la puerta
  W.prop('metal').box(x + 0.46, y + 0.65, z, 0.05, 1.3, 0.8);
  // Panel superior dejando rendija abierta entre 1.40m y 1.65m (altura de los ojos)
  W.prop('metal').box(x + 0.46, y + 1.95, z, 0.05, 0.5, 0.8);

  // Rejilla/rendija decorativa
  W.prop('rust').box(x + 0.46, y + 1.38, z, 0.04, 0.03, 0.6);
  W.prop('rust').box(x + 0.46, y + 1.68, z, 0.04, 0.03, 0.6);
}

export const loadChapter1 = buildChapter1;
export default buildChapter1;
