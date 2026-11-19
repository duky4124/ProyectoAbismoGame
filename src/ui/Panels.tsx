import { useEffect, useState } from 'react';
import type { Game } from '../game/engine';
import { DOCS, ITEMS, RECIPES, type DocDef } from '../game/data';
import { audio } from '../game/audio';
import { fmtTime } from './Menus';

const MAX = 10;

export function Inventory({ game, onClose }: { game: Game; onClose: () => void }) {
  const [, force] = useState(0);
  const [tab, setTab] = useState<'bag' | 'craft' | 'docs'>('bag');
  const [sel, setSel] = useState(0);
  useEffect(() => game.on('inventory', () => force((x) => x + 1)), [game]);
  const slots = Array.from({ length: MAX }, (_, i) => game.inv[i] || null);
  const cur = game.inv[sel] ? ITEMS[game.inv[sel].id] : null;
  const docs = [...game.docs].map((id) => DOCS[id]).filter(Boolean);
  const tabs: [typeof tab, string][] = [['bag', '🎒 Mochila'], ['craft', '🛠 Fabricación'], ['docs', `📄 Archivo (${docs.length})`]];
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-2 sm:p-8 bg-black/70 backdrop-blur-sm pointer-events-auto">
      <div className="panel w-full max-w-3xl max-h-full flex flex-col hud-in">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap">{tabs.map(([k, l]) => <button key={k} className={`btn ${tab === k ? 'btn-primary' : ''}`} onClick={() => { audio.click(); setTab(k); }}>{l}</button>)}</div>
          <button className="btn" onClick={() => { audio.click(); onClose(); }}>Cerrar (Tab)</button>
        </div>
        <div className="p-4 overflow-y-auto scroll-thin">
          {tab === 'bag' && (
            <div className="grid sm:grid-cols-[1fr_1fr] gap-4">
              <div>
                <div className="text-[10px] tracking-[.3em] text-slate-400 font-mono2 mb-2">ESPACIO: {game.inv.length}/{MAX}</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {slots.map((s, i) => (
                    <div key={i} className={`slot ${sel === i ? 'sel' : ''}`} onClick={() => { audio.click(); setSel(i); }} onDoubleClick={() => { if (s && ITEMS[s.id].usable) game.useItem(i); }} title={s ? ITEMS[s.id].name : 'Vacío'}>
                      {s && <><span className="text-2xl sm:text-3xl">{ITEMS[s.id].icon}</span>{s.qty > 1 && <span className="absolute right-1 bottom-0.5 text-[11px] font-mono2 text-amber-300">×{s.qty}</span>}</>}
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[11px] text-slate-400 leading-snug">Linterna: <b className="text-white">{game.P.hasLight ? `${Math.round(game.P.battery)} %` : 'no encontrada'}</b> · Q = curarse rápido · G = lanzar distractor</div>
              </div>
              <div className="border border-white/10 p-3 min-h-[160px] bg-black/30">
                {cur ? (
                  <>
                    <div className="flex items-center gap-3"><span className="text-4xl">{cur.icon}</span><div><div className="font-title tracking-widest text-lg text-white">{cur.name}</div><div className="text-[10px] tracking-[.25em] text-cyan-300/80 font-mono2 uppercase">{cur.cat}</div></div></div>
                    <p className="mt-3 text-sm text-slate-300 leading-snug">{cur.desc}</p>
                    <div className="mt-4 flex gap-2 flex-wrap">
                      {cur.usable && <button className="btn btn-primary" onClick={() => game.useItem(sel)}>{cur.useLabel || 'Usar'}</button>}
                      <button className="btn" onClick={() => { game.dropItem(sel); setSel(Math.max(0, Math.min(sel, game.inv.length - 1))); }}>Soltar</button>
                    </div>
                  </>
                ) : <p className="text-sm text-slate-500">Selecciona un objeto. La mochila es limitada: elige bien qué llevar.</p>}
              </div>
            </div>
          )}
          {tab === 'craft' && (
            <div className="grid sm:grid-cols-2 gap-3">
              {RECIPES.map((r) => {
                const ok = Object.entries(r.needs).every(([id, n]) => game.count(id) >= n);
                const out = ITEMS[r.gives];
                return (
                  <div key={r.id} className={`border p-3 ${ok ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-white/10 bg-black/30'}`}>
                    <div className="flex items-center gap-2"><span className="text-2xl">{out.icon}</span><div className="font-title tracking-widest text-white">{r.name}</div></div>
                    <div className="text-xs text-slate-400 mt-1">{r.desc}</div>
                    <div className="flex flex-wrap gap-2 mt-2 text-xs font-mono2">
                      {Object.entries(r.needs).map(([id, n]) => <span key={id} className={`px-1.5 py-0.5 border ${game.count(id) >= n ? 'border-emerald-400/60 text-emerald-300' : 'border-red-500/50 text-red-300'}`}>{ITEMS[id].icon} {ITEMS[id].name} {game.count(id)}/{n}</span>)}
                    </div>
                    <button className="btn btn-primary mt-3" disabled={!ok} onClick={() => game.craft(r.id)}>Fabricar</button>
                  </div>
                );
              })}
            </div>
          )}
          {tab === 'docs' && (
            docs.length === 0 ? <p className="text-sm text-slate-500">Aún no has encontrado documentos ni grabaciones. Explora la instalación.</p> :
              <div className="space-y-1.5">
                {docs.map((d) => (
                  <button key={d.id} className="w-full text-left border border-white/10 bg-black/30 hover:border-cyan-300/60 px-3 py-2 flex items-center gap-3" onClick={() => { audio.click(); game.readDoc(d.id); }}>
                    <span className="text-xl">{d.kind === 'audio' ? '🎙' : d.kind === 'nota' ? '📝' : '📄'}</span>
                    <span className="flex-1"><span className="block text-sm text-white">{d.title}{d.secret && <span className="ml-2 text-[10px] text-fuchsia-300 tracking-widest">SECRETO</span>}</span><span className="block text-[11px] text-slate-500">{d.author}</span></span>
                  </button>
                ))}
              </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocModal({ doc, first, onClose }: { doc: DocDef; first: boolean; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm pointer-events-auto">
      <div className="w-full max-w-xl max-h-full overflow-y-auto scroll-thin hud-in p-6 sm:p-8" style={{ background: doc.kind === 'audio' ? 'linear-gradient(#10161c,#0a0e12)' : 'linear-gradient(#d9d2b8,#c2b996)', color: doc.kind === 'audio' ? '#bfe9f5' : '#2a2518', boxShadow: '0 0 60px #000', border: doc.secret ? '2px solid #c026d3' : '1px solid rgba(0,0,0,.5)' }}>
        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] tracking-[.3em] font-mono2 opacity-70">{doc.kind === 'audio' ? '🎙 GRABACIÓN DE AUDIO' : doc.kind === 'nota' ? '📝 NOTA' : '📄 DOCUMENTO'}{doc.secret ? ' · SECRETO' : ''}</div>
          {first && <div className="text-[10px] tracking-widest font-mono2 px-1.5 bg-black/70 text-amber-300">NUEVO</div>}
        </div>
        <h3 className="font-title text-2xl tracking-widest mb-1">{doc.title}</h3>
        <div className="text-xs opacity-70 mb-4 font-mono2">{doc.author}</div>
        <p className="whitespace-pre-line text-[15px] leading-relaxed font-mono2">{doc.body}</p>
        <div className="mt-6 flex justify-end"><button className="btn" style={{ color: '#fff' }} onClick={onClose}>Cerrar (E)</button></div>
      </div>
    </div>
  );
}

export function Keypad({ game, digits, onClose }: { game: Game; digits: number; onClose: () => void }) {
  const [v, setV] = useState('');
  const [bad, setBad] = useState(0);
  const press = (d: string) => {
    if (v.length >= digits) return; audio.keypad();
    const nv = v + d; setV(nv);
    if (nv.length === digits) { window.setTimeout(() => { if (!game.submitKeypad(nv)) { setBad((b) => b + 1); setV(''); } }, 180); }
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (/^(Digit|Numpad)\d$/.test(e.code)) { e.preventDefault(); press(e.code.slice(-1)); } else if (e.code === 'Backspace') setV((x) => x.slice(0, -1)); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm pointer-events-auto">
      <div key={bad} className={`panel p-6 w-[320px] hud-in ${bad ? 'anim-shake' : ''}`} style={bad ? { borderColor: '#ef4444' } : undefined}>
        <div className="text-[10px] tracking-[.3em] text-red-400 font-mono2 mb-1">ACCESO RESTRINGIDO</div>
        <div className="font-title text-xl tracking-widest text-white mb-3">SEGURIDAD — NEXUS</div>
        <div className="flex justify-center gap-2 mb-4">
          {Array.from({ length: digits }).map((_, i) => <div key={i} className="w-12 h-14 border border-cyan-300/50 bg-black/60 flex items-center justify-center text-3xl text-cyan-200 font-mono2">{v[i] ?? '·'}</div>)}
        </div>
        {bad > 0 && <div className="text-center text-red-400 text-xs mb-2 font-mono2">CÓDIGO INCORRECTO</div>}
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} className="btn text-xl py-3" onClick={() => press(d)}>{d}</button>)}
          <button className="btn py-3" onClick={() => setV('')}>C</button>
          <button className="btn text-xl py-3" onClick={() => press('0')}>0</button>
          <button className="btn py-3" onClick={() => setV((x) => x.slice(0, -1))}>⌫</button>
        </div>
        <button className="btn w-full mt-3" onClick={onClose}>Cancelar (Esc)</button>
      </div>
    </div>
  );
}

export function Choice({ title, opts, onPick }: { title: string; opts: string[]; onPick: (i: number) => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pointer-events-auto">
      <div className="panel p-6 sm:p-8 max-w-xl w-full hud-in">
        <div className="text-[10px] tracking-[.4em] text-red-400 font-mono2 mb-2">DECISIÓN</div>
        <h3 className="font-title text-2xl sm:text-3xl tracking-widest text-white mb-5">{title}</h3>
        <div className="space-y-2">{opts.map((o, i) => <button key={i} className="menu-btn !normal-case !tracking-wide" onClick={() => onPick(i)}>{o}</button>)}</div>
        <p className="mt-4 text-xs text-slate-500">Tu elección cambiará el desenlace y los recursos disponibles más adelante.</p>
      </div>
    </div>
  );
}

export function PauseMenu(p: { onResume: () => void; onInv: () => void; onSettings: () => void; onRestart: () => void; onMenu: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 pointer-events-auto">
      <div className="panel p-6 w-full max-w-sm hud-in">
        <h2 className="font-title text-3xl tracking-[.3em] text-white mb-4">PAUSA</h2>
        <div className="space-y-1.5">
          <button className="menu-btn" onClick={() => { audio.click(); p.onResume(); }}>Reanudar</button>
          <button className="menu-btn" onClick={() => { audio.click(); p.onInv(); }}>Mochila</button>
          <button className="menu-btn" onClick={() => { audio.click(); p.onSettings(); }}>Ajustes</button>
          <button className="menu-btn" onClick={() => { audio.click(); p.onRestart(); }}>Reiniciar desde el último punto</button>
          <button className="menu-btn" onClick={() => { audio.click(); p.onMenu(); }}>Menú principal</button>
        </div>
        <div className="mt-4 text-[10px] text-slate-500 font-mono2 leading-relaxed">WASD mover · SHIFT correr · C agacharse · ESPACIO saltar · F linterna · E interactuar · TAB mochila · G distractor · Q curarse</div>
      </div>
    </div>
  );
}

export function GameOver(p: { score: number; time: number; rank: number; best: boolean; onRetry: () => void; onMenu: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black/85 p-4 pointer-events-auto text-center">
      <h2 className="font-title text-5xl sm:text-8xl text-[#d6202e] anim-glitch" style={{ textShadow: '0 0 40px rgba(193,18,31,.7)' }}>HAS CAÍDO</h2>
      <div className="mt-4 font-mono2 text-slate-300 tracking-widest">PUNTOS <b className="text-amber-300 text-2xl ml-2">{p.score.toLocaleString()}</b> · TIEMPO {fmtTime(p.time)}</div>
      <div className="mt-1 text-xs text-slate-500 font-mono2">{p.best ? '¡NUEVO RÉCORD PERSONAL!' : p.rank > 0 ? `Posición #${p.rank} en la tabla local` : 'Puntuación registrada'}</div>
      <div className="mt-8 flex gap-3 flex-wrap justify-center">
        <button className="btn btn-primary text-base px-6 py-3" onClick={p.onRetry}>Reintentar (R)</button>
        <button className="btn px-6 py-3" onClick={p.onMenu}>Menú principal</button>
      </div>
      <div className="mt-4 text-[11px] text-slate-600">Reaparecerás en el último punto de guardado con −300 puntos.</div>
    </div>
  );
}

export function Complete(p: { info: Record<string, unknown>; rank: number; best: boolean; onReplay: () => void; onMenu: () => void; onScores: () => void }) {
  const i = p.info as { score: number; time: number; timeBonus: number; noDmg: number; docs: number; secrets: number; deaths: number; title: string; text: string; stats: { pickups: number; crafts: number; hides: number; chases: number } };
  const rows: [string, string][] = [
    ['Tiempo', fmtTime(i.time)], ['Objetos recogidos', String(i.stats.pickups)], ['Documentos', String(i.docs)], ['Secretos', String(i.secrets)],
    ['Fabricados', String(i.stats.crafts)], ['Escondites', String(i.stats.hides)], ['Persecuciones', String(i.stats.chases)], ['Muertes', String(i.deaths)],
    ['Bonus por tiempo', `+${i.timeBonus}`], ['Bonus sin daño', `+${i.noDmg}`],
  ];
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-3 pointer-events-auto overflow-y-auto">
      <div className="panel w-full max-w-2xl p-6 sm:p-8 hud-in my-auto">
        <div className="text-[10px] tracking-[.5em] text-emerald-400 font-mono2">INFORME DE MISIÓN</div>
        <h2 className="font-title text-3xl sm:text-5xl text-white tracking-[.15em] mb-2">{i.title}</h2>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">{i.text}</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono2 text-xs">
          {rows.map(([a, b]) => <div key={a} className="flex justify-between border-b border-white/10 py-1"><span className="text-slate-400">{a}</span><span className="text-white">{b}</span></div>)}
        </div>
        <div className="mt-4 text-center"><div className="text-[10px] tracking-[.4em] text-slate-400 font-mono2">PUNTUACIÓN FINAL</div><div className="font-title text-5xl text-amber-300">{i.score.toLocaleString()}</div>
          <div className="text-xs text-slate-500 font-mono2">{p.best ? '¡NUEVO RÉCORD PERSONAL!' : p.rank > 0 ? `Posición #${p.rank} en la tabla local` : ''}</div></div>
        <div className="mt-6 flex gap-2 flex-wrap justify-center">
          <button className="btn btn-primary" onClick={p.onReplay}>Repetir capítulo</button>
          <button className="btn" onClick={p.onScores}>Récords</button>
          <button className="btn" onClick={p.onMenu}>Menú principal</button>
        </div>
      </div>
    </div>
  );
}
