# Experiment Contract: Cavalry of Rome

## Route

```txt
experiments/cavalry-of-rome/
```

## Status

Playable v0.1 thin slice.

## Player Promise

Command a Roman auxiliary cavalry wing, choose lanes and formations, commit charges, rally exhausted riders, and break the raider line before morale and cohesion collapse.

## NexusRealtime Layer Map

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

## Gate Target

This experiment currently targets the **First Playable Experiment** milestone:

- clear objective
- state-scoped input
- deterministic kit-owned battle rules
- restart path
- visible errors
- debug host
- headless tests

## Promotion Watch

Reusable candidates to split later:

```txt
formation-command-kit
morale-cohesion-kit
charge-resolution-kit
enemy-lane-pressure-kit
battle-objective-kit
```
