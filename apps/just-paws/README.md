# Just Paws

A Just Cause-style 3D browser game set in a Paw Patrol-inspired Adventure Bay. Fan project, family friendly: rescue chickens stuck on rooftops, bust Mayor Grumbleton's Kitty-Bots, cause cartoon chaos.

Play: https://claude.ai/artifact/5UT89YJF74HdhmNKqgFBeL (private Claude Artifact)

## What's in it
- Scout the pup: run, grappling hook (hook + parachute = slingshot), parachute, wingsuit, jetpack
- Pup Cruiser (car with ramps) and Pup Copter (helicopter on the pad east of the Lookout)
- Adventure Bay: Lookout (Pup HQ), town hall, bridge, lighthouse, mountain, beach
- Toon renderer: cel shading, screen-space ink outlines, sky dome, colour grading. Three looks: Golden Hour (default), Saturday Morning, Pastel Toy (switch with V or the ◐ button)
- Keyboard/mouse and touch controls

## Files
- `index.html`: the whole game in one file. three.js r128 is loaded from cdnjs.
  It is the Artifact source, so it has no `<!doctype>`/`<html>`/`<head>`/`<body>` tags; the Artifact publisher adds them.
- `tests/physics.test.js`: headless Playwright test (roofs, jetpack, helicopter, parachute). It steps the simulation with `JP.dbg.step(n)`.

## Run locally
```bash
npx http-server apps/just-paws   # then open http://localhost:8080/index.html
node apps/just-paws/tests/physics.test.js
```
The page works without the wrapper tags, but browsers render it in quirks mode; the test wraps it the way the Artifact publisher does.

## Debug hooks
- `JP.setStyle('golden' | 'bold' | 'pastel')`
- `JP.shot({cam, look, fov, pup, car, bot})`: fixed camera for concept shots (before pressing Start)
- `JP.dbg`: `{P, heli, roofH, roofs, step(n)}`
