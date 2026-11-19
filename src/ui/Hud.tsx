import { useEffect, useRef, useState } from 'react';
import type { Game, HudState } from '../game/engine';
import type { Settings } from '../game/data';
import { CHAPTERS } from '../game/data';
import { fmtTime } from './Menus';

const WHO: Record<string, string> = { DAN: '#e8eef2', LENA: '#5ad1e6', VOSS: '#f0b429', '???': '#c084fc' };

function Bar({ icon, label, v, color, warn }: { icon: string; label: string; v: number; color: string; warn?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${warn ? 'anim-flick' : ''}`}>
      <span className="w-5 text-center text-sm drop-shadow">{icon}</span>
      <div className="flex-1">
        <div className="flex justify-between text-[9px] tracking-[.2em] font-mono2 text-slate-300/80 leading-none mb-0.5"><span>{label}</span><span>{Math.round(v)}</span></div>
        <div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: color, boxShadow: warn ? `0 0 8px ${color}` : undefined }} /></div>
      </div>
    </div>
  );
}

interface Toast { id: number; text: string; kind: string }
interface Pop { id: number; n: number; label: string }

export function Hud({ game, settings, touch }: { game: Game; settings: Settings; touch: boolean }) {
  const [h, setH] = useState<HudState | null>(null);
  const [sub, setSub] = useState<{ who: string; text: string; radio: boolean; id: number } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pops, setPops] = useState<Pop[]>([]);
  const [hint, setHint] = useState<{ text: string; id: number } | null>(null);
  const [zone, setZone] = useState<{ t: string; id: number } | null>(null);
  const [title, setTitle] = useState<number | null>(null);
  const [hitDir, setHitDir] = useState<{ a: number; id: number } | null>(null);
  const subT = useRef<number>(0); const hintT = useRef<number>(0);

  useEffect(() => {
    const offs = [
      game.on('hud', (d: HudState) => setH(d)),
      game.on('subtitle', (d) => { setSub(d); clearTimeout(subT.current); subT.current = window.setTimeout(() => setSub((s) => (s && s.id === d.id ? null : s)), d.dur * 1000); }),
      game.on('toast', (d) => { setToasts((t) => [...t.slice(-3), d]); window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== d.id)), 3400); }),
      game.on('score', (d) => { if (!d.label) return; setPops((t) => [...t.slice(-2), d]); window.setTimeout(() => setPops((t) => t.filter((x) => x.id !== d.id)), 2200); }),
      game.on('hint', (d) => { setHint(d); clearTimeout(hintT.current); hintT.current = window.setTimeout(() => setHint(null), 7500); }),
      game.on('zone', (t: string) => { const id = Math.random(); setZone({ t, id }); window.setTimeout(() => setZone((z) => (z && z.id === id ? null : z)), 4200); }),
      game.on('chapter', (d) => { setTitle(d.n); window.setTimeout(() => setTitle(null), 5200); }),
      game.on('hurt', (d) => { const id = Math.random(); setHitDir({ a: d.angle, id }); window.setTimeout(() => setHitDir((x) => (x && x.id === id ? null : x)), 700); }),
    ];
    return () => offs.forEach((f) => f());
  }, [game]);

  if (!h) return null;
  const lowHp = h.health < 35;
  const subSize = settings.subSize === 'enorme' ? 'text-2xl sm:text-3xl' : settings.subSize === 'grande' ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg';
  const batCol = h.battery < 20 ? '#ef4444' : '#4ade80';
  return (
    <div className="fixed inset-0 pointer-events-none z-10 select-none">
      {/* efectos */}
      <div className="absolute inset-0" style={{ background: `rgba(160,10,20,${Math.min(0.55, h.hurt * 0.55)})`, transition: 'background .1s' }} />
      {(lowHp || h.danger === 2) && <div className={`absolute inset-0 ${h.danger === 2 ? 'chase-frame' : ''}`} style={lowHp && h.danger !== 2 ? { boxShadow: 'inset 0 0 120px 20px rgba(150,10,20,.5)' } : undefined} />}
      {h.hidden && (
        <div className="absolute inset-0" style={{
          background: h.hideType === 'locker' ? 'linear-gradient(to bottom, #000 0 36%, rgba(0,0,0,0) 36% 60%, #000 60%)' : h.hideType === 'crate' ? 'linear-gradient(to top, #000 0 12%, rgba(0,0,0,0) 40%)' : 'radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,.85) 100%)',
          boxShadow: 'inset 0 0 200px 60px #000',
        }} />
      )}
      {hitDir && <div className="absolute left-1/2 top-1/2" style={{ width: 0, height: 0, transform: `rotate(${(-hitDir.a * 180) / Math.PI}deg) translateY(-120px)` }}><div style={{ width: 120, height: 14, marginLeft: -60, background: 'radial-gradient(ellipse, rgba(255,30,30,.9), transparent 70%)' }} /></div>}
      <div className="absolute inset-0 bg-black" style={{ opacity: h.fade, transition: 'opacity .15s linear' }} />

      {/* mira y aviso */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className={`rounded-full bg-white/80 transition-all ${h.prompt ? 'w-2 h-2 bg-amber-300' : 'w-1 h-1'}`} style={{ boxShadow: '0 0 4px #000' }} />
      </div>
      {h.prompt && (
        <div className="absolute left-1/2 top-[56%] -translate-x-1/2 flex items-center gap-2 bg-black/55 px-3 py-1.5 border border-white/20 hud-in">
          <span className="bg-amber-300 text-black font-bold text-xs px-1.5 py-0.5 font-mono2">{touch ? '●' : 'E'}</span>
          <span className="text-sm tracking-wide text-white">{h.prompt}</span>
        </div>
      )}

      {/* objetivo */}
      <div className="absolute left-3 top-3 sm:left-5 sm:top-4 max-w-[60%] sm:max-w-sm">
        <div className="text-[9px] tracking-[.35em] text-cyan-300/70 font-mono2">OBJETIVO</div>
        <div className="text-xs sm:text-sm text-white drop-shadow font-medium leading-snug" style={{ textShadow: '0 1px 3px #000' }}>{h.objective}</div>
      </div>

      {/* puntuación */}
      <div className="absolute right-3 top-3 sm:right-5 sm:top-4 text-right font-mono2" style={{ marginRight: touch ? 52 : 0 }}>
        <div className="text-lg sm:text-2xl text-amber-300 tracking-widest leading-none" style={{ textShadow: '0 0 10px rgba(240,180,41,.4)' }}>{h.score.toLocaleString()}</div>
        <div className="text-[10px] text-slate-400 tracking-[.25em]">PUNTOS · {fmtTime(h.time)}</div>
      </div>
      <div className="absolute right-3 sm:right-5 top-14 sm:top-[3.6rem] flex flex-col items-end gap-1">
        {pops.map((p) => <div key={p.id} className="font-title tracking-[.2em] text-amber-200 text-sm sm:text-lg" style={{ animation: 'scorepop 2.2s forwards', textShadow: '0 0 10px rgba(240,180,41,.6)' }}>+{p.n} {p.label}</div>)}
      </div>

      {/* detección */}
      {h.detect > 0.04 && (
        <div className="absolute left-1/2 top-16 -translate-x-1/2 flex flex-col items-center gap-1">
          <div className={`text-2xl ${h.detect > 0.7 ? 'anim-beat' : ''}`} style={{ filter: `drop-shadow(0 0 ${6 + h.detect * 10}px rgba(255,0,0,${h.detect}))`, opacity: 0.4 + h.detect * 0.6 }}>👁</div>
          <div className="w-28 bar"><i style={{ width: `${Math.min(100, h.detect * 100)}%`, background: h.detect > 0.7 ? '#ff2a2a' : '#f0b429' }} /></div>
        </div>
      )}

      {/* zona */}
      {zone && <div key={zone.id} className="absolute left-1/2 top-[22%] -translate-x-1/2 text-center font-title text-xl sm:text-3xl text-white/90 whitespace-nowrap" style={{ animation: 'zone 4.2s forwards', textShadow: '0 0 20px rgba(0,0,0,.9)' }}>{zone.t.toUpperCase()}</div>}

      {/* toasts */}
      <div className={`absolute flex flex-col gap-1.5 ${touch ? 'left-44 top-[3.6rem]' : 'left-5 top-28'}`}>
        {toasts.map((t) => (
          <div key={t.id} className={`px-3 py-1.5 text-xs sm:text-sm border-l-4 bg-black/65 max-w-xs ${t.kind === 'good' ? 'border-emerald-400 text-emerald-100' : t.kind === 'bad' ? 'border-red-500 text-red-100' : t.kind === 'warn' ? 'border-amber-400 text-amber-100' : 'border-cyan-300 text-slate-100'}`} style={{ animation: 'toastin 3.4s forwards' }}>{t.text}</div>
        ))}
      </div>

      {/* subtítulos */}
      {settings.subtitles && sub && (
        <div key={sub.id} className="absolute bottom-[17%] sm:bottom-[14%] left-2 right-2 md:left-64 md:right-64 text-center hud-in">
          <span className={`inline-block px-4 py-2 bg-black/70 ${subSize} leading-snug`} style={{ textShadow: '0 1px 2px #000' }}>
            <b className="tracking-widest mr-2 text-xs sm:text-sm align-middle" style={{ color: WHO[sub.who] || '#fff' }}>{sub.radio ? '📻 ' : ''}{sub.who}:</b>
            <span className="text-white">{sub.text}</span>
          </span>
        </div>
      )}

      {/* consejo */}
      {hint && (
        <div key={hint.id} className="absolute left-1/2 -translate-x-1/2 bottom-[28%] sm:bottom-[26%] max-w-md w-[88%] text-center hud-in">
          <div className="inline-block bg-black/65 border border-cyan-300/40 px-3 py-1.5 text-xs sm:text-sm text-cyan-100">ℹ {hint.text}</div>
        </div>
      )}

      {/* constantes vitales */}
      <div className={`absolute left-3 sm:left-5 space-y-1.5 bg-black/35 p-2 border-l-2 border-white/20 ${touch ? 'top-[3.6rem] w-36' : 'bottom-5 w-56'}`}>
        <Bar icon="❤" label="VIDA" v={h.health} color="#e11d48" warn={lowHp} />
        <Bar icon="⚡" label={h.exhausted ? 'SIN ALIENTO' : 'RESISTENCIA'} v={h.stamina} color={h.exhausted ? '#f97316' : '#facc15'} warn={h.exhausted} />
        <Bar icon="🍖" label="HAMBRE" v={h.hunger} color="#fb923c" warn={h.hunger < 20} />
        <Bar icon="💧" label="SED" v={h.thirst} color="#38bdf8" warn={h.thirst < 20} />
        {h.hasLight && <Bar icon={h.flash ? '🔦' : '🔋'} label={h.flash ? 'LINTERNA ON' : 'LINTERNA OFF'} v={h.battery} color={batCol} warn={h.battery < 15} />}
      </div>
      <div className={`absolute flex flex-col items-end gap-1 text-[9px] font-mono2 tracking-[.2em] text-slate-300/80 ${touch ? 'right-16 top-14' : 'right-5 bottom-5'}`}>
        <div className="flex items-center gap-2">RUIDO<div className="bar w-20"><i style={{ width: `${h.noise * 100}%`, background: h.noise > 0.6 ? '#ef4444' : '#a3e635' }} /></div></div>
        <div>{h.crouch ? '▼ AGACHADO' : h.hidden ? '◼ ESCONDIDO' : ''} · MOCHILA {h.slots}/10</div>
      </div>

      {/* título de capítulo */}
      {title !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ animation: 'zone 5s forwards' }}>
          <div className="font-mono2 tracking-[.6em] text-xs text-red-500 mb-2">CAPÍTULO {String(title).padStart(2, '0')}</div>
          <div className="font-title text-4xl sm:text-7xl text-white" style={{ textShadow: '0 0 40px rgba(193,18,31,.7)' }}>{CHAPTERS[title - 1]?.title}</div>
          <div className="mt-3 font-mono2 tracking-[.3em] text-xs text-slate-300">{CHAPTERS[title - 1]?.zone.toUpperCase()} · 2049</div>
        </div>
      )}
    </div>
  );
}

// ---------- Controles táctiles ----------
export function TouchControls({ game, prompt }: { game: Game; prompt: boolean }) {
  const stick = useRef<HTMLDivElement>(null); const knob = useRef<HTMLDivElement>(null);
  const move = useRef<{ id: number; ox: number; oy: number } | null>(null);
  const look = useRef<{ id: number; x: number; y: number } | null>(null);
  const [, force] = useState(0);

  useEffect(() => () => { game.input.moveX = game.input.moveY = 0; game.input.run = false; }, [game]);

  const R = 56;
  const onMoveDown = (e: React.PointerEvent) => { e.preventDefault(); (e.target as Element).setPointerCapture(e.pointerId); move.current = { id: e.pointerId, ox: e.clientX, oy: e.clientY }; if (stick.current) { stick.current.style.left = `${e.clientX - 70}px`; stick.current.style.top = `${e.clientY - 70}px`; stick.current.style.opacity = '1'; } };
  const onMoveMove = (e: React.PointerEvent) => {
    const m = move.current; if (!m || m.id !== e.pointerId) return;
    let dx = e.clientX - m.ox, dy = e.clientY - m.oy; const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    game.input.moveX = dx / R; game.input.moveY = dy / R; game.input.run = d > R * 1.25;
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const onMoveUp = (e: React.PointerEvent) => { if (move.current?.id !== e.pointerId) return; move.current = null; game.input.moveX = game.input.moveY = 0; game.input.run = false; if (knob.current) knob.current.style.transform = 'translate(0,0)'; if (stick.current) stick.current.style.opacity = '0.25'; };
  const onLookDown = (e: React.PointerEvent) => { e.preventDefault(); (e.target as Element).setPointerCapture(e.pointerId); look.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; };
  const onLookMove = (e: React.PointerEvent) => { const l = look.current; if (!l || l.id !== e.pointerId) return; game.input.lookX += (e.clientX - l.x) * 1.7; game.input.lookY += (e.clientY - l.y) * 1.7; l.x = e.clientX; l.y = e.clientY; };
  const onLookUp = (e: React.PointerEvent) => { if (look.current?.id === e.pointerId) look.current = null; };

  const Btn = ({ a, icon, style, on }: { a: Parameters<Game['touchPress']>[0]; icon: string; style: React.CSSProperties; on?: boolean }) => (
    <button className={`tbtn ${on ? 'on' : ''}`} style={style} onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); game.touchPress(a); force((x) => x + 1); }}>{icon}</button>
  );
  const safe = 'env(safe-area-inset-bottom, 0px)';
  return (
    <>
      <div className="fixed left-0 bottom-0 w-1/2 h-[65%] z-20" style={{ touchAction: 'none' }} onPointerDown={onMoveDown} onPointerMove={onMoveMove} onPointerUp={onMoveUp} onPointerCancel={onMoveUp} />
      <div className="fixed right-0 top-0 w-1/2 h-full z-20" style={{ touchAction: 'none' }} onPointerDown={onLookDown} onPointerMove={onLookMove} onPointerUp={onLookUp} onPointerCancel={onLookUp} />
      <div ref={stick} className="fixed z-20 rounded-full border-2 border-white/40 bg-white/5 pointer-events-none" style={{ width: 140, height: 140, left: 30, bottom: `calc(40px + ${safe})`, opacity: 0.25 }}>
        <div ref={knob} className="absolute rounded-full bg-white/35 border border-white/60" style={{ width: 56, height: 56, left: 42, top: 42 }} />
      </div>
      <Btn a="interact" icon="✋" on={prompt} style={{ right: 24, bottom: `calc(96px + ${safe})`, width: 82, height: 82, fontSize: '2rem', borderColor: prompt ? '#f0b429' : undefined }} />
      <Btn a="jump" icon="⤒" style={{ right: 118, bottom: `calc(40px + ${safe})`, width: 58, height: 58 }} />
      <Btn a="crouch" icon="▼" on={game.P.crouch} style={{ right: 30, bottom: `calc(30px + ${safe})`, width: 58, height: 58 }} />
      <Btn a="flash" icon="🔦" on={game.P.flashOn} style={{ right: 118, bottom: `calc(112px + ${safe})`, width: 54, height: 54 }} />
      <Btn a="throw" icon="🔔" style={{ right: 190, bottom: `calc(62px + ${safe})`, width: 48, height: 48, fontSize: '1.1rem' }} />
      <Btn a="heal" icon="🩹" style={{ right: 190, bottom: `calc(120px + ${safe})`, width: 48, height: 48, fontSize: '1.1rem' }} />
      <Btn a="inv" icon="🎒" style={{ right: 12, top: 56, width: 44, height: 44, fontSize: '1.1rem' }} />
      <Btn a="pause" icon="⏸" style={{ right: 12, top: 8, width: 40, height: 40, fontSize: '1rem' }} />
    </>
  );
}
