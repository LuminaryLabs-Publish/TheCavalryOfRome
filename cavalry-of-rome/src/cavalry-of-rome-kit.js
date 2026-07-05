import {
  defineEvent,
  defineResource,
  defineRuntimeKit
} from "./runtime.js";

import {
  advanceCavalrySequence,
  createSequenceState
} from "./sequences.js";

export const CAVALRY_OF_ROME_KIT_VERSION = "0.1.0";

export const CavalryState = defineResource("cavalryOfRome.state");

export const FormationRequested = defineEvent("cavalry.formation.requested");
export const LaneSelected = defineEvent("cavalry.lane.selected");
export const ChargeRequested = defineEvent("cavalry.charge.requested");
export const ChargeStarted = defineEvent("cavalry.charge.started");
export const ImpactResolved = defineEvent("cavalry.impact.resolved");
export const RallyRequested = defineEvent("cavalry.rally.requested");
export const EnemyRouted = defineEvent("cavalry.enemy.routed");
export const BattleCompleted = defineEvent("cavalry.battle.completed");
export const BattleFailed = defineEvent("cavalry.battle.failed");
export const CommandRejected = defineEvent("cavalry.command.rejected");
export const RestartRequested = defineEvent("cavalry.restart.requested");

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatPercent(value) {
  return Math.round(value);
}

function makeLogEntry(world, message, type = "info") {
  return {
    frame: world.__nexusClock.frame,
    at: Number(world.__nexusClock.elapsed.toFixed(2)),
    type,
    message
  };
}

function appendLog(state, entry) {
  state.commandLog = [entry, ...(state.commandLog ?? [])].slice(0, 8);
}

function createInitialState(level) {
  const lanes = Object.fromEntries(
    (level.lanes ?? []).map((lane) => [
      lane.id,
      {
        ...clone(lane),
        maxStrength: lane.strength,
        maxMorale: lane.morale,
        status: "holding",
        routedAt: null
      }
    ])
  );

  return {
    id: level.id ?? "cavalry-of-rome",
    version: CAVALRY_OF_ROME_KIT_VERSION,
    title: level.title ?? "Cavalry of Rome",
    objective: level.objective ?? "Break the enemy line.",
    mode: "deploying",
    formation: "line",
    selectedLane: level.lanes?.[1]?.id ?? level.lanes?.[0]?.id ?? null,
    targetLane: null,
    player: {
      ...clone(level.player ?? {}),
      momentum: 0,
      chargeDistance: 0,
      rallyCooldown: 0
    },
    formations: clone(level.formations ?? {}),
    lanes,
    routedCount: 0,
    score: 0,
    lastEvent: null,
    lastRejection: null,
    commandLog: [],
    sequence: createSequenceState(level.sequence),
    diagnostics: {
      impacts: 0,
      rejectedCommands: 0,
      totalDamage: 0
    }
  };
}

function emitRejection(world, state, reason, command = "unknown") {
  state.lastRejection = reason;
  state.diagnostics.rejectedCommands += 1;
  appendLog(state, makeLogEntry(world, reason, "reject"));
  world.emit(CommandRejected, { command, reason });
}

function activeEnemyLanes(state) {
  return Object.values(state.lanes).filter((lane) => lane.status !== "routed");
}

function resolveImpact(world, state) {
  const lane = state.lanes[state.targetLane];
  if (!lane || lane.status === "routed") {
    state.mode = "maneuver";
    state.targetLane = null;
    state.player.momentum = 0;
    return;
  }

  const formation = state.formations[state.formation] ?? state.formations.line;
  const momentum = clamp(state.player.momentum, 10, 100);
  const fatiguePenalty = clamp(1 - state.player.fatigue / 145, 0.35, 1);
  const cohesionFactor = clamp(state.player.cohesion / 85, 0.35, 1.2);
  const laneResistance = Number(lane.resistance ?? 1);

  const impactDamage = Math.max(4, Math.round((momentum / 8) * formation.impact * fatiguePenalty * cohesionFactor / laneResistance));
  const moraleDamage = Math.max(6, Math.round(impactDamage * 1.45 + momentum / 8));
  const counterDamage = Math.max(0, Math.round((lane.strength / 18) * laneResistance / formation.defense));
  const cohesionLoss = Math.max(4, Math.round(counterDamage * 1.8 + formation.cohesionDrain * 4));

  lane.strength = clamp(lane.strength - impactDamage, 0, lane.maxStrength);
  lane.morale = clamp(lane.morale - moraleDamage, 0, lane.maxMorale);

  state.player.troopers = clamp(state.player.troopers - Math.floor(counterDamage / 3), 0, levelSafePlayerTroopers(state));
  state.player.cohesion = clamp(state.player.cohesion - cohesionLoss, 0, 100);
  state.player.morale = clamp(state.player.morale - Math.floor(counterDamage / 2), 0, 100);
  state.player.fatigue = clamp(state.player.fatigue + 6 + formation.cohesionDrain * 4, 0, 100);
  state.player.momentum = 0;
  state.player.chargeDistance = 0;
  state.mode = "maneuver";

  state.diagnostics.impacts += 1;
  state.diagnostics.totalDamage += impactDamage;

  const impactEvent = world.emit(ImpactResolved, {
    laneId: lane.id,
    damage: impactDamage,
    moraleDamage,
    counterDamage,
    formation: state.formation
  });
  state.lastEvent = impactEvent.type;
  appendLog(
    state,
    makeLogEntry(
      world,
      `${formation.label} impact on ${lane.enemyLabel}: -${impactDamage} strength, -${moraleDamage} morale.`,
      "impact"
    )
  );

  if ((lane.strength <= 0 || lane.morale <= 0) && lane.status !== "routed") {
    lane.status = "routed";
    lane.routedAt = world.__nexusClock.frame;
    state.routedCount += 1;
    state.score += 100 + Math.round(state.player.morale + state.player.cohesion - state.player.fatigue / 2);
    world.emit(EnemyRouted, { laneId: lane.id, enemyLabel: lane.enemyLabel });
    appendLog(state, makeLogEntry(world, `${lane.enemyLabel} routed from ${lane.label}.`, "success"));
  }

  if (activeEnemyLanes(state).length > 0) {
    const nextLane = activeEnemyLanes(state).sort((a, b) => a.distance - b.distance)[0];
    state.selectedLane = nextLane?.id ?? state.selectedLane;
  }
}

function levelSafePlayerTroopers(state) {
  return Math.max(Number(state.player.troopers ?? 0), 0);
}

function handleFormation(world, state, event) {
  const formationId = event.formation ?? event.formationId;
  const formation = state.formations[formationId];

  if (!formation) {
    emitRejection(world, state, `Unknown formation: ${formationId}`, "formation");
    return;
  }

  if (["victory", "defeat"].includes(state.mode)) {
    emitRejection(world, state, "The battle is already decided.", "formation");
    return;
  }

  state.formation = formation.id;
  state.lastRejection = null;
  state.lastEvent = FormationRequested.name;
  appendLog(state, makeLogEntry(world, `Formation set: ${formation.label}.`, "command"));
}

function handleLaneSelection(world, state, event) {
  const laneId = event.laneId;
  const lane = state.lanes[laneId];

  if (!lane) {
    emitRejection(world, state, `Unknown lane: ${laneId}`, "selectLane");
    return;
  }

  if (lane.status === "routed") {
    emitRejection(world, state, `${lane.enemyLabel} is already routed.`, "selectLane");
    return;
  }

  if (state.mode === "charging") {
    emitRejection(world, state, "Cannot redirect during a committed charge.", "selectLane");
    return;
  }

  state.selectedLane = laneId;
  state.mode = state.mode === "deploying" ? "maneuver" : state.mode;
  state.lastRejection = null;
  state.lastEvent = LaneSelected.name;
  appendLog(state, makeLogEntry(world, `Target lane selected: ${lane.label}.`, "command"));
}

function handleCharge(world, state) {
  if (["victory", "defeat"].includes(state.mode)) {
    emitRejection(world, state, "The battle is already decided.", "charge");
    return;
  }

  if (state.mode === "charging") {
    emitRejection(world, state, "A charge is already underway.", "charge");
    return;
  }

  const lane = state.lanes[state.selectedLane];
  if (!lane || lane.status === "routed") {
    emitRejection(world, state, "No valid enemy lane is selected.", "charge");
    return;
  }

  if (state.player.cohesion < 12) {
    emitRejection(world, state, "Cohesion too low. Rally before another charge.", "charge");
    return;
  }

  if (state.player.morale < 10) {
    emitRejection(world, state, "Morale too low to charge.", "charge");
    return;
  }

  const chargeDistance = Math.max(lane.distance, 260);
  lane.distance = chargeDistance;
  state.mode = "charging";
  state.targetLane = lane.id;
  state.player.chargeDistance = chargeDistance;
  state.player.momentum = clamp(18 + (100 - state.player.fatigue) * 0.25, 10, 52);
  state.lastRejection = null;
  const started = world.emit(ChargeStarted, {
    laneId: lane.id,
    formation: state.formation,
    distance: chargeDistance
  });
  state.lastEvent = started.type;
  appendLog(state, makeLogEntry(world, `Charge started toward ${lane.enemyLabel}.`, "command"));
}

function handleRally(world, state) {
  if (["victory", "defeat"].includes(state.mode)) {
    emitRejection(world, state, "The battle is already decided.", "rally");
    return;
  }

  if (state.mode === "charging") {
    emitRejection(world, state, "Cannot rally during a charge.", "rally");
    return;
  }

  if (state.player.rallyCooldown > 0) {
    emitRejection(world, state, `Rally cooldown: ${state.player.rallyCooldown.toFixed(1)}s.`, "rally");
    return;
  }

  const formation = state.formations[state.formation] ?? state.formations.line;
  const moraleGain = Math.round(8 * formation.rallyBonus);
  const cohesionGain = Math.round(14 * formation.rallyBonus);
  const fatigueRecovery = state.formation === "screen" ? 8 : 5;

  state.player.morale = clamp(state.player.morale + moraleGain, 0, 100);
  state.player.cohesion = clamp(state.player.cohesion + cohesionGain, 0, 100);
  state.player.fatigue = clamp(state.player.fatigue - fatigueRecovery, 0, 100);
  state.player.rallyCooldown = 3.25;
  state.mode = state.mode === "deploying" ? "maneuver" : state.mode;
  state.lastRejection = null;
  state.lastEvent = RallyRequested.name;
  appendLog(state, makeLogEntry(world, `Rally restored +${moraleGain} morale and +${cohesionGain} cohesion.`, "command"));
}

function updateContinuousBattle(world, state) {
  const dt = world.__nexusClock.delta;

  state.player.rallyCooldown = clamp((state.player.rallyCooldown ?? 0) - dt, 0, 99);

  if (["victory", "defeat"].includes(state.mode)) return;

  for (const lane of Object.values(state.lanes)) {
    if (lane.status === "routed") continue;
    lane.distance = clamp(lane.distance - dt * 8, 0, 900);
    if (lane.distance <= 65 && state.mode !== "charging") {
      state.player.morale = clamp(state.player.morale - dt * 2.2, 0, 100);
      state.player.cohesion = clamp(state.player.cohesion - dt * 1.7, 0, 100);
    }
  }

  if (state.mode === "charging") {
    const lane = state.lanes[state.targetLane];
    if (!lane || lane.status === "routed") {
      state.mode = "maneuver";
      return;
    }

    const formation = state.formations[state.formation] ?? state.formations.line;
    const speed = 135 * formation.speed * clamp(1 - state.player.fatigue / 180, 0.55, 1.1);
    const distanceStep = speed * dt;
    lane.distance = clamp(lane.distance - distanceStep, 0, 900);
    state.player.chargeDistance = lane.distance;
    state.player.momentum = clamp(state.player.momentum + dt * 30 * formation.speed, 0, 100);
    state.player.fatigue = clamp(state.player.fatigue + dt * 5.8 * formation.cohesionDrain, 0, 100);
    state.player.cohesion = clamp(state.player.cohesion - dt * 2.6 * formation.cohesionDrain, 0, 100);

    if (lane.distance <= 0) {
      resolveImpact(world, state);
    }
  } else if (state.mode === "maneuver") {
    state.player.fatigue = clamp(state.player.fatigue - dt * 1.25, 0, 100);
    state.player.cohesion = clamp(state.player.cohesion + dt * 0.65, 0, 100);
  }
}

function evaluateBattleEnd(world, state) {
  if (["victory", "defeat"].includes(state.mode)) return;

  if (activeEnemyLanes(state).length === 0) {
    state.mode = "victory";
    state.score += Math.round(state.player.troopers * 20 + state.player.morale * 2 + state.player.cohesion * 2);
    world.emit(BattleCompleted, { score: state.score });
    appendLog(state, makeLogEntry(world, `Victory: the Sabine Road is secure. Score ${state.score}.`, "success"));
    return;
  }

  if (state.player.morale <= 0 || state.player.cohesion <= 0 || state.player.troopers <= 0) {
    state.mode = "defeat";
    world.emit(BattleFailed, {
      morale: state.player.morale,
      cohesion: state.player.cohesion,
      troopers: state.player.troopers
    });
    appendLog(state, makeLogEntry(world, "Defeat: the cavalry line breaks.", "failure"));
  }
}

export function createCavalryOfRomeKit(config = {}) {
  const level = config.level;
  if (!level) {
    throw new Error("createCavalryOfRomeKit requires a level config");
  }

  function cavalrySystem(world) {
    const previous = world.getResource(CavalryState);
    if (!previous) return;

    let state = clone(previous);
    const sequenceEvents = [];

    for (const event of world.readEvents(RestartRequested)) {
      state = createInitialState(level);
      state.lastEvent = event.type;
      appendLog(state, makeLogEntry(world, "Scenario restarted.", "command"));
    }

    for (const event of world.readEvents(FormationRequested)) {
      handleFormation(world, state, event);
      sequenceEvents.push(event);
    }

    for (const event of world.readEvents(LaneSelected)) {
      handleLaneSelection(world, state, event);
      sequenceEvents.push(event);
    }

    for (const event of world.readEvents(ChargeRequested)) {
      handleCharge(world, state, event);
      sequenceEvents.push(...world.readEvents(ChargeStarted));
    }

    for (const event of world.readEvents(RallyRequested)) {
      handleRally(world, state, event);
      sequenceEvents.push(event);
    }

    updateContinuousBattle(world, state);
    evaluateBattleEnd(world, state);

    sequenceEvents.push(...world.readEvents(ImpactResolved));
    sequenceEvents.push(...world.readEvents(EnemyRouted));
    state.sequence = advanceCavalrySequence(state.sequence, level.sequence, sequenceEvents);

    world.setResource(CavalryState, state);
  }

  return defineRuntimeKit({
    id: config.kitId ?? "cavalry-of-rome-kit",
    provides: ["game:cavalry-of-rome"],
    resources: { CavalryState },
    events: {
      FormationRequested,
      LaneSelected,
      ChargeRequested,
      ChargeStarted,
      ImpactResolved,
      RallyRequested,
      EnemyRouted,
      BattleCompleted,
      BattleFailed,
      CommandRejected,
      RestartRequested
    },
    systems: [
      {
        phase: "simulate",
        name: "cavalryOfRomeSystem",
        system: cavalrySystem
      }
    ],
    initWorld({ world }) {
      world.setResource(CavalryState, createInitialState(level));
    },
    install({ engine, world }) {
      engine.cavalry = {
        getState() {
          return world.getResource(CavalryState);
        },
        setFormation(formation) {
          world.emit(FormationRequested, { formation });
          return world.getResource(CavalryState);
        },
        selectLane(laneId) {
          world.emit(LaneSelected, { laneId });
          return world.getResource(CavalryState);
        },
        charge() {
          world.emit(ChargeRequested, {});
          return world.getResource(CavalryState);
        },
        rally() {
          world.emit(RallyRequested, {});
          return world.getResource(CavalryState);
        },
        restart() {
          world.emit(RestartRequested, {});
          return world.getResource(CavalryState);
        },
        formatStatus() {
          const state = world.getResource(CavalryState);
          return `${state.mode} | ${state.formations[state.formation].label} | morale ${formatPercent(state.player.morale)} | cohesion ${formatPercent(state.player.cohesion)}`;
        }
      };
    },
    metadata: {
      title: "Cavalry of Rome",
      purpose: "Deterministic tactical cavalry command loop for the Sabine Road scenario.",
      version: CAVALRY_OF_ROME_KIT_VERSION
    }
  });
}
