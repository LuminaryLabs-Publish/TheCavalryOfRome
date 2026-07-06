import {
  defineEvent,
  defineResource,
  defineRuntimeKit
} from "./runtime.js";

import {
  advanceCavalrySequence,
  createSequenceState
} from "./sequences.js";

export const CAVALRY_OF_ROME_KIT_VERSION = "0.3.0";

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
export const UnitSelected = defineEvent("cavalry.unit.selected");
export const UnitMoveRequested = defineEvent("cavalry.unit.move.requested");
export const UnitMarchStarted = defineEvent("cavalry.unit.march.started");
export const UnitMarchCompleted = defineEvent("cavalry.unit.march.completed");

const REGIONS = [
  { id: "gallia", label: "Gallia", center: [-2260, 1360], owner: "blue" },
  { id: "hispania", label: "Hispania", center: [-1680, -860], owner: "rome" },
  { id: "britannia", label: "Britannia", center: [-880, 1850], owner: "neutral" },
  { id: "africa", label: "Africa", center: [-260, -1960], owner: "red" },
  { id: "italia", label: "Italia", center: [420, 1380], owner: "rome" },
  { id: "illyria", label: "Illyria", center: [880, -820], owner: "yellow" },
  { id: "germania", label: "Germania", center: [1420, 460], owner: "green" },
  { id: "dacia", label: "Dacia", center: [2180, -1540], owner: "blue" },
  { id: "asia", label: "Asia Minor", center: [2500, 1820], owner: "neutral" },
  { id: "mauretania", label: "Mauretania", center: [-2740, -1860], owner: "neutral" }
];

const UNIT_TYPES = {
  light: { label: "Light", start: 10, soldiers: 24, speed: 0.88, cost: 30 },
  medium: { label: "Medium", start: 5, soldiers: 42, speed: 1.0, cost: 55 },
  heavy: { label: "Heavy", start: 5, soldiers: 64, speed: 1.14, cost: 80 }
};

const EVENT_CARD_LIBRARY = [
  { id: "boring-day-1", label: "Boring Day", weight: 58, effect: "nothing" },
  { id: "boring-day-2", label: "Quiet March", weight: 26, effect: "nothing" },
  { id: "farm-help", label: "Help Around the Farm", weight: 5, effect: "gold", gold: 15 },
  { id: "bandit-raid", label: "Raided by Bandits", weight: 4, effect: "engagement" },
  { id: "lost-scouts", label: "Lost Scouts", weight: 3, effect: "delay" },
  { id: "merchant-road", label: "Merchant Road", weight: 3, effect: "gold", gold: 25 },
  { id: "local-guide", label: "Local Guide", weight: 1, effect: "speed" }
];

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

function createInitialUnits(regions) {
  const units = [];
  let unitIndex = 1;
  for (const region of Object.values(regions)) {
    for (const [unitType, config] of Object.entries(UNIT_TYPES)) {
      for (let i = 0; i < config.start; i += 1) {
        units.push({
          id: `${region.id}-${unitType}-${i + 1}`,
          serial: unitIndex++,
          label: `${config.label} ${i + 1}`,
          unitType,
          soldiers: config.soldiers,
          maxSoldiers: config.soldiers,
          owner: region.owner,
          regionId: region.id,
          status: "garrison",
          marchId: null,
          experience: 0
        });
      }
    }
  }
  return units;
}

function summarizeArmies(campaign) {
  const armies = Object.fromEntries(Object.values(campaign.regions).map((region) => [
    region.id,
    {
      regionId: region.id,
      owner: region.owner,
      units: { light: 0, medium: 0, heavy: 0 },
      unitIds: []
    }
  ]));

  for (const unit of campaign.units ?? []) {
    if (unit.status !== "garrison" || !unit.regionId || !armies[unit.regionId]) continue;
    armies[unit.regionId].units[unit.unitType] += 1;
    armies[unit.regionId].unitIds.push(unit.id);
  }

  return armies;
}

function selectedUnits(campaign) {
  const selectedIds = new Set(campaign.selectedUnitIds ?? []);
  return (campaign.units ?? []).filter((unit) => selectedIds.has(unit.id));
}

function normalizeCampaign(campaign) {
  campaign.armies = summarizeArmies(campaign);
  campaign.selectedUnits = selectedUnits(campaign).map((unit) => ({
    id: unit.id,
    label: unit.label,
    unitType: unit.unitType,
    soldiers: unit.soldiers,
    regionId: unit.regionId,
    owner: unit.owner
  }));
  campaign.selectedArmy = campaign.selectedUnits.length === 1
    ? {
        armyId: campaign.selectedUnits[0].id,
        unitId: campaign.selectedUnits[0].id,
        regionId: campaign.selectedUnits[0].regionId,
        unitType: campaign.selectedUnits[0].unitType,
        owner: campaign.selectedUnits[0].owner,
        count: 1,
        soldiers: campaign.selectedUnits[0].soldiers
      }
    : null;
}

function createCampaignState() {
  const regions = Object.fromEntries(REGIONS.map((region) => [region.id, clone(region)]));
  const campaign = {
    gold: 120,
    turn: 1,
    regions,
    units: createInitialUnits(regions),
    marches: [],
    selectedUnitIds: [],
    selectedUnits: [],
    selectedArmy: null,
    eventCards: EVENT_CARD_LIBRARY,
    pendingEventCards: [],
    lastArmyEvent: null,
    nextMarchId: 1
  };
  normalizeCampaign(campaign);
  return campaign;
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
    campaign: createCampaignState(),
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
  appendLog(state, makeLogEntry(world, `${formation.label} impact on ${lane.enemyLabel}: -${impactDamage} strength, -${moraleDamage} morale.`, "impact"));

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
  if (!formation) return emitRejection(world, state, `Unknown formation: ${formationId}`, "formation");
  if (["victory", "defeat"].includes(state.mode)) return emitRejection(world, state, "The battle is already decided.", "formation");
  state.formation = formation.id;
  state.lastRejection = null;
  state.lastEvent = FormationRequested.name;
  appendLog(state, makeLogEntry(world, `Formation set: ${formation.label}.`, "command"));
}

function handleLaneSelection(world, state, event) {
  const laneId = event.laneId;
  const lane = state.lanes[laneId];
  if (!lane) return emitRejection(world, state, `Unknown lane: ${laneId}`, "selectLane");
  if (lane.status === "routed") return emitRejection(world, state, `${lane.enemyLabel} is already routed.`, "selectLane");
  if (state.mode === "charging") return emitRejection(world, state, "Cannot redirect during a committed charge.", "selectLane");
  state.selectedLane = laneId;
  state.mode = state.mode === "deploying" ? "maneuver" : state.mode;
  state.lastRejection = null;
  state.lastEvent = LaneSelected.name;
  appendLog(state, makeLogEntry(world, `Target lane selected: ${lane.label}.`, "command"));
}

function regionDistance(fromRegion, toRegion) {
  if (!fromRegion || !toRegion) return 0;
  const dx = (fromRegion.center[0] - toRegion.center[0]) * 2.55;
  const dz = (fromRegion.center[1] - toRegion.center[1]) * 2.55;
  return Math.sqrt(dx * dx + dz * dz);
}

function maxRegionDistance(campaign) {
  const regions = Object.values(campaign.regions);
  let max = 1;
  for (const a of regions) {
    for (const b of regions) {
      max = Math.max(max, regionDistance(a, b));
    }
  }
  return max;
}

function marchDurationSeconds(campaign, fromRegionId, toRegionId, unitType) {
  const fromRegion = campaign.regions[fromRegionId];
  const toRegion = campaign.regions[toRegionId];
  const distance = regionDistance(fromRegion, toRegion);
  const distanceT = clamp(distance / maxRegionDistance(campaign), 0, 1);
  const typeFactor = UNIT_TYPES[unitType]?.speed ?? 1;
  return clamp(Math.round((600 + distanceT * 600) * typeFactor), 420, 1200);
}

function handleUnitSelection(world, state, event) {
  const unitId = event.unitId ?? event.armyId;
  const append = Boolean(event.append ?? event.shiftKey);
  const unit = state.campaign.units.find((candidate) => candidate.id === unitId);
  if (!unit || unit.status !== "garrison") return emitRejection(world, state, "Unknown or unavailable unit group.", "selectUnit");

  const selected = new Set(state.campaign.selectedUnitIds ?? []);
  if (append) {
    if (selected.has(unit.id)) {
      selected.delete(unit.id);
    } else {
      selected.add(unit.id);
    }
  } else {
    selected.clear();
    selected.add(unit.id);
  }

  state.campaign.selectedUnitIds = [...selected];
  normalizeCampaign(state.campaign);
  const count = state.campaign.selectedUnitIds.length;
  state.campaign.lastArmyEvent = count === 1
    ? `Selected ${UNIT_TYPES[unit.unitType].label} unit in ${state.campaign.regions[unit.regionId].label}.`
    : `Selected ${count} unit groups.`;
  state.lastEvent = UnitSelected.name;
  appendLog(state, makeLogEntry(world, state.campaign.lastArmyEvent, "command"));
  world.emit(UnitSelected, { unitId: unit.id, append, selectedUnitIds: state.campaign.selectedUnitIds });
}

function handleUnitMove(world, state, event) {
  const targetRegionId = event.targetRegionId ?? event.regionId;
  if (!state.campaign.regions[targetRegionId]) return emitRejection(world, state, `Unknown target province: ${targetRegionId}`, "moveUnits");

  const units = selectedUnits(state.campaign).filter((unit) => unit.status === "garrison");
  if (units.length === 0) return emitRejection(world, state, "Select one or more unit rings first.", "moveUnits");

  const sourceRegionId = units[0].regionId;
  if (units.some((unit) => unit.regionId !== sourceRegionId)) {
    return emitRejection(world, state, "Selected units must be stacked in the same province to move as a group.", "moveUnits");
  }
  if (sourceRegionId === targetRegionId) return emitRejection(world, state, "Selected units are already in that province.", "moveUnits");

  const durationSeconds = Math.max(...units.map((unit) => marchDurationSeconds(state.campaign, sourceRegionId, targetRegionId, unit.unitType)));
  const march = {
    id: `march-${state.campaign.nextMarchId++}`,
    owner: units[0].owner,
    unitIds: units.map((unit) => unit.id),
    units: units.map((unit) => ({ id: unit.id, label: unit.label, unitType: unit.unitType, soldiers: unit.soldiers })),
    count: units.length,
    soldiers: units.reduce((sum, unit) => sum + unit.soldiers, 0),
    fromRegionId: sourceRegionId,
    toRegionId: targetRegionId,
    startedAt: world.__nexusClock.elapsed,
    durationSeconds,
    remainingSeconds: durationSeconds,
    progress: 0,
    status: "marching"
  };

  for (const unit of units) {
    unit.status = "marching";
    unit.marchId = march.id;
    unit.regionId = sourceRegionId;
  }

  state.campaign.marches.push(march);
  state.campaign.selectedUnitIds = [];
  normalizeCampaign(state.campaign);
  state.campaign.lastArmyEvent = `${units.length} unit groups marching from ${state.campaign.regions[sourceRegionId].label} to ${state.campaign.regions[targetRegionId].label}.`;
  state.lastEvent = UnitMarchStarted.name;
  appendLog(state, makeLogEntry(world, `${state.campaign.lastArmyEvent} ETA ${Math.round(durationSeconds / 60)} min.`, "command"));
  world.emit(UnitMarchStarted, march);
}

function updateCampaignMarches(world, state) {
  const dt = world.__nexusClock.delta;
  const arrivals = [];
  for (const march of state.campaign.marches) {
    if (march.status !== "marching") continue;
    march.remainingSeconds = clamp(march.remainingSeconds - dt, 0, march.durationSeconds);
    march.progress = clamp(1 - march.remainingSeconds / march.durationSeconds, 0, 1);
    if (march.remainingSeconds <= 0) {
      march.status = "arrived";
      arrivals.push(march);
    }
  }

  for (const march of arrivals) {
    for (const unitId of march.unitIds ?? []) {
      const unit = state.campaign.units.find((candidate) => candidate.id === unitId);
      if (!unit) continue;
      unit.regionId = march.toRegionId;
      unit.status = "garrison";
      unit.marchId = null;
      unit.experience += 1;
    }
    state.campaign.lastArmyEvent = `${march.count} unit groups arrived in ${state.campaign.regions[march.toRegionId].label}.`;
    appendLog(state, makeLogEntry(world, state.campaign.lastArmyEvent, "success"));
    world.emit(UnitMarchCompleted, march);
  }

  state.campaign.marches = state.campaign.marches.filter((march) => march.status === "marching");
  normalizeCampaign(state.campaign);
}

function handleCharge(world, state) {
  if (["victory", "defeat"].includes(state.mode)) return emitRejection(world, state, "The battle is already decided.", "charge");
  if (state.mode === "charging") return emitRejection(world, state, "A charge is already underway.", "charge");
  const lane = state.lanes[state.selectedLane];
  if (!lane || lane.status === "routed") return emitRejection(world, state, "No valid enemy lane is selected.", "charge");
  if (state.player.cohesion < 12) return emitRejection(world, state, "Cohesion too low. Rally before another charge.", "charge");
  if (state.player.morale < 10) return emitRejection(world, state, "Morale too low to charge.", "charge");

  const chargeDistance = Math.max(lane.distance, 260);
  lane.distance = chargeDistance;
  state.mode = "charging";
  state.targetLane = lane.id;
  state.player.chargeDistance = chargeDistance;
  state.player.momentum = clamp(18 + (100 - state.player.fatigue) * 0.25, 10, 52);
  state.lastRejection = null;
  const started = world.emit(ChargeStarted, { laneId: lane.id, formation: state.formation, distance: chargeDistance });
  state.lastEvent = started.type;
  appendLog(state, makeLogEntry(world, `Charge started toward ${lane.enemyLabel}.`, "command"));
}

function handleRally(world, state) {
  if (["victory", "defeat"].includes(state.mode)) return emitRejection(world, state, "The battle is already decided.", "rally");
  if (state.mode === "charging") return emitRejection(world, state, "Cannot rally during a charge.", "rally");
  if (state.player.rallyCooldown > 0) return emitRejection(world, state, `Rally cooldown: ${state.player.rallyCooldown.toFixed(1)}s.`, "rally");

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
  updateCampaignMarches(world, state);
  if (["victory", "defeat"].includes(state.mode)) return;
  if (state.mode === "deploying") return;

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
    lane.distance = clamp(lane.distance - speed * dt, 0, 900);
    state.player.chargeDistance = lane.distance;
    state.player.momentum = clamp(state.player.momentum + dt * 30 * formation.speed, 0, 100);
    state.player.fatigue = clamp(state.player.fatigue + dt * 5.8 * formation.cohesionDrain, 0, 100);
    state.player.cohesion = clamp(state.player.cohesion - dt * 2.6 * formation.cohesionDrain, 0, 100);
    if (lane.distance <= 0) resolveImpact(world, state);
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
    world.emit(BattleFailed, { morale: state.player.morale, cohesion: state.player.cohesion, troopers: state.player.troopers });
    appendLog(state, makeLogEntry(world, "Defeat: the cavalry line breaks.", "failure"));
  }
}

export function createCavalryOfRomeKit(config = {}) {
  const level = config.level;
  if (!level) throw new Error("createCavalryOfRomeKit requires a level config");

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
    for (const event of world.readEvents(FormationRequested)) { handleFormation(world, state, event); sequenceEvents.push(event); }
    for (const event of world.readEvents(LaneSelected)) { handleLaneSelection(world, state, event); sequenceEvents.push(event); }
    for (const event of world.readEvents(UnitSelected)) { handleUnitSelection(world, state, event); sequenceEvents.push(event); }
    for (const event of world.readEvents(UnitMoveRequested)) { handleUnitMove(world, state, event); sequenceEvents.push(...world.readEvents(UnitMarchStarted)); }
    for (const event of world.readEvents(ChargeRequested)) { handleCharge(world, state); sequenceEvents.push(...world.readEvents(ChargeStarted)); }
    for (const event of world.readEvents(RallyRequested)) { handleRally(world, state); sequenceEvents.push(event); }

    updateContinuousBattle(world, state);
    evaluateBattleEnd(world, state);
    normalizeCampaign(state.campaign);

    sequenceEvents.push(...world.readEvents(ImpactResolved));
    sequenceEvents.push(...world.readEvents(EnemyRouted));
    sequenceEvents.push(...world.readEvents(UnitMarchCompleted));
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
      RestartRequested,
      UnitSelected,
      UnitMoveRequested,
      UnitMarchStarted,
      UnitMarchCompleted
    },
    systems: [{ phase: "simulate", name: "cavalryOfRomeSystem", system: cavalrySystem }],
    initWorld({ world }) {
      world.setResource(CavalryState, createInitialState(level));
    },
    install({ engine, world }) {
      engine.cavalry = {
        getState() { return world.getResource(CavalryState); },
        setFormation(formation) { world.emit(FormationRequested, { formation }); return world.getResource(CavalryState); },
        selectLane(laneId) { world.emit(LaneSelected, { laneId }); return world.getResource(CavalryState); },
        selectUnit(unitId, append = false) { world.emit(UnitSelected, { unitId, append }); return world.getResource(CavalryState); },
        selectArmy(regionId, unitType) {
          const state = world.getResource(CavalryState);
          const unit = state.campaign.units.find((candidate) => candidate.regionId === regionId && candidate.unitType === unitType && candidate.status === "garrison");
          if (unit) world.emit(UnitSelected, { unitId: unit.id, append: false });
          return state;
        },
        moveUnits(targetRegionId) { world.emit(UnitMoveRequested, { targetRegionId }); return world.getResource(CavalryState); },
        moveArmy(targetRegionId) { world.emit(UnitMoveRequested, { targetRegionId }); return world.getResource(CavalryState); },
        charge() { world.emit(ChargeRequested, {}); return world.getResource(CavalryState); },
        rally() { world.emit(RallyRequested, {}); return world.getResource(CavalryState); },
        restart() { world.emit(RestartRequested, {}); return world.getResource(CavalryState); },
        formatStatus() {
          const state = world.getResource(CavalryState);
          const selectedCount = state.campaign?.selectedUnitIds?.length ?? 0;
          const armyStatus = selectedCount ? ` | ${selectedCount} unit groups selected` : "";
          return `${state.mode} | ${state.formations[state.formation].label} | morale ${formatPercent(state.player.morale)} | cohesion ${formatPercent(state.player.cohesion)}${armyStatus}`;
        }
      };
    },
    metadata: {
      title: "Cavalry of Rome",
      purpose: "Deterministic tactical cavalry command loop with individual province unit groups and grouped marching.",
      version: CAVALRY_OF_ROME_KIT_VERSION
    }
  });
}
