import assert from "node:assert/strict";
import { test } from "node:test";

import { createRealtimeGame } from "../src/runtime.js";
import { createCavalryOfRomeKit, createMarchRoute, routePointAt, segmentIntersection } from "../src/cavalry-of-rome-kit.js";
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

test("deployment overlook does not decay before the first command", () => {
  const engine = createEngine();
  runSeconds(engine, 120);

  const state = engine.cavalry.getState();
  assert.equal(state.mode, "deploying");
  assert.equal(state.player.morale, cavalryOfRomeLevel01.player.morale);
  assert.equal(state.player.cohesion, cavalryOfRomeLevel01.player.cohesion);
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

test("province marches keep route metadata and unit flavor", () => {
  const engine = createEngine();
  const state = engine.cavalry.getState();
  const sourceRegionId = "hispania";
  const light = state.campaign.units.find((unit) => unit.regionId === sourceRegionId && unit.unitType === "light" && unit.status === "garrison");
  const heavy = state.campaign.units.find((unit) => unit.regionId === sourceRegionId && unit.unitType === "heavy" && unit.status === "garrison");

  engine.cavalry.selectUnit(light.id);
  engine.tick(1 / 60);
  engine.cavalry.selectUnit(heavy.id, true);
  engine.tick(1 / 60);
  engine.cavalry.moveUnits("italia");
  engine.tick(1 / 60);

  const march = engine.cavalry.getState().campaign.marches[0];
  assert.equal(march.route.fromRegionId, sourceRegionId);
  assert.equal(march.route.toRegionId, "italia");
  assert.equal(march.units.some((unit) => unit.unitType === "heavy" && unit.mounted), true);
  assert.equal(march.units.some((unit) => unit.unitType === "light" && unit.javelins), true);
  assert.ok(march.currentPosition);
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

test("crossing march routes create an encounter", () => {
  const engine = createEngine();
  const state = engine.cavalry.getState();
  const campaign = state.campaign;
  const regionIds = Object.keys(campaign.regions);
  let selected = null;

  for (let a = 0; a < regionIds.length && !selected; a += 1) {
    for (let b = a + 1; b < regionIds.length && !selected; b += 1) {
      const routeA = createMarchRoute(campaign, regionIds[a], regionIds[b]);
      if (!routeA) continue;
      for (let c = 0; c < regionIds.length && !selected; c += 1) {
        for (let d = c + 1; d < regionIds.length && !selected; d += 1) {
          if (a === c && b === d) continue;
          const routeB = createMarchRoute(campaign, regionIds[c], regionIds[d]);
          if (!routeB) continue;
          const hit = segmentIntersection(routeA.start, routeA.end, routeB.start, routeB.end);
          if (hit) selected = { routeA, routeB, hit, a: regionIds[a], b: regionIds[b], c: regionIds[c], d: regionIds[d] };
        }
      }
    }
  }

  assert.ok(selected, "Expected at least one intersecting route pair");

  campaign.marches = [
    {
      id: "march-a",
      owner: "rome",
      unitIds: ["a"],
      units: [{ id: "a", label: "Light 1", unitType: "light", soldiers: 24, owner: "rome", mounted: false, javelins: true, rank: 0 }],
      count: 1,
      soldiers: 24,
      fromRegionId: selected.a,
      toRegionId: selected.b,
      startedAt: 0,
      durationSeconds: 120,
      remainingSeconds: 120 * (1 - selected.hit.ua),
      progress: selected.hit.ua,
      status: "marching",
      route: selected.routeA,
      currentPosition: routePointAt(selected.routeA, selected.hit.ua)
    },
    {
      id: "march-b",
      owner: "blue",
      unitIds: ["b"],
      units: [{ id: "b", label: "Heavy 1", unitType: "heavy", soldiers: 64, owner: "blue", mounted: true, javelins: false, rank: 0 }],
      count: 1,
      soldiers: 64,
      fromRegionId: selected.c,
      toRegionId: selected.d,
      startedAt: 0,
      durationSeconds: 120,
      remainingSeconds: 120 * (1 - selected.hit.ub),
      progress: selected.hit.ub,
      status: "marching",
      route: selected.routeB,
      currentPosition: routePointAt(selected.routeB, selected.hit.ub)
    }
  ];

  engine.tick(1 / 60);

  const next = engine.cavalry.getState();
  assert.equal(next.campaign.encounter?.active, true);
  assert.equal(next.campaign.encounter?.kind, "collision");
  assert.ok(next.campaign.marches.some((march) => march.status === "encountering"));
  assert.ok(next.campaign.encounter.participantCount >= 2);
});

test("arrival-triggered encounters expose opening engagement and hex troop board", () => {
  const engine = createEngine();
  const state = engine.cavalry.getState();
  const units = ["light", "medium", "heavy"].map((unitType) => (
    state.campaign.units.find((candidate) => candidate.regionId === "hispania" && candidate.unitType === unitType && candidate.status === "garrison")
  ));

  engine.cavalry.selectUnit(units[0].id);
  engine.tick(1 / 60);
  engine.cavalry.selectUnit(units[1].id, true);
  engine.tick(1 / 60);
  engine.cavalry.selectUnit(units[2].id, true);
  engine.tick(1 / 60);
  engine.cavalry.moveUnits("italia");
  engine.tick(1 / 60);

  const march = engine.cavalry.getState().campaign.marches[0];
  march.remainingSeconds = 0;
  march.progress = 1;
  march.currentPosition = routePointAt(march.route, 1);
  engine.tick(1 / 60);

  const next = engine.cavalry.getState();
  const encounter = next.campaign.encounter;
  assert.equal(encounter?.active, true);
  assert.equal(encounter?.kind, "arrival");
  assert.ok(encounter.hex.radius > 0);
  assert.equal(encounter.camera.perspective, "attacker-rear");
  assert.ok(encounter.camera.fov < 60);
  assert.equal(encounter.engagement.defenderHeavyCount, 5);
  assert.equal(encounter.engagement.dice.length, 5);
  assert.equal(encounter.engagement.openingStrength, encounter.engagement.dice.reduce((sum, die) => sum + die.result, 0));
  assert.equal(encounter.engagement.attackerTroopsCommitted, 3);
  assert.equal(encounter.board.attackerCount, 3);
  assert.equal(encounter.board.defenderCount, Math.min(encounter.engagement.openingStrength, encounter.board.defenderAvailableCount));
  assert.equal(encounter.board.cells.length, encounter.board.attackerCount + encounter.board.defenderCount);
  assert.deepEqual(new Set(encounter.board.cells.filter((cell) => cell.side === "attacker").map((cell) => cell.unitType)), new Set(["light", "medium", "heavy"]));
  assert.equal(new Set(encounter.board.cells.map((cell) => `${cell.q},${cell.r}`)).size, encounter.board.cells.length);
});

test("arrivals into empty provinces complete without an encounter", () => {
  const engine = createEngine();
  const state = engine.cavalry.getState();
  state.campaign.units = state.campaign.units.filter((unit) => unit.regionId !== "britannia");
  const unit = state.campaign.units.find((candidate) => candidate.regionId === "hispania" && candidate.unitType === "light" && candidate.status === "garrison");

  engine.cavalry.selectUnit(unit.id);
  engine.tick(1 / 60);
  engine.cavalry.moveUnits("britannia");
  engine.tick(1 / 60);

  const march = engine.cavalry.getState().campaign.marches[0];
  march.remainingSeconds = 0;
  march.progress = 1;
  march.currentPosition = routePointAt(march.route, 1);
  engine.tick(1 / 60);

  const next = engine.cavalry.getState();
  const arrived = next.campaign.units.find((candidate) => candidate.id === unit.id);
  assert.equal(next.campaign.encounter, null);
  assert.equal(next.campaign.marches.length, 0);
  assert.equal(arrived.status, "garrison");
  assert.equal(arrived.regionId, "britannia");
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
