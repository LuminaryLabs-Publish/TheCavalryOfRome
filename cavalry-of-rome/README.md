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


## Cohorts, Supply & Momentum — Active Tactical Game

The strategic campaign now launches multiplayer/index.html in offline campaign mode for real encounters. The original deterministic hex combat remains the rules foundation, but the active command layer uses a four-card doctrine hand, Supply, Momentum, and Command points. The opposing single-player commander uses the adaptive learning policy and the same legal API as a human, not the historical section-command card AI. Campaign casualties and territorial results still return through the validated existing overlay contract.

**Run single player:** `npm run start`. Start a march into hostile territory; the new doctrine encounter opens automatically.
**Run AI practice:** open `/multiplayer/index.html?practice=1`. The old `/tactical/` demo link redirects there.
**Run a local multiplayer server:** `npm run multiplayer:server` and open `http://localhost:8787/multiplayer/index.html`. Create or join independent persistent battles by invitation code; other players may be offline between turns.
**Run all regression suites:** `npm test`.

A public itch.io release requires an external HTTPS server with durable storage, configured CORS and real two-browser validation. PeerJS provides live-update hints but never authorizes or stores turns. See multiplayer/RULES.md and multiplayer/DEPLOYMENT.md. GitHub Actions workflows are unchanged.
