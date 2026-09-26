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
    for (let i = 0; i < 3; i++) { key('keydown', 'KeyV'); key('keyup', 'KeyV'); d.step(2); }
    return out;
  });
  // Pup HQ is walk-in, and round things collide as round things
  const hq = await page.evaluate(() => {
    const d = JP.dbg, W = JP.world, H = W.HQ, E = W.elev, P = d.P, L = W.LOOK, out = {};
    const key = (type, code) => dispatchEvent(new KeyboardEvent(type, { code }));
    const put = (x, y, z) => { P.slide = null; P.pos.set(x, y, z); P.vel.set(0, 0, 0); P.mode = 'ground'; };
    const walk = (yaw, n) => { d.cam.yaw = yaw; key('keydown', 'KeyW'); d.step(n); key('keyup', 'KeyW'); d.step(10); };
    const r = () => Math.hypot(P.pos.x - L.x, P.pos.z - L.z);
    d.step(200);   // let the elevator settle wherever it parked
    put(L.x, H.FY + 0.2, L.z - 16); walk(0, 110);
    out.door = { r: r(), y: P.pos.y - H.FY };
    d.step(40); out.rideStart = E.dir; d.step(360);
    out.lift = { py: P.pos.y - H.PF, ey: E.y - H.PF, r: r(), mode: P.mode };
    walk(H.deckA, 70); out.balcony = { r: r(), y: P.pos.y - H.PF };
    put(L.x + Math.sin(H.deckA + 1.6) * 9, H.PF + 0.1, L.z + Math.cos(H.deckA + 1.6) * 9); walk(H.deckA + 1.6, 90);
    out.parapet = { r: r(), y: P.pos.y - H.PF };
    put(L.x, H.FY + 0.2, L.z - 6); d.step(400);   // elevator went back down? call it from the pod then
    put(L.x + Math.sin(H.deckA) * 6, H.PF + 0.1, L.z + Math.cos(H.deckA) * 6); walk(H.deckA + Math.PI, 20);
    out.topDoorShut = { r: r(), elevUp: E.y > H.PF - 0.01 };
    d.step(400); out.called = { ey: E.y - H.PF };
    put(L.x, H.FY + 0.2, L.z + 16); walk(Math.PI, 120); out.wall = { r: r() };
    const si = H.slideIn; put(si.x, H.PF + 0.1, si.z); d.step(2); out.slideOn = !!P.slide; d.step(400);
    out.slide = { on: !!P.slide, y: P.pos.y, g: H.g, mode: P.mode };
    // lighthouse: the collider is the round tower, not a box inside it
    put(W.LH.x + 12, d.ground(W.LH.x + 12, W.LH.z) + 0.2, W.LH.z); walk(-Math.PI / 2, 120);
    out.lighthouse = Math.hypot(P.pos.x - W.LH.x, P.pos.z - W.LH.z);
    // heli pad: stand on its round edge
    put(W.PAD.x + 6.7, W.PAD.y + 1, W.PAD.z); d.step(60); out.pad = P.pos.y - W.PAD.y;
    // a tree trunk blocks you
    const tr = W.boxes.find(b => b.tree && d.ground(b.x, b.z) > 3 && Math.abs(d.ground(b.x - 8, b.z) - d.ground(b.x, b.z)) < 1.5);
    put(tr.x - 8, d.ground(tr.x - 8, tr.z) + 0.2, tr.z); walk(Math.PI / 2, 90); out.tree = { dx: tr.x - P.pos.x, r: tr.r };
    // the parked Pup Cruiser has a roof you can stand on
    const car = d.car; put(car.pos.x, car.pos.y + 6, car.pos.z); P.mode = 'air'; d.step(90); out.carRoof = P.pos.y - car.pos.y;
    // walking into the side of a ramp does not lift you on top of it
    const rp = W.ramps[0], sx = Math.cos(rp.ang), sz = -Math.sin(rp.ang), ux = Math.sin(rp.ang), uz = Math.cos(rp.ang);
    const mx = rp.x + ux * rp.L * 0.8, mz = rp.z + uz * rp.L * 0.8;
    put(mx + sx * (rp.W / 2 + 3), d.ground(mx + sx * (rp.W / 2 + 3), mz + sz * (rp.W / 2 + 3)) + 0.1, mz + sz * (rp.W / 2 + 3));
    walk(Math.atan2(-sx, -sz), 60); out.ramp = { y: P.pos.y - rp.base, h: rp.H * 0.8 };
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
    ['chicken rescued by touch', r.chicken.rescued && r.chicken.count === 1, r.chicken],
    ['walk in through the Pup HQ door', hq.door.r < 3 && Math.abs(hq.door.y) < 0.3, hq.door],
    ['elevator carries you to the lookout', hq.rideStart !== 0 && Math.abs(hq.lift.py) < 0.1 && Math.abs(hq.lift.ey) < 0.01 && hq.lift.r < 2.5, hq],
    ['out on the balcony', hq.balcony.r > 8 && hq.balcony.r < 10.2 && Math.abs(hq.balcony.y) < 0.1, hq.balcony],
    ['balcony parapet holds you', hq.parapet.r < 9.6 && Math.abs(hq.parapet.y) < 0.1, hq.parapet],
    ['shaft door shut while the elevator is away', !hq.topDoorShut.elevUp && hq.topDoorShut.r > 3.5, hq.topDoorShut],
    ['elevator comes when called', Math.abs(hq.called.ey) < 0.01, hq.called],
    ['Pup HQ wall blocks', hq.wall.r > 10.9 && hq.wall.r < 11.4, hq.wall],
    ['slide down to the roof terrace', hq.slideOn && !hq.slide.on && hq.slide.y < hq.slide.g + 10, hq.slide],
    ['lighthouse is round', hq.lighthouse > 4.5 && hq.lighthouse < 5, hq.lighthouse],
    ['helipad edge holds you', Math.abs(hq.pad) < 0.05, hq.pad],
    ['tree trunks block', hq.tree.dx > hq.tree.r + 0.6 && hq.tree.dx < hq.tree.r + 1, hq.tree],
    ['stand on the parked car', hq.carRoof > 2 && hq.carRoof < 2.6, hq.carRoof],
    ['ramp side is a wall', hq.ramp.y < 1, hq.ramp],
  ];
  let fail = 0;
  for (const [name, ok, info] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, ok ? '' : JSON.stringify(info)); if (!ok) fail++; }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
