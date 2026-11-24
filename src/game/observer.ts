  private animate(dt: number, time: number, dist: number) {
    const g = this.g;
    const spd = this.speedNow;
    const moving = spd > 0.1;
    const chasing = this.state === 'chase';
    const attacking = this.state === 'attack';

    // Ciclo de pasos: más rápido y amplio durante la persecución.
    const gaitSpeed = chasing ? 2.35 : 1.65;
    this.phase += dt * Math.max(0.15, spd) * gaitSpeed;
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    const runBlend = chasing ? 1 : 0;
    const walkAmp = moving
      ? Math.min(chasing ? 1.15 : 0.72, 0.22 + spd * (chasing ? 0.19 : 0.14))
      : 0;

    // Ataque en tres tiempos: preparación, golpe y recuperación.
    const attackProgress = attacking ? THREE.MathUtils.clamp(this.attackT / 0.8, 0, 1) : 0;
    const windup = attacking ? smooth01(attackProgress / 0.30) : 0;
    const strike = attacking
      ? smooth01((attackProgress - 0.22) / 0.25) * (1 - smooth01((attackProgress - 0.58) / 0.30))
      : 0;
    const recover = attacking ? smooth01((attackProgress - 0.58) / 0.42) : 0;

    this.legs.forEach((l, i) => {
      const side = i === 0 ? -1 : 1;
      const legPhase = s * side;
      const kneeLift = Math.max(0, c * side);

      // Las piernas se mueven en oposición, con rodillas más elevadas al correr.
      const hipTarget = moving ? legPhase * walkAmp : 0.025 * Math.sin(time * 1.1 + i);
      const kneeTarget = moving
        ? 0.06 + kneeLift * walkAmp * (chasing ? 1.05 : 0.72)
        : 0.035;

      l.hip.rotation.x += (hipTarget - l.hip.rotation.x) * Math.min(1, dt * 12);
      l.knee.rotation.x += (kneeTarget - l.knee.rotation.x) * Math.min(1, dt * 14);
    });

    this.arms.forEach((a, i) => {
      const side = i === 0 ? -1 : 1;
      const oppositeLeg = -s * side;
      const armSwing = moving ? oppositeLeg * walkAmp * (chasing ? 0.85 : 0.62) : Math.sin(time * 0.9 + i) * 0.025;

      // Durante el ataque ambos brazos avanzan; uno lidera el golpe.
      const lead = i === 0 ? 1 : 0.78;
      const attackForward = windup * 0.48 + strike * 1.18 * lead - recover * 0.12;
      const shoulderX = attacking ? attackForward : armSwing + runBlend * 0.18;
      const shoulderZ = side * (0.06 + (attacking ? 0.24 * windup + 0.12 * strike : 0));

      a.sh.rotation.x += (shoulderX - a.sh.rotation.x) * Math.min(1, dt * (attacking ? 15 : 10));
      a.sh.rotation.z += (shoulderZ - a.sh.rotation.z) * Math.min(1, dt * 12);

      const elbowTarget = attacking
        ? -0.12 + windup * 0.72 - strike * 0.92 + recover * 0.18
        : -0.12 - (moving ? Math.max(0, oppositeLeg) * 0.32 : 0) - runBlend * 0.12;
      a.el.rotation.x += (elbowTarget - a.el.rotation.x) * Math.min(1, dt * 14);
    });

    const targetLean = attacking
      ? 0.12 + strike * 0.52
      : chasing ? 0.38 : this.state === 'investigate' ? 0.14 : moving ? 0.06 : 0;
    this.lean += (targetLean - this.lean) * Math.min(1, dt * (attacking ? 13 : 5));
    this.body.rotation.x = -this.lean;
    const bob = moving ? Math.abs(Math.sin(this.phase * 2)) * (chasing ? 0.075 : 0.045) : Math.sin(time * 1.1) * 0.012;
    this.body.position.y += (bob - this.body.position.y) * Math.min(1, dt * 12);

    // Respiración y tensión del torso.
    const breath = 1 + Math.sin(time * (attacking ? 5 : 1.7)) * (attacking ? 0.035 : 0.018);
    this.chest.scale.x += (breath - this.chest.scale.x) * Math.min(1, dt * 8);

    // La cabeza sigue al jugador y acompaña el impulso del ataque.
    const P = g.P;
    const headYawWorld = Math.atan2(-(P.x - this.x), -(P.z - this.z));
    const rel = wrapAngle(headYawWorld - this.yaw);
    const lookAt = (this.state === 'watch' || chasing || attacking || (this.hasLOS && dist < 22)) && Math.abs(rel) < 1.6;
    const wantH = lookAt ? rel : Math.sin(time * 0.5) * 0.4;
    this.head.rotation.y += (wantH - this.head.rotation.y) * Math.min(1, dt * 6);

    const tilt = attacking ? -0.12 - strike * 0.22
      : this.state === 'watch' ? 0.35 + Math.sin(time * 0.7) * 0.12
      : this.state === 'investigate' ? 0.15 : 0;
    this.head.rotation.z += (tilt - this.head.rotation.z) * Math.min(1, dt * (attacking ? 12 : 3));

    if (this.state === 'patrol' && Math.random() < dt * 0.4) {
      this.head.rotation.y += (Math.random() - 0.5) * 0.8;
    }

    const eyeGlow = this.chasing ? 1 : 0.5 + Math.sin(time * 5) * 0.2;
    this.eyes.forEach((e) => e.scale.setScalar(eyeGlow * 1.2 + 0.2));

    this.group.position.set(this.x, 0, this.z);
    this.group.rotation.y = this.yaw;
    this.group.visible = true;
    this.body.visible = true;

    // Sonidos sincronizados con cada pisada.
    if (moving) {
      const cyc = Math.floor(this.phase / Math.PI);
      if (cyc !== this.lastStep) {
        this.lastStep = cyc;
        if (dist < 45) {
          g.audio.heavyStep({ x: this.x, y: 0.1, z: this.z }, Math.min(0.8, 0.25 + spd * 0.1));
        }
      }
    }

    this.clickT -= dt;
    if (this.clickT < 0 && dist < 50) {
      this.clickT = 2.5 + Math.random() * 4;
      g.audio.boneClick({ x: this.x, y: 2.5, z: this.z });
    }
    const prox = Math.max(0, 1 - dist / 35);
    g.audio.enemyBedUpdate({ x: this.x, y: 2, z: this.z }, prox * (this.chasing ? 1.4 : 0.8));
  }
}

function smooth01(v: number) {
  const t = THREE.MathUtils.clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
}

function wrapAngle(a: number) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
function turn(cur: number, want: number, maxStep: number) {
  const d = wrapAngle(want - cur);
  return cur + Math.max(-maxStep, Math.min(maxStep, d));
}
