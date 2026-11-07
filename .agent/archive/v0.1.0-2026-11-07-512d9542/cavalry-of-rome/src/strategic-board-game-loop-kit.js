import {
  defineEvent,
  defineResource,
  defineRuntimeKit
} from "./runtime.js";

export const STRATEGIC_BOARD_GAME_LOOP_KIT_VERSION = "0.2.1";

export const StrategicBoardLoopState = defineResource("strategicBoard.loop.state");

export const StrategicTurnStarted = defineEvent("strategic.turn.started");
export const StrategicEndTurnRequested = defineEvent("strategic.turn.end.requested");
export const StrategicTurnEnded = defineEvent("strategic.turn.ended");
export const StrategicIncomeCollected = defineEvent("strategic.income.collected");
export const StrategicEventCardsDrawn = defineEvent("strategic.eventCards.drawn");
export const StrategicWorldActionRequested = defineEvent("strategic.worldAction.requested");
export const StrategicWorldActionSpent = defineEvent("strategic.worldAction.spent");
export const StrategicRecruitRequested = defineEvent("strategic.recruit.requested");
export const StrategicRecruitCompleted = defineEvent("strategic.recruit.completed");
export const StrategicBoardCommandRejected = defineEvent("strategic.command.rejected");

const DEFAULT_MAX_WORLD_ACTIONS = 2;

const UNIT_TYPES = {
  light: { label: "Light", soldiers: 24, cost: 30 },
  medium: { label: "Medium", soldiers: 42, cost: 55 },
  heavy: { label: "Heavy", soldiers: 64, cost: 80 }
};

const DEFAULT_REGIONS = [
  { id: "gallia", label: "Gallia", owner: "blue", income: 8 },
  { id: "hispania", label: "Hispania", owner: "rome", income: 10 },
  { id: "britannia", label: "Britannia", owner: "neutral", income: 6 },
  { id: "africa", label: "Africa", owner: "red", income: 9 },
  { id: "italia", label: "Italia", owner: "rome", income: 14 },
  { id: "illyria", label: "Illyria", owner: "yellow", income: 7 },
  { id: "germania", label: "Germania", owner: "green", income: 9 },
  { id: "dacia", label: "Dacia", owner: "blue", income: 8 },
  { id: "asia", label: "Asia Minor", owner: "neutral", income: 11 },
  { id: "mauretania", label: "Mauretania", owner: "neutral", income: 5 }
];

const DEFAULT_EVENT_CARDS = [
  { id: "boring-day-clear-road", label: "Boring Day", weight: 54, kind: "nothing", text: "The army marches, eats, argues, and nothing meaningful happens." },
  { id: "boring-day-cold-camp", label: "Cold Camp", weight: 18, kind: "nothing", text: "The camp is uncomfortable but quiet." },
  { id: "farm-help-harvest", label: "Help Around the Farm", weight: 6, kind: "gold", gold: 18, text: "The unit helps locals bring in a harvest and earns goodwill and coin." },
  { id: "farm-help-stables", label: "Repair Village Stables", weight: 4, kind: "gold", gold: 12, text: "The unit repairs stables along the road and is paid in coin and supplies." },
  { id: "bandit-raid-road", label: "Raided by Bandits", weight: 5, kind: "engagement", text: "Bandits strike the baggage line. This will become a small engagement event." },
  { id: "bandit-ambush-forest", label: "Forest Ambush", weight: 3, kind: "engagement", text: "Scouts report movement in the trees. This will become a terrain engagement event." },
  { id: "supply-trouble", label: "Supply Trouble", weight: 4, kind: "delay", delayTurns: 1, text: "Broken wheels and bad roads threaten to slow the army." },
  { id: "local-guide", label: "Local Guide", weight: 3, kind: "speed", text: "A local guide offers a safer route through the province." },
  { id: "veteran-drill", label: "Veteran Drill", weight: 3, kind: "experience", text: "The unit drills with veterans and gains battlefield confidence." }
];

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function makeLogEntry(world, message, type = "info") {
  return { frame: world.__nexusClock.frame, at: Number(world.__nexusClock.elapsed.toFixed(2)), type, message };
}
function appendLog(state, entry) { state.log = [entry, ...(state.log ?? [])].slice(0, 10); }
function weightedPick(items, seed) {
  const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.weight ?? 1)), 0);
  if (total <= 0) return items[0] ?? null;
  let cursor = (Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1) * total;
  for (const item of items) {
    cursor -= Math.max(0, Number(item.weight ?? 1));
    if (cursor <= 0) return item;
  }
  return items[items.length - 1] ?? null;
}
function createRegions(configRegions = DEFAULT_REGIONS) {
  return Object.fromEntries(configRegions.map((region) => [region.id, {
    id: region.id,
    label: region.label ?? region.id,
    owner: region.owner ?? "neutral",
    income: Number(region.income ?? 5),
    tags: [...(region.tags ?? [])]
  }]));
}
function createInitialState(config = {}) {
  const maxWorldActions = Number(config.maxWorldActions ?? DEFAULT_MAX_WORLD_ACTIONS);
  return {
    id: "strategic-board-game-loop",
    version: STRATEGIC_BOARD_GAME_LOOP_KIT_VERSION,
    turn: 1,
    phase: "planning",
    activeFaction: config.activeFaction ?? "rome",
    gold: Number(config.startingGold ?? 120),
    maxWorldActions,
    worldActionsRemaining: maxWorldActions,
    regions: createRegions(config.regions),
    unitTypes: clone(config.unitTypes ?? UNIT_TYPES),
    lastIncome: null,
    lastAction: null,
    lastRecruit: null,
    lastEventCards: [],
    pendingEventCards: [],
    eventDeck: clone(config.eventCards ?? DEFAULT_EVENT_CARDS),
    log: [],
    diagnostics: { turnsEnded: 0, incomeCollections: 0, cardsDrawn: 0, worldActionsSpent: 0, recruitsCompleted: 0, rejectedCommands: 0 }
  };
}
function reject(world, state, reason, command = "strategic") {
  state.diagnostics.rejectedCommands += 1;
  appendLog(state, makeLogEntry(world, reason, "reject"));
  world.emit(StrategicBoardCommandRejected, { command, reason });
}
function ownedRegion(state, regionId) {
  const region = state.regions[regionId];
  return region && region.owner === state.activeFaction;
}
function collectIncome(world, state) {
  const entries = Object.values(state.regions).filter((region) => region.owner === state.activeFaction).map((region) => ({ regionId: region.id, label: region.label, amount: Number(region.income ?? 0) }));
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  state.gold += total;
  state.lastIncome = { turn: state.turn, faction: state.activeFaction, total, entries };
  state.diagnostics.incomeCollections += 1;
  appendLog(state, makeLogEntry(world, `Collected ${total} gold from ${entries.length} owned provinces.`, "income"));
  world.emit(StrategicIncomeCollected, state.lastIncome);
}
function cavalryCampaign(engine) { return engine.cavalry?.getState?.()?.campaign; }
function armyGroupsFromEngine(engine) {
  const campaign = cavalryCampaign(engine);
  if (!campaign?.units) return [];
  const groups = [];
  for (const unit of campaign.units) {
    if (unit.status !== "garrison" || !unit.regionId) continue;
    groups.push({ id: unit.id, label: unit.label ?? unit.id, regionId: unit.regionId, unitType: unit.unitType, soldiers: unit.soldiers, owner: unit.owner });
  }
  for (const march of campaign.marches ?? []) {
    groups.push({ id: march.id, label: `March ${march.id}`, regionId: march.toRegionId, unitType: march.units?.[0]?.unitType ?? "march", soldiers: march.soldiers, owner: march.owner, marching: true });
  }
  return groups;
}
function summarizeCampaign(campaign) {
  const armies = Object.fromEntries(Object.values(campaign.regions ?? {}).map((region) => [region.id, { regionId: region.id, owner: region.owner, units: { light: 0, medium: 0, heavy: 0 }, unitIds: [] }]));
  for (const unit of campaign.units ?? []) {
    if (unit.status !== "garrison" || !unit.regionId || !armies[unit.regionId]) continue;
    armies[unit.regionId].units[unit.unitType] = Number(armies[unit.regionId].units[unit.unitType] ?? 0) + 1;
    armies[unit.regionId].unitIds.push(unit.id);
  }
  campaign.armies = armies;
  campaign.selectedUnits = (campaign.units ?? []).filter((unit) => (campaign.selectedUnitIds ?? []).includes(unit.id));
}
function addUnitsToCampaign(world, engine, state, { regionId, unitType, count }) {
  const cavalryState = clone(engine.cavalry?.getState?.());
  const campaign = cavalryState?.campaign;
  const unitConfig = state.unitTypes[unitType];
  if (!campaign || !unitConfig) return false;
  let serial = Math.max(0, ...(campaign.units ?? []).map((unit) => Number(unit.serial ?? 0))) + 1;
  for (let i = 0; i < count; i += 1) {
    const existingTypeCount = campaign.units.filter((unit) => unit.regionId === regionId && unit.unitType === unitType).length + 1;
    campaign.units.push({
      id: `${regionId}-${unitType}-crafted-${serial}`,
      serial,
      label: `${unitConfig.label} ${existingTypeCount}`,
      unitType,
      soldiers: unitConfig.soldiers,
      maxSoldiers: unitConfig.soldiers,
      owner: state.activeFaction,
      regionId,
      status: "garrison",
      marchId: null,
      experience: 0,
      craftedAtTurn: state.turn
    });
    serial += 1;
  }
  summarizeCampaign(campaign);
  world.setResource("cavalryOfRome.state", cavalryState);
  return true;
}
function spendWorldAction(world, state, actionType, detail = {}) {
  if (state.phase !== "planning") return reject(world, state, `Cannot spend action during ${state.phase}.`, actionType), false;
  if (state.worldActionsRemaining <= 0) return reject(world, state, "No world actions remain this turn.", actionType), false;
  state.worldActionsRemaining -= 1;
  state.diagnostics.worldActionsSpent += 1;
  state.lastAction = { turn: state.turn, actionType, detail, remaining: state.worldActionsRemaining };
  appendLog(state, makeLogEntry(world, `${actionType} action spent. ${state.worldActionsRemaining} actions remain.`, "action"));
  world.emit(StrategicWorldActionSpent, state.lastAction);
  return true;
}
function recruitRequestsFromEvent(event) {
  if (Array.isArray(event.requests)) {
    return event.requests.map((request) => ({ unitType: request.unitType, count: Math.max(0, Math.min(20, Math.floor(Number(request.count ?? 0)))) })).filter((request) => request.count > 0);
  }
  const count = Math.max(1, Math.min(20, Math.floor(Number(event.count ?? 1))));
  return [{ unitType: event.unitType, count }];
}
function resolveRecruit(world, state, engine, event) {
  const regionId = event.regionId;
  const requests = recruitRequestsFromEvent(event);
  if (!ownedRegion(state, regionId)) return reject(world, state, "Recruitment is only allowed in owned red provinces.", "recruit");
  if (requests.length <= 0) return reject(world, state, "Choose at least one unit group to craft.", "recruit");
  for (const request of requests) {
    if (!state.unitTypes[request.unitType]) return reject(world, state, `Unknown unit type: ${request.unitType}`, "recruit");
  }
  const totalCost = requests.reduce((sum, request) => sum + Number(state.unitTypes[request.unitType].cost ?? 0) * request.count, 0);
  if (state.gold < totalCost) return reject(world, state, `Need ${totalCost} gold to craft those unit groups.`, "recruit");
  if (!spendWorldAction(world, state, "recruit", { regionId, requests, totalCost })) return;
  state.gold -= totalCost;
  for (const request of requests) {
    const added = addUnitsToCampaign(world, engine, state, { regionId, unitType: request.unitType, count: request.count });
    if (!added) return reject(world, state, "Could not add recruited units to the campaign.", "recruit");
  }
  const totalCount = requests.reduce((sum, request) => sum + request.count, 0);
  state.lastRecruit = { turn: state.turn, regionId, requests, totalCount, totalCost, gold: state.gold };
  state.diagnostics.recruitsCompleted += totalCount;
  appendLog(state, makeLogEntry(world, `Crafted ${totalCount} unit groups for ${totalCost} gold.`, "recruit"));
  world.emit(StrategicRecruitCompleted, state.lastRecruit);
}
function drawArmyEventCards(world, state, engine) {
  const armyGroups = armyGroupsFromEngine(engine).filter((group) => group.owner === state.activeFaction);
  const cards = [];
  for (let index = 0; index < armyGroups.length; index += 1) {
    const group = armyGroups[index];
    const card = weightedPick(state.eventDeck, state.turn * 1000 + index * 37 + String(group.id).length);
    if (!card) continue;
    cards.push({ id: `${state.turn}:${group.id}:${card.id}`, turn: state.turn, armyId: group.id, armyLabel: group.label, regionId: group.regionId, owner: group.owner, card: clone(card) });
  }
  state.lastEventCards = cards;
  state.pendingEventCards = cards.filter((entry) => entry.card.kind !== "nothing");
  state.diagnostics.cardsDrawn += cards.length;
  appendLog(state, makeLogEntry(world, `Drew ${cards.length} army event cards; ${state.pendingEventCards.length} need attention.`, "event"));
  world.emit(StrategicEventCardsDrawn, { turn: state.turn, cards });
}
function resolveEndTurn(world, state, engine) {
  if (state.phase !== "planning") return reject(world, state, `Cannot end turn while phase is ${state.phase}.`, "endTurn");
  state.phase = "income";
  collectIncome(world, state);
  state.phase = "events";
  drawArmyEventCards(world, state, engine);
  state.diagnostics.turnsEnded += 1;
  world.emit(StrategicTurnEnded, { turn: state.turn, gold: state.gold });
  state.turn += 1;
  state.phase = "planning";
  state.worldActionsRemaining = state.maxWorldActions;
  appendLog(state, makeLogEntry(world, `Turn ${state.turn} begins.`, "turn"));
  world.emit(StrategicTurnStarted, { turn: state.turn, phase: state.phase, gold: state.gold, worldActionsRemaining: state.worldActionsRemaining });
}

export function createStrategicBoardGameLoopKit(config = {}) {
  function strategicBoardLoopSystem(world, { engine }) {
    const previous = world.getResource(StrategicBoardLoopState);
    if (!previous) return;
    const state = clone(previous);
    for (const event of world.readEvents(StrategicWorldActionRequested)) {
      spendWorldAction(world, state, event.actionType ?? "world", event.detail ?? {});
      state.lastCommand = event.type;
    }
    for (const event of world.readEvents(StrategicRecruitRequested)) {
      resolveRecruit(world, state, engine, event);
      state.lastCommand = event.type;
    }
    for (const event of world.readEvents(StrategicEndTurnRequested)) {
      resolveEndTurn(world, state, engine);
      state.lastCommand = event.type;
    }
    world.setResource(StrategicBoardLoopState, state);
  }
  return defineRuntimeKit({
    id: config.kitId ?? "strategic-board-game-loop-kit",
    provides: ["domain:strategic-board-game-loop"],
    resources: { StrategicBoardLoopState },
    events: { StrategicTurnStarted, StrategicEndTurnRequested, StrategicTurnEnded, StrategicIncomeCollected, StrategicEventCardsDrawn, StrategicWorldActionRequested, StrategicWorldActionSpent, StrategicRecruitRequested, StrategicRecruitCompleted, StrategicBoardCommandRejected },
    systems: [{ phase: "simulate", name: "strategicBoardLoopSystem", system: strategicBoardLoopSystem }],
    initWorld({ world }) {
      const state = createInitialState(config);
      world.setResource(StrategicBoardLoopState, state);
      world.emit(StrategicTurnStarted, { turn: state.turn, phase: state.phase, gold: state.gold, worldActionsRemaining: state.worldActionsRemaining });
    },
    install({ engine, world }) {
      engine.strategy = {
        getState() { return world.getResource(StrategicBoardLoopState); },
        endTurn() { world.emit(StrategicEndTurnRequested, {}); return world.getResource(StrategicBoardLoopState); },
        spendWorldAction(actionType, detail = {}) { world.emit(StrategicWorldActionRequested, { actionType, detail }); return world.getResource(StrategicBoardLoopState); },
        recruitUnit(regionId, unitType, count = 1) { world.emit(StrategicRecruitRequested, { regionId, unitType, count }); return world.getResource(StrategicBoardLoopState); },
        recruitUnits(regionId, counts = {}) {
          const requests = Object.entries(counts).map(([unitType, count]) => ({ unitType, count })).filter((request) => Number(request.count) > 0);
          world.emit(StrategicRecruitRequested, { regionId, requests });
          return world.getResource(StrategicBoardLoopState);
        },
        canUseOwnedProvince(regionId) { const state = world.getResource(StrategicBoardLoopState); return Boolean(state?.regions?.[regionId]?.owner === state.activeFaction); },
        getUnitCosts() { return clone(world.getResource(StrategicBoardLoopState)?.unitTypes ?? UNIT_TYPES); },
        getGold() { return world.getResource(StrategicBoardLoopState)?.gold ?? 0; },
        getPhase() { return world.getResource(StrategicBoardLoopState)?.phase ?? "unknown"; },
        getTurn() { return world.getResource(StrategicBoardLoopState)?.turn ?? 0; },
        getWorldActionsRemaining() { return world.getResource(StrategicBoardLoopState)?.worldActionsRemaining ?? 0; },
        formatStatus() { const state = world.getResource(StrategicBoardLoopState); return `turn ${state.turn} | ${state.phase} | gold ${state.gold} | actions ${state.worldActionsRemaining}/${state.maxWorldActions}`; }
      };
    },
    metadata: { title: "Strategic Board Game Loop Kit", purpose: "Owns turn phase, world action budget, gold income, batch recruitment, and army event-card draw cycle for strategic board games.", version: STRATEGIC_BOARD_GAME_LOOP_KIT_VERSION }
  });
}
