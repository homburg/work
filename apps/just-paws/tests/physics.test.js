// Headless smoke + physics test for Just Paws.
// Run: node apps/just-paws/tests/physics.test.js   (needs Playwright + a Chromium it can launch)
// Steps the game deterministically through JP.dbg.step(n) because swiftshader renders only a few fps.
const path = require('path');
const fs = require('fs');
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }

const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'
  + fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8') + '</body></html>';

(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await playwright.chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(proxy ? ['--ignore-certificate-errors'] : [])],
    ...(proxy ? { proxy: { server: proxy } } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**fonts.g*/**', r => r.abort());
  await page.route('http://just-paws.test/', r => r.fulfill({ body: html, contentType: 'text/html' }));
  for (const f of ['animations.js', 'perf.js'])
    await page.route('http://just-paws.test/' + f, r => r.fulfill({ body: fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), contentType: 'application/javascript' }));
  await page.goto('http://just-paws.test/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.JP && window.JP.dbg, null, { timeout: 60000 });
  await page.click('#start');

  const r = await page.evaluate(() => {
    const d = JP.dbg, P = d.P, H = d.heli, out = {};
    const key = (type, code) => dispatchEvent(new KeyboardEvent(type, { code }));
    const roof = d.roofs[0];
    P.pos.set(roof.x + roof.hw * 0.5, roof.base + roof.rh + 3, roof.z); P.vel.set(0, 0, 0); d.step(120);
    out.roof = { y: P.pos.y, expect: roof.base + roof.rh * 0.5, mode: P.mode };
    key('keydown', 'KeyJ'); const y0 = P.pos.y; d.step(90); out.jet = { mode: P.mode, climbed: P.pos.y - y0, fuel: P.fuel }; key('keyup', 'KeyJ'); d.step(10);
    P.pos.set(H.pos.x + 3, H.pos.y + 0.5, H.pos.z); P.vel.set(0, 0, 0); P.mode = 'air'; d.step(60);
    key('keydown', 'KeyE'); key('keyup', 'KeyE'); const hy = H.pos.y;
    key('keydown', 'Space'); d.step(180); key('keyup', 'Space');
    out.heli = { mode: P.mode, climbed: H.pos.y - hy };
    key('keydown', 'KeyE'); key('keyup', 'KeyE'); d.step(20); key('keydown', 'Space'); key('keyup', 'Space'); d.step(30);
    out.bail = { mode: P.mode };
    // gameplay after mesh merging: entities still resolvable from their meshes, things still move
    const meshesOf = g => { const a = []; g.traverse(o => { if (o.isMesh) a.push(o); }); return a; };
    out.ents = [...d.bots, ...d.props].every(e => meshesOf(e.g).every(m => m.userData.ent === e));
    const prop = d.props[0], p0 = prop.pos.clone();
    P.mode = 'air'; P.pos.set(p0.x - 2.5, p0.y - 0.5, p0.z); P.vel.set(14, 2, 0); d.step(20); d.step(40);
    out.prop = { moved: prop.pos.distanceTo(p0), knocked: prop.knocked };
    const bot = d.bots[0]; P.pos.set(bot.pos.x, bot.pos.y - 0.7, bot.pos.z); P.vel.set(0, 0, 0); P.mode = 'air'; d.step(2);
    out.bot = { busted: d.S.bots, alive: bot.alive };
    const ch = d.chickens[0]; P.pos.set(ch.pos.x, ch.pos.y - 0.7, ch.pos.z); d.step(2);
    out.chicken = { rescued: ch.rescued, count: d.S.chick };
    // digger: hop in, drive, scoop a crate, lift it, tip it out, then scoop dirt
    const G = d.dig, tip = new THREE.Vector3();
    P.pos.set(G.pos.x + 3, G.pos.y + 1, G.pos.z); P.vel.set(0, 0, 0); P.mode = 'air'; d.step(30);
    key('keydown', 'KeyE'); key('keyup', 'KeyE'); const dmode = P.mode, g0 = G.pos.clone();
    key('keydown', 'KeyW'); d.step(40); key('keyup', 'KeyW'); d.step(30);
    const drove = G.pos.distanceTo(g0);
    G.tip.getWorldPosition(tip); const crate = d.props.find(p => p.state === 'rest'); crate.pos.set(tip.x, d.ground(tip.x, tip.z) + 0.7, tip.z);
    key('keydown', 'KeyF'); key('keyup', 'KeyF'); const loaded = G.load.length;
    key('keydown', 'Space'); d.step(90); key('keyup', 'Space'); const lifted = crate.pos.y - d.ground(crate.pos.x, crate.pos.z);
    key('keydown', 'KeyF'); key('keyup', 'KeyF'); d.step(60); const tipped = G.load.length === 0 && crate.pos.distanceTo(tip) > 3;
    key('keydown', 'ShiftLeft'); d.step(90); key('keyup', 'ShiftLeft'); key('keydown', 'KeyF'); key('keyup', 'KeyF');
    out.dig = { mode: dmode, drove, loaded, lifted, tipped, dirt: G.dirt };
    key('keydown', 'KeyE'); key('keyup', 'KeyE'); d.step(10); out.dig.out = P.mode;
    for (let i = 0; i < 3; i++) { key('keydown', 'KeyV'); key('keyup', 'KeyV'); d.step(2); }
    // call in a ride: B opens the menu, 1 orders the car, it parachutes down next to you
    key('keydown', 'KeyR'); key('keyup', 'KeyR'); d.step(30);
    key('keydown', 'KeyB'); key('keyup', 'KeyB'); const menu = !document.getElementById('order').hidden;
    key('keydown', 'Digit1'); key('keyup', 'Digit1');
    const C = d.car, dropping = d.drops.length, hi = C.pos.y - d.ground(C.pos.x, C.pos.z);
    d.step(400);
    out.carDrop = { menu, closed: document.getElementById('order').hidden, dropping, hi, left: d.drops.length,
      dist: Math.hypot(C.pos.x - P.pos.x, C.pos.z - P.pos.z), onGround: Math.abs(C.pos.y - d.ground(C.pos.x, C.pos.z)) < 0.05 };
    P.pos.set(C.pos.x + 3, C.pos.y + 0.5, C.pos.z); P.mode = 'air'; d.step(30);
    key('keydown', 'KeyE'); key('keyup', 'KeyE'); out.carDrop.enter = P.mode; key('keydown', 'KeyE'); key('keyup', 'KeyE'); d.step(30);
    const hw = d.orderRide(d.RIDES[1]); d.step(400);
    out.heliDrop = { why: hw, landed: H.landed, dist: Math.hypot(H.pos.x - P.pos.x, H.pos.z - P.pos.z), again: d.orderRide(d.RIDES[1]) };
    const B = d.boat; P.pos.set(B.pos.x + 30, 0, B.pos.z); P.mode = 'swim'; d.step(5);
    const bw = d.orderRide(d.RIDES[2]); d.step(400);
    out.boatDrop = { why: bw, y: B.pos.y, depth: d.ground(B.pos.x, B.pos.z), left: d.drops.length };
    key('keydown', 'KeyR'); key('keyup', 'KeyR'); d.step(30);
    const Dg = d.dig, gw = d.orderRide(d.RIDES[3]); d.step(400);
    out.digDrop = { why: gw, dist: Math.hypot(Dg.pos.x - P.pos.x, Dg.pos.z - P.pos.z), left: d.drops.length };
    // online: another player at the Sky Whale's wheel moves our copy of it, and the wheel is taken
    const Sh = d.ship; d.MP.id = 'me';
    const tx = Sh.pos.x + 30, tz = Sh.pos.z + 20, ty = Sh.baseY + 12, tyaw = Sh.yaw + 1;
    for (let i = 0; i < 12; i++) { d.mpPeer({ id: 'captain', n: 'Luna', c: 2, s: [tx, ty, tz, 0, 12, 0, 0, 0, tyaw, 0] }, true); d.step(15); }
    out.shipSync = { off: Math.hypot(Sh.pos.x - tx, Sh.pos.z - tz), dy: Math.abs(Sh.baseY - ty), dyaw: Math.abs(Math.atan2(Math.sin(Sh.yaw - tyaw), Math.cos(Sh.yaw - tyaw))) };
    P.mode = 'air'; P.pos.set(Sh.pos.x, Sh.pos.y + Sh.deckY + 1, Sh.pos.z); P.vel.set(0, 0, 0); d.mpPeer({ id: 'captain', s: [tx, ty, tz, 0, 12, 0, 0, 0, tyaw, 0] }, true); d.step(5);
    key('keydown', 'KeyE'); key('keyup', 'KeyE'); out.shipSync.mode = P.mode;
    // big map: Tab unfolds it, K folds it, tapping the minimap unfolds it, tapping the big map folds it
    const bm = () => !document.getElementById('bigmap').hidden;
    out.bigMap = {};
    key('keydown', 'Tab'); key('keyup', 'Tab'); d.step(2); out.bigMap.tab = bm();
    const bc = document.getElementById('bigC'), px = bc.getContext('2d').getImageData(bc.width >> 1, bc.height >> 1, 1, 1).data;
    out.bigMap.drawn = bc.width > 100 && px[3] === 255;
    key('keydown', 'KeyK'); key('keyup', 'KeyK'); out.bigMap.k = bm();
    document.getElementById('map').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); out.bigMap.tap = bm();
    document.getElementById('bigmap').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); out.bigMap.tapClose = bm();
    // bedtime: the Kitty-Bots are lying down asleep, not hovering
    out.bed = Object.assign(d.bedtime(), { botsDown: d.bots.every(b => !b.alive || (b.sleepY !== undefined && Math.abs(b.pos.y - b.sleepY) < 0.1)) });
    // online: another player's car, sent 15x a second with uneven network delay, moves evenly on our screen
    P.mode = 'air'; const M = d.MP, x0 = d.car.pos.x + 40, z0 = d.car.pos.z, send = [], spd = [], turn = [];
    for (let i = 0, j = 7; i <= 45; i++) { j = (j * 9301 + 49297) % 233280; const t = i / 15; send.push({ at: 0.05 + t + 0.04 * j / 233280, k: t * 1000, s: [x0 + 20 * t, 2, z0, 0, 7, 20, 0, 0, 0.6 * t, 0] }); }
    let last = null, lastYaw = null;
    for (let f = 0; f <= 180; f++) {
      M.clock = f / 60; while (send.length && send[0].at <= M.clock) { const m = send.shift(); d.mpPeer({ id: 'racer', n: 'Tom', c: 1, s: m.s }, true, m.k / 1000); }
      d.mpUpdate(1 / 60, M.clock); const q = M.peers.get('racer'); if (!q) continue; const g = q.veh.car.g;
      if (f > 40) { spd.push((g.position.x - last) * 60); turn.push((g.rotation.y - lastYaw) * 60); }
      last = g.position.x; lastYaw = g.rotation.y;
    }
    M.clock = null;
    out.mpSmooth = { minSpeed: Math.min(...spd), maxSpeed: Math.max(...spd), minTurn: Math.min(...turn), maxTurn: Math.max(...turn) };
    return out;
  });
  await browser.close();

  const checks = [
    ['no page errors', errors.length === 0, errors],
    ['lands on pitched roof', Math.abs(r.roof.y - r.roof.expect) < 0.05 && r.roof.mode === 'ground', r.roof],
    ['jetpack climbs and burns fuel', r.jet.mode === 'jet' && r.jet.climbed > 5 && r.jet.fuel < 100, r.jet],
    ['helicopter lifts off', r.heli.mode === 'heli' && r.heli.climbed > 10, r.heli],
    ['bail out + parachute', r.bail.mode === 'chute', r.bail],
    ['merged meshes keep their entity', r.ents, r.ents],
    ['props get knocked', r.prop.knocked && r.prop.moved > 0.5, r.prop],
    ['kitty-bot busted by touch', r.bot.busted >= 1 && !r.bot.alive, r.bot],
    ['call in the car: menu, parachute drop, land next to you', r.carDrop.menu && r.carDrop.closed && r.carDrop.dropping === 1 && r.carDrop.hi > 30 && r.carDrop.left === 0 && r.carDrop.dist < 45 && r.carDrop.onGround && r.carDrop.enter === 'car', r.carDrop],
    ['call in the copter', r.heliDrop.why === '' && r.heliDrop.landed && r.heliDrop.dist < 45 && r.heliDrop.again === '', r.heliDrop],
    ['call in the boat onto water', r.boatDrop.why === '' && Math.abs(r.boatDrop.y) < 0.2 && r.boatDrop.depth < -3 && r.boatDrop.left === 0, r.boatDrop],
    ['call in the digger', r.digDrop.why === '' && r.digDrop.dist < 45 && r.digDrop.left === 0, r.digDrop],
    ['chicken rescued by touch', r.chicken.rescued && r.chicken.count === 1, r.chicken],
    ['digger drives, scoops, lifts and tips', r.dig.mode === 'dig' && r.dig.drove > 3 && r.dig.loaded === 1 && r.dig.lifted > 3 && r.dig.tipped && r.dig.dirt && r.dig.out !== 'dig', r.dig],
    ['big map folds out and back', r.bigMap.tab && r.bigMap.drawn && !r.bigMap.k && r.bigMap.tap && !r.bigMap.tapClose, r.bigMap],
    ['bedtime: Kitty-Bots asleep on the ground', r.bed.on && r.bed.botsDown, r.bed],
    ['online car moves smoothly', r.mpSmooth.minSpeed > 17 && r.mpSmooth.maxSpeed < 23 && r.mpSmooth.minTurn > 0.5 && r.mpSmooth.maxTurn < 0.7, r.mpSmooth],
    ['airship follows the online captain', r.shipSync.off < 3 && r.shipSync.dy < 2 && r.shipSync.dyaw < 0.2 && r.shipSync.mode !== 'ship', r.shipSync],
  ];
  let fail = 0;
  for (const [name, ok, info] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, ok && !process.env.V ? '' : JSON.stringify(info)); if (!ok) fail++; }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
