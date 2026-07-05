import assert from "node:assert/strict";
import { test } from "node:test";

import { createRealtimeGame } from "../src/runtime.js";
import { createCavalryOfRomeKit } from "../src/cavalry-of-rome-kit.js";
import { cavalryOfRomeLevel01 } from "../src/level-01.js";

function createEngine() {
  return createRealtimeGame({
    kits: [createCavalryOfRomeKit({ level: cavalryOfRomeLevel01 })]
  });
}

function runSeconds(engine, seconds) {
  const frames = Math.ceil(seconds * 60);
  for (let i = 0; i < frames; i += 1) {
    engine.tick(1 / 60);
  }
}

function runUntilNotCharging(engine, maxSeconds = 10) {
  const frames = Math.ceil(maxSeconds * 60);
  for (let i = 0; i < frames; i += 1) {
    engine.tick(1 / 60);
    if (engine.cavalry.getState().mode !== "charging") return;
  }
}

test("initial state is deterministic and inspectable", () => {
  const engine = createEngine();
  const state = engine.cavalry.getState();

  assert.equal(state.mode, "deploying");
  assert.equal(state.formation, "line");
  assert.equal(state.selectedLane, "center");
  assert.equal(Object.keys(state.lanes).length, 3);
  assert.equal(state.sequence.nodeId, "deploy");
});

test("formation and lane commands update state through the kit API", () => {
  const engine = createEngine();

  engine.cavalry.setFormation("wedge");
  engine.cavalry.selectLane("left");
  engine.tick(1 / 60);

  const state = engine.cavalry.getState();
  assert.equal(state.formation, "wedge");
  assert.equal(state.selectedLane, "left");
  assert.equal(state.mode, "maneuver");
  assert.equal(state.lastRejection, null);
});

test("a charge resolves impact and damages the selected enemy lane", () => {
  const engine = createEngine();

  engine.cavalry.setFormation("wedge");
  engine.cavalry.selectLane("right");
  engine.cavalry.charge();
  runSeconds(engine, 5);

  const state = engine.cavalry.getState();
  assert.ok(state.diagnostics.impacts >= 1);
  assert.ok(state.lanes.right.strength < cavalryOfRomeLevel01.lanes.find((lane) => lane.id === "right").strength);
  assert.notEqual(state.mode, "charging");
});

test("invalid commands reject without crashing or mutating unrelated state", () => {
  const engine = createEngine();

  engine.cavalry.setFormation("testudo");
  engine.tick(1 / 60);

  const state = engine.cavalry.getState();
  assert.equal(state.formation, "line");
  assert.match(state.lastRejection, /Unknown formation/);
  assert.equal(state.diagnostics.rejectedCommands, 1);
});

test("rally is state-scoped and cannot fire while charging", () => {
  const engine = createEngine();

  engine.cavalry.charge();
  engine.cavalry.rally();
  engine.tick(1 / 60);

  const state = engine.cavalry.getState();
  assert.equal(state.mode, "charging");
  assert.match(state.lastRejection, /Cannot rally during a charge/);
});

test("repeated tactical actions can win the scenario headlessly", () => {
  const engine = createEngine();

  for (const laneId of ["right", "left", "center"]) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const current = engine.cavalry.getState();
      if (current.lanes[laneId].status === "routed") break;

      if (current.player.cohesion < 55 || current.player.morale < 55) {
        engine.cavalry.rally();
        runSeconds(engine, 0.5);
      }

      const formation = engine.cavalry.getState().player.cohesion > 45 ? "wedge" : "screen";
      engine.cavalry.setFormation(formation);
      engine.cavalry.selectLane(laneId);
      engine.tick(1 / 60);
      engine.cavalry.charge();
      runUntilNotCharging(engine);
      runSeconds(engine, 0.5);
    }
  }

  const state = engine.cavalry.getState();
  assert.equal(state.mode, "victory");
  assert.equal(Object.values(state.lanes).every((lane) => lane.status === "routed"), true);
});
