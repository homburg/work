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
    // online: another player at the Sky Whale's wheel moves our copy of it, and the wheel is taken
    const Sh = d.ship; d.MP.id = 'me';
    const tx = Sh.pos.x + 30, tz = Sh.pos.z + 20, ty = Sh.baseY + 12, tyaw = Sh.yaw + 1;
    for (let i = 0; i < 12; i++) { d.mpPeer({ id: 'captain', n: 'Luna', c: 2, s: [tx, ty, tz, 0, 12, 0, 0, 0, tyaw, 0] }, true); d.step(15); }
    out.shipSync = { off: Math.hypot(Sh.pos.x - tx, Sh.pos.z - tz), dy: Math.abs(Sh.baseY - ty), dyaw: Math.abs(Math.atan2(Math.sin(Sh.yaw - tyaw), Math.cos(Sh.yaw - tyaw))) };
    P.mode = 'air'; P.pos.set(Sh.pos.x, Sh.pos.y + Sh.deckY + 1, Sh.pos.z); P.vel.set(0, 0, 0); d.mpPeer({ id: 'captain', s: [tx, ty, tz, 0, 12, 0, 0, 0, tyaw, 0] }, true); d.step(5);
    key('keydown', 'KeyE'); key('keyup', 'KeyE'); out.shipSync.mode = P.mode;
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
    ['airship follows the online captain', r.shipSync.off < 3 && r.shipSync.dy < 2 && r.shipSync.dyaw < 0.2 && r.shipSync.mode !== 'ship', r.shipSync],
  ];
  let fail = 0;
  for (const [name, ok, info] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, ok ? '' : JSON.stringify(info)); if (!ok) fail++; }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
