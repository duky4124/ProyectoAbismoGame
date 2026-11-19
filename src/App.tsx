{ useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Game, audio } from './game/engine';
import {
addScore, clearSave, loadProgress, loadSave, loadSettings, saveSettings, writeProgress, type ScoreEntry, type Settings,
} from './game/data';
import { ChapterSelect, Credits, Farewell, MainMenu, MenuBackdrop, Scores, SettingsPanel } from './ui/Menus';
import { Hud, TouchControls } from './ui/Hud';
import { Choice, Complete, DocModal, GameOver, Inventory, Keypad, PauseMenu } from './ui/Panels';
type Screen = 'menu' | 'chapters' | 'settings' | 'credits' | 'scores' | 'farewell' | 'game';
type Modal = 'none' | 'pause' | 'inventory' | 'doc' | 'keypad' | 'choice';
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
// inicializar motor
useEffect(() => {
if (!canvasRef.current) return;
const g = Game.get(canvasRef.current);
(window as unknown as { __game: Game }).__game = g;
g.applySettings(settingsRef.current);
g.start();
setGame(g);
}, []);
useEffect(() => { if (game) { game.isTouch = touch; } }, [game, touch]);
// eventos del juego
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
const newGame = () => { clearSave(); setHasSave(false); startGame(1, null); };
const doContinue = () => { const s = loadSave(); if (s) startGame(s.chapter, s); };
const doRestart = () => {
if (!game) return; clearOverlays(); audio.alarm(false);
game.restartFromCheckpoint(); audio.setDanger(0, true); game.setModal('none'); game.requestLock();
};
const toMenu = () => { if (!game) return; clearOverlays(); game.quitToMenu(); setScreen('menu'); setHasSave(!!loadSave()); };
const updateSettings = (s: Settings) => { setSettings(s); saveSettings(s); game?.applySettings(s); };
const sv = loadSave();
const saveInfo = sv ? Cap. ${sv.chapter} · ${sv.point} · ${new Date(sv.when).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })} : undefined;
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
{!playing && (
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
