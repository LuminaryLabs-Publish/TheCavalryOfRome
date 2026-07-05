# Cavalry of Rome — Architecture

## Layer Map

```txt
Runtime
  deterministic tick, resources, events, systems

Cavalry of Rome Kit
  battle state, events, command validation, charge resolution

Sequence Data
  authored tutorial and pressure hints

Host
  browser boot, frame loop, debug host

Renderer
  Canvas presentation only
```

## Runtime Contract

`src/runtime.js` provides a small deterministic runtime with:

```txt
resources
events
tick-scoped event queues
phased systems
runtime-kit installation
```

No browser API is used by systems.

## Kit Boundary

`src/cavalry-of-rome-kit.js` owns:

```txt
Roman unit state
enemy lane state
formation changes
lane selection
charge start
charge travel
impact resolution
rally validation
victory/defeat/restart
```

The kit does **not** draw pixels, read keyboard input, create DOM nodes, or run `requestAnimationFrame`.

## Renderer Boundary

`src/renderer.js` owns:

```txt
Canvas resize
battlefield drawing
lane picking to object ids
HUD drawing
world-space labels
```

Renderer picking returns a lane id. It does not complete objectives or mutate the battle.

## Input Boundary

`src/input-adapter.js` maps browser input into the public kit API:

```js
engine.cavalry.setFormation("wedge")
engine.cavalry.selectLane("left")
engine.cavalry.charge()
engine.cavalry.rally()
```

Input requests actions. The kit validates and decides outcomes.

## Debug Contract

`window.GameHost.getState()` returns the authoritative game resource. The canvas is presentation; resource state is truth.
