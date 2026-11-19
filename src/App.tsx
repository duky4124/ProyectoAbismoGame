import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as EngineModule from './game/engine';
import { MainMenu } from './ui/Menus';

// Compatibilidad con cualquier tipo de export en engine.ts
const GameClass = (EngineModule as any).GameEngine || (EngineModule as any).Engine || (EngineModule as any).Game || (EngineModule as any).default;

type GamePhase = 'menu' | 'cutscene' | 'awakening' | 'playing' | 'dead' | 'paused';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<any>(null);

  const [phase, setPhase] = useState<GamePhase>('menu');
  const [hasSave, setHasSave] = useState<boolean>(() => {
    return !!localStorage.getItem('abismo_save_slot');
  });
  const [saveInfo, setSaveInfo] = useState<string>('Capítulo 1 - Inicio');

  // Inicializar motor 3D
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
    } catch (e) {
      console.error('Error al inicializar el motor:', e);
    }

    return () => {
      if (engineRef.current?.destroy) {
        engineRef.current.destroy();
      }
    };
  }, []);

  // Iniciar nueva partida -> Lanza la cinemática
  const handleNewGame = () => {
    setPhase('cutscene');
  };

  // Continuar partida guardada
  const handleContinue = () => {
    if (engineRef.current) {
      engineRef.current.loadSave?.();
      setPhase('awakening');
    }
  };

  // Terminar cinemática -> Pasa al estado de DESPERTAR (desmontando la cinemática)
  const finishCutscene = useCallback(() => {
    if (engineRef.current) {
      try {
        engineRef.current.loadChapter?.(1);
      } catch (e) {
        console.warn('loadChapter warn:', e);
      }
    }
    setPhase('awakening');
  }, []);

  // Despertar: Clic o Tecla desbloquea la pantalla e inicia el juego
  const handleWakeUp = useCallback(() => {
    setPhase('playing');
    if (engineRef.current) {
      try {
        engineRef.current.requestLock?.();
      } catch (err) {
        console.warn('Pointer lock request catch:', err);
      }
      try {
        engineRef.current.start?.();
      } catch (err) {
        console.warn('Engine start catch:', err);
      }
    }
  }, []);

  // Escuchar cualquier clic o tecla durante el estado de despertar
  useEffect(() => {
    if (phase !== 'awakening') return;

    const onKey = () => handleWakeUp();
    const onClick = () => handleWakeUp();

    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick);
    };
  }, [phase, handleWakeUp]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#000', userSelect: 'none' }}>
      
      {/* Canvas 3D de fondo siempre presente */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          outline: 'none'
        }}
      />

      {/* 1. MENÚ PRINCIPAL */}
      {phase === 'menu' && (
        <MainMenu
          onNew={handleNewGame}
          onContinue={handleContinue}
          hasSave={hasSave}
          saveInfo={saveInfo}
          onChapters={() => {}}
          onSettings={() => {}}
        />
      )}

      {/* 2. CINEMÁTICA DE ACCIDENTE */}
      {phase === 'cutscene' && (
        <IntroCutscene onComplete={finishCutscene} />
      )}

      {/* 3. PANTALLA DE DESPERTAR (Limpia y con detección de clic garantizada) */}
      {phase === 'awakening' && (
        <div
          onClick={handleWakeUp}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: '#000',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontFamily: 'monospace',
            textAlign: 'center',
            padding: '20px'
          }}
        >
          <div style={{
            color: '#e24444',
            fontSize: '15px',
            letterSpacing: '3px',
            marginBottom: '20px',
            textTransform: 'uppercase'
          }}>
            SEÑAL BIOMÉTRICA DÉBIL · SUJETO INCONSCIENTE
          </div>

          <div style={{
            color: '#8899aa',
            fontSize: '14px',
            lineHeight: '1.8',
            maxWidth: '520px',
            marginBottom: '45px'
          }}>
            El impacto destrozó la compuerta NEXUS B-01.<br />
            La cabina del transporte está inundada de humo frío y chispas...
          </div>

          <div style={{
            color: '#22d3ee',
            fontSize: '14px',
            letterSpacing: '2px',
            animation: 'pulse 1.8s infinite'
          }}>
            [ HAZ CLIC O PRESIONA CUALQUIER TECLA PARA DESPERTAR ]
          </div>

          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 0.3; transform: scale(0.99); }
              50% { opacity: 1; transform: scale(1.01); }
            }
          `}</style>
        </div>
      )}

      {/* 4. PANTALLA DE MUERTE */}
      {phase === 'dead' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'rgba(20,0,0,0.92)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          color: '#fff'
        }}>
          <h1 style={{ color: '#ff2222', letterSpacing: '4px', fontSize: '2rem' }}>SEÑAL VITAL PERDIDA</h1>
          <p style={{ color: '#888', marginBottom: '30px' }}>Tu cuerpo descansa en el abismo de la fosa.</p>
          <button
            onClick={() => {
              if (engineRef.current?.restart) engineRef.current.restart();
              setPhase('awakening');
            }}
            style={{
              padding: '12px 24px',
              background: '#222',
              color: '#fff',
              border: '1px solid #ff3333',
              cursor: 'pointer',
              fontFamily: 'monospace'
            }}
          >
            REINTENTAR
          </button>
        </div>
      )}
    </div>
  );
}

// Subcomponente de Cinemática
function IntroCutscene({ onComplete }: { onComplete: () => void }) {
  const [message, setMessage] = useState('INICIANDO DESCENSO A LA FOSA DE LAS MARIANAS...');
  const [telemetry, setTelemetry] = useState('-7,850 METROS · PRESIÓN EXTERIOR: 79.5 MPa');

  useEffect(() => {
    // Escuchar ESC / Espacio / Enter para saltar
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        onComplete();
      }
    };
    window.addEventListener('keydown', handleKey);

    // Audio sintetizado
    let ctx: AudioContext | null = null;
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (_) {}

    const playBeep = (freq: number, type: OscillatorType = 'sine', duration = 0.2) => {
      if (!ctx || ctx.state === 'suspended') return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (_) {}
    };

    const timers = [
      setTimeout(() => {
        setMessage('ALERTA: FALLO EN VÁLVULA DE RETROPROPULSIÓN HIDRÁULICA');
        setTelemetry('-8,020 METROS · VELOCIDAD DE DESCENSO CRÍTICA');
        playBeep(350, 'sawtooth', 0.4);
      }, 2200),

      setTimeout(() => {
        setMessage('PROXIMIDAD: ESTRUCTURA ARTIFICIAL NO IDENTIFICADA');
        setTelemetry('COMPUERTA EXTERIOR NEXUS B-01 DETECTADA');
        playBeep(450, 'square', 0.3);
      }, 4400),

      setTimeout(() => {
        setMessage('¡¡¡ IMPACTO INMINENTE - SISTEMAS DE FRENO FUERA DE LÍNEA !!!');
        setTelemetry('IMPACTO EN 3... 2... 1...');
        playBeep(700, 'sawtooth', 0.5);
      }, 6200),

      setTimeout(() => {
        playBeep(80, 'square', 1.2); // Ruido de colisión
        onComplete();
      }, 8200)
    ];

    return () => {
      window.removeEventListener('keydown', handleKey);
      timers.forEach(clearTimeout);
      if (ctx && ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }
    };
  }, [onComplete]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99990,
      background: '#04070a',
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: 'monospace',
      padding: '24px'
    }}>
      {/* Indicador superior */}
      <div style={{ color: '#00ffcc', fontSize: '12px', letterSpacing: '3px', marginBottom: '16px' }}>
        REGISTRO DE VUELO // TRANSPORTE SUBMARINO NEXUS-IV
      </div>

      {/* Mensaje principal */}
      <div style={{
        fontSize: '18px',
        maxWidth: '700px',
        textAlign: 'center',
        color: '#ff4444',
        minHeight: '50px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        letterSpacing: '1px'
      }}>
        {message}
      </div>

      {/* Telemetría */}
      <div style={{ color: '#667788', fontSize: '13px', marginTop: '14px', letterSpacing: '1px' }}>
        {telemetry}
      </div>

      {/* Barra de progreso */}
      <div style={{ width: '280px', height: '2px', background: '#1a2230', marginTop: '30px', overflow: 'hidden' }}>
        <div style={{
          width: '100%',
          height: '100%',
          background: '#00ffcc',
          animation: 'loadProgress 8.2s linear forwards'
        }} />
      </div>

      {/* Botón SALTAR exclusivo de la cinemática */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onComplete();
        }}
        style={{
          position: 'absolute',
          bottom: '24px',
          right: '24px',
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid #334455',
          color: '#8899aa',
          padding: '8px 16px',
          fontSize: '12px',
          fontFamily: 'monospace',
          cursor: 'pointer',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        SALTAR [ESC] ⏭
      </button>

      <style>{`
        @keyframes loadProgress {
          from { transform: translateX(-100%); }
          to { transform: translateX(0%); }
        }
      `}</style>
    </div>
  );
}
