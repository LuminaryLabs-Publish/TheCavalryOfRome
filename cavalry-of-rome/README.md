# NexusEngine-CavalryOfRome

**Cavalry of Rome** is a deterministic browser tactics experiment for NexusEngine / NexusRealtime-style game architecture. The player commands a Roman auxiliary cavalry wing on the Sabine Road, selects formations, commits charges, rallies exhausted riders, and breaks three enemy lanes before morale collapses.

## Play

Open `index.html` from a static server.

```bash
npm run start
# then open http://localhost:5173
```

Controls:

| Input | Action |
|---|---|
| Click lane | Select target lane |
| `A` / `S` / `D` | Select left / center / right lane |
| `1` | Line formation |
| `2` | Wedge formation |
| `3` | Screen formation |
| `Space` | Charge selected lane |
| `R` | Rally |
| `N` | Restart scenario |

## Test

```bash
npm test
```

The tests exercise the game kit headlessly: initial state, command validation, charge resolution, state-scoped rally rejection, and victory progression.

## Architecture

The repository is intentionally split into the Nexus-style layers:

```txt
Runtime
  src/runtime.js

Game Kit / Domain Logic
  src/cavalry-of-rome-kit.js

Game Data
  src/level-01.js

Authored Sequence Hints
  src/sequences.js

Host / Renderer / Input
  index.html
  src/main.js
  src/renderer.js
  src/input-adapter.js

Headless Tests
  tests/cavalry-of-rome-kit.test.mjs
```

The renderer draws state only. Input queues public kit API calls. The kit owns deterministic battle rules, command validation, morale, cohesion, charge impact, enemy routs, victory, defeat, and restart.

## Debug Host

The browser host exposes:

```js
window.GameHost.getState()
window.GameHost.engine
window.GameHost.tick(1 / 60)
window.GameHost.stop()
window.GameHost.start()
```

Use this for state-first debugging instead of inspecting canvas pixels.

## Current Status

This is a playable v0.1 thin slice with no external dependencies. It is ready for iteration into fuller Roman cavalry domains: formations, command cadence, scouting, fatigue, terrain, enemy AI, campaign rewards, and replay-safe persistence.
