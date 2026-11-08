# Cavalry of Rome — Persistent Multiplayer (MP-001)

This adds an original, turn-based **Cohorts, Supply & Momentum** ruleset, independent private doctrine hands, two-human matches, adaptive AI, persistent HTTP match storage, and optional PeerJS live notifications. The multiplayer game and the existing single-player campaign now share this ruleset. The previous section-command tactical prototype is retired from the active gameplay path, though its source remains for archived regression coverage.

## Start a local match server

Requirements: Node 22+, a writable directory, a static browser. From `cavalry-of-rome/`:

```sh
npm run multiplayer:start
# http://localhost:8787
```

The Node server serves `/multiplayer/` and the existing `/tactical/` assets. It writes the match database by default to `../.cavalry-mp-data/matches.json`. Use `CAVALRY_DATA_FILE` for a persistent-volume path.

To run tests from `cavalry-of-rome/`, use `npm test` (includes multiplayer tests) or `npm run multiplayer:test`.

## Play with another person

Open `http://localhost:8787` (or the deployed client), enter a commander name, and choose **Challenge a Friend**. Give the eight-character invitation code to the other player. Their own browser creates a distinct guest identity and uses **Join by invitation code**. Each player sees only their own doctrine hand. Take turns at any time; the browser may be closed between turns. The player can open several battles and switch between them.

For AI practice, select **Face Adaptive AI**, or load `multiplayer/index.html?practice=1` offline. The main strategic single-player campaign also opens this interface automatically when an encounter starts, passing its real geographic encounter and unit identities. The AI observes the player's public doctrine/action history, updates its model online and acts after the human ends an activation. To download a learned model snapshot, call `GET /api/matches/{match-id}/onnx` with the player's Bearer token. The campaign AI persists its learned policy in browser storage between encounters when permitted. The private recovery token is an account credential: store it securely, never share it with opponents, and never put it into a match URL.

## Backend configuration

```sh
HOST=0.0.0.0 PORT=8787 \
CAVALRY_DATA_FILE=/data/cavalry/matches.json \
CORS_ORIGINS='https://html-classic.itch.zone,https://html.itch.zone,https://yourdomain.example' \
node multiplayer/server/index.mjs
```

Production requires HTTPS termination, a persistent volume, a single writer process, backups, and a trusted deployment target. The current JSON store is deliberately **single-process** and not intended for horizontally scaled production. A PostgreSQL transaction store is a logical next step for scale and account management.

`PeerJS` is loaded from a pinned CDN script. If WebRTC signaling is unavailable, clients still poll the authoritative server every 7.5 seconds and can submit asynchronous turns. `PeerJS` never carries hidden hands, tokens or unvalidated turn results. Deploy a PeerServer and explicit TURN/STUN configuration as production traffic grows.

Optional ONNX inference acceleration: `npm install --no-save onnxruntime-node`; the model's weights are trained online in pure JavaScript and exported as a valid ONNX snapshot. ONNX Runtime Node executes inference, not a training session. The ONNX ModelProto contains an online-updated opponent-behavior policy, not an image encoder. If onnxruntime-web is available in the browser (or onnxruntime-node on the server), the current ONNX snapshot is executed for inference; otherwise its MatMul/Add evaluator runs directly in JS. The behavior model trains through public doctrine/action observations using stochastic-gradient updates between decisions. No image vision model is bundled; hidden information is never used.

## itch.io deployment

The itch ZIP must have `index.html` at its top level, plus the complete `multiplayer/` and `tactical/` client assets. The production package also contains the existing strategic game, which can be opened in single player without a match server. Use the included `multiplayer/itch/index.html` as the itch entry page or set the site's launch to `multiplayer/index.html` after repackaging. **itch.io hosts only the client**; the HTTPS Node match server must be deployed separately. In the game, set the **Match server HTTPS URL** and save. For a production itch build, preconfigure the backend URL and restrict CORS to the actual itch frame origin.

Before advertising multiplayer publicly, verify real two-device browser turns and reconnection in the itch iframe, WebGL2/GLB loading, HTTPS/CORS, PeerJS connectivity, live ONNX Runtime optional inference, and database recovery after restart. The browser sandbox may block localhost despite a working HTTP API; do not call that a completed browser regression.

## API contract

- `GET /api/health`
- `POST /api/identity` and `GET /api/identity` (auth except create)
- `POST /api/matches` (`mode: "human" | "ai"`)
- `POST /api/matches/join` (`inviteCode`)
- `GET /api/matches` and `GET /api/matches/:id`
- `POST /api/matches/:id/commands` (`actionId`, `expectedVersion`, `command`)
- `POST /api/matches/:id/peer` (`peerId`, transient presence)
- `GET /api/matches/:id/onnx` (AI matches, authenticated)

All authenticated APIs use `Authorization: Bearer <private-token>`.

Full rules: [RULES.md](./RULES.md).

## Campaign integration

The existing `src/tactical-overlay.js` sends its battle packet to `/multiplayer/index.html` via a same-origin named iframe. Offline campaign mode uses the same `turn-rules.mjs`, 3D terrain/GLB assets, authored encounter data, and `opponent-ai.mjs` policy used by the persistent server. On victory, defeat, or concession, the player presses **RETURN TO CAMPAIGN**; the original host validates the unit ledger and applies casualties and conquest exactly once. When browser storage is permitted, the AI policy persists between single-player battles and battle state survives an iframe reload.

The old `/tactical/` URL redirects to the new offline adaptive-AI practice mode. Historical JS modules remain for backwards-compatibility tests, but no active single-player UI uses the old section-command cards.
