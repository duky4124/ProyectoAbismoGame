import React, { useState } from 'react';

export interface MainMenuProps {
  onNew: () => void;
  onContinue: () => void;
  hasSave?: boolean;
  saveInfo?: string;
  onChapters?: () => void;
  onSettings?: () => void;
}

export function MainMenu(p: MainMenuProps) {
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
        background: disabled ? 'rgba(10, 15, 20, 0.4)' : 'rgba(15, 25, 35, 0.75)',
        border: disabled ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 255, 204, 0.25)',
        color: disabled ? '#556677' : '#e0f0ff',
        padding: '12px 20px',
        margin: '6px 0',
        width: '100%',
        maxWidth: '340px',
        fontSize: '15px',
        letterSpacing: '1.5px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s ease',
        borderRadius: '3px',
        textAlign: 'left'
      }}
    >
      <span style={{ fontWeight: 500 }}>{label}</span>
      {sub && (
        <span style={{ fontSize: '11px', color: disabled ? '#884444' : '#00ffcc', marginTop: '3px' }}>
          {sub}
        </span>
      )}
    </button>
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      paddingLeft: '10vw',
      background: 'linear-gradient(90deg, rgba(2, 6, 12, 0.88) 0%, rgba(2, 6, 12, 0.4) 60%, transparent 100%)'
    }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{
          fontSize: '2.5rem',
          letterSpacing: '6px',
          margin: 0,
          color: '#ffffff',
          fontWeight: 700
        }}>
          PROYECTO ABISMO
        </h1>
        <p style={{
          margin: '6px 0 0 0',
          fontSize: '13px',
          color: '#00ffcc',
          letterSpacing: '3px'
        }}>
          ESTACIÓN SUBMARINA NEXUS · -8,000M
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {B('Nueva partida', p.onNew)}
        {B('Continuar', p.onContinue, !p.hasSave, p.hasSave ? p.saveInfo : 'Sin partida guardada')}
        {B('Multijugador', () => {}, true, '🔒 Bloqueado · Servidores NEXUS fuera de línea')}
        {B('Seleccionar capítulo', p.onChapters || (() => {}))}
        {p.onSettings && B('Ajustes', p.onSettings)}
      </div>
    </div>
  );
}
