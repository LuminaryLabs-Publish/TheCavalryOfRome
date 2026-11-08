# Historical tactical prototype (not active gameplay)

Active campaign and PvP use `../multiplayer/index.html` with the original Cohorts, Supply & Momentum doctrine rules and adaptive opponent. The direct `/tactical/` entry redirects to adaptive AI practice; code below is retained for the baseline regression suite.

---

# Cavalry of Rome — Tactical Command Cards (3D)

This directory implements the 3D command-card battle for the existing Cavalry of Rome campaign. **The strategic game remains the root `cavalry-of-rome/` application.** When opposing armies encounter, its host opens this tactical screen and sends the current encounter board. Returning a battle result applies casualties, retreats and captures to the same campaign unit identities. The project also supports a demonstration battle if opened on its own.

## Play

Start the parent app with `npm run start` in `cavalry-of-rome/` and open its localhost URL. Use the strategic map to select and march Roman units into an enemy-held province. A command-card battle opens automatically. The independent tactical demo is served at `/tactical/`.

In battle, select a card from the illustrated bottom hand and press **PLAY CARD**, click an eligible Roman miniature, then click a highlighted movement hex or enemy. **END COMMAND** resolves enemy orders and draws a replacement card. **WITHDRAW** concedes the encounter. After battle, **RETURN TO CAMPAIGN** writes back unit casualties and territory ownership. Drag to orbit, scroll to zoom, 1–5 selects a hand card, Enter plays/ends, Esc clears the selection.

## Layout and authorship

- `campaign-scenario.mjs` maps actual published campaign encounter IDs and coordinates into battle-ready deployments without inventing units or changing the original game.
- `terrain-world.mjs` reproduces the published analytic world elevation, retains incoming terrain features, and configures the 3D battlefield at the actual encounter position.
- `sculpt-geometry.mjs` builds real draped hex geometry, roads, river banks, water, bridges when present, forests, rocks, and accent meshes.
- `webgl-battlefield.mjs` renders custom WebGL2 terrain and GLB miniatures, orbit controls, picking, and health/soldier-count labels.
- `hex-combat.mjs`, `command-cards.mjs` implement deterministic hex combat and the illustrated card-hand command restrictions.
- `assets/models/` contains six authored GLB troop miniatures (Roman/enemy light, medium, heavy).
- `assets/cards/` contains eight original Roman-inspired card illustrations, not reproductions of another game's art.
- `authoring/` retains procedural mesh generator source and model inspection evidence, prepared for Nexus authoring workflows. Native NexusAuthoring execution has not been independently verified.

The battle is intentionally a self-contained JS module inside an iframe, to preserve the published Three.js strategic renderer and UI while using the verified terrain authoring prototype. It is **not** a replacement for the strategic app or its source files.

## Verification

From the repository game directory, run `npm test` to execute both legacy and new tests. `node --check tactical/*.mjs` validates source syntax; GLB files are loaded and examined by the tactical tests. Automated tests cover deployment, card authorization, movement, troop identity, and campaign adapter contracts. Browser/GPU rendering needs visual acceptance in a browser that permits WebGL2 and local/GitHub Pages navigation. No GitHub Actions settings need modification.
