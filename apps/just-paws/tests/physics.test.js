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
  await page.route('http://just-paws.test/animations.js', r => r.fulfill({ body: fs.readFileSync(path.join(__dirname, '..', 'animations.js'), 'utf8'), contentType: 'application/javascript' }));
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
    return out;
  });
  await browser.close();

  const checks = [
    ['no page errors', errors.length === 0, errors],
    ['lands on pitched roof', Math.abs(r.roof.y - r.roof.expect) < 0.05 && r.roof.mode === 'ground', r.roof],
    ['jetpack climbs and burns fuel', r.jet.mode === 'jet' && r.jet.climbed > 5 && r.jet.fuel < 100, r.jet],
    ['helicopter lifts off', r.heli.mode === 'heli' && r.heli.climbed > 10, r.heli],
    ['bail out + parachute', r.bail.mode === 'chute', r.bail],
  ];
  let fail = 0;
  for (const [name, ok, info] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`, ok ? '' : JSON.stringify(info)); if (!ok) fail++; }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
