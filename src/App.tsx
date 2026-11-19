import React, { useEffect, useRef, useState } from 'react';
import * as EngineModule from './game/engine';
import { MainMenu } from './ui/Menus';

// Soporte universal para importación de GameEngine
const GameClass =
  (EngineModule as any).GameEngine ||
  (EngineModule as any).Engine ||
  (EngineModule as any).Game ||
  (EngineModule as any).default;

type Phase = 'menu' | 'playing' | 'dead';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<any>(null);

  const [phase, setPhase] = useState<Phase>('menu');
  const [hasSave, setHasSave] = useState<boolean>(() => {
    return !!localStorage.getItem('abismo_save');
  });
  const [saveInfo, setSaveInfo] = useState<string>('Capítulo 1 - Inicio');

  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      const eng = new GameClass(canvasRef.current, {
        onDeath: () => setPhase('dead'),
        onSave: (info: string) => {
          setHasSave(true);
          setSaveInfo(info);
        }
      });
      engineRef.current = eng;
    } catch (err) {
      console.error('Error al inicializar el motor:', err);
    }

    return () => {
      if (engineRef.current?.destroy) {
        engineRef.current.destroy();
      }
    };
  }, []);

  const startGame = (chapter = 1, isContinue = false) => {
    setPhase('playing');
    if (!engineRef.current) return;

    if (isContinue && typeof engineRef.current.loadSave === 'function') {
      engineRef.current.loadSave();
    } else if (typeof engineRef.current.loadChapter === 'function') {
      engineRef.current.loadChapter(chapter);
    }

    if (typeof engineRef.current.start === 'function') {
      engineRef.current.start();
    }
    if (typeof engineRef.current.requestLock === 'function') {
      try {
        engineRef.current.requestLock();
      } catch (_) {}
    }
  };

  const handleRestart = () => {
    setPhase('playing');
    if (engineRef.current) {
      if (typeof engineRef.current.restart === 'function') {
        engineRef.current.restart();
      }
      if (typeof engineRef.current.requestLock === 'function') {
        try {
          engineRef.current.requestLock();
        } catch (_) {}
      }
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000' }}>
      {/* Canvas principal del juego */}
      <canvas
        ref={canvasRef}
        onClick={() => {
          if (phase === 'playing' && engineRef.current?.requestLock) {
            try {
              engineRef.current.requestLock();
            } catch (_) {}
          }
        }}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          outline: 'none',
          cursor: phase === 'playing' ? 'crosshair' : 'default'
        }}
      />

      {/* Menú Principal */}
      {phase === 'menu' && (
        <MainMenu
          onNew={() => startGame(1, false)}
          onContinue={() => startGame(1, true)}
          hasSave={hasSave}
          saveInfo={saveInfo}
          onChapters={() => startGame(1, false)}
        />
      )}

      {/* Pantalla de Muerte */}
      {phase === 'dead' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'rgba(10, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontFamily: 'monospace'
        }}>
          <h1 style={{ color: '#ff3333', fontSize: '2rem', letterSpacing: '4px', marginBottom: '10px' }}>
            SEÑAL BIOMÉTRICA PERDIDA
          </h1>
          <p style={{ color: '#888', marginBottom: '24px' }}>
            No sobreviviste en las profundidades de NEXUS.
          </p>
          <button
            onClick={handleRestart}
            style={{
              padding: '12px 28px',
              background: '#151515',
              border: '1px solid #ff3333',
              color: '#fff',
              fontFamily: 'monospace',
              fontSize: '13px',
              letterSpacing: '2px',
              cursor: 'pointer'
            }}
          >
            REINTENTAR
          </button>
        </div>
      )}
    </div>
  );
}
