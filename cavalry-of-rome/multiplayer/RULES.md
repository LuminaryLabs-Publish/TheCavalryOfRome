# Cavalry of Rome — Cohorts, Supply & Momentum (MP-001)

**Version:** 1.0.0 | **Status:** Canonical tactical rules for campaign, practice, AI and PvP.

This is an original tactical system. Unlike section-command card games, normal formation orders are independent of cards. A player can command any legally available friendly formation by spending Command points. Doctrine cards are optional, single-use resource and morale effects; none grant permission to order a battlefield section.

## Activation and victory

The attacker acts first, then the defender; each pair of activations is a round. Commanders may finish an activation early. Elimination or rout of all enemy ready formations gives an immediate victory. A player can concede. At the end of 20 rounds, compare total remaining strength; ties are draws.

## Orders and resources

- Each activation begins with **4 Command** (maximum 6 after bonuses).
- Move a friendly formation **once** for **1 Command**. Attack **once** for **2 Command**. A formation may move and attack in one activation when enough Command remains.
- Rally costs **1 Command**, restores **25 morale** up to 100, and consumes that formation's movement and attack opportunities for the activation.
- Both sides start with **3 Supply** (maximum 6) and **0 Momentum** (maximum 4). Gain 1 Supply at the end of each activation.
- Dealing damage generates 1 Momentum. Entering a road/bridge generates 1 Momentum, at most once per activation.
- Once per activation, spend 2 Momentum for 1 additional Command, capped at 6.

## Doctrine deck

Each side has a *private seeded deck* of 24 cards, three copies of each doctrine. Draw an initial hand of four. A player may play at most one doctrine per activation and must pay its Supply cost. On finishing an activation, replenish toward four and deterministically reshuffle discards when the deck runs out. Playing no doctrine never blocks normal orders.

| Doctrine | Supply | Effect |
| --- | ---: | --- |
| Marching Cadence | 1 | +1 Command |
| Supply Train | 0 | +2 Supply |
| Eagle Vow | 2 | +15 morale for all living friendly formations |
| Lancer Signal | 1 | +1 Momentum if friendly heavy cavalry survives |
| Scouting Dispatch | 1 | +1 Command if friendly light scouts survive |
| Road Levy | 0 | +1 Supply if a friendly formation occupies road/bridge |
| Reserve Cohort | 2 | Restore 1 strength to the weakest damaged living friendly formation |
| Drum of Resolve | 1 | +20 morale to the lowest-morale living friendly formation |

All resource gains obey caps. A doctrine with no eligible target or an already-full resource has no effect and cannot be played.

## Combat geography

Use the deterministic hex core shared with the existing game. Light troops move up to 3 and have range 2. Medium troops move up to 2 and have range 1. Heavy cavalry moves up to 2 and has range 1 with a charge impact benefit. Terrain blocking, line of sight, morale, strength, counterattacks and rout are evaluated by the real game engine, without client overrides.

## Human, AI, and match integrity

Both players use identical legality checks and resources. The server stores full per-match state and returns redacted views without the opponent's hand or deck. Every action has a unique ID and an expected match version; a single process serializes writes and rejects stale, illegal or unauthorized actions. PeerJS only signals updated versions. Offline turns remain in durable storage.

The adaptive opponent performs online stochastic-gradient updates on public doctrine choices and tracks visible movement/attack aggression. Learned weights are exportable as an ONNX model. If `onnxruntime-node` is installed server-side or `onnxruntime-web` loads in the browser, inference runs the exported model. Otherwise, the equivalent numeric MatMul/Add inference is used. AI actions are sampled from the same legal action API as a human; no opponent hidden cards and no private state from another match are available. Vision recognition is optional, limited to public board imagery.

**Compatibility:** The historical `tactical/command-cards.mjs` and `tactical/demo.mjs` source stays available for regression tests only. Active campaign encounters, standalone practice and multiplayer all run `multiplayer/turn-rules.mjs`; no game mode uses the former directional-order cards.

## Single-player campaign integration

The strategic overworld, deployment, and casualty ledger remain authoritative for the campaign. Its tactical encounter iframe runs these exact rules against the learning AI. No legacy directional-command-card game is played on the live campaign path. The AI's 12-feature public-state opponent model trains from visible doctrine selection and actual movement/attacks during play; it is exported in ONNX format and can execute through optional ONNX Runtime. Results return to the existing campaign after validated completion.
