import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Game, audio } from './game/engine';
import {
  addScore, clearSave, loadProgress, loadSave, loadSettings, saveSettings, writeProgress, type ScoreEntry, type Settings,
} from './game/data';
import { ChapterSelect, Credits, Farewell, MainMenu, MenuBackdrop, Scores, SettingsPanel } from './ui/Menus';
import { Hud, TouchControls } from './ui/Hud';
import { Choice, Complete, DocModal, GameOver, Inventory, Keypad, PauseMenu } from './ui/Panels';

type Screen = 'menu' | 'chapters' | 'settings' | 'credits' | 'scores' | 'farewell' | 'intro' | 'game';
type Modal = 'none' | 'pause' | 'inventory' | 'doc' | 'keypad' | 'choice';

// ============================================================================
// COMPONENTE: CINEMÁTICA DEL CHOQUE (INTRODUCCIÓN)
// ============================================================================
function IntroCutscene({ onComplete }: { onComplete: () => void }) {
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(130);
  const [depth, setDepth] = useState(7240);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Sintetizador de audio para la cinemática
  useEffect(() => {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      audioCtxRef.current = ctx;

      // 1. Zumbido del motor acelerando
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(60, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 7.5);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 7.2);
      gain.gain.setValueAtTime(0, ctx.currentTime + 7.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      // 2. Alarma de colisión (empieza a los 3.5 segundos)
      for (let i = 0; i < 7; i++) {
        const tStart = ctx.currentTime + 3.8 + i * 0.55;
        const alarmOsc = ctx.createOscillator();
        const alarmGain = ctx.createGain();
        alarmOsc.type = 'square';
        alarmOsc.frequency.setValueAtTime(880, tStart);
        alarmOsc.frequency.setValueAtTime(740, tStart + 0.15);
        alarmGain.gain.setValueAtTime(0.18, tStart);
        alarmGain.gain.exponentialRampToValueAtTime(0.01, tStart + 0.35);
        alarmOsc.connect(alarmGain);
        alarmGain.connect(ctx.destination);
        alarmOsc.start(tStart);
        alarmOsc.stop(tStart + 0.4);
      }

      // 3. Choque explosivo e impacto (a los 7.8 segundos)
      const crashTime = ctx.currentTime + 7.8;
      const bufferSize = ctx.sampleRate * 2.5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.4));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const crashFilter = ctx.createBiquadFilter();
      crashFilter.type = 'lowpass';
      crashFilter.frequency.setValueAtTime(800, crashTime);
      const crashGain = ctx.createGain();
      crashGain.gain.setValueAtTime(0.8, crashTime);
      crashGain.gain.exponentialRampToValueAtTime(0.01, crashTime + 2.0);
      noise.connect(crashFilter);
      crashFilter.connect(crashGain);
      crashGain.connect(ctx.destination);
      noise.start(crashTime);

      // 4. Pitido sordo (Tinnitus post-impacto a los 8.2 segundos)
      const tinOsc = ctx.createOscillator();
      const tinGain = ctx.createGain();
      tinOsc.type = 'sine';
      tinOsc.frequency.setValueAtTime(3200, crashTime + 0.4);
      tinGain.gain.setValueAtTime(0.15, crashTime + 0.4);
      tinGain.gain.exponentialRampToValueAtTime(0.001, crashTime + 4.5);
      tinOsc.connect(tinGain);
      tinGain.connect(ctx.destination);
      tinOsc.start(crashTime + 0.4);
      tinOsc.stop(crashTime + 4.8);
    } catch {
      // Audio fallback si el navegador bloquea autoplay
    }

    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Reloj de la cinemática
  useEffect(() => {
    const start = performance.now();
    const interval = setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      setTime(elapsed);

      // Simulación física de aceleración y profundidad
      if (elapsed < 7.8) {
        setSpeed(Math.min(285, Math.floor(130 + elapsed * 20)));
        setDepth(Math.floor(7240 + elapsed * 100));
      }

      if (elapsed >= 12.5) {
        clearInterval(interval);
        onComplete();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [onComplete]);

  // Tecla de salto (ESC / Espacio)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onComplete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onComplete]);

  const isAlarm = time >= 3.5 && time < 7.8;
  const isImpact = time >= 7.8 && time < 8.2;
  const isBlackout = time >= 8.2;

  return (
    <div className={`fixed inset-0 z-50 bg-black overflow-hidden select-none font-mono2 ${isAlarm ? 'animate-pulse' : ''}`}>
      {/* 1. Luces del túnel a gran velocidad */}
      {!isBlackout && (
        <div className="absolute inset-0 flex items-center justify-center opacity-70">
          <div
            className="w-[200vw] h-[200vh] border-[12px] border-cyan-500/20 rounded-full animate-ping"
            style={{ animationDuration: `${Math.max(0.15, 0.6 - time * 0.05)}s` }}
          />
          <div
            className="absolute w-[120vw] h-[120vh] border-[16px] border-cyan-400/30 rounded-full animate-ping"
            style={{ animationDuration: `${Math.max(0.12, 0.45 - time * 0.04)}s` }}
          />
        </div>
      )}

      {/* 2. Parabrisas y Cabina del Vehículo */}
      {!isBlackout && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Estructura del marco del parabrisas */}
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-neutral-900 via-neutral-900/80 to-transparent border-b border-white/10" />
          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-neutral-900 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-neutral-900 to-transparent" />

          {/* Compuerta blindada de NEXUS acercándose en la oscuridad */}
          {time >= 5.0 && (
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-red-600/70 bg-neutral-950 flex flex-col items-center justify-center transition-all"
              style={{
                width: `${Math.min(90, (time - 5.0) * 35)}vw`,
                height: `${Math.min(80, (time - 5.0) * 30)}vh`,
                opacity: Math.min(1, (time - 5.0) * 0.8),
              }}
            >
              <div className="text-red-500 text-xs sm:text-lg font-bold tracking-[.4em] anim-flick">
                COMPUERTA BLINDADA B-01 · NEXUS
              </div>
              <div className="text-amber-500 text-[10px] tracking-widest mt-1">ZONA DE CONTENCIÓN CERRADA</div>
            </div>
          )}

          {/* Tablero digital inferior del vehículo */}
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-neutral-950 via-neutral-900 to-transparent p-6 flex flex-col justify-end">
            <div className="max-w-4xl mx-auto w-full flex items-end justify-between border-t border-cyan-500/30 pt-3">
              <div>
                <div className="text-[11px] text-cyan-300/80 tracking-widest">TRANSPORTE NEXUS-04 · CABINA ACTIVA</div>
                <div className="text-xs text-slate-400 mt-1">
                  PROFUNDIDAD: <span className="text-white font-bold tracking-wider">−{depth.toLocaleString()} m</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-400">VELOCÍMETRO</div>
                <div className={`text-2xl sm:text-3xl font-bold tracking-widest ${isAlarm ? 'text-red-500' : 'text-cyan-300'}`}>
                  {speed} <span className="text-sm font-normal">KM/H</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Cartel de Alarma de Colisión en Rojo */}
      {isAlarm && (
        <div className="absolute inset-x-0 top-1/4 flex flex-col items-center justify-center p-4">
          <div className="bg-red-950/80 border-2 border-red-600 px-6 py-4 rounded shadow-[0_0_50px_rgba(255,0,0,0.6)] text-center anim-flick">
            <div className="text-red-400 text-sm sm:text-base font-bold tracking-[.3em]">
              ⚠ ¡FALLO CRÍTICO DE FRENOS HIDRÁULICOS! ⚠
            </div>
            <div className="text-white text-lg sm:text-2xl font-title tracking-[.2em] mt-1">
              IMPACTO INMINENTE
            </div>
          </div>
        </div>
      )}

      {/* 4. Destello de Impacto Blanco y Cristal Roto */}
      {isImpact && (
        <div className="absolute inset-0 bg-white z-50 flex items-center justify-center">
          <svg className="w-full h-full stroke-black stroke-[3] opacity-80" viewBox="0 0 100 100">
            <line x1="50" y1="50" x2="10" y2="10" />
            <line x1="50" y1="50" x2="90" y2="15" />
            <line x1="50" y1="50" x2="85" y2="85" />
            <line x1="50" y1="50" x2="15" y2="80" />
            <line x1="50" y1="50" x2="50" y2="95" />
          </svg>
        </div>
      )}

      {/* 5. Desmayo y transición a Capítulo 1 */}
      {isBlackout && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-6 text-center">
          <div className="text-red-500/80 text-xs sm:text-sm tracking-[.4em] anim-flick mb-3">
            SEÑAL BIOMÉTRICA DÉBIL · SUJETO INCONSCIENTE
          </div>
          <p className="text-slate-400 text-sm sm:text-base max-w-md leading-relaxed">
            El impacto destrozó la compuerta. La cabina está inundada de humo frío... Algo se arrastra en la oscuridad.
          </p>
          <div className="text-cyan-400/80 text-xs tracking-[.3em] mt-6 animate-pulse">
            DESPERTANDO EN LA INSTALACIÓN...
          </div>
        </div>
      )}

      {/* BOTÓN SALTAR (SKIP) EN LA ESQUINA INFERIOR DERECHA */}
      <button
        onClick={onComplete}
        className="fixed bottom-6 right-6 z-50 px-4 py-2 border border-white/30 bg-black/80 hover:bg-red-950/60 hover:border-red-500 text-xs sm:text-sm tracking-widest text-slate-300 hover:text-white transition-all backdrop-blur-md rounded shadow-lg flex items-center gap-2"
        title="Saltar cinemática [ESC o Espacio]"
      >
        <span>SALTAR</span>
        <span className="text-[10px] text-cyan-300/80 hidden sm:inline">[ESC]</span>
        <span>⏭</span>
      </button>
    </div>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [screen, setScreen] = useState<Screen>('menu');
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [modal, setModal] = useState<Modal>('none');
  const [pauseSettings, setPauseSettings] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [docInfo, setDocInfo] = useState<{ doc: Parameters<typeof DocModal>[0]['doc']; first: boolean } | null>(null);
  const [keypad, setKeypad] = useState<{ digits: number } | null>(null);
  const [choice, setChoice] = useState<{ title: string; opts: string[] } | null>(null);
  const [over, setOver] = useState<{ score: number; time: number; rank: number; best: boolean } | null>(null);
  const [done, setDone] = useState<{ info: Record<string, unknown>; rank: number; best: boolean } | null>(null);
  const [hasSave, setHasSave] = useState(() => !!loadSave());
  const [promptOn, setPromptOn] = useState(false);
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const screenRef = useRef(screen); screenRef.current = screen;

  const touch = useMemo(() => {
    if (settings.touch === 'on') return true; if (settings.touch === 'off') return false;
    return typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
  }, [settings.touch]);

  // Inicializar motor
  useEffect(() => {
    if (!canvasRef.current) return;
    const g = Game.get(canvasRef.current);
    (window as unknown as { __game: Game }).__game = g;
    g.applySettings(settingsRef.current);
    g.start();
    setGame(g);
  }, []);

  useEffect(() => { if (game) { game.isTouch = touch; } }, [game, touch]);

  // Eventos del juego
  useEffect(() => {
    if (!game) return;
    const record = (result: 'completo' | 'caído', score: number, time: number) => {
      const entry: ScoreEntry = { alias: settingsRef.current.alias || 'OPERARIO', score, chapter: game.chapter, time, result, date: Date.now() };
      const { rank } = addScore(entry);
      const prog = loadProgress(); const prev = prog.best[String(game.chapter)] || 0;
      const best = score > prev; if (best) { prog.best[String(game.chapter)] = score; writeProgress(prog); }
      return { rank, best };
    };
    const offs = [
      game.on('modal', (m: Modal) => { setModal(m); if (m === 'none') { setPauseSettings(false); } }),
      game.on('doc', (d) => setDocInfo(d)),
      game.on('keypad', (d) => setKeypad(d)),
      game.on('choice', (d) => setChoice(d)),
      game.on('hud', (h) => setPromptOn(!!h.prompt)),
      game.on('saved', () => setHasSave(true)),
      game.on('gameover', (d) => {
        if (d.restart) { if (screenRef.current === 'game') doRestart(); return; }
        const r = record('caído', d.score, d.time); setOver({ score: d.score, time: d.time, ...r });
      }),
      game.on('complete', (d) => { const r = record('completo', d.score, d.time); setDone({ info: d, ...r }); setHasSave(true); }),
    ];
    return () => offs.forEach((f) => f());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  const ensureAudio = useCallback(() => {
    audio.init(); audio.setVolumes({ master: settingsRef.current.master, music: settingsRef.current.music, sfx: settingsRef.current.sfx, ambience: settingsRef.current.ambience }); audio.startAmbient();
  }, []);

  useEffect(() => {
    const first = () => { ensureAudio(); if (screenRef.current !== 'game') audio.menuMode(true); };
    window.addEventListener('pointerdown', first, { once: true }); window.addEventListener('keydown', first, { once: true });
    return () => { window.removeEventListener('pointerdown', first); window.removeEventListener('keydown', first); };
  }, [ensureAudio]);

  const clearOverlays = () => { setOver(null); setDone(null); setDocInfo(null); setKeypad(null); setChoice(null); setPauseSettings(false); setShowScores(false); };

  const startGame = (chapter: number, save: ReturnType<typeof loadSave>) => {
    if (!game) return;
    ensureAudio(); clearOverlays();
    game.isTouch = touch; game.applySettings(settings);
    game.loadLevel(chapter, save);
    audio.setDanger(0, true);
    setScreen('game'); game.setModal('none'); game.requestLock();
  };

  // Al presionar Nueva Partida -> Se ejecuta la cinemática
  const newGame = () => {
    clearSave();
    setHasSave(false);
    ensureAudio();
    setScreen('intro');
  };

  const doContinue = () => { const s = loadSave(); if (s) startGame(s.chapter, s); };
  const doRestart = () => {
    if (!game) return; clearOverlays(); audio.alarm(false);
    game.restartFromCheckpoint(); audio.setDanger(0, true); game.setModal('none'); game.requestLock();
  };
  const toMenu = () => { if (!game) return; clearOverlays(); game.quitToMenu(); setScreen('menu'); setHasSave(!!loadSave()); };
  const updateSettings = (s: Settings) => { setSettings(s); saveSettings(s); game?.applySettings(s); };

  const sv = loadSave();
  const saveInfo = sv ? `Cap. ${sv.chapter} · ${sv.point} · ${new Date(sv.when).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}` : undefined;
  const playing = screen === 'game';
  const noModal = modal === 'none' && !over && !done;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <canvas id="game" ref={canvasRef} tabIndex={-1} onClick={() => { if (playing && game && game.modal === 'none' && !touch && game.state === 'playing') game.requestLock(); }} />
      {playing && <><div className="vignette" /><div className="grain" /><div className="scan" /></>}
      {playing && game && <Hud game={game} settings={settings} touch={touch} />}
      {playing && game && touch && noModal && <TouchControls game={game} prompt={promptOn} />}
      {playing && game && modal === 'pause' && !over && !done && !pauseSettings && (
        <PauseMenu onResume={() => game.resumeGame()} onInv={() => game.setModal('inventory')} onSettings={() => setPauseSettings(true)} onRestart={doRestart} onMenu={toMenu} />
      )}
      {playing && game && modal === 'pause' && pauseSettings && <div className="fixed inset-0 z-50"><SettingsPanel s={settings} onChange={updateSettings} onClose={() => setPauseSettings(false)} /></div>}
      {playing && game && modal === 'inventory' && !over && <Inventory game={game} onClose={() => game.setModal('none')} />}
      {playing && game && modal === 'doc' && docInfo && <DocModal doc={docInfo.doc} first={docInfo.first} onClose={() => game.setModal('none')} />}
      {playing && game && modal === 'keypad' && keypad && <Keypad game={game} digits={keypad.digits} onClose={() => game.setModal('none')} />}
      {playing && game && modal === 'choice' && choice && <Choice title={choice.title} opts={choice.opts} onPick={(i) => game.resolveChoice(i)} />}
      {playing && over && <GameOver {...over} onRetry={doRestart} onMenu={toMenu} />}
      {playing && done && !showScores && <Complete info={done.info} rank={done.rank} best={done.best} onReplay={() => startGame(1, null)} onMenu={toMenu} onScores={() => setShowScores(true)} />}
      {playing && showScores && <div className="fixed inset-0 z-50"><Scores onClose={() => setShowScores(false)} /></div>}

      {/* PANTALLA DE CINEMÁTICA */}
      {screen === 'intro' && <IntroCutscene onComplete={() => startGame(1, null)} />}

      {!playing && screen !== 'intro' && (
        <>
          <MenuBackdrop />
          <div className="grain" /><div className="scan" />
          {screen === 'menu' && (
            <MainMenu hasSave={hasSave} saveInfo={saveInfo} alias={settings.alias} setAlias={(a) => updateSettings({ ...settings, alias: a })}
              onNew={newGame} onContinue={doContinue} onChapters={() => setScreen('chapters')} onSettings={() => setScreen('settings')}
              onCredits={() => setScreen('credits')} onScores={() => setScreen('scores')} onExit={() => { setScreen('farewell'); try { window.close(); } catch { /* */ } }} />
          )}
          {screen === 'chapters' && <ChapterSelect onClose={() => setScreen('menu')} onPlay={(n) => startGame(n, null)} />}
          {screen === 'settings' && <SettingsPanel s={settings} onChange={updateSettings} onClose={() => setScreen('menu')} />}
          {screen === 'credits' && <Credits onClose={() => setScreen('menu')} />}
          {screen === 'scores' && <Scores onClose={() => setScreen('menu')} />}
          {screen === 'farewell' && <Farewell onBack={() => setScreen('menu')} />}
        </>
      )}
    </div>
  );
}
