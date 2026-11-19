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
// CINEMÁTICA DEL CHOQUE
// ============================================================================
function IntroCutscene({ onComplete }: { onComplete: () => void }) {
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(130);
  const [depth, setDepth] = useState(7240);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(60, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 4.5);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 4.2);
      gain.gain.setValueAtTime(0, ctx.currentTime + 4.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      for (let i = 0; i < 4; i++) {
        const tStart = ctx.currentTime + 2.2 + i * 0.5;
        const aOsc = ctx.createOscillator();
        const aGain = ctx.createGain();
        aOsc.type = 'square';
        aOsc.frequency.setValueAtTime(880, tStart);
        aGain.gain.setValueAtTime(0.15, tStart);
        aGain.gain.exponentialRampToValueAtTime(0.01, tStart + 0.3);
        aOsc.connect(aGain);
        aGain.connect(ctx.destination);
        aOsc.start(tStart);
        aOsc.stop(tStart + 0.35);
      }
    } catch {
      // Ignorar fallback
    }

    return () => {
      try {
        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
          audioCtxRef.current.close();
        }
      } catch {
        // Ignorar
      }
    };
  }, []);

  useEffect(() => {
    const start = performance.now();
    const interval = setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      setTime(elapsed);

      if (elapsed < 4.8) {
        setSpeed(Math.min(285, Math.floor(130 + elapsed * 32)));
        setDepth(Math.floor(7240 + elapsed * 160));
      }

      if (elapsed >= 6.8) {
        clearInterval(interval);
        finish();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [finish]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  const isAlarm = time >= 2.2 && time < 4.8;
  const isImpact = time >= 4.8 && time < 5.2;
  const isBlackout = time >= 5.2;

  return (
    <div
      onClick={finish}
      className={`fixed inset-0 z-50 bg-black overflow-hidden select-none font-mono2 ${isAlarm ? 'animate-pulse' : ''} cursor-pointer`}
    >
      {!isBlackout && (
        <div className="absolute inset-0 flex items-center justify-center opacity-70 pointer-events-none">
          <div
            className="w-[200vw] h-[200vh] border-[12px] border-cyan-500/20 rounded-full animate-ping"
            style={{ animationDuration: `${Math.max(0.15, 0.45 - time * 0.06)}s` }}
          />
        </div>
      )}

      {!isBlackout && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-neutral-900 to-transparent" />
          {time >= 2.8 && (
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-red-600/70 bg-neutral-950 flex flex-col items-center justify-center"
              style={{
                width: `${Math.min(90, (time - 2.8) * 45)}vw`,
                height: `${Math.min(80, (time - 2.8) * 40)}vh`,
              }}
            >
              <div className="text-red-500 text-xs sm:text-lg font-bold tracking-[.4em] anim-flick">
                COMPUERTA BLINDADA B-01 · NEXUS
              </div>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-neutral-950 to-transparent p-6 flex flex-col justify-end">
            <div className="max-w-4xl mx-auto w-full flex items-end justify-between border-t border-cyan-500/30 pt-3">
              <div>
                <div className="text-[11px] text-cyan-300/80 tracking-widest">TRANSPORTE NEXUS-04</div>
                <div className="text-xs text-slate-400 mt-1">
                  PROFUNDIDAD: <span className="text-white font-bold">−{depth.toLocaleString()} m</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">VELOCÍMETRO</div>
                <div className={`text-2xl sm:text-3xl font-bold ${isAlarm ? 'text-red-500' : 'text-cyan-300'}`}>
                  {speed} <span className="text-sm font-normal">KM/H</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAlarm && (
        <div className="absolute inset-x-0 top-1/4 flex flex-col items-center justify-center p-4 pointer-events-none">
          <div className="bg-red-950/80 border-2 border-red-600 px-6 py-4 rounded shadow-[0_0_50px_rgba(255,0,0,0.6)] text-center anim-flick">
            <div className="text-red-400 text-sm font-bold tracking-[.3em]">⚠ ¡FALLO DE FRENOS! ⚠</div>
            <div className="text-white text-lg sm:text-2xl font-title tracking-[.2em] mt-1">IMPACTO INMINENTE</div>
          </div>
        </div>
      )}

      {isImpact && <div className="absolute inset-0 bg-white z-50 pointer-events-none" />}

      {isBlackout && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-6 text-center pointer-events-none">
          <div className="text-red-500/80 text-xs sm:text-sm tracking-[.4em] anim-flick mb-3">
            SEÑAL BIOMÉTRICA DÉBIL · SUJETO INCONSCIENTE
          </div>
          <p className="text-slate-400 text-sm max-w-md">
            El impacto destrozó la compuerta. La cabina está inundada de humo frío...
          </p>
          <div className="text-cyan-400/80 text-xs tracking-[.3em] mt-6 animate-pulse">
            [ HAZ CLIC PARA DESPERTAR ]
          </div>
        </div>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          finish();
        }}
        className="fixed bottom-6 right-6 z-50 px-4 py-2 border border-white/30 bg-black/80 hover:bg-red-950/60 hover:border-red-500 text-xs sm:text-sm tracking-widest text-slate-300 hover:text-white rounded shadow-lg flex items-center gap-2 cursor-pointer"
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

  useEffect(() => {
    if (!canvasRef.current) return;
    const g = Game.get(canvasRef.current);
    (window as unknown as { __game: Game }).__game = g;
    g.applySettings(settingsRef.current);
    g.start();
    setGame(g);
  }, []);

  useEffect(() => { if (game) { game.isTouch = touch; } }, [game, touch]);

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
    ensureAudio();
    clearOverlays();
    game.isTouch = touch;
    game.applySettings(settings);
    game.loadLevel(chapter, save);
    audio.setDanger(0, true);
    setScreen('game');
    game.setModal('none');
    try {
      game.requestLock();
    } catch {
      // Ignorar
    }
  };

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

      {/* PANTALLA INTRO */}
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
