import { useState, type ReactNode } from 'react';
import type { Settings } from '../game/data';

// --- UTILIDAD REQUERIDA POR HUD.TSX (Evita error de compilación) ---
export function fmtTime(sec: number): string {
  if (typeof sec !== 'number' || isNaN(sec)) return '00:00';
  let s = Math.max(0, Math.floor(sec));
  if (s > 100000) s = Math.floor(s / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

export function fmtScore(n: number): string {
  return (n || 0).toLocaleString('es-ES');
}

// --- FONDO ORIGINAL DEL MENÚ ---
export function MenuBackdrop() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-gradient-to-b from-[#030712] via-[#051124] to-[#01040a]">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-cyan-500/25 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}

// --- MENÚ PRINCIPAL (Alineado a la izquierda como el original) ---
export interface MainMenuProps {
  hasSave: boolean;
  saveInfo?: string;
  alias?: string;
  setAlias?: (a: string) => void;
  onNew: () => void;
  onContinue: () => void;
  onChapters: () => void;
  onSettings: () => void;
  onCredits: () => void;
  onScores: () => void;
  onExit: () => void;
}

export function MainMenu({
  hasSave,
  saveInfo,
  alias = 'OPERARIO',
  setAlias,
  onNew,
  onContinue,
  onChapters,
  onSettings,
  onCredits,
  onScores,
  onExit
}: MainMenuProps) {
  const [editing, setEditing] = useState(false);

  const btnClass = "w-full max-w-[340px] text-left px-5 py-3 rounded transition-all duration-150 border font-mono tracking-wider flex flex-col justify-center my-1";

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-center pl-8 md:pl-20 max-w-xl select-none">
      {/* TÍTULO ORIGINAL */}
      <div className="mb-6">
        <h1 className="text-4xl md:text-5xl font-bold tracking-[0.25em] text-white drop-shadow-[0_0_20px_rgba(0,255,204,0.35)] font-mono">
          PROYECTO ABISMO
        </h1>
        <p className="text-xs tracking-[0.3em] text-cyan-400 font-mono mt-2">
          ESTACIÓN SUBMARINA NEXUS // -8,000M
        </p>

        {/* SUJETO / OPERARIO */}
        {setAlias && (
          <div className="mt-3 text-xs text-slate-400 font-mono flex items-center gap-2">
            <span>OPERARIO //</span>
            {editing ? (
              <input
                type="text"
                maxLength={16}
                defaultValue={alias}
                autoFocus
                onBlur={(e) => {
                  setAlias(e.target.value.trim() || 'OPERARIO');
                  setEditing(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setAlias((e.target as HTMLInputElement).value.trim() || 'OPERARIO');
                    setEditing(false);
                  }
                }}
                className="bg-black/80 border border-cyan-400 text-cyan-300 px-2 py-0.5 text-xs outline-none"
              />
            ) : (
              <span
                onClick={() => setEditing(true)}
                className="text-cyan-300 hover:text-white cursor-pointer underline underline-offset-2"
                title="Clic para editar"
              >
                {alias} ✎
              </span>
            )}
          </div>
        )}
      </div>

      {/* BOTONES DE ACCIÓN */}
      <div className="flex flex-col">
        {/* Nueva Partida */}
        <button
          type="button"
          onClick={onNew}
          className={`${btnClass} bg-slate-900/80 hover:bg-cyan-500/15 border-cyan-500/30 hover:border-cyan-400 text-slate-100 hover:text-white`}
        >
          <span className="text-sm font-semibold">NUEVA PARTIDA</span>
        </button>

        {/* Continuar */}
        <button
          type="button"
          disabled={!hasSave}
          onClick={hasSave ? onContinue : undefined}
          className={`${btnClass} ${
            hasSave
              ? 'bg-slate-900/80 hover:bg-cyan-500/15 border-cyan-500/30 hover:border-cyan-400 text-slate-100'
              : 'bg-black/30 border-white/5 text-slate-600 cursor-not-allowed'
          }`}
        >
          <span className="text-sm font-semibold">CONTINUAR</span>
          {hasSave && (
            <span className="text-[10px] text-cyan-400 tracking-normal mt-0.5">
              {saveInfo || 'Punto de control guardado'}
            </span>
          )}
        </button>

        {/* Multijugador (Bloqueado) */}
        <button
          type="button"
          disabled
          className={`${btnClass} bg-black/40 border-white/5 opacity-60 cursor-not-allowed`}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-500">MULTIJUGADOR</span>
            <span className="text-xs">🔒</span>
          </div>
          <span className="text-[10px] text-rose-500 tracking-normal mt-0.5">
            Servidores NEXUS fuera de línea
          </span>
        </button>

        {/* Seleccionar Capítulo */}
        <button
          type="button"
          onClick={onChapters}
          className={`${btnClass} bg-slate-900/80 hover:bg-cyan-500/15 border-cyan-500/30 hover:border-cyan-400 text-slate-100`}
        >
          <span className="text-sm font-semibold">SELECCIONAR CAPÍTULO</span>
        </button>

        {/* Ajustes */}
        <button
          type="button"
          onClick={onSettings}
          className={`${btnClass} bg-slate-900/80 hover:bg-cyan-500/15 border-cyan-500/30 hover:border-cyan-400 text-slate-100`}
        >
          <span className="text-sm font-semibold">AJUSTES</span>
        </button>

        {/* Puntuaciones */}
        <button
          type="button"
          onClick={onScores}
          className={`${btnClass} bg-slate-900/80 hover:bg-cyan-500/15 border-cyan-500/30 hover:border-cyan-400 text-slate-100`}
        >
          <span className="text-sm font-semibold">PUNTUACIONES</span>
        </button>

        {/* Créditos */}
        <button
          type="button"
          onClick={onCredits}
          className={`${btnClass} bg-slate-900/80 hover:bg-cyan-500/15 border-cyan-500/30 hover:border-cyan-400 text-slate-100`}
        >
          <span className="text-sm font-semibold">CRÉDITOS</span>
        </button>

        {/* Salir */}
        <button
          type="button"
          onClick={onExit}
          className={`${btnClass} bg-slate-900/80 hover:bg-red-500/15 border-white/10 hover:border-rose-400 text-slate-400 hover:text-white`}
        >
          <span className="text-sm font-semibold">SALIR</span>
        </button>
      </div>
    </div>
  );
}

// --- SUBPANEL: SELECCIONAR CAPÍTULO ---
export function ChapterSelect({ onClose, onPlay }: { onClose: () => void; onPlay: (n: number) => void }) {
  return (
    <Modal title="SELECCIÓN DE CAPÍTULO" onClose={onClose}>
      <div className="flex flex-col gap-3 mt-4">
        <button
          type="button"
          onClick={() => onPlay(1)}
          className="text-left p-3 rounded bg-slate-900/90 border border-cyan-500/40 hover:border-cyan-400 transition"
        >
          <div className="text-cyan-300 font-bold text-sm">CAPÍTULO 1: LA ENTRADA</div>
          <div className="text-slate-400 text-xs mt-1">
            Compuerta exterior NEXUS B-01 tras el descenso.
          </div>
        </button>
        <button
          type="button"
          disabled
          className="text-left p-3 rounded bg-black/40 border border-white/5 opacity-50 cursor-not-allowed"
        >
          <div className="text-slate-500 font-bold text-sm">CAPÍTULO 2: SECTOR SUMERGIDO 🔒</div>
          <div className="text-slate-600 text-xs mt-1">Completa el capítulo anterior para desbloquear.</div>
        </button>
      </div>
    </Modal>
  );
}

// --- SUBPANEL: AJUSTES ---
export function SettingsPanel({ s, onChange, onClose }: { s: Settings; onChange: (s: Settings) => void; onClose: () => void }) {
  return (
    <Modal title="AJUSTES DEL SISTEMA" onClose={onClose}>
      <div className="flex flex-col gap-4 mt-4 font-mono text-xs">
        <Slider label="Master" value={s.master ?? 0.8} onChange={(v) => onChange({ ...s, master: v })} />
        <Slider label="Música" value={s.music ?? 0.7} onChange={(v) => onChange({ ...s, music: v })} />
        <Slider label="Efectos (SFX)" value={s.sfx ?? 0.8} onChange={(v) => onChange({ ...s, sfx: v })} />
        <Slider label="Ambiente" value={s.ambience ?? 0.75} onChange={(v) => onChange({ ...s, ambience: v })} />
      </div>
    </Modal>
  );
}

// --- SUBPANEL: PUNTUACIONES ---
export function Scores({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="REGISTRO DE INMERSIONES" onClose={onClose}>
      <div className="py-8 text-center text-slate-500 font-mono text-xs">
        Sin inmersiones registradas en la memoria local.
      </div>
    </Modal>
  );
}

// --- SUBPANEL: CRÉDITOS ---
export function Credits({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="CRÉDITOS" onClose={onClose}>
      <div className="mt-4 font-mono text-xs text-slate-300 leading-relaxed space-y-2">
        <p className="text-cyan-400 font-bold">PROYECTO ABISMO</p>
        <p>Experiencia de terror subacuático y supervivencia sci-fi en la Fosa de las Marianas.</p>
        <p className="text-slate-500 text-[11px] pt-2">Cloudflare Pages Edition</p>
      </div>
    </Modal>
  );
}

// --- SUBPANEL: SALIDA ---
export function Farewell({ onBack }: { onBack: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black font-mono text-white p-6">
      <h2 className="text-2xl font-bold tracking-widest text-cyan-400">SESIÓN CERRADA</h2>
      <p className="text-slate-500 text-xs mt-2 mb-6">Puedes cerrar esta ventana de forma segura.</p>
      <button
        type="button"
        onClick={onBack}
        className="px-6 py-2 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 text-xs tracking-wider"
      >
        VOLVER AL MENÚ
      </button>
    </div>
  );
}

// Componentes modales auxiliares
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-950 border border-slate-800 p-6 rounded shadow-2xl font-mono">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white tracking-widest">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white text-lg">✕</button>
        </div>
        {children}
        <div className="mt-6 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-slate-300 bg-slate-900 border border-slate-700 hover:border-cyan-400"
          >
            VOLVER
          </button>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-slate-400 mb-1">
        <span>{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-cyan-400 cursor-pointer"
      />
    </div>
  );
}
