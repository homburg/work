/* Just Paws: character + vehicle animation module (three.js r128, no deps).
 * Usage (see animations-INTEGRATION.md):
 *   const ANIM = JPAnim.init(THREE, scene);
 *   ANIM.rigPup(pup)            right after makePup(), before chute/toonify
 *   ANIM.rigCar(car)            after the car is built
 *   ANIM.pup(pup, P, dt, t, {chute, yaw})   every frame, replaces the per-mode pose block
 *   ANIM.car(car, dt, inp, t)   every frame from updateCar()
 *   ANIM.npc(p, dt, t, playerPos)
 *   ANIM.bot(b, dt, t) / ANIM.chicken(c, dt, t) / ANIM.rotor(...) / ANIM.hover(...)
 * Everything is visual only: it never touches physics state (P.pos, P.vel, car.pos ...).
 */
(function(){
'use strict';
function init(THREE, scene, opts){
  opts = opts || {};
  const V3 = THREE.Vector3;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
  const wrapA = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const frac = x => x - Math.floor(x);

  // --- damped springs (sub-stepped so big frame dt stays stable) ---
  const spring = (x) => ({ x: x || 0, v: 0 });
  function sstep(s, target, f, z, dt){
    const w = TAU * f, n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
    for(let i = 0; i < n; i++){ s.v += (w * w * (target - s.x) - 2 * z * w * s.v) * h; s.x += s.v * h; }
    return s.x;
  }

  // --- dust puffs (opaque toon puffs that pop up and shrink; ink-outlined like the rest) ---
  const puffs = [];
  if(scene){
    const g = new THREE.IcosahedronGeometry(0.2, 1);
    const m = new THREE.MeshLambertMaterial({ color: opts.dustColor || 0xf6ead0 });
    for(let i = 0; i < 48; i++){
      const o = new THREE.Mesh(g, m); o.visible = false; o.castShadow = false; o.receiveShadow = false; o.userData.dynamic = true;
      scene.add(o); puffs.push({ o, v: new V3(), life: 0, max: 1, s: 1 });
    }
  }
  let puffI = 0;
  function dust(pos, n, spread, size){
    if(!puffs.length) return;
    for(let i = 0; i < n; i++){
      const p = puffs[puffI++ % puffs.length], a = i / n * TAU + Math.random() * 0.6;
      p.o.visible = true; p.o.position.set(pos.x + Math.sin(a) * 0.3, pos.y + 0.15, pos.z + Math.cos(a) * 0.3);
      const sp = spread * (0.7 + Math.random() * 0.6);
      p.v.set(Math.sin(a) * sp, 0.6 + Math.random() * 1.2, Math.cos(a) * sp);
      p.max = p.life = 0.35 + Math.random() * 0.3; p.s = (size || 1) * (0.7 + Math.random() * 0.6);
      p.o.scale.setScalar(0.01);
    }
  }
  let lastTick = -1;
  function tickPuffs(dt, t){
    if(t === lastTick) return; lastTick = t;
    for(const p of puffs){
      if(p.life <= 0) continue;
      p.life -= dt; p.v.multiplyScalar(1 - 3.5 * dt); p.o.position.addScaledVector(p.v, dt);
      const k = 1 - p.life / p.max;                       // 0 -> 1
      p.o.scale.setScalar(Math.max(0.01, p.s * Math.sin(Math.min(1, k * 1.15) * Math.PI) * (1 + k * 0.6)));
      if(p.life <= 0) p.o.visible = false;
    }
  }
  let lastPuffT = -1;

  // =====================================================================
  //  PUP RIG
  //  pup.g (game: position + yaw)  ->  a.sq (squash/stretch, bob; pivot at feet)
  //    ->  a.rot (pitch/roll/stretch around body centre)  ->  original parts
  //  Legs get a knee joint; ears get pivots at their base; eyes can blink.
  // =====================================================================
  const CY = 0.8; // body centre height
  function rigPup(pup){
    if(pup.anim) return pup;
    const g = pup.g, sq = new THREE.Group(), rot = new THREE.Group();
    sq.name = 'animSquash'; rot.name = 'animRot'; rot.position.y = CY;
    const kids = g.children.slice();
    g.add(sq); sq.add(rot);
    for(const c of kids){ rot.add(c); c.position.y -= CY; }

    // smoother body + chest patch: the low-poly spheres intersected in a jagged cream blotch,
    // very visible once the pup sits or leans back
    for(const c of rot.children){
      const gp = c.geometry && c.geometry.type === 'SphereGeometry' && c.geometry.parameters;
      if(!gp) continue;
      if(gp.radius === 0.5){ c.geometry = new THREE.SphereGeometry(0.5, 24, 18); }
      else if(gp.radius === 0.4){
        c.geometry = new THREE.SphereGeometry(0.4, 24, 18);
        c.position.set(0, 0.6 - CY, 0.2); c.scale.set(0.74, 0.62, 1.12);
      }
    }

    // knees: split each leg cylinder into upper + lower (lower carries the paw)
    const knees = [];
    for(const leg of pup.legs){
      const cyl = leg.children.find(c => c.geometry && c.geometry.type === 'CylinderGeometry');
      const paw = leg.children.find(c => c.geometry && c.geometry.type === 'SphereGeometry');
      const knee = new THREE.Group(); knee.position.y = -0.27; leg.add(knee);
      if(cyl){
        const m = cyl.material;
        leg.remove(cyl);
        const up = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.095, 0.3, 8), m); up.position.y = -0.14;
        const lo = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.09, 0.27, 8), m); lo.position.y = -0.12;
        for(const o of [up, lo]){ o.castShadow = true; o.receiveShadow = true; }
        leg.add(up); knee.add(lo);
      }
      if(paw){ knee.add(paw); paw.position.y += 0.27; }
      // haunch/shoulder: a soft fur bulge at the top of the leg so it grows out of the body
      if(cyl){
        const front = leg.position.z > 0;
        const hb = new THREE.Mesh(new THREE.SphereGeometry(front ? 0.15 : 0.17, 14, 10), cyl.material);
        hb.position.set(0, front ? -0.06 : -0.04, front ? 0 : -0.02); hb.scale.set(1, 1.35, front ? 1.1 : 1.3);
        hb.castShadow = true; hb.receiveShadow = true; leg.add(hb);
      }
      knees.push(knee);
    }

    // ears -> pivots at the base so they can flop; eyes for blinking
    const ears = [], eyes = [];
    for(const c of pup.head.children.slice()){
      const t = c.geometry && c.geometry.type;
      if(t === 'ConeGeometry'){
        const h = c.geometry.parameters.height, base = new V3(0, -h / 2, 0).applyEuler(c.rotation).add(c.position);
        const piv = new THREE.Group(); piv.position.copy(base); piv.rotation.copy(c.rotation);
        pup.head.add(piv); piv.add(c); c.position.set(0, h / 2, 0); c.rotation.set(0, 0, 0);
        const side = Math.sign(base.x) || 1;
        ears.push({ piv, side, bz: piv.rotation.z, bx: piv.rotation.x, fx: spring(), fz: spring() });
      }else if(t === 'SphereGeometry' && c.position.z > 0.3 && Math.abs(c.position.x) > 0.1){
        eyes.push(c);
      }
    }

    pup.anim = {
      sq, rot, knees, ears, eyes,
      headBase: pup.head.position.clone(),
      prevMode: null, prevVy: 0, prevFace: null, prevHs: 0, yawRate: 0, acc: 0,
      phase: 0, gallop: 0, idleT: 0, sit: 0, air: 0,
      squash: spring(), pitch: spring(), roll: spring(), bob: spring(),
      tailX: spring(-0.2), tailW: 0, tailPh: Math.random() * 6,
      headY: spring(), headX: spring(), lookT: 0, lookTarget: 0,
      blinkT: 1 + Math.random() * 3, blink: 0,
      chuteOpen: spring(1), wingOpen: spring(1), swingX: spring(), swingZ: spring(),
      legS: [0, 1, 2, 3].map(() => spring()), kneeS: [0, 1, 2, 3].map(() => spring()),
      hop: 0, hopV: 0, excite: 0, flipT: -1,
    };
    return pup;
  }

  // gait offsets (cycles) for legs [FL, FR, BL, BR]
  const TROT = [0, 0.5, 0.5, 0], GALLOP = [0, 0.12, 0.55, 0.67];
  const AIR_MODES = { air: 1, chute: 1, wing: 1, grapple: 1 };

  function blinkTick(a, dt){
    a.blinkT -= dt;
    if(a.blinkT < 0){ a.blink = 0.14; a.blinkT = 1.8 + Math.random() * 3.5; if(Math.random() < 0.2) a.blinkT = 0.25; }
    if(a.blink > 0) a.blink -= dt;
    const s = a.blink > 0 ? 0.12 : 1;
    for(const e of a.eyes) e.scale.y = s;
  }

  function earsTick(a, dt, back, out, flutter, t, f){
    for(const e of a.ears){
      const ex = sstep(e.fx, -back, f || 5, 0.28, dt);
      const ez = sstep(e.fz, out, f || 5, 0.25, dt);
      const fl = flutter ? Math.sin(t * 38 + e.side * 1.7) * flutter : 0;
      e.piv.rotation.x = e.bx + ex + fl;
      e.piv.rotation.z = e.bz - e.side * (ez + fl * 0.5);
    }
  }
  function earKick(a, vx, vz){ for(const e of a.ears){ e.fx.v += vx; e.fz.v += vz; } }

  // set leg i: hip angle h, knee bend k (positive folds the paw back/up)
  function leg(pup, i, h, k, dt, f){
    const a = pup.anim;
    if(f){ h = sstep(a.legS[i], h, f, 0.7, dt); k = sstep(a.kneeS[i], k, f, 0.7, dt); }
    else { a.legS[i].x = h; a.legS[i].v = 0; a.kneeS[i].x = k; a.kneeS[i].v = 0; }
    pup.legs[i].rotation.x = h; a.knees[i].rotation.x = k;
  }

  // ---------------------------------------------------------------------
  //  pup(pup, P, dt, t, o)   P needs: mode, vel (V3), face; optional wingPitch
  //  o.chute: parachute group (on pup.g); o.yaw: camera yaw (for chute/wing banking)
  // ---------------------------------------------------------------------
  function pup(pup, P, dt, t, o){
    o = o || {};
    const a = pup.anim; if(!a) return;
    dt = Math.min(dt, 0.05);
    const mode = P.mode, v = P.vel, hs = Math.hypot(v.x, v.z), vy = v.y;
    pup.g.rotation.x = 0; pup.g.rotation.z = 0;

    // yaw rate + forward acceleration
    if(a.prevFace === null) a.prevFace = P.face;
    const yr = dt > 0 ? wrapA(P.face - a.prevFace) / dt : 0; a.prevFace = P.face;
    a.yawRate = damp(a.yawRate, clamp(yr, -8, 8), 10, dt);
    const acc = dt > 0 ? (hs - a.prevHs) / dt : 0; a.prevHs = hs;
    a.acc = damp(a.acc, clamp(acc, -60, 60), 8, dt);

    // ---- transitions ----
    const pm = a.prevMode;
    if(pm !== mode){
      if((pm === 'ground' || pm === 'swim') && mode === 'air' && vy > 3){      // jump: stretch
        a.squash.v += 9; earKick(a, 4, 6);
        a.flipT = (hs > 12 && Math.random() < 0.35) ? 0 : -1;                 // occasional happy flip on a sprint jump
        dust(pup.g.position, 4, 1.8, 0.6);
      }
      if(mode === 'ground' && pm && pm !== 'ground' && pm !== 'swim' && pm !== 'car' && pm !== 'heli'){ // landing: squash
        const imp = clamp(-a.prevVy, 2, 30);
        a.squash.v -= 1.2 + imp * 0.55; earKick(a, -6, imp * 0.5); a.pitch.v += imp * 0.12;
        if(t - lastPuffT > 0.15){ dust(pup.g.position, 3 + Math.round(imp / 4), 1.4 + imp * 0.12, 0.5 + imp * 0.025); lastPuffT = t; }
        a.flipT = -1;
      }
      if(mode === 'chute'){ a.chuteOpen.x = 0.15; a.chuteOpen.v = 0; a.swingX.v -= 4; earKick(a, 0, 8); }
      if(mode === 'wing'){ a.wingOpen.x = 0.05; a.wingOpen.v = 0; earKick(a, -5, 0); }
      if(mode === 'grapple'){ a.squash.v += 6; }
      if(mode === 'swim'){ a.squash.v -= 4; }
      a.prevMode = mode;
    }
    a.prevVy = vy;

    // ---- per-mode targets ----
    let pitch = 0, roll = 0, bob = 0, sqT = 0, stretchZ = 1;
    let tailX = -0.2, tailAmp = 0.45, tailHz = 2.2;
    let earBack = 0, earOut = 0, earFlutter = 0, earF = 5;
    let headX = 0, headY = 0;
    const idle = mode === 'ground' && hs < 0.4;
    a.idleT = idle ? a.idleT + dt : 0;
    a.sit = damp(a.sit, (idle && a.idleT > 5) ? 1 : 0, idle && a.idleT > 5 ? 4 : 12, dt);

    if(mode === 'ground'){
      const run = clamp(hs / 9, 0, 1);
      a.gallop = damp(a.gallop, hs > 11.5 ? 1 : 0, 6, dt);
      const hz = 1.3 + hs * 0.17;
      a.phase += dt * hz * (hs > 0.3 ? 1 : 0);
      const amp = Math.min(1, hs / 4) * (0.62 + a.gallop * 0.3);
      for(let i = 0; i < 4; i++){
        const off = lerp(TROT[i], GALLOP[i], a.gallop), th = TAU * (a.phase + off);
        let h = amp * Math.sin(th), k = amp * 1.5 * Math.max(0, -Math.cos(th));
        if(i >= 2) k *= 0.8;
        // sitting: back legs fold under, front legs stay planted
        const s = a.sit;
        h = lerp(h, i < 2 ? 0.42 : -1.15, s); k = lerp(k, i < 2 ? 0 : 1.6, s);
        leg(pup, i, h, k, dt, 0);
      }
      const ph2 = TAU * a.phase * 2;
      bob = run * (1 - a.gallop) * 0.045 * (0.5 - 0.5 * Math.cos(ph2))
          + a.gallop * 0.13 * Math.max(0, Math.sin(TAU * a.phase + 0.6));
      pitch = clamp(-a.acc * 0.008, -0.22, 0.22) + a.gallop * 0.14 * Math.sin(TAU * a.phase + 1.2) + run * 0.05;
      roll = clamp(a.yawRate * hs * 0.012, -0.3, 0.3);
      pitch = lerp(pitch, -0.32, a.sit); bob -= a.sit * 0.17;
      headX = run * 0.04 * Math.sin(ph2 - 0.8) - a.gallop * 0.12 + a.sit * 0.35;
      headY = clamp(a.yawRate * 0.12, -0.5, 0.5);
      // idle life: look around, breathe
      if(idle){
        a.lookT -= dt;
        if(a.lookT < 0){ a.lookT = 1.5 + Math.random() * 3; a.lookTarget = (Math.random() - 0.5) * 1.3; if(Math.random() < 0.3) earKick(a, 0, 3); }
        headY += a.lookTarget; headX += Math.sin(t * 0.7) * 0.06;
        sqT = Math.sin(t * 2.6) * 0.02;
      }
      tailX = lerp(-0.25, -0.55, run); tailAmp = lerp(0.55, 0.25, run) * (1 - a.sit * 0.3); tailHz = lerp(2.4, 3.4, run);
      earBack = run * 0.35 + a.gallop * 0.35; earOut = 0; earFlutter = a.gallop * 0.05;
    }
    else if(mode === 'air'){
      const up = clamp(vy / 10, -1, 1);
      if(a.flipT >= 0){ a.flipT += dt; if(a.flipT > 0.55) a.flipT = -1; }
      const tuck = clamp(up, 0, 1), reach = clamp(-up, 0, 1);
      leg(pup, 0, lerp(-0.35, -0.75, reach) - tuck * 0.35, lerp(0.4, 0.05, reach) + tuck * 1.1, dt, 9);
      leg(pup, 1, lerp(-0.35, -0.7, reach) - tuck * 0.3, lerp(0.4, 0.05, reach) + tuck * 1.1, dt, 9);
      leg(pup, 2, lerp(0.5, 0.7, reach) + tuck * 0.3, lerp(0.6, 0.2, reach) + tuck * 0.6, dt, 9);
      leg(pup, 3, lerp(0.5, 0.75, reach) + tuck * 0.3, lerp(0.6, 0.2, reach) + tuck * 0.6, dt, 9);
      pitch = clamp(-vy * 0.035, -0.4, 0.45);
      if(a.flipT >= 0) pitch += smooth01(a.flipT / 0.55) * TAU;
      roll = clamp(a.yawRate * 0.08, -0.3, 0.3);
      headX = clamp(-vy * 0.02, -0.25, 0.3);
      tailX = -0.6 - up * 0.3; tailAmp = 0.2; tailHz = 3;
      earBack = 0.1; earOut = clamp(-vy * 0.05, -0.4, 0.9); earFlutter = reach * 0.06;
      sqT = clamp(Math.abs(vy) * 0.008, 0, 0.1);
    }
    else if(mode === 'chute'){
      a.sit = 0;
      const sway = sstep(a.swingX, clamp(-a.acc * 0.02, -0.4, 0.4), 1.1, 0.12, dt);
      const bank = sstep(a.swingZ, clamp(a.yawRate * 0.35, -0.5, 0.5), 1.1, 0.15, dt);
      pitch = sway + Math.sin(t * 1.3) * 0.04; roll = bank;
      for(let i = 0; i < 4; i++){
        const kick = Math.sin(t * 5 + i * 1.7) * 0.28;
        leg(pup, i, (i < 2 ? 0.15 : 0.25) + kick, 0.35 + Math.max(0, -kick) * 1.2, dt, 6);
      }
      headX = 0.2 + Math.sin(t * 0.9) * 0.05; headY = Math.sin(t * 0.6) * 0.35;
      tailX = 0.1; tailAmp = 0.5; tailHz = 2.6;
      earBack = 0; earOut = -0.25 + Math.sin(t * 2.1) * 0.1;
    }
    else if(mode === 'wing'){
      const wp = P.wingPitch !== undefined ? P.wingPitch : -0.2;
      const speed = Math.hypot(hs, vy);
      pitch = -wp * 0.9 + 0.45;
      roll = clamp(a.yawRate * 0.45, -0.75, 0.75);
      const fl = Math.sin(t * 22) * 0.04 * clamp(speed / 40, 0.3, 1);
      leg(pup, 0, -1.35 + fl, 0.15, dt, 8); leg(pup, 1, -1.35 - fl, 0.15, dt, 8);
      leg(pup, 2, 1.3 - fl, 0.25, dt, 8); leg(pup, 3, 1.3 + fl, 0.25, dt, 8);
      headX = -0.45 - wp * 0.3; headY = roll * -0.3;
      tailX = -1.3; tailAmp = 0.06; tailHz = 6;
      earBack = 1.1; earOut = 0.1; earFlutter = clamp(speed / 50, 0.03, 0.12); earF = 7;
      stretchZ = 1 + clamp((speed - 20) / 200, 0, 0.12);
    }
    else if(mode === 'grapple'){
      const sp = v.length();
      pitch = clamp(-Math.atan2(vy, Math.max(hs, 0.01)), -1.1, 1.1) * 0.75;
      roll = clamp(a.yawRate * 0.1, -0.3, 0.3);
      leg(pup, 0, -1.55, 0.05, dt, 10); leg(pup, 1, -1.35, 0.25, dt, 10);
      leg(pup, 2, 0.95, 0.45, dt, 10); leg(pup, 3, 1.1, 0.35, dt, 10);
      headX = -0.2;
      tailX = -1.2; tailAmp = 0.08; tailHz = 5;
      earBack = 0.95; earOut = 0.1; earFlutter = clamp(sp / 400, 0, 0.1); earF = 7;
      stretchZ = 1 + clamp(sp / 350, 0, 0.14);
    }
    else if(mode === 'swim'){
      a.phase += dt * 1.5;
      for(let i = 0; i < 4; i++){
        const th = TAU * (a.phase + (i % 2) * 0.5 + (i >= 2 ? 0.25 : 0));
        leg(pup, i, (i < 2 ? -0.5 : 0.4) + Math.sin(th) * 0.7, 0.7 + Math.cos(th) * 0.6, dt, 0);
      }
      pitch = -0.38; roll = Math.sin(t * 3) * 0.07; bob = Math.sin(t * 4.2) * 0.05 - 0.05;
      headX = 0.3; headY = Math.sin(t * 1.1) * 0.25;
      tailX = -0.9; tailAmp = 0.35; tailHz = 2;
      earOut = 0.35; earBack = 0.2;
    }
    else if(mode === 'jet'){
      // jetpack: lean into travel, legs dangle and kick, ears blown up by the thrust
      const tilt = clamp(hs * 0.03, 0, 0.55);
      pitch = 0.1 + tilt + clamp(-a.acc * 0.008, -0.15, 0.15) + Math.sin(t * 7) * 0.02;
      roll = clamp(a.yawRate * 0.2, -0.45, 0.45) + Math.sin(t * 3.1) * 0.04;
      for(let i = 0; i < 4; i++){
        const k = Math.sin(t * 6 + i * 1.6) * 0.22;
        leg(pup, i, (i < 2 ? 0.2 : 0.55) + k - tilt * 0.5, 0.5 + Math.max(0, -k) * 1.4, dt, 8);
      }
      headX = -tilt * 0.6 + 0.05; headY = clamp(a.yawRate * 0.15, -0.4, 0.4);
      tailX = -0.9; tailAmp = 0.35; tailHz = 4;
      earBack = 0.3 + tilt; earOut = -0.35 + clamp(vy * 0.03, -0.2, 0.3); earFlutter = 0.07; earF = 7;
      bob = Math.sin(t * 5) * 0.04; sqT = Math.sin(t * 13) * 0.015;
    }
    else if(mode === 'car' || mode === 'heli'){
      // pup hidden while driving; keep it neutral
    }
    else {
      // unknown flying modes (jetpack, copter seat ...): generic hover pose
      const tilt = clamp(hs * 0.025, 0, 0.45);
      pitch = tilt + clamp(-a.acc * 0.01, -0.2, 0.2); roll = clamp(a.yawRate * 0.25, -0.5, 0.5);
      for(let i = 0; i < 4; i++){
        const k = Math.sin(t * 3.2 + i * 1.4) * 0.18;
        leg(pup, i, (i < 2 ? 0.3 : 0.45) + k - tilt * 0.6, 0.45 + Math.max(0, k), dt, 6);
      }
      headX = -tilt * 0.5 + 0.1; headY = clamp(a.yawRate * 0.15, -0.4, 0.4);
      tailX = -0.7; tailAmp = 0.25; tailHz = 3;
      earBack = clamp(hs * 0.03, 0, 0.9); earOut = clamp(-vy * 0.04, -0.3, 0.6); earFlutter = clamp(hs / 600, 0, 0.08);
    }

    // ---- apply body ----
    const sqx = sstep(a.squash, sqT, 4.2, 0.32, dt);
    const s = clamp(sqx, -0.45, 0.5);
    a.sq.scale.set(1 - s * 0.45, 1 + s, (1 - s * 0.45) * 1);
    a.rot.scale.z = damp(a.rot.scale.z, stretchZ, 8, dt);
    a.sq.position.y = sstep(a.bob, bob, mode === 'ground' ? 14 : 5, 0.8, dt);
    const pf = mode === 'air' && a.flipT >= 0;
    a.rot.rotation.x = pf ? pitch : sstep(a.pitch, pitch, mode === 'wing' || mode === 'grapple' ? 3.2 : 4.5, 0.55, dt);
    if(pf){ a.pitch.x = pitch % TAU; a.pitch.v = 0; }
    a.rot.rotation.z = sstep(a.roll, roll, 3.5, 0.6, dt);

    // head (spring-follow so it lags a touch behind the body)
    pup.head.rotation.x = sstep(a.headX, headX, 3.5, 0.6, dt);
    pup.head.rotation.y = sstep(a.headY, headY, 2.5, 0.7, dt);

    // tail
    a.tailPh += dt * TAU * tailHz;
    pup.tail.rotation.x = sstep(a.tailX, tailX, 3, 0.4, dt);
    pup.tail.rotation.z = Math.sin(a.tailPh) * tailAmp;

    earsTick(a, dt, earBack, earOut, earFlutter, t, earF);
    blinkTick(a, dt);

    // parachute canopy: pop-open overshoot, breathing, banking
    const ch = o.chute;
    if(ch && ch.visible){
      const k = sstep(a.chuteOpen, 1, 1.6, 0.3, dt);
      ch.scale.set(k, lerp(0.4, 1, clamp(k, 0, 1.2)) * (1 + Math.sin(t * 2.4) * 0.025), k);
      ch.rotation.z = -a.roll.x * 0.55; ch.rotation.x = -a.pitch.x * 0.5;
    }
    // wingsuit: snap open with overshoot + tip flutter
    if(pup.wings && pup.wings.visible){
      const k = sstep(a.wingOpen, 1, 2.2, 0.28, dt);
      pup.wings.scale.set(clamp(k, 0.02, 1.4), 1, 1);
      pup.wings.rotation.z = Math.sin(t * 17) * 0.025;
    }
    tickPuffs(dt, t);
  }
  function smooth01(x){ x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

  // ---------------------------------------------------------------------
  //  NPC pups: idle life, sit when bored, bounce + wag when Scout comes near
  // ---------------------------------------------------------------------
  function npc(p, dt, t, playerPos){
    const a = p.anim; if(!a) return;
    dt = Math.min(dt, 0.05);
    const d = playerPos ? p.g.position.distanceTo(playerPos) : 99;
    a.excite = damp(a.excite, d < 9 ? 1 : 0, 3, dt);
    a.sit = damp(a.sit, a.excite > 0.5 ? 0 : 1, 3, dt);
    // hops
    if(a.excite > 0.6 && a.hop <= 0 && Math.random() < dt * 1.2){ a.hopV = 3.4 + Math.random(); a.hop = 0.0001; a.squash.v += 5; }
    if(a.hop > 0){ a.hopV -= 16 * dt; a.hop += a.hopV * dt; if(a.hop <= 0){ a.hop = 0; a.squash.v -= 6; earKick(a, -3, 4); } }
    for(let i = 0; i < 4; i++){
      const h = lerp(a.hop > 0 ? (i < 2 ? -0.4 : 0.5) : 0, i < 2 ? 0.42 : -1.15, a.sit);
      const k = lerp(a.hop > 0 ? 0.5 : 0, i < 2 ? 0 : 1.6, a.sit);
      leg(p, i, h, k, dt, 10);
    }
    const s = clamp(sstep(a.squash, Math.sin(t * 2.4 + a.tailPh) * 0.02, 4.2, 0.32, dt), -0.4, 0.4);
    a.sq.scale.set(1 - s * 0.45, 1 + s, 1 - s * 0.45);
    a.sq.position.y = a.hop - a.sit * 0.17;
    a.rot.rotation.x = sstep(a.pitch, -0.32 * a.sit - (a.hop > 0 ? a.hopV * 0.04 : 0), 4, 0.6, dt);
    a.rot.rotation.z = 0;
    // head: keep the game's yaw tracking, add a curious tilt
    p.head.rotation.x = 0.3 * a.sit - 0.1 * a.excite;
    p.head.rotation.z = Math.sin(t * 0.8 + a.tailPh) * 0.12 * (1 - a.excite) + a.excite * 0.15 * Math.sin(t * 2);
    a.tailPh += dt * TAU * lerp(2, 4.2, a.excite);
    p.tail.rotation.x = sstep(a.tailX, lerp(-0.15, -0.5, a.excite), 3, 0.4, dt);
    p.tail.rotation.z = Math.sin(a.tailPh) * lerp(0.35, 0.75, a.excite);
    earsTick(a, dt, 0, a.hop > 0 ? clamp(-a.hopV * 0.12, -0.3, 0.5) : 0, 0, t, 5);
    blinkTick(a, dt);
  }

  // =====================================================================
  //  CAR: body leans in turns, squats/dives on throttle/brake, bounces on
  //  landings, front wheels steer, engine idle rumble; driver pup reacts.
  // =====================================================================
  function rigCar(car){
    if(car.anim) return car;
    const body = new THREE.Group(); body.name = 'animBody';
    const kids = car.g.children.filter(c => car.wheels.indexOf(c) < 0);
    car.g.add(body); for(const c of kids) body.add(c);
    car.anim = { body, prevHead: car.heading, prevSpeed: car.speed, prevGround: car.onGround, prevVy: 0,
      yawRate: 0, acc: 0, roll: spring(), pitch: spring(), y: spring(), steer: spring() };
    return car;
  }
  function carAnim(car, dt, inp, t){
    const a = car.anim; if(!a) return;
    dt = Math.min(dt, 0.05); t = t || performance.now() / 1000;
    const yr = dt > 0 ? wrapA(car.heading - a.prevHead) / dt : 0; a.prevHead = car.heading;
    a.yawRate = damp(a.yawRate, yr, 10, dt);
    const acc = dt > 0 ? (car.speed - a.prevSpeed) / dt : 0; a.prevSpeed = car.speed;
    a.acc = damp(a.acc, clamp(acc, -80, 80), 10, dt);
    // landing / hop
    if(!a.prevGround && car.onGround){ const imp = clamp(-a.prevVy, 0, 30); a.y.v -= imp * 0.18; a.pitch.v += imp * 0.03; if(imp > 6) dust(car.pos, 8, 3 + imp * 0.1, 1.2); }
    if(a.prevGround && !car.onGround && car.vy > 3) a.y.v += 2.5;
    a.prevGround = car.onGround; a.prevVy = car.vy;

    const spd = Math.abs(car.speed);
    const roll = car.onGround ? clamp(a.yawRate * car.speed * 0.012, -0.14, 0.14) : 0;
    const pitch = car.onGround ? clamp(-a.acc * 0.0045, -0.09, 0.09) : 0;
    const rumble = car.onGround ? Math.sin(t * 47) * 0.012 * (1 - clamp(spd / 20, 0, 0.7)) : 0;
    a.body.rotation.z = sstep(a.roll, roll, 2.2, 0.35, dt);
    a.body.rotation.x = sstep(a.pitch, pitch, 2.4, 0.35, dt);
    a.body.position.y = sstep(a.y, 0, 3, 0.3, dt) + rumble;
    const st = sstep(a.steer, -(inp ? inp.x : 0) * 0.42, 6, 0.8, dt);
    if(car.wheels[0]) car.wheels[0].rotation.y = st;
    if(car.wheels[1]) car.wheels[1].rotation.y = st;

    seated(car.driver, dt, t, spd, a.yawRate, a.acc, car.vy);
    tickPuffs(dt, t);
  }
  // seated pilot/driver: sways against turns, ears stream with speed
  function seated(d, dt, t, spd, yawRate, acc, vy){
    if(!d || !d.anim || !d.g.visible) return;
    const da = d.anim;
    for(let i = 0; i < 4; i++) leg(d, i, i < 2 ? -0.9 : -1.2, i < 2 ? 0.2 : 1.5, dt, 0);
    da.rot.rotation.x = -0.35 + clamp(acc * 0.004, -0.2, 0.2);
    da.rot.rotation.z = sstep(da.roll, clamp(-yawRate * spd * 0.02, -0.35, 0.35), 2, 0.3, dt);
    d.head.rotation.x = 0.3; d.head.rotation.y = sstep(da.headY, clamp(yawRate * 0.3, -0.5, 0.5), 2.5, 0.6, dt);
    da.tailPh += dt * TAU * 3; d.tail.rotation.z = Math.sin(da.tailPh) * 0.5;
    earsTick(da, dt, clamp(spd * 0.035, 0, 1.1), clamp(-vy * 0.04, -0.3, 0.6), clamp(spd / 700, 0, 0.07), t, 6);
    blinkTick(da, dt);
  }

  // =====================================================================
  //  PUP COPTER: hover bob + wobble in the air, skid squash on touchdown,
  //  pilot pup animated. Call after heliVisual() (which sets pos + tilt).
  // =====================================================================
  function heli(h, dt, t, piloted){
    dt = Math.min(dt, 0.05);
    const a = h.anim || (h.anim = { prevYaw: h.yaw, yawRate: 0, prevLanded: h.landed, prevVy: 0, sq: spring(), air: 0, prevSpd: 0, acc: 0 });
    const yr = dt > 0 ? wrapA(h.yaw - a.prevYaw) / dt : 0; a.prevYaw = h.yaw; a.yawRate = damp(a.yawRate, yr, 8, dt);
    const spd = Math.hypot(h.vel.x, h.vel.z);
    const acc = dt > 0 ? (spd - a.prevSpd) / dt : 0; a.prevSpd = spd; a.acc = damp(a.acc, clamp(acc, -40, 40), 6, dt);
    if(!a.prevLanded && h.landed){ const imp = clamp(-a.prevVy, 1, 20); a.sq.v -= 0.6 + imp * 0.25; dust(h.pos, 10, 3 + imp * 0.2, 1.4); }
    if(a.prevLanded && !h.landed) a.sq.v += 1.2;
    a.prevLanded = h.landed; a.prevVy = h.vel.y;
    a.air = damp(a.air, h.landed ? 0 : 1, 3, dt);
    const spin = h.spin || 0;
    // hover bob; engine shiver while the rotor runs on the pad
    h.g.position.y += a.air * Math.sin(t * 1.7) * 0.18 + (1 - a.air) * spin * Math.sin(t * 55) * 0.015;
    const s = clamp(sstep(a.sq, 0, 2.6, 0.3, dt), -0.2, 0.2);
    h.g.scale.set(1 - s * 0.4, 1 + s, 1 - s * 0.4);
    if(piloted) seated(h.pilot, dt, t, spd, a.yawRate, a.acc, h.vel.y);
    tickPuffs(dt, t);
  }

  // =====================================================================
  //  Small extras
  // =====================================================================
  // Kitty-Bots: bank + pitch into their drift, wobble.
  function bot(b, dt, t){
    if(!b.alive) return;
    const a = b.anim || (b.anim = { prev: b.pos.clone(), vx: 0, vz: 0 });
    dt = Math.min(dt, 0.05);
    if(dt > 0){ a.vx = damp(a.vx, (b.pos.x - a.prev.x) / dt, 6, dt); a.vz = damp(a.vz, (b.pos.z - a.prev.z) / dt, 6, dt); }
    a.prev.copy(b.pos);
    const y = b.g.rotation.y, s = Math.sin(y), c = Math.cos(y);
    const fwd = a.vx * s + a.vz * c, side = a.vx * c - a.vz * s;
    b.g.rotation.order = 'YXZ';
    b.g.rotation.x = clamp(fwd * 0.12, -0.35, 0.35) + Math.sin(t * 2.3 + (b.phase || 0)) * 0.05;
    b.g.rotation.z = clamp(-side * 0.12, -0.35, 0.35) + Math.sin(t * 1.7 + (b.phase || 0)) * 0.06;
  }
  // Chickens: flap wings, flap hard when rescued.
  function chicken(c, dt, t){
    const a = c.anim || (c.anim = { wings: c.g.children.filter(o => o.geometry && o.geometry.type === 'SphereGeometry' && Math.abs(o.position.x) > 0.3) });
    const hard = c.rescued;
    const burstFlap = hard ? 1 : Math.max(0, Math.sin(t * 0.9 + (c.phase || 0)) - 0.8) * 5;
    for(const w of a.wings){
      const side = Math.sign(w.position.x);
      w.rotation.z = side * (0.15 + burstFlap * (0.5 + 0.5 * Math.sin(t * (hard ? 40 : 28))) * 0.9);
    }
  }
  // Rotor spin with spin-up/down. state = {rpm} kept on the mesh.
  function rotor(obj, on, dt, axis, maxSpeed){
    const u = obj.userData; u.rpm = damp(u.rpm || 0, on ? (maxSpeed || 30) : 0, on ? 1.2 : 0.6, dt);
    obj.rotation[axis || 'y'] += u.rpm * dt;
    return u.rpm / (maxSpeed || 30);
  }
  // Generic hover vehicle (Pup Copter, jetpack ...): tilt into velocity, bob, bank in turns.
  // group: the visual group (not the physics object); vel: V3 world velocity; heading: yaw.
  function hover(group, vel, heading, dt, t, opt){
    opt = opt || {};
    const a = group.userData.hov || (group.userData.hov = { pitch: spring(), roll: spring(), prevH: heading, yr: 0 });
    dt = Math.min(dt, 0.05);
    const yr = dt > 0 ? wrapA(heading - a.prevH) / dt : 0; a.prevH = heading; a.yr = damp(a.yr, yr, 8, dt);
    const s = Math.sin(heading), c = Math.cos(heading), fwd = vel.x * s + vel.z * c, side = vel.x * c - vel.z * s;
    const k = opt.tilt || 0.02, max = opt.max || 0.4;
    group.rotation.order = 'YXZ';
    group.rotation.x = sstep(a.pitch, clamp(fwd * k, -max, max), 1.4, 0.5, dt);
    group.rotation.z = sstep(a.roll, clamp(-side * k + a.yr * 0.25, -max, max), 1.4, 0.5, dt);
    return Math.sin(t * (opt.bobHz || 1.6) * TAU) * (opt.bob || 0.08);   // add to group.position.y
  }

  return { rigPup, pup, npc, rigCar, car: carAnim, heli, bot, chicken, rotor, hover, dust, tickPuffs, spring, sstep };
}
window.JPAnim = { init };
})();
