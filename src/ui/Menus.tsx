import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CHAPTERS, DEFAULT_SETTINGS, loadProgress, loadScores, type Settings } from '../game/data';
import { audio } from '../game/audio';

export function fmtTime(s: number) { 
  const m = Math.floor(s / 60); 
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`; 
}

// ============================================================================
// COMPONENTE 3D: RENDERIZA TU CRIATURA "OBSERVER" EN EL MENÚ
// ============================================================================
function ObserverMenu3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Escena y Cámara
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 50);
    camera.position.set(0, 1.8, 3.8);

    // 2. Renderer con transparencia
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // 3. Luces atmosféricas para resaltar la piel cadavérica y los huesos
    const ambientLight = new THREE.AmbientLight(0x0c131a, 1.2);
    scene.add(ambientLight);

    const redRimLight = new THREE.PointLight(0xff1a1a, 4, 10);
    redRimLight.position.set(1.5, 2.5, -1.0);
    scene.add(redRimLight);

    const coldKeyLight = new THREE.DirectionalLight(0x407080, 1.5);
    coldKeyLight.position.set(-2, 3, 3);
    scene.add(coldKeyLight);

    // ========================================================================
    // CONSTRUCCIÓN DEL BICHO (TU MODELO EXACTO)
    // ========================================================================
    const group = new THREE.Group();
    const body = new THREE.Group();
    const head = new THREE.Group();
    const legs: { hip: THREE.Group; knee: THREE.Group }[] = [];
    const arms: { sh: THREE.Group; el: THREE.Group }[] = [];
    const eyes: THREE.Mesh[] = [];

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xedeae2,
      roughness: 0.38,
      metalness: 0.05,
      emissive: 0x181512,
    });
    const boneMat = new THREE.MeshStandardMaterial({
      color: 0xf5f3ee,
      roughness: 0.25,
      metalness: 0.1,
    });
    const voidDark = new THREE.MeshBasicMaterial({ color: 0x020202 });
    const fleshMat = new THREE.MeshStandardMaterial({ color: 0x3d1a24, roughness: 0.45, emissive: 0x140408 });
    const clawMat = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.15, metalness: 0.4 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1100 });

    const createAnatomicalBone = (len: number, rTop: number, rBot: number) => {
      const grp = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rBot, rTop, len, 8), skinMat);
      shaft.position.y = -len / 2;
      grp.add(shaft);
      const joint = new THREE.Mesh(new THREE.SphereGeometry(rTop * 1.12, 6, 6), boneMat);
      joint.position.y = -0.02;
      grp.add(joint);
      return grp;
    };

    group.add(body);

    // Pelvis
    const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.24, 7), skinMat);
    pelvis.position.y = 1.48;
    pelvis.scale.set(1.1, 1, 0.7);
    body.add(pelvis);

    // Columna
    const lowerSpine = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 0.42, 6), boneMat);
    lowerSpine.position.set(0, 1.72, 0.02);
    body.add(lowerSpine);

    // Tórax
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.14, 0.85, 9), skinMat);
    chest.scale.set(1.1, 1.0, 0.62);
    chest.position.set(0, 2.15, -0.02);
    body.add(chest);

    // Esternón
    const sternum = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.03), boneMat);
    sternum.position.set(0, 2.2, -0.16);
    body.add(sternum);

    // Costillas
    for (let i = 0; i < 8; i++) {
      const ribW = 0.19 - i * 0.008;
      const rib = new THREE.Mesh(new THREE.TorusGeometry(ribW, 0.012, 5, 14, Math.PI * 0.95), boneMat);
      rib.rotation.set(Math.PI / 2 + 0.1, 0, Math.PI / 2);
      rib.scale.set(1, 0.65, 1);
      rib.position.set(0, 1.82 + i * 0.075, -0.01);
      body.add(rib);
    }

    // Vértebras
    for (let i = 0; i < 9; i++) {
      const vert = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.16, 4), boneMat);
      vert.rotation.x = Math.PI / 2 + 0.25;
      vert.position.set(0, 1.62 + i * 0.11, 0.12 + Math.sin(i * 0.3) * 0.02);
      body.add(vert);
    }

    // Clavículas
    for (const sx of [-1, 1]) {
      const clavicle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.26, 5), boneMat);
      clavicle.position.set(sx * 0.13, 2.48, -0.08);
      clavicle.rotation.z = sx * 1.35;
      clavicle.rotation.y = sx * 0.3;
      body.add(clavicle);
    }

    // Cuello
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.34, 8), skinMat);
    neck.position.set(0, 2.65, -0.02);
    neck.rotation.x = -0.15;
    body.add(neck);

    for (const sx of [-1, 1]) {
      const tendon = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.28, 4), fleshMat);
      tendon.position.set(sx * 0.065, 2.64, -0.03);
      tendon.rotation.z = sx * 0.12;
      body.add(tendon);
    }

    // Cabeza
    head.position.set(0, 2.85, -0.06);
    body.add(head);

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), skinMat);
    cranium.scale.set(0.72, 1.25, 1.2);
    cranium.rotation.x = -0.22;
    head.add(cranium);

    for (const sx of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), boneMat);
      cheek.position.set(sx * 0.10, 0.02, -0.14);
      cheek.rotation.set(-0.4, 0, sx * 0.4);
      head.add(cheek);

      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 6), voidDark);
      socket.position.set(sx * 0.065, 0.06, -0.17);
      socket.scale.set(1.0, 1.4, 0.8);
      head.add(socket);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), eyeMat);
      eye.position.set(sx * 0.065, 0.055, -0.19);
      head.add(eye);
      eyes.push(eye);
    }

    // Mandíbula y dientes
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.22, 0.16), skinMat);
    jaw.position.set(0, -0.16, -0.12);
    jaw.rotation.x = 0.25;
    head.add(jaw);

    const mouthVoid = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.18, 0.12), voidDark);
    mouthVoid.position.set(0, -0.14, -0.16);
    head.add(mouthVoid);

    for (let t = 0; t < 6; t++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.03, 3), boneMat);
      tooth.position.set((t - 2.5) * 0.012, -0.06, -0.21);
      tooth.rotation.x = Math.PI;
      head.add(tooth);
      const bTooth = tooth.clone();
      bTooth.position.set((t - 2.5) * 0.011, -0.21, -0.19);
      bTooth.rotation.x = 0;
      head.add(bTooth);
    }

    // Piernas
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.14, 1.42, 0);
      body.add(hip);
      const thigh = createAnatomicalBone(0.72, 0.075, 0.05);
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.72;
      hip.add(knee);
      const patella = new THREE.Mesh(new THREE.SphereGeometry(0.038, 6, 6), boneMat);
      patella.position.set(0, 0, -0.04);
      knee.add(patella);
      const shin = createAnatomicalBone(0.74, 0.05, 0.035);
      knee.add(shin);
      const foot = new THREE.Group();
      foot.position.set(0, -0.75, 0);
      knee.add(foot);
      const footBone = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.28), skinMat);
      footBone.position.set(0, 0.02, -0.1);
      foot.add(footBone);
      for (let toe = 0; toe < 3; toe++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.08, 4), clawMat);
        claw.rotation.x = Math.PI / 2 + 0.3;
        claw.position.set((toe - 1) * 0.026, 0.01, -0.26);
        foot.add(claw);
      }
      legs.push({ hip, knee });
    }

    // Brazos
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(sx * 0.26, 2.45, -0.02);
      body.add(sh);
      const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), skinMat);
      deltoid.scale.set(1, 1.2, 1);
      sh.add(deltoid);
      const uArm = createAnatomicalBone(0.85, 0.06, 0.042);
      sh.add(uArm);
      const el = new THREE.Group();
      el.position.y = -0.85;
      sh.add(el);
      const elbowBone = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 4), boneMat);
      elbowBone.rotation.x = -Math.PI / 2 - 0.2;
      elbowBone.position.set(0, 0, 0.035);
      el.add(elbowBone);
      const fArm = createAnatomicalBone(0.95, 0.042, 0.028);
      el.add(fArm);
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.02), skinMat);
      palm.position.set(0, -1.0, 0);
      el.add(palm);
      for (let f = 0; f < 5; f++) {
        const finger = new THREE.Group();
        finger.position.set((f - 2) * 0.02, -1.06, 0);
        const phalanx = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.011, 0.22, 4), boneMat);
        phalanx.position.y = -0.11;
        phalanx.rotation.x = 0.12;
        finger.add(phalanx);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.12, 4), clawMat);
        tip.position.set(0, -0.26, 0.025);
        tip.rotation.x = Math.PI + 0.35;
        finger.add(tip);
        el.add(finger);
      }
      arms.push({ sh, el });
    }

    // ========================================================================
    // POSICIÓN EN PANTALLA (A la derecha, acechando)
    // ========================================================================
    group.position.set(1.2, -0.2, -0.3); // Posicionado a la derecha
    group.rotation.y = -0.35; // Mirando ligeramente hacia el centro del menú
    scene.add(group);

    // Animación en bucle
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Respiración del torso
      chest.scale.x = 1.1 + Math.sin(time * 1.5) * 0.04;
      body.position.y = Math.sin(time * 1.2) * 0.025;

      // Movimiento tétrico de la cabeza acechando
      head.rotation.y = Math.sin(time * 0.6) * 0.18 - 0.2;
      head.rotation.z = 0.18 + Math.sin(time * 0.9) * 0.06;

      // Movimiento sutil de brazos
      arms.forEach((a, i) => {
        a.sh.rotation.z = (i ? -1 : 1) * (0.08 + Math.sin(time * 1.3 + i * 2) * 0.03);
        a.el.rotation.x = -0.2 + Math.sin(time * 1.1 + i) * 0.05;
      });

      // Pulso brillante en los ojos
      const em = 0.7 + Math.sin(time * 4) * 0.3;
      eyes.forEach((e) => e.scale.setScalar(em * 1.3 + 0.2));

      renderer.render(scene, camera);
    };

    animate();

    // Redimensión de ventana
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 pointer-events-none z-[1]" />;
}

// ============================================================================
// MENUBACKDROP: FONDO + TU BICHO 3D + ATMÓSFERA
// ============================================================================
export function MenuBackdrop() {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#030507]" style={{ zIndex: 0 }}>
      {/* 1. IMAGEN DE FONDO (public/fondo.jpg) */}
      <img
        src="/fondo.jpg"
        alt="Fondo Abismo"
        className="absolute inset-0 w-full h-full object-cover object-center opacity-30 select-none"
      />

      {/* 2. TU VERDADERO BICHO 3D (Renderizado en vivo) */}
      <ObserverMenu3D />

      {/* 3. GRADIENTES Y ATMÓSFERA TÉTRICA */}
      <div 
        className="absolute inset-0" 
        style={{ 
          background: 'radial-gradient(ellipse at 75% 45%, rgba(140,20,25,.38), transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(20,60,80,.32), transparent 60%)' 
        }} 
      />
      <div 
        className="absolute inset-0 anim-flick" 
        style={{ 
          background: 'radial-gradient(circle at 76% 25%, rgba(255,40,30,.22), transparent 32%)' 
        }} 
      />

      {/* Niebla submarina flotante */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute inset-x-[-20%] pointer-events-none"
          style={{
            bottom: `${i * 14}%`,
            height: '40%',
            background: 'radial-gradient(ellipse at center, rgba(140,160,170,.08), transparent 65%)',
            animation: `drift ${14 + i * 6}s ease-in-out ${i * -4}s infinite alternate`
          }}
        />
      ))}

      {/* Sombra inferior para garantizar lectura de controles */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black via-black/70 to-transparent pointer-events-none" />
    </div>
  );
}

// ============================================================================
// MAIN MENU
// ============================================================================
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
        <div className="flex flex-col justify-center text-center sm:text-left z-10">
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
        <div className="w-full max-w-sm sm:w-72 lg:w-96 shrink-0 sm:self-center space-y-1.5 z-10">
          {B('Nueva partida', p.onNew)}
          {B('Continuar', p.onContinue, !p.hasSave, p.hasSave ? p.saveInfo : 'Sin partida guardada')}
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
