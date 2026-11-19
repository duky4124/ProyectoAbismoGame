// Datos estáticos: objetos, recetas, documentos, capítulos y ajustes
export type ItemCat = 'herramienta' | 'medicina' | 'comida' | 'batería' | 'tarjeta' | 'material';

export interface ItemDef {
  id: string;
  name: string;
  cat: ItemCat;
  icon: string;
  desc: string;
  color: number;
  stack: number;
  usable?: boolean;
  useLabel?: string;
}

export const ITEMS: Record<string, ItemDef> = {
  pipe: { id: 'pipe', name: 'Tubo metálico', cat: 'material', icon: '🔩', desc: 'Un tubo de acero retorcido del chasis. Sirve como palanca.', color: 0x8a8f96, stack: 2 },
  tape: { id: 'tape', name: 'Cinta americana', cat: 'material', icon: '🧻', desc: 'Medio rollo de cinta plateada. Une casi cualquier cosa.', color: 0xb9bcc2, stack: 2 },
  can: { id: 'can', name: 'Lata vacía', cat: 'material', icon: '🥫', desc: 'Una lata vacía. Hace ruido si la golpeas.', color: 0x9aa3a8, stack: 3 },
  wire: { id: 'wire', name: 'Cable pelado', cat: 'material', icon: '🧵', desc: 'Cable de cobre. Útil para circuitos y trampas sonoras.', color: 0xc77b2e, stack: 4 },
  alcohol: { id: 'alcohol', name: 'Alcohol', cat: 'material', icon: '🧴', desc: 'Antiséptico de laboratorio.', color: 0x8fd3e8, stack: 2 },
  fuse_burnt: { id: 'fuse_burnt', name: 'Fusible quemado', cat: 'material', icon: '🔌', desc: 'Un fusible industrial ennegrecido. Podría repararse con cable.', color: 0x2c2a28, stack: 1 },
  fuse: { id: 'fuse', name: 'Fusible reparado', cat: 'herramienta', icon: '⚡', desc: 'Fusible puenteado con cable. Encaja en la caja de fusibles de la esclusa.', color: 0xffc247, stack: 1 },
  crowbar: { id: 'crowbar', name: 'Palanca improvisada', cat: 'herramienta', icon: '🪛', desc: 'Tubo reforzado con cinta. Permite forzar puertas atascadas.', color: 0x6f7780, stack: 1 },
  noisemaker: { id: 'noisemaker', name: 'Distractor sonoro', cat: 'herramienta', icon: '🔔', desc: 'Lata con cable y alarma. Lánzalo (G) para atraer a las criaturas.', color: 0xff8a3d, stack: 3, usable: true, useLabel: 'Lanzar' },
  glowstick: { id: 'glowstick', name: 'Barra luminosa', cat: 'herramienta', icon: '🟢', desc: 'Luz química verde. Ilumina una zona durante dos minutos.', color: 0x6dff8a, stack: 3, usable: true, useLabel: 'Activar' },
  battery: { id: 'battery', name: 'Batería', cat: 'batería', icon: '🔋', desc: 'Pila de litio. Recarga un 55 % la linterna.', color: 0x4ade80, stack: 3, usable: true, useLabel: 'Recargar' },
  medkit: { id: 'medkit', name: 'Botiquín', cat: 'medicina', icon: '🩹', desc: 'Botiquín completo. Recupera 60 de vida.', color: 0xef4444, stack: 2, usable: true, useLabel: 'Usar' },
  bandage: { id: 'bandage', name: 'Vendas', cat: 'medicina', icon: '🩺', desc: 'Vendas limpias. Recuperan 20 de vida.', color: 0xf5f5f4, stack: 3, usable: true, useLabel: 'Usar' },
  medkit_improv: { id: 'medkit_improv', name: 'Botiquín improvisado', cat: 'medicina', icon: '💊', desc: 'Vendas y alcohol. Recupera 45 de vida.', color: 0xf97316, stack: 2, usable: true, useLabel: 'Usar' },
  water: { id: 'water', name: 'Agua embotellada', cat: 'comida', icon: '💧', desc: 'Botella de agua. Reduce la sed.', color: 0x60a5fa, stack: 3, usable: true, useLabel: 'Beber' },
  ration: { id: 'ration', name: 'Ración de emergencia', cat: 'comida', icon: '🍫', desc: 'Barrita calórica. Reduce el hambre.', color: 0xa16207, stack: 3, usable: true, useLabel: 'Comer' },
  canned: { id: 'canned', name: 'Conserva', cat: 'comida', icon: '🥫', desc: 'Judías en lata, caducadas hace años. Saben igual.', color: 0xb45309, stack: 3, usable: true, useLabel: 'Comer' },
  keycard_blue: { id: 'keycard_blue', name: 'Tarjeta azul (Nivel 2)', cat: 'tarjeta', icon: '💳', desc: 'Tarjeta de seguridad NEXUS. Abre puertas de Nivel 2.', color: 0x3b82f6, stack: 1 },
};

export interface Recipe {
  id: string;
  name: string;
  needs: Record<string, number>;
  gives: string;
  desc: string;
}

export const RECIPES: Recipe[] = [
  { id: 'r_crowbar', name: 'Palanca improvisada', needs: { pipe: 1, tape: 1 }, gives: 'crowbar', desc: 'Para forzar puertas atascadas.' },
  { id: 'r_noise', name: 'Distractor sonoro', needs: { can: 1, wire: 1 }, gives: 'noisemaker', desc: 'Atrae a las criaturas hacia otro punto.' },
  { id: 'r_fuse', name: 'Fusible reparado', needs: { fuse_burnt: 1, wire: 1 }, gives: 'fuse', desc: 'Repara el mecanismo de la esclusa.' },
  { id: 'r_medkit', name: 'Botiquín improvisado', needs: { bandage: 1, alcohol: 1 }, gives: 'medkit_improv', desc: 'Cura 45 de vida.' },
];

export interface DocDef {
  id: string;
  title: string;
  kind: 'documento' | 'audio' | 'nota';
  author?: string;
  body: string;
  secret?: boolean;
}

export const DOCS: Record<string, DocDef> = {
  d_manifest: {
    id: 'd_manifest', title: 'Orden de misión 7-A', kind: 'documento', author: 'Despacho de Rescate NEXUS-Externo',
    body: 'OPERARIO: D. ORTEGA, Dan.\nDESTINO: Instalación ABISMO — Nivel -8.000 m.\n\nObjetivo: localizar al personal científico tras la pérdida de contacto (día 41). Se sospecha fallo de ventilación.\n\nNOTA: No se facilita información sobre la naturaleza de la investigación. No usar el canal abierto de radio salvo emergencia.\n\n— Aprobado por: Dr. A. Voss (Dirección Científica)',
  },
  d_memo: {
    id: 'd_memo', title: 'Memo: cambio de claves', kind: 'nota', author: 'Seguridad — T. Reyes',
    body: 'A TODO EL PERSONAL DE OFICINAS:\n\nEl código de la sala de Seguridad se ha cambiado. Por motivos de "facilidad", la Dra. Voss ha pedido usar la fecha de cumpleaños de su hija (día y mes, cuatro dígitos, sin guiones).\n\nNo lo apuntéis en ningún sitio.\n\n(Alguien ha escrito debajo: «Ya lo sabe toda la planta».)',
  },
  d_calendar: {
    id: 'd_calendar', title: 'Calendario de escritorio', kind: 'nota', author: 'Oficina de Dirección',
    body: 'MARZO 2049\n\nUn día aparece rodeado en rojo con rotulador: «14 — ¡CUMPLE DE IRIS! 🎂 No olvidar la tarta».\n\nEn la esquina de la hoja hay un dibujo infantil: una niña de la mano de una figura muy alta y sin cara.',
  },
  d_incident: {
    id: 'd_incident', title: 'Informe de incidente 0412', kind: 'documento', author: 'T. Reyes — Jefe de Seguridad',
    body: 'Día 38. Contención del Sector Lab comprometida.\n\nEl sujeto catalogado como «OBSERVADOR» ha sido visto fuera de la cámara. No responde a estímulos sonoros. Solo parece reaccionar cuando se le mira… o cuando se le oye.\n\nORDEN INTERNA: si ves una figura alta en el pasillo, NO corras en línea recta. Escóndete ANTES de que te vea. Si te ve esconderte, no tendrás otra oportunidad.\n\nEl ascensor de servicio solo funciona con el fusible principal de la esclusa 3.',
  },
  d_audio1: {
    id: 'd_audio1', title: 'Grabación de audio #031', kind: 'audio', author: 'Dra. Elena Voss',
    body: '«…Registro treinta y uno. Los sujetos de la primera cohorte han… mejorado. Todos recuerdan lo que les hemos dicho que recuerden. Dirección quiere acelerar el protocolo ECO. Yo… yo ya no estoy segura de que debamos seguir. Si alguien escucha esto: la mitad de la planta cree que esto es una investigación médica. No lo es.»',
  },
  d_supply: {
    id: 'd_supply', title: 'Albarán de suministros', kind: 'documento', author: 'Logística',
    body: 'Material enviado a la esclusa 3 / Sector Lab:\n— 1 fusible principal (repuesto en estantería B)\n— Cable de repuesto\n\nObservación: el fusible llegó dañado. Se recomienda puentear con cable de cobre si no hay repuesto.',
  },
  d_secret: {
    id: 'd_secret', title: 'Expediente 0-ECO / «ORTEGA, D.»', kind: 'documento', author: 'Protocolo ECO — CONFIDENCIAL', secret: true,
    body: 'SUJETO: 0-ECO\nNOMBRE ASIGNADO: Daniel Ortega\nESTADO: Reintegración exterior completada — 3 ciclos.\n\nLos recuerdos de vida previa han sido sustituidos. El sujeto cree ser trabajador de rescate externo. Se activará mediante orden de misión 7-A cuando sea necesario.\n\nPOSIBLES FALLOS: déjà vu, reconocimiento de lugares, resonancia con las criaturas.\n\n(Tachado a mano: «Perdónanos, Dan.»)',
  },
  d_secret_audio: {
    id: 'd_secret_audio', title: 'Grabación oculta #0', kind: 'audio', author: 'Voz desconocida', secret: true,
    body: '«Si estás escuchando esto, ya has vuelto aquí. Otra vez. No confíes en la orden que te trajo. Busca el expediente. Busca tu nombre… el de verdad. Y no mires a los ojos de la figura alta: te reconoce.»',
  },
};

export interface ChapterDef {
  n: number;
  title: string;
  zone: string;
  summary: string;
  playable: boolean;
}

export const CHAPTERS: ChapterDef[] = [
  { n: 1, title: 'EL ACCIDENTE', zone: 'Hangar de llegada', summary: 'Tu vehículo se estrella a 8.000 m de profundidad. Aprende a sobrevivir y encuentra la salida del sector.', playable: true },
  { n: 2, title: 'LA INSTALACIÓN', zone: 'Laboratorios exteriores', summary: 'Explora los primeros laboratorios y descubre qué hacía NEXUS.', playable: false },
  { n: 3, title: 'EL PRIMER CONTACTO', zone: 'Pasillos de servicio', summary: 'Algo alto te observa desde el fondo del pasillo.', playable: false },
  { n: 4, title: 'EL LABORATORIO PRINCIPAL', zone: 'Laboratorio principal', summary: 'Acertijos y documentos secretos.', playable: false },
  { n: 5, title: 'LA CAZA', zone: 'Túneles subterráneos', summary: 'Escapa del Rastreador.', playable: false },
  { n: 6, title: 'AGUAS NEGRAS', zone: 'Central eléctrica', summary: 'Restaura la electricidad en la zona inundada.', playable: false },
  { n: 7, title: 'EL HOSPITAL', zone: 'Hospital secreto', summary: 'Experimentos con seres humanos.', playable: false },
  { n: 8, title: 'ORIGEN', zone: 'Archivo profundo', summary: 'El verdadero origen de las criaturas.', playable: false },
  { n: 9, title: 'EXPERIMENTO 09', zone: 'La Gran Caverna', summary: 'Supervivencia contra la criatura principal.', playable: false },
  { n: 10, title: 'EL ÚLTIMO ASCENSO', zone: 'Superficie', summary: 'Decisiones finales. Tres finales posibles.', playable: false },
];

export interface Settings {
  master: number; music: number; sfx: number; ambience: number;
  quality: 'bajo' | 'medio' | 'alto';
  fov: number; sensitivity: number; invertY: boolean; brightness: number;
  subtitles: boolean; subSize: 'normal' | 'grande' | 'enorme';
  shake: number; reduceFlash: boolean; toggleRun: boolean; toggleCrouch: boolean;
  pauseInv: boolean; showHints: boolean; touch: 'auto' | 'on' | 'off'; alias: string;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8, music: 0.7, sfx: 0.9, ambience: 0.8,
  quality: 'medio', fov: 75, sensitivity: 1, invertY: false, brightness: 0.5,
  subtitles: true, subSize: 'normal', shake: 1, reduceFlash: false, toggleRun: false, toggleCrouch: true,
  pauseInv: true, showHints: true, touch: 'auto', alias: 'OPERARIO',
};

export interface SaveData {
  v: 1;
  chapter: number;
  point: string;
  when: number;
  px: number; pz: number; yaw: number;
  health: number; stamina: number; hunger: number; thirst: number; battery: number;
  hasLight: boolean;
  inv: { id: string; qty: number }[];
  flags: string[];
  collected: string[];
  doors: Record<string, { open: boolean; locked: boolean }>;
  docs: string[];
  score: number; time: number; deaths: number;
}

export interface ScoreEntry { alias: string; score: number; chapter: number; time: number; result: 'completo' | 'caído'; date: number }

const K_SET = 'abismo.settings.v1';
const K_SAVE = 'abismo.save.v1';
const K_HS = 'abismo.scores.v1';
const K_PROG = 'abismo.progress.v1';

function read<T>(k: string, d: T): T {
  try { const s = localStorage.getItem(k); return s ? { ...(typeof d === 'object' && !Array.isArray(d) ? d : {}), ...JSON.parse(s) } as T : d; } catch { return d; }
}
export const loadSettings = (): Settings => read(K_SET, DEFAULT_SETTINGS);
export const saveSettings = (s: Settings) => { try { localStorage.setItem(K_SET, JSON.stringify(s)); } catch { /* */ } };
export const loadSave = (): SaveData | null => { try { const s = localStorage.getItem(K_SAVE); return s ? (JSON.parse(s) as SaveData) : null; } catch { return null; } };
export const writeSave = (d: SaveData) => { try { localStorage.setItem(K_SAVE, JSON.stringify(d)); } catch { /* */ } };
export const clearSave = () => { try { localStorage.removeItem(K_SAVE); } catch { /* */ } };
export const loadScores = (): ScoreEntry[] => { try { const s = localStorage.getItem(K_HS); return s ? (JSON.parse(s) as ScoreEntry[]) : []; } catch { return []; } };
export function addScore(e: ScoreEntry): { rank: number; list: ScoreEntry[] } {
  const list = [...loadScores(), e].sort((a, b) => b.score - a.score).slice(0, 10);
  try { localStorage.setItem(K_HS, JSON.stringify(list)); } catch { /* */ }
  return { rank: list.findIndex((x) => x === e || (x.date === e.date && x.score === e.score)) + 1, list };
}
export const loadProgress = (): { best: Record<string, number>; ending: string[] } => { try { const s = localStorage.getItem(K_PROG); return s ? JSON.parse(s) : { best: {}, ending: [] }; } catch { return { best: {}, ending: [] }; } };
export const writeProgress = (p: { best: Record<string, number>; ending: string[] }) => { try { localStorage.setItem(K_PROG, JSON.stringify(p)); } catch { /* */ } };
