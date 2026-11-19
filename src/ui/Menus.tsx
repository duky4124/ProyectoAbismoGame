// src/ui/Menus.tsx
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/* ============================================================
   EXPORTS QUE USAN OTROS ARCHIVOS (NO BORRAR)
   Hud.tsx hace: import { fmtTime } from './Menus';
   ============================================================ */

/** Formatea segundos a "m:ss" (o "m:ss.d" con décimas). */
export function fmtTime(t: number, withTenths = false): string {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const base = `${m}:${s.toString().padStart(2, '0')}`;
  if (withTenths) return `${base}.${Math.floor((t % 1) * 10)}`;
  return base;
}

/* ============================================================
   FONDO 100% GENERADO POR CÓDIGO (sin imágenes)
   ============================================================ */
function ProceduralBackdrop() {
  return (
    <div className="menu-bg">
      <div className="bg-base" />
      <div className="bg-glow-red" />
      <div className="bg-glow-blue" />
      <div className="bg-fog fog-1" />
      <div className="bg-fog fog-2" />
      <div className="bg-vignette" />
      <style>{`
        .menu-bg { position:absolute; inset:0; overflow:hidden; }
        .bg-base {
          position:absolute; inset:0;
          background: linear-gradient(180deg, #05060a 0%, #0a0c12 55%, #120a0c 100%);
        }
        .bg-glow-red {
          position:absolute; inset:0;
          background: radial-gradient(ellipse at 70% 40%, rgba(120,20,25,.30), transparent 55%);
          animation: flicker 4s infinite steps(1);
        }
        .bg-glow-blue {
          position:absolute; inset:0;
          background: radial-gradient(ellipse at 20% 80%, rgba(30,70,90,.28), transparent 60%);
        }
        .bg-fog {
          position:absolute; inset:-20%;
          background: radial-gradient(ellipse at 50% 50%, rgba(160,170,190,.05), transparent 60%);
          animation: drift 26s linear infinite alternate;
        }
        .fog-2 { animation-duration:41s; animation-direction:alternate-reverse; opacity:.7; }
        .bg-vignette {
          position:absolute; inset:0;
          background: radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,.75) 100%);
        }
        @keyframes flicker {
          0%,100% { opacity:1 } 7% { opacity:.55 } 9% { opacity:1 }
          43% { opacity:.7 } 45% { opacity:1 } 78% { opacity:.5 } 80% { opacity:1 }
        }
        @keyframes drift {
          from { transform: translate(-4%,-2%) scale(1); }
          to   { transform: translate(5%,3%) scale(1.15); }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   BICHO 3D DEL MENÚ
   Plantado firme, mirando al frente, solo respira.
   SIN vaivén lateral ni balanceos raros.
   ============================================================ */
function ObserverMenu3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 1.4, 4.5);
    camera.lookAt(0.7, 1.2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    mount.appendChild(renderer.domElement);

    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    scene.add(new THREE.AmbientLight(0x404050, 0.7));
    const key = new THREE.DirectionalLight(0x8899bb, 1.1);
    key.position.set(-3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff3322, 0.5);
    rim.position.set(4, 2, -3);
    scene.add(rim);

    let pivot: THREE.Group | null = null;
    let eyeLight: THREE.PointLight | null = null;

    new GLTFLoader().load(
      '/models/monster.glb',
      (gltf) => {
        const model = gltf.scene;

        // Auto-escala a ~2.6 m y pies en y = 0
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3(), center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        const s = 2.6 / Math.max(size.y, 0.001);
        model.scale.setScalar(s);
        model.position.x -= center.x * s;
        model.position.z -= center.z * s;
        model.position.y -= box.min.y * s;

        pivot = new THREE.Group();
        pivot.add(model);

        // Luz roja de los ojos, hija del pivot (sigue al bicho)
        eyeLight = new THREE.PointLight(0xff2222, 1.2, 8);
        eyeLight.position.set(0, 2.15, 0.6);
        pivot.add(eyeLight);

        scene.add(pivot);
        console.log('%c[MENU v4] modelo cargado', 'color:lime');
      },
      undefined,
      (err) => console.error('Error cargando monster.glb:', err)
    );

    // Animación con performance.now (sin THREE.Clock = sin warning)
    const t0 = performance.now();
    let animId = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = (performance.now() - t0) / 1000;

      if (pivot) {
        const breathe = Math.sin(t * 1.2);

        // Plantado FIRME: posición y ángulo fijos, sin vaivén lateral
        pivot.position.set(1.35, -0.1 + breathe * 0.012, 0.3);
        pivot.rotation.set(0.03 + breathe * 0.012, -0.30, 0);

        // Expansión torácica al inhalar
        const s = 1 + breathe * 0.012;
        pivot.scale.set(s, s, s);
      }
      if (eyeLight) {
        eyeLight.intensity = 1.2 + Math.sin(t * 0.6) * 0.4 + Math.sin(t * 3.5) * 0.15;
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />;
}

/* ============================================================
   MENÚ PRINCIPAL
   ============================================================ */
function Menu({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', fontFamily: 'monospace' }}>
      <ProceduralBackdrop />
      <ObserverMenu3D />

      <div className="menu-ui">
        <h1 className="title">EL OBSERVADOR</h1>
        <button className="btn" onClick={onStart}>JUGAR</button>
        <button className="btn" disabled>CREDITOS</button>
        <button className="btn" onClick={() => window.close()}>SALIR</button>
      </div>

      {/* MARCADOR: confirma que esta versión está corriendo. Bórralo cuando funcione todo. */}
      <div style={{
        position: 'absolute', bottom: 8, right: 12, zIndex: 20,
        color: '#4a5568', fontSize: 11, letterSpacing: '.1em',
      }}>MENU v4</div>

      <style>{`
        .menu-ui {
          position:absolute; inset:0; z-index:10;
          display:flex; flex-direction:column;
          align-items:flex-start; justify-content:center;
          padding-left:8%; gap:14px;
        }
        .title {
          color:#c9312d; letter-spacing:.35em;
          font-size:clamp(28px,5vw,56px); margin:0 0 30px;
          text-shadow:0 0 24px rgba(200,40,40,.5);
        }
        .btn {
          background:transparent; border:1px solid rgba(200,60,60,.5);
          color:#d8d8d8; padding:10px 34px; font-size:16px;
          letter-spacing:.25em; cursor:pointer; font-family:inherit;
          transition:all .2s;
        }
        .btn:hover:not(:disabled) {
          background:rgba(200,50,50,.15); border-color:#e04040;
          color:#fff; text-shadow:0 0 10px rgba(255,80,80,.8);
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   EXPORTS DEL MENÚ (cubre las 3 formas posibles de importarlo)
   ============================================================ */
export { Menu };
export { Menu as MainMenu };
export default Menu;
