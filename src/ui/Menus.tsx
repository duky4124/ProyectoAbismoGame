import React from 'react';

interface MenuProps {
  onNew: () => void;
  onContinue: () => void;
  onChapters?: () => void;
  onSettings?: () => void;
  hasSave?: boolean;
  saveInfo?: string;
}

export function MainMenu({ onNew, onContinue, onChapters, onSettings, hasSave, saveInfo }: MenuProps) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      background: 'radial-gradient(circle at center, rgba(3, 8, 16, 0.6) 0%, rgba(1, 3, 6, 0.95) 100%)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: "'Courier New', Courier, monospace",
      color: '#fff',
      padding: '20px'
    }}>
      {/* Título */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{
          fontSize: '2.8rem',
          letterSpacing: '8px',
          margin: 0,
          color: '#e2f1ff',
          textShadow: '0 0 20px rgba(0, 255, 204, 0.3)'
        }}>
          PROYECTO ABISMO
        </h1>
        <div style={{
          fontSize: '0.85rem',
          color: '#00ffcc',
          letterSpacing: '4px',
          marginTop: '8px'
        }}>
          ESTACIÓN SUBMARINA NEXUS // -8,000M
        </div>
      </div>

      {/* Lista de Botones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '320px' }}>
        
        {/* Nueva Partida */}
        <button
          onClick={onNew}
          style={btnStyle(false)}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, btnHover)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, btnStyle(false))}
        >
          NUEVA PARTIDA
        </button>

        {/* Continuar */}
        <button
          onClick={hasSave ? onContinue : undefined}
          disabled={!hasSave}
          title={hasSave ? saveInfo : 'No hay partida guardada'}
          style={btnStyle(!hasSave)}
          onMouseEnter={(e) => hasSave && Object.assign(e.currentTarget.style, btnHover)}
          onMouseLeave={(e) => hasSave && Object.assign(e.currentTarget.style, btnStyle(false))}
        >
          CONTINUAR
          {hasSave && (
            <span style={{ display: 'block', fontSize: '10px', color: '#00ffcc', marginTop: '2px' }}>
              {saveInfo || 'Punto de control'}
            </span>
          )}
        </button>

        {/* Multijugador (Bloqueado) */}
        <div style={{ position: 'relative' }}>
          <button
            disabled
            style={{
              ...btnStyle(true),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 16px',
              cursor: 'not-allowed',
              opacity: 0.55
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>MULTIJUGADOR</span>
              <span style={{ fontSize: '11px' }}>🔒</span>
            </div>
            <span style={{ fontSize: '9px', color: '#ff6666', marginTop: '3px', letterSpacing: '0.5px' }}>
              Servidores NEXUS fuera de línea
            </span>
          </button>
        </div>

        {/* Seleccionar Capítulo */}
        {onChapters && (
          <button
            onClick={onChapters}
            style={btnStyle(false)}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, btnHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, btnStyle(false))}
          >
            SELECCIONAR CAPÍTULO
          </button>
        )}

        {/* Ajustes */}
        {onSettings && (
          <button
            onClick={onSettings}
            style={btnStyle(false)}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, btnHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, btnStyle(false))}
          >
            AJUSTES
          </button>
        )}
      </div>

      {/* Versión */}
      <div style={{ position: 'absolute', bottom: '16px', color: '#445566', fontSize: '11px', letterSpacing: '1px' }}>
        v1.0.4 · CLOUDFLARE PAGES EDITION
      </div>
    </div>
  );
}

const btnStyle = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? 'rgba(10, 16, 24, 0.4)' : 'rgba(14, 24, 38, 0.8)',
  border: disabled ? '1px solid #1c2838' : '1px solid #2d425c',
  color: disabled ? '#45566a' : '#cce0f5',
  padding: '12px 20px',
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: '13px',
  letterSpacing: '2px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  transition: 'all 0.2s ease',
  outline: 'none',
  width: '100%',
  borderRadius: '2px'
});

const btnHover: React.CSSProperties = {
  background: 'rgba(0, 255, 204, 0.12)',
  borderColor: '#00ffcc',
  color: '#ffffff',
  boxShadow: '0 0 12px rgba(0, 255, 204, 0.2)'
};
