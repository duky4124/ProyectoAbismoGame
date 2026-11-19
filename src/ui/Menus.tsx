import React, { useState } from 'react';

// --- FONDO ANIMADO / AMBIENTAL DEL MENÚ ---
export function MenuBackdrop() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden bg-gradient-to-b from-[#020813] via-[#04101d] to-[#010408]">
      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/20 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}

// --- MENÚ PRINCIPAL ---
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
  const [editingAlias, setEditingAlias] = useState(false);

  const B = (label: string, onClick: () => void, disabled = false, sub?: string) => (
    <button
      key={label}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        background: disabled ? 'rgba(8, 12, 18, 0.45)' : 'rgba(12, 22, 34, 0.75)',
        border: disabled ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 255, 204, 0.25)',
        color: disabled ? '#455668' : '#e0f0ff',
        padding: '11px 18px',
        margin: '5px 0',
        width: '100%',
        maxWidth: '320px',
        fontFamily: 'monospace',
        fontSize: '14px',
        letterSpacing: '1.5px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        borderRadius: '3px',
        textAlign: 'left'
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = '#00ffcc';
          e.currentTarget.style.background = 'rgba(0, 255, 204, 0.12)';
          e.currentTarget.style.color = '#ffffff';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = 'rgba(0, 255, 204, 0.25)';
          e.currentTarget.style.background = 'rgba(12, 22, 34, 0.75)';
          e.currentTarget.style.color = '#e0f0ff';
        }
      }}
    >
      <span style={{ fontWeight: 600 }}>{label}</span>
      {sub && (
        <span style={{ fontSize: '10px', color: disabled ? '#884444' : '#00ffcc', marginTop: '2px' }}>
          {sub}
        </span>
      )}
    </button>
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 40,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      paddingLeft: '8vw',
      fontFamily: 'monospace',
      userSelect: 'none'
    }}>
      {/* Título */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          fontSize: '2.6rem',
          letterSpacing: '6px',
          margin: 0,
          color: '#ffffff',
          fontWeight: 700,
          textShadow: '0 0 15px rgba(0,255,204,0.3)'
        }}>
          PROYECTO ABISMO
        </h1>
        <p style={{
          margin: '6px 0 0 0',
          fontSize: '12px',
          color: '#00ffcc',
          letterSpacing: '3px'
        }}>
          ESTACIÓN SUBMARINA NEXUS // -8,000M
        </p>

        {/* Alias del Operario */}
        {setAlias && (
          <div style={{ marginTop: '14px', fontSize: '12px', color: '#6688aa' }}>
            SUJETO: {' '}
            {editingAlias ? (
              <input
                type="text"
                maxLength={16}
                defaultValue={alias}
                autoFocus
                onBlur={(e) => {
                  setAlias(e.target.value.trim() || 'OPERARIO');
                  setEditingAlias(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setAlias((e.target as any).value.trim() || 'OPERARIO');
                    setEditingAlias(false);
                  }
                }}
                style={{
                  background: '#0a1018',
                  border: '1px solid #00ffcc',
                  color: '#fff',
                  padding: '2px 6px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
            ) : (
              <span
                onClick={() => setEditingAlias(true)}
                style={{ color: '#00ffcc', cursor: 'pointer', textDecoration: 'underline' }}
                title="Haz clic para cambiar nombre"
              >
                {alias} ✎
              </span>
            )}
          </div>
        )}
      </div>

      {/* Lista de botones */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {B('Nueva partida', onNew)}
        {B('Continuar', onContinue, !hasSave, hasSave ? saveInfo : 'Sin partida guardada')}
        {B('Multijugador', () => {}, true, '🔒 Bloqueado · Servidores NEXUS fuera de línea')}
        {B('Seleccionar capítulo', onChapters)}
        {B('Ajustes', onSettings)}
        {B('Puntuaciones', onScores)}
        {B('Créditos', onCredits)}
        {B('Salir', onExit)}
      </div>
    </div>
  );
}

// --- SELECCIONAR CAPÍTULO ---
export function ChapterSelect({ onClose, onPlay }: { onClose: () => void; onPlay: (ch: number) => void }) {
  return (
    <ModalPanel title="SELECCIONAR CAPÍTULO" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
        <button
          onClick={() => onPlay(1)}
          style={panelBtnStyle}
        >
          <div style={{ fontWeight: 'bold', color: '#00ffcc' }}>CAPÍTULO 1: LA ENTRADA</div>
          <div style={{ fontSize: '11px', color: '#8899aa', marginTop: '4px' }}>
            Acceso a la compuerta B-01 tras el colapso del transporte.
          </div>
        </button>

        <button
          disabled
          style={{ ...panelBtnStyle, opacity: 0.5, cursor: 'not-allowed' }}
        >
          <div style={{ fontWeight: 'bold', color: '#667788' }}>CAPÍTULO 2: NIVEL SUMERGIDO 🔒</div>
          <div style={{ fontSize: '11px', color: '#556677', marginTop: '4px' }}>
            Requiere completar el Capítulo 1.
          </div>
        </button>
      </div>
    </ModalPanel>
  );
}

// --- AJUSTES ---
export function SettingsPanel({ s, onChange, onClose }: { s: any; onChange: (s: any) => void; onClose: () => void }) {
  return (
    <ModalPanel title="AJUSTES DEL SISTEMA" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '15px', fontSize: '13px' }}>
        <SettingSlider
          label="Volumen General"
          value={s.master ?? 0.8}
          onChange={(v) => onChange({ ...s, master: v })}
        />
        <SettingSlider
          label="Música"
          value={s.music ?? 0.7}
          onChange={(v) => onChange({ ...s, music: v })}
        />
        <SettingSlider
          label="Efectos de Sonido"
          value={s.sfx ?? 0.8}
          onChange={(v) => onChange({ ...s, sfx: v })}
        />
        <SettingSlider
          label="Ambiente"
          value={s.ambience ?? 0.75}
          onChange={(v) => onChange({ ...s, ambience: v })}
        />
      </div>
    </ModalPanel>
  );
}

// --- PUNTUACIONES ---
export function Scores({ onClose }: { onClose: () => void }) {
  return (
    <ModalPanel title="REGISTRO DE INMERSIONES" onClose={onClose}>
      <div style={{ marginTop: '15px', color: '#8899aa', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
        No hay registros disponibles en el archivo local.
      </div>
    </ModalPanel>
  );
}

// --- CRÉDITOS ---
export function Credits({ onClose }: { onClose: () => void }) {
  return (
    <ModalPanel title="CRÉDITOS" onClose={onClose}>
      <div style={{ marginTop: '15px', fontSize: '13px', lineHeight: '1.8', color: '#ccddee' }}>
        <p><strong style={{ color: '#00ffcc' }}>PROYECTO ABISMO</strong></p>
        <p>Experiencia de terror subacuático y supervivencia sci-fi en la Fosa de las Marianas.</p>
        <p style={{ marginTop: '10px', color: '#778899', fontSize: '11px' }}>
          Desarrollado para Cloudflare Pages Edition.
        </p>
      </div>
    </ModalPanel>
  );
}

// --- SALIDA / DESPEDIDA ---
export function Farewell({ onBack }: { onBack: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: '#020408', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', color: '#fff'
    }}>
      <h2 style={{ color: '#00ffcc', letterSpacing: '3px' }}>SESIÓN CERRADA</h2>
      <p style={{ color: '#667788', margin: '15px 0 25px 0', fontSize: '13px' }}>
        Puedes cerrar esta pestaña del navegador de forma segura.
      </p>
      <button onClick={onBack} style={panelBtnStyle}>VOLVER AL MENÚ</button>
    </div>
  );
}

// Auxiliares de UI
function ModalPanel({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(2, 6, 12, 0.85)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', padding: '20px'
    }}>
      <div style={{
        background: '#060d16', border: '1px solid #1c3048',
        width: '100%', maxWidth: '480px', padding: '24px', borderRadius: '4px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #142436', paddingBottom: '10px' }}>
          <h3 style={{ margin: 0, color: '#e0f0ff', fontSize: '15px', letterSpacing: '2px' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8899aa', fontSize: '18px', cursor: 'pointer' }}>✕</button>
        </div>
        {children}
        <div style={{ marginTop: '24px', textAlign: 'right' }}>
          <button onClick={onClose} style={{ ...panelBtnStyle, width: 'auto', padding: '6px 16px', fontSize: '12px' }}>
            VOLVER
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a0b4c8', marginBottom: '4px' }}>
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
        style={{ width: '100%', accentColor: '#00ffcc', cursor: 'pointer' }}
      />
    </div>
  );
}

const panelBtnStyle: React.CSSProperties = {
  background: 'rgba(12, 22, 34, 0.8)',
  border: '1px solid #1c3048',
  color: '#e0f0ff',
  padding: '10px 14px',
  fontFamily: 'monospace',
  textAlign: 'left',
  cursor: 'pointer',
  borderRadius: '2px',
  width: '100%'
};
