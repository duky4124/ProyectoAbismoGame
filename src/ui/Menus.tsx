import { useState } from 'react';
import { CHAPTERS, DEFAULT_SETTINGS, loadProgress, loadScores, type Settings } from '../game/data';
import { audio } from '../game/audio';

export function fmtTime(s: number) { 
  const m = Math.floor(s / 60); 
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`; 
}

export function MenuBackdrop() {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#030507]" style={{ zIndex: 0 }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 70% 40%, rgba(120,20,25,.25), transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(30,70,90,.28), transparent 60%)' }} />
      <div className="absolute inset-0 anim-flick" style={{ background: 'radial-gradient(circle at 78% 18%, rgba(255,40,30,.22), transparent 28%)' }} />
      {/* figura alta lejana */}
      <div className="absolute bottom-0 right-[12%] hidden sm:block anim-flick" style={{ width: 70, height: '72%', opacity: 0.55 }}>
        <div className="absolute left-1/2 -translate-x-1/2 top-0 rounded-full bg-gradient-to-b from-[#3a3a38] to-[#0a0a0a]" style={{ width: 20, height: 46 }} />
        <div className="absolute left-1/2 -translate-x-1/2 top-12 bg-gradient-to-b from-[#1b1b1a] to-black" style={{ width: 18, height: '55%' }} />
        <div className="absolute left-[8%] top-14 bg-black" style={{ width: 4, height: '58%', transform: 'rotate(4deg)' }} />
        <div className="absolute right-[8%] top-14 bg-black" style={{ width: 4, height: '58%', transform: 'rotate(-4deg)' }} />
        <div className="absolute left-1/2 -translate-x-[9px] top-[22px] bg-red-600 rounded-full" style={{ width: 3, height: 3, boxShadow: '0 0 8px 3px #f00' }} />
        <div className="absolute left-1/2 translate-x-[6px] top-[22px] bg-red-600 rounded-full" style={{ width: 3, height: 3, boxShadow: '0 0 8px 3px #f00' }} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="absolute inset-x-[-20%]" style={{ bottom: `${i * 14}%`, height: '40%', background: 'radial-gradient(ellipse at center, rgba(140,160,170,.09), transparent 65%)', animation: `drift ${14 + i * 6}s ease-in-out ${i * -4}s infinite alternate` }} />
      ))}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}

export function MainMenu(p: {
  hasSave: boolean; saveInfo?: string; alias: string; setAlias: (s: string) => void;
  onNew: () => void; onContinue: () => void; onChapters: () => void; onSettings: () => void; onCredits: () => void; onScores: () => void; onExit: () => void;
}) {
  const B = (label: string, fn: () => void, dis = false, sub?: string) => (
    <button className="menu-btn" disabled={dis} onClick={() => { audio.click(); fn(); }} onMouseEnter={() => audio.uiHover()}>
      {label}{sub && <span className="block text-[10px] tracking-widest text-cyan-300/60 normal-case mt-0.5">{sub}</span>}
    </button>
  );

  return (
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div className="min-h-full flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-6 p-6 sm:p-14">
        <div className="flex flex-col justify-center text-center sm:text-left">
          <div className="text-[11px] sm:text-xs tracking-[.5em] text-cyan-300/70 font-mono2 mb-3">NEXUS CORP · AÑO 2049 · PROFUNDIDAD −8.000 m</div>
          <h1 className="font-title text-5xl sm:text-6xl lg:text-8xl text-white anim-glitch leading-[0.95]" style={{ textShadow: '0 0 30px rgba(193,18,31,.5)' }}>
            PROYECTO<br /><span className="text-[#d6202e]">ABISMO</span>
          </h1>
          <p className="mt-5 max-w-md text-sm text-slate-400 leading-relaxed hidden sm:block">
            Terror, supervivencia y misterio en primera persona. Tu vehículo se estrella en una instalación olvidada. Algo te observa desde la oscuridad.
          </p>
          <div className="mt-6 hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono2">
            <span>ALIAS:</span>
            <input value={p.alias} maxLength={12} onChange={(e) => p.setAlias(e.target.value.toUpperCase())} className="bg-black/50 border border-white/20 px-2 py-1 text-cyan-200 w-36 tracking-widest outline-none focus:border-red-500" />
          </div>
        </div>
        
        {/* LISTA DE BOTONES DEL MENÚ */}
        <div className="w-full max-w-sm sm:w-72 lg:w-96 shrink-0 sm:self-center space-y-1.5">
          {B('Nueva partida', p.onNew)}
          {B('Continuar', p.onContinue, !p.hasSave, p.hasSave ? p.saveInfo : 'Sin partida guardada')}
          {/* BOTÓN MULTIJUGADOR BLOQUEADO */}
          {B('Multijugador', () => {}, true, '🔒 Bloqueado · Servidores NEXUS fuera de línea')}
          {B('Seleccionar capítulo', p.onChapters)}
          {B('Récords', p.onScores)}
          {B('Ajustes', p.onSettings)}
          {B('Créditos', p.onCredits)}
          {B('Salir', p.onExit)}
          <div className="pt-4 text-[10px] text-slate-500 font-mono2 tracking-wider leading-relaxed hidden sm:block">
            WASD mover · RATÓN mirar · SHIFT correr · C agacharse · ESPACIO saltar<br />F linterna · E interactuar · TAB mochila · G distractor · Q curarse · ESC pausa
          </div>
        </div>
      </div>
    </div>
  );
}

function Shell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-3 sm:p-8 bg-black/70 backdrop-blur-sm">
      <div className={`panel w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} max-h-full flex flex-col hud-in`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <h2 className="font-title text-2xl tracking-[.25em] text-white">{title}</h2>
          <button className="btn" onClick={() => { audio.click(); onClose(); }}>Volver</button>
        </div>
        <div className="overflow-y-auto scroll-thin p-5">{children}</div>
      </div>
    </div>
  );
}

export function ChapterSelect(p: { onClose: () => void; onPlay: (n: number) => void }) {
  const prog = loadProgress();
  return (
    <Shell title="SELECCIONAR CAPÍTULO" onClose={p.onClose} wide>
      <div className="grid sm:grid-cols-2 gap-3">
        {CHAPTERS.map((c) => (
          <div key={c.n} className={`border p-3 flex flex-col gap-1 ${c.playable ? 'border-red-500/50 bg-red-950/20' : 'border-white/10 bg-white/[.02] opacity-60'}`}>
            <div className="flex items-baseline gap-3">
              <span className="font-title text-3xl text-red-500/90">{String(c.n).padStart(2, '0')}</span>
              <span className="font-title tracking-[.15em] text-lg text-white">{c.title}</span>
            </div>
            <div className="text-[11px] text-cyan-300/70 font-mono2 tracking-wider">{c.zone.toUpperCase()}</div>
            <div className="text-xs text-slate-400 leading-snug">{c.summary}</div>
            <div className="mt-1 flex items-center justify-between">
              {c.playable ? <button className="btn btn-primary" onClick={() => { audio.click(); p.onPlay(c.n); }}>Jugar capítulo</button> : <button className="btn" disabled>🔒 En desarrollo</button>}
              {prog.best[String(c.n)] ? <span className="text-xs text-amber-300 font-mono2">MEJOR: {prog.best[String(c.n)].toLocaleString()}</span> : null}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">El proyecto se construye por etapas: el Capítulo 1 es completamente jugable. Los siguientes capítulos se desbloquearán en futuras versiones.</p>
    </Shell>
  );
}

export function Credits({ onClose }: { onClose: () => void }) {
  return (
    <Shell title="CRÉDITOS" onClose={onClose}>
      <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
        <p><b className="text-white">PROYECTO ABISMO</b> — juego de terror y supervivencia en primera persona.</p>
        <p><span className="text-cyan-300">Diseño, programación e historia:</span> equipo ABISMO.</p>
        <p><span className="text-cyan-300">Motor 3D:</span> Three.js (licencia MIT) sobre React + Vite + Tailwind CSS.</p>
        <p><span className="text-cyan-300">Gráficos:</span> texturas, modelos de criatura y escenarios generados proceduralmente en el propio código (sin recursos externos).</p>
        <p><span className="text-cyan-300">Audio:</span> música dinámica y efectos sintetizados en tiempo real con WebAudio (originales, libres de derechos). Las voces son indicativas: sustituibles por grabaciones.</p>
        <p><span className="text-cyan-300">Personajes:</span> Dan Ortega (protagonista), Lena Park (radio de rescate), Dra. Elena Voss (NEXUS), T. Reyes (Seguridad), El Observador.</p>
        <p className="text-slate-500 text-xs">Todos los recursos son provisionales y pueden reemplazarse por modelos, texturas y sonidos definitivos manteniendo la misma arquitectura.</p>
      </div>
    </Shell>
  );
}

export function Scores({ onClose }: { onClose: () => void }) {
  const list = loadScores();
  return (
    <Shell title="TABLA DE RÉCORDS" onClose={onClose}>
      {list.length === 0 ? <p className="text-slate-400 text-sm">Todavía no hay récords. Completa o muere en una partida para registrar tu puntuación.</p> : (
        <table className="w-full text-sm font-mono2">
          <thead><tr className="text-left text-[11px] text-slate-500 tracking-widest"><th className="py-1">#</th><th>ALIAS</th><th className="text-right">PUNTOS</th><th className="text-right">TIEMPO</th><th className="text-right">RESULTADO</th></tr></thead>
          <tbody>
            {list.map((e, i) => (
              <tr key={i} className={`border-t border-white/10 ${i === 0 ? 'text-amber-300' : 'text-slate-200'}`}>
                <td className="py-1.5">{i + 1}</td><td className="tracking-widest">{e.alias}</td><td className="text-right">{e.score.toLocaleString()}</td>
                <td className="text-right">{fmtTime(e.time)}</td><td className={`text-right ${e.result === 'completo' ? 'text-emerald-400' : 'text-red-400'}`}>{e.result.toUpperCase()} · CAP {e.chapter}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}

export function Farewell({ onBack }: { onBack: () => void }) {
  return (
    <div className="fixed inset-0 z-30 bg-black flex flex-col items-center justify-center gap-6 text-center p-6">
      <h2 className="font-title text-4xl sm:text-6xl text-white tracking-[.3em] anim-flick">GRACIAS POR JUGAR</h2>
      <p className="text-slate-400 max-w-md text-sm">Puedes cerrar esta pestaña. Lo que habita en el abismo seguirá esperando.</p>
      <button className="btn btn-primary" onClick={onBack}>Volver al menú</button>
    </div>
  );
}

// ---------- Ajustes ----------
function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="py-2 border-b border-white/5">
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs tracking-[.15em] uppercase text-slate-300 font-mono2">{label}</div>
        <div className="w-1/2 flex justify-end">{children}</div>
      </div>
      {hint && <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  );
}

export function SettingsPanel({ s, onChange, onClose }: { s: Settings; onChange: (s: Settings) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'audio' | 'gfx' | 'ctrl' | 'access'>('audio');
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...s, [k]: v });
  const Sl = (k: 'master' | 'music' | 'sfx' | 'ambience' | 'fov' | 'sensitivity' | 'brightness' | 'shake', min: number, max: number, step: number, fmt?: (n: number) => string) => (
    <div className="flex items-center gap-3 w-full">
      <input type="range" min={min} max={max} step={step} value={s[k] as number} onChange={(e) => set(k, parseFloat(e.target.value) as Settings[typeof k])} />
      <span className="text-xs text-cyan-200 w-10 text-right font-mono2">{fmt ? fmt(s[k] as number) : Math.round((s[k] as number) * 100) + '%'}</span>
    </div>
  );
  const Tg = (k: 'invertY' | 'subtitles' | 'reduceFlash' | 'toggleRun' | 'toggleCrouch' | 'pauseInv' | 'showHints') => (
    <button className={`btn ${s[k] ? 'btn-primary' : ''}`} onClick={() => { audio.click(); set(k, !s[k] as Settings[typeof k]); }}>{s[k] ? 'Sí' : 'No'}</button>
  );
  const tabs: [typeof tab, string][] = [['audio', 'Sonido'], ['gfx', 'Gráficos'], ['ctrl', 'Controles'], ['access', 'Accesibilidad']];
  return (
    <Shell title="AJUSTES" onClose={onClose}>
      <div className="flex gap-2 mb-3 flex-wrap">
        {tabs.map(([k, l]) => <button key={k} className={`btn ${tab === k ? 'btn-primary' : ''}`} onClick={() => { audio.click(); setTab(k); }}>{l}</button>)}
      </div>
      {tab === 'audio' && <>
        <Row label="Volumen general">{Sl('master', 0, 1, 0.05)}</Row>
        <Row label="Música">{Sl('music', 0, 1, 0.05)}</Row>
        <Row label="Efectos">{Sl('sfx', 0, 1, 0.05)}</Row>
        <Row label="Ambiente">{Sl('ambience', 0, 1, 0.05)}</Row>
      </>}
      {tab === 'gfx' && <>
        <Row label="Calidad" hint="Bajo: sin sombras · Medio: sombras de linterna · Alto: sombras nítidas y más luces. Se aplica al reiniciar el nivel.">
          <div className="flex gap-1">{(['bajo', 'medio', 'alto'] as const).map((q) => <button key={q} className={`btn ${s.quality === q ? 'btn-primary' : ''}`} onClick={() => { audio.click(); set('quality', q); }}>{q}</button>)}</div>
        </Row>
        <Row label="Campo de visión">{Sl('fov', 60, 100, 1, (n) => `${n}°`)}</Row>
        <Row label="Brillo">{Sl('brightness', 0, 1, 0.05)}</Row>
        <Row label="Intensidad de sacudidas">{Sl('shake', 0, 1.5, 0.1, (n) => `${Math.round(n * 100)}%`)}</Row>
      </>}
      {tab === 'ctrl' && <>
        <Row label="Sensibilidad">{Sl('sensitivity', 0.3, 3, 0.1, (n) => n.toFixed(1))}</Row>
        <Row label="Invertir eje Y">{Tg('invertY')}</Row>
        <Row label="Correr: modo alternar" hint="Pulsa Shift una vez para correr/parar.">{Tg('toggleRun')}</Row>
        <Row label="Agacharse: modo alternar" hint="Si está desactivado, mantén C.">{Tg('toggleCrouch')}</Row>
        <Row label="Controles táctiles">
          <div className="flex gap-1">{(['auto', 'on', 'off'] as const).map((q) => <button key={q} className={`btn ${s.touch === q ? 'btn-primary' : ''}`} onClick={() => { audio.click(); set('touch', q); }}>{q === 'auto' ? 'Auto' : q === 'on' ? 'Sí' : 'No'}</button>)}</div>
        </Row>
      </>}
      {tab === 'access' && <>
        <Row label="Subtítulos">{Tg('subtitles')}</Row>
        <Row label="Tamaño de subtítulos">
          <div className="flex gap-1">{(['normal', 'grande', 'enorme'] as const).map((q) => <button key={q} className={`btn ${s.subSize === q ? 'btn-primary' : ''}`} onClick={() => { audio.click(); set('subSize', q); }}>{q}</button>)}</div>
        </Row>
        <Row label="Reducir parpadeos" hint="Evita luces estroboscópicas y parpadeos intensos.">{Tg('reduceFlash')}</Row>
        <Row label="Pausar con la mochila abierta">{Tg('pauseInv')}</Row>
        <Row label="Mostrar consejos">{Tg('showHints')}</Row>
      </>}
      <div className="mt-4 flex justify-end"><button className="btn" onClick={() => { audio.click(); onChange({ ...DEFAULT_SETTINGS, alias: s.alias }); }}>Restablecer</button></div>
    </Shell>
  );
}
