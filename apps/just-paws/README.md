# Just Paws

A Just Cause-style 3D browser game set in a Paw Patrol-inspired Adventure Bay. Fan project, family friendly: rescue chickens stuck on rooftops, bust Mayor Grumbleton's Kitty-Bots, cause cartoon chaos.

Play: https://claude.ai/artifact/5UT89YJF74HdhmNKqgFBeL (private Claude Artifact)

## What's in it
- Scout the pup: run, grappling hook (hook + parachute = slingshot), parachute, wingsuit, jetpack
- Pup Cruiser (car with ramps) and Pup Copter (helicopter on the pad east of the Lookout)
- Digger (gravko) at the dig site north of town: tracks turn on the spot, Space/Shift (UP/DOWN, A/B) moves the arm, F (SCOOP, X) scoops crates, barrels or dirt and tips them out
- Call in a ride (B, the 🪂 button or D-pad ◀ ▶): Pup Cruiser, Pup Copter, speedboat or digger drops in by parachute next to you, red smoke marks the spot; the boat lands on the nearest water
- Adventure Bay: Lookout (Pup HQ), town hall, bridge, lighthouse, mountain, beach
- Toon renderer: cel shading, screen-space ink outlines, sky dome, colour grading. Three looks: Golden Hour (default), Saturday Morning, Pastel Toy (switch with V or the ◐ button)
- Squash-and-stretch pup rig (trot/gallop, landings, chute/wingsuit poses), car suspension, copter hover
- Keyboard/mouse and touch controls
- Bedtime, by itself and not optional from 20:00 to 06:00 Danish time (a running game reloads into it): every animal lies down to sleep with floating Zs (pups, chickens, Kitty-Bots flop down, Scout dozes off after standing still ~3 s), night look with moon and stars, soft lullaby. Scout sleeps too and can't be moved (only the camera); the ride menu only offers a bed, which parachutes in and Scout sleeps in it. The look can't be switched then. `?sleep=1` forces it on in the daytime (the test uses it)
- New deploys load by themselves on the title screen or when the game comes back from the background; mid-game the ⟳ button lights up

## Files
- `index.html`: the whole game in one file. three.js r128 is loaded from cdnjs.
  It is the Artifact source, so it has no `<!doctype>`/`<html>`/`<head>`/`<body>` tags; the Artifact publisher adds them.
- `animations.js`: character and vehicle animation module (`window.JPAnim`), loaded with `<script src="animations.js">` and published as a supporting file next to the page. Hooks are the `ANIM.*` calls in `index.html`.
- `perf.js`: performance module (`window.JPPerf`): merges static meshes and rigid groups (fewer draw calls), shadow map every other frame, dynamic resolution. Also a supporting file. Meshes that move or hide later need `userData.noMerge = true` or a place in the exclude list.
- `tests/physics.test.js`: headless Playwright test (roofs, jetpack, helicopter, parachute, props, Kitty-Bots, chickens, look switching). It steps the simulation with `JP.dbg.step(n)`.

## Run locally
```bash
npx http-server apps/just-paws   # then open http://localhost:8080/index.html
node apps/just-paws/tests/physics.test.js
```
The page works without the wrapper tags, but browsers render it in quirks mode; the test wraps it the way the Artifact publisher does.

## Debug hooks
- `JP.setStyle('golden' | 'bold' | 'pastel')`
- `JP.shot({cam, look, fov, pup, car, bot})`: fixed camera for concept shots (before pressing Start)
- `JP.dbg`: `{P, heli, car, props, bots, chickens, S, roofH, roofs, step(n)}`
