import {
  defineEvent,
  defineResource,
  defineRuntimeKit
} from "./runtime.js";

export const STRATEGIC_BOARD_GAME_LOOP_KIT_VERSION = "0.1.0";

export const StrategicBoardLoopState = defineResource("strategicBoard.loop.state");

export const StrategicTurnStarted = defineEvent("strategic.turn.started");
export const StrategicEndTurnRequested = defineEvent("strategic.turn.end.requested");
export const StrategicTurnEnded = defineEvent("strategic.turn.ended");
export const StrategicIncomeCollected = defineEvent("strategic.income.collected");
export const StrategicEventCardsDrawn = defineEvent("strategic.eventCards.drawn");
export const StrategicBoardCommandRejected = defineEvent("strategic.command.rejected");

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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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
  state.log = [entry, ...(state.log ?? [])].slice(0, 10);
}

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
  return Object.fromEntries(configRegions.map((region) => [
    region.id,
    {
      id: region.id,
      label: region.label ?? region.id,
      owner: region.owner ?? "neutral",
      income: Number(region.income ?? 5),
      tags: [...(region.tags ?? [])]
    }
  ]));
}

function createInitialState(config = {}) {
  return {
    id: "strategic-board-game-loop",
    version: STRATEGIC_BOARD_GAME_LOOP_KIT_VERSION,
    turn: 1,
    phase: "planning",
    activeFaction: config.activeFaction ?? "rome",
    gold: Number(config.startingGold ?? 120),
    regions: createRegions(config.regions),
    lastIncome: null,
    lastEventCards: [],
    pendingEventCards: [],
    eventDeck: clone(config.eventCards ?? DEFAULT_EVENT_CARDS),
    log: [],
    diagnostics: {
      turnsEnded: 0,
      incomeCollections: 0,
      cardsDrawn: 0,
      rejectedCommands: 0
    }
  };
}

function collectIncome(world, state) {
  const entries = Object.values(state.regions)
    .filter((region) => region.owner === state.activeFaction)
    .map((region) => ({
      regionId: region.id,
      label: region.label,
      amount: Number(region.income ?? 0)
    }));
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  state.gold += total;
  state.lastIncome = {
    turn: state.turn,
    faction: state.activeFaction,
    total,
    entries
  };
  state.diagnostics.incomeCollections += 1;
  appendLog(state, makeLogEntry(world, `Collected ${total} gold from ${entries.length} owned provinces.`, "income"));
  world.emit(StrategicIncomeCollected, state.lastIncome);
}

function armyGroupsFromEngine(engine) {
  const campaign = engine.cavalry?.getState?.()?.campaign;
  if (!campaign?.units) return [];
  const groups = [];
  for (const unit of campaign.units) {
    if (unit.status !== "garrison" || !unit.regionId) continue;
    groups.push({
      id: unit.id,
      label: unit.label ?? unit.id,
      regionId: unit.regionId,
      unitType: unit.unitType,
      soldiers: unit.soldiers,
      owner: unit.owner
    });
  }
  for (const march of campaign.marches ?? []) {
    groups.push({
      id: march.id,
      label: `March ${march.id}`,
      regionId: march.toRegionId,
      unitType: march.units?.[0]?.unitType ?? "march",
      soldiers: march.soldiers,
      owner: march.owner,
      marching: true
    });
  }
  return groups;
}

function drawArmyEventCards(world, state, engine) {
  const armyGroups = armyGroupsFromEngine(engine).filter((group) => group.owner === state.activeFaction);
  const cards = [];
  for (let index = 0; index < armyGroups.length; index += 1) {
    const group = armyGroups[index];
    const card = weightedPick(state.eventDeck, state.turn * 1000 + index * 37 + String(group.id).length);
    if (!card) continue;
    cards.push({
      id: `${state.turn}:${group.id}:${card.id}`,
      turn: state.turn,
      armyId: group.id,
      armyLabel: group.label,
      regionId: group.regionId,
      owner: group.owner,
      card: clone(card)
    });
  }
  state.lastEventCards = cards;
  state.pendingEventCards = cards.filter((entry) => entry.card.kind !== "nothing");
  state.diagnostics.cardsDrawn += cards.length;
  appendLog(state, makeLogEntry(world, `Drew ${cards.length} army event cards; ${state.pendingEventCards.length} need attention.`, "event"));
  world.emit(StrategicEventCardsDrawn, { turn: state.turn, cards });
}

function reject(world, state, reason, command = "strategic") {
  state.diagnostics.rejectedCommands += 1;
  appendLog(state, makeLogEntry(world, reason, "reject"));
  world.emit(StrategicBoardCommandRejected, { command, reason });
}

function resolveEndTurn(world, state, engine) {
  if (state.phase !== "planning") {
    reject(world, state, `Cannot end turn while phase is ${state.phase}.`, "endTurn");
    return;
  }
  state.phase = "income";
  collectIncome(world, state);
  state.phase = "events";
  drawArmyEventCards(world, state, engine);
  state.diagnostics.turnsEnded += 1;
  world.emit(StrategicTurnEnded, { turn: state.turn, gold: state.gold });
  state.turn += 1;
  state.phase = "planning";
  appendLog(state, makeLogEntry(world, `Turn ${state.turn} begins.`, "turn"));
  world.emit(StrategicTurnStarted, { turn: state.turn, phase: state.phase, gold: state.gold });
}

export function createStrategicBoardGameLoopKit(config = {}) {
  function strategicBoardLoopSystem(world, { engine }) {
    const previous = world.getResource(StrategicBoardLoopState);
    if (!previous) return;
    const state = clone(previous);

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
    events: {
      StrategicTurnStarted,
      StrategicEndTurnRequested,
      StrategicTurnEnded,
      StrategicIncomeCollected,
      StrategicEventCardsDrawn,
      StrategicBoardCommandRejected
    },
    systems: [
      {
        phase: "simulate",
        name: "strategicBoardLoopSystem",
        system: strategicBoardLoopSystem
      }
    ],
    initWorld({ world }) {
      const state = createInitialState(config);
      world.setResource(StrategicBoardLoopState, state);
      world.emit(StrategicTurnStarted, { turn: state.turn, phase: state.phase, gold: state.gold });
    },
    install({ engine, world }) {
      engine.strategy = {
        getState() {
          return world.getResource(StrategicBoardLoopState);
        },
        endTurn() {
          world.emit(StrategicEndTurnRequested, {});
          return world.getResource(StrategicBoardLoopState);
        },
        getGold() {
          return world.getResource(StrategicBoardLoopState)?.gold ?? 0;
        },
        getPhase() {
          return world.getResource(StrategicBoardLoopState)?.phase ?? "unknown";
        },
        getTurn() {
          return world.getResource(StrategicBoardLoopState)?.turn ?? 0;
        },
        formatStatus() {
          const state = world.getResource(StrategicBoardLoopState);
          return `turn ${state.turn} | ${state.phase} | gold ${state.gold}`;
        }
      };
    },
    metadata: {
      title: "Strategic Board Game Loop Kit",
      purpose: "Owns the high-level turn loop, gold income, and army event-card draw cycle for strategic board games.",
      version: STRATEGIC_BOARD_GAME_LOOP_KIT_VERSION
    }
  });
}
