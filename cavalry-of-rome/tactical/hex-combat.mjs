/**
 * Cavalry of Rome — deterministic encounter combat rules, sandbox prototype.
 * No DOM, Three.js, clock, randomness or external dependencies. All actions are
 * immutable and driven by the existing encounter.board.cells/featureCells format.
 *
 * IMPORTANT: This module has not been wired into cavalry-of-rome/src.
 * Troop strength represents battle pips, NOT campaign soldier counts.
 */

export const COMBAT_RULES_VERSION = '0.1.0-sandbox';

export const UNIT_STATS = Object.freeze({
  light: Object.freeze({ move: 3, attack: 2, range: 2, armor: 0, counter: 1 }),
  medium: Object.freeze({ move: 2, attack: 3, range: 1, armor: 0, counter: 2 }),
  heavy: Object.freeze({ move: 2, attack: 4, range: 1, armor: 1, counter: 2 })
});

const DIRECTIONS = Object.freeze([[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]);
const hexKey = (q, r) => `${q},${r}`;
const deepCopy = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

export function hexDistance(a, b) {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r));
}

export function withinHex(radius, q, r) {
  return Number.isInteger(q) && Number.isInteger(r)
    && Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= radius;
}

function featureMap(state) {
  return new Map(state.features.map((cell) => [hexKey(cell.q, cell.r), cell]));
}

function living(unit) { return unit && unit.status === 'ready' && unit.strength > 0; }
function activeUnits(state, side) { return state.units.filter((unit) => living(unit) && unit.side === side); }
function findUnit(state, unitId) { return state.units.find((unit) => unit.id === unitId); }
function opponent(side) { return side === 'attacker' ? 'defender' : 'attacker'; }
function occupant(state, q, r, excludeId = null) {
  return state.units.find((unit) => living(unit) && unit.id !== excludeId && unit.q === q && unit.r === r);
}

function turnLog(state, event) {
  state.log.push({ turn: state.turn, phase: state.phase, ...event });
  if (state.log.length > 100) state.log.shift();
}

function checkOutcome(state) {
  const attackers = activeUnits(state, 'attacker').length;
  const defenders = activeUnits(state, 'defender').length;
  if (!attackers && !defenders) state.outcome = 'draw';
  else if (!attackers) state.outcome = 'defender';
  else if (!defenders) state.outcome = 'attacker';
  if (state.outcome) {
    state.phase = 'complete';
    state.ordersRemaining = 0;
    state.selectedUnitId = null;
    turnLog(state, { type: 'battle-completed', winner: state.outcome });
  }
}

export function createEncounterCombatState(encounter, { maxOrders = 6 } = {}) {
  if (!encounter?.active || !encounter.board || !Array.isArray(encounter.board.cells)) {
    throw new Error('Active encounter with board.cells is required');
  }
  const radius = Number(encounter.board.radius ?? encounter.hex?.radius ?? 6);
  if (!Number.isInteger(radius) || radius < 1) throw new Error('Invalid board radius');
  if (!Number.isInteger(maxOrders) || maxOrders < 1 || maxOrders > 100) throw new Error('Invalid orders limit');
  const blocked = new Set(encounter.board.blockedCells ?? []);
  const usedIds = new Set();
  const usedCells = new Set();
  const units = encounter.board.cells.map((unit) => {
    const id = String(unit.unitId ?? '');
    const type = UNIT_STATS[unit.unitType] ? unit.unitType : 'medium';
    const side = unit.side;
    const position = hexKey(unit.q, unit.r);
    if (!id || usedIds.has(id)) throw new Error(`Invalid or duplicated unit ID: ${id}`);
    if (!['attacker', 'defender'].includes(side)) throw new Error(`Invalid side for ${id}`);
    if (!withinHex(radius, unit.q, unit.r) || blocked.has(position) || usedCells.has(position)) {
      throw new Error(`Invalid or occupied deployment hex: ${position}`);
    }
    usedIds.add(id);
    usedCells.add(position);
    return {
      id, side, owner: unit.owner ?? null, type, label: unit.label ?? id,
      soldiers: Number(unit.soldiers ?? (type === "light" ? 24 : type === "heavy" ? 64 : 42)),
      participantId: unit.participantId ?? null,
      // Display/model metadata; never treat duplicated reserves as unique campaign soldiers.
      deploymentSourceId: unit.deploymentSourceId ?? id,
      reserve: Boolean(unit.reserve),
      q: unit.q, r: unit.r, strength: 6, maxStrength: 6,
      morale: 80, status: 'ready', moved: false, acted: false, movedSteps: 0
    };
  });
  const state = {
    version: COMBAT_RULES_VERSION,
    encounterKind: encounter.kind ?? 'unknown',
    radius, turn: 1, phase: 'attacker', maxOrders,
    ordersRemaining: maxOrders, selectedUnitId: null, outcome: null,
    features: deepCopy(encounter.board.featureCells ?? []),
    blockedCells: [...blocked], units, log: []
  };
  checkOutcome(state);
  return state;
}

function moveCost(state, cell, features) {
  if (!withinHex(state.radius, cell.q, cell.r)) return Infinity;
  const key = hexKey(cell.q, cell.r);
  if (state.blockedCells.includes(key)) return Infinity;
  const feature = features.get(key);
  if (feature?.obstacle || feature?.movement === 'impassable') return Infinity;
  return feature?.movement === 'difficult' ? 2 : 1;
}

export function reachableHexes(state, unitId) {
  const unit = findUnit(state, unitId);
  if (state.outcome || !living(unit) || unit.side !== state.phase || unit.moved) return [];
  const stats = UNIT_STATS[unit.type];
  const features = featureMap(state);
  const visited = new Map([[hexKey(unit.q, unit.r), 0]]);
  const queue = [{ q: unit.q, r: unit.r, cost: 0 }];
  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost || a.q - b.q || a.r - b.r);
    const current = queue.shift();
    if (current.cost !== visited.get(hexKey(current.q, current.r))) continue;
    for (const [dq, dr] of DIRECTIONS) {
      const next = { q: current.q + dq, r: current.r + dr };
      const step = moveCost(state, next, features);
      const cost = current.cost + step;
      if (cost > stats.move || occupant(state, next.q, next.r, unit.id)) continue;
      const key = hexKey(next.q, next.r);
      if (cost < (visited.get(key) ?? Infinity)) {
        visited.set(key, cost);
        queue.push({ ...next, cost });
      }
    }
  }
  visited.delete(hexKey(unit.q, unit.r));
  return [...visited].map(([key, cost]) => {
    const [q, r] = key.split(',').map(Number);
    return { q, r, cost };
  }).sort((a, b) => a.cost - b.cost || a.q - b.q || a.r - b.r);
}

// Cube coordinates are used only for tracing hexes between ranged units.
function roundCube(x, y, z) {
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}

function clearLineOfSight(state, from, to) {
  const dist = hexDistance(from, to);
  const features = featureMap(state);
  for (let i = 1; i < dist; i += 1) {
    const t = i / dist;
    const q = from.q + (to.q - from.q) * t;
    const r = from.r + (to.r - from.r) * t;
    const cell = roundCube(q, -q - r, r);
    if (features.get(hexKey(cell.q, cell.r))?.blocksLineOfSight) return false;
  }
  return true;
}

export function attackableUnits(state, unitId) {
  const source = findUnit(state, unitId);
  if (state.outcome || !living(source) || source.side !== state.phase || source.acted) return [];
  return state.units.filter((target) => living(target) && target.side !== source.side
    && hexDistance(source, target) <= UNIT_STATS[source.type].range
    && clearLineOfSight(state, source, target))
    .map((target) => ({ unitId: target.id, distance: hexDistance(source, target) }));
}

function applyDamage(target, value, moraleShock = 0) {
  const dealt = Math.min(target.strength, Math.max(0, Math.floor(value)));
  target.strength -= dealt;
  target.morale = clamp(target.morale - dealt * 11 - moraleShock, 0, 100);
  if (target.strength === 0) target.status = 'destroyed';
  else if (target.morale <= 15) target.status = 'routed';
  return dealt;
}

function validCommand(state, unitId, kind) {
  const unit = findUnit(state, unitId);
  if (state.outcome) return 'Battle is complete';
  if (!unit) return 'Unknown unit';
  if (!living(unit)) return 'Unit cannot act';
  if (unit.side !== state.phase) return 'Not this unit’s phase';
  if (state.ordersRemaining <= 0) return 'No orders remain';
  if (kind === 'move' && unit.moved) return 'Unit already moved';
  if (kind === 'attack' && unit.acted) return 'Unit already attacked';
  return null;
}

function rejected(state, reason) { return { accepted: false, reason, state, events: [] }; }
function accepted(state, events) { return { accepted: true, reason: null, state, events }; }

export function performCombatAction(original, command) {
  if (!original?.units || !command?.type) return rejected(original, 'Invalid command or battle state');
  if (original.outcome) return rejected(original, 'Battle is complete');
  if (command.type === 'select') {
    const unit = findUnit(original, command.unitId);
    if (!living(unit) || unit.side !== original.phase) return rejected(original, 'Select a living friendly unit');
    const state = deepCopy(original);
    state.selectedUnitId = unit.id;
    return accepted(state, [{ type: 'unit-selected', unitId: unit.id }]);
  }
  if (command.type === 'withdraw') {
    if (original.phase !== 'attacker') return rejected(original, 'Only the attacking army may withdraw');
    const state = deepCopy(original);
    state.outcome = 'defender';
    state.phase = 'complete';
    state.ordersRemaining = 0;
    state.selectedUnitId = null;
    turnLog(state, { type: 'attacker-withdrew' });
    return accepted(state, [{ type: 'battle-completed', winner: 'defender', reason: 'withdrawal' }]);
  }
  if (command.type === 'end-turn') {
    const state = deepCopy(original);
    state.phase = opponent(original.phase);
    if (state.phase === 'attacker') state.turn += 1;
    state.ordersRemaining = state.maxOrders;
    state.selectedUnitId = null;
    for (const unit of activeUnits(state, state.phase)) {
      unit.moved = false;
      unit.acted = false;
      unit.movedSteps = 0;
    }
    turnLog(state, { type: 'phase-started', phase: state.phase });
    return accepted(state, [{ type: 'phase-started', phase: state.phase, turn: state.turn }]);
  }
  const error = validCommand(original, command.unitId, command.type);
  if (error) return rejected(original, error);
  if (command.type === 'move') {
    const target = reachableHexes(original, command.unitId)
      .find((cell) => cell.q === command.q && cell.r === command.r);
    if (!target) return rejected(original, 'Hex is blocked, occupied, or out of movement range');
    const state = deepCopy(original);
    const unit = findUnit(state, command.unitId);
    unit.q = target.q;
    unit.r = target.r;
    unit.moved = true;
    unit.movedSteps = target.cost;
    state.ordersRemaining -= 1;
    const event = { type: 'unit-moved', unitId: unit.id, q: unit.q, r: unit.r, cost: target.cost };
    turnLog(state, event);
    return accepted(state, [event]);
  }
  if (command.type === 'attack') {
    const source = findUnit(original, command.unitId);
    const target = findUnit(original, command.targetUnitId);
    if (!target || !living(target) || target.side === source.side) return rejected(original, 'Select a living enemy unit');
    if (!attackableUnits(original, source.id).some((entry) => entry.unitId === target.id)) {
      return rejected(original, 'Enemy out of range or line of sight blocked');
    }
    const state = deepCopy(original);
    const attacker = findUnit(state, command.unitId);
    const defender = findUnit(state, command.targetUnitId);
    const distance = hexDistance(attacker, defender);
    const base = UNIT_STATS[attacker.type];
    const armor = UNIT_STATS[defender.type].armor;
    const charge = attacker.type === 'heavy' && attacker.movedSteps >= 2 && distance === 1 ? 2 : 0;
    const moralePenalty = attacker.morale < 35 ? 1 : 0;
    const damage = Math.max(1, Math.round(base.attack * attacker.strength / attacker.maxStrength) + charge - armor - moralePenalty);
    const dealt = applyDamage(defender, damage, charge ? 8 : 0);
    attacker.acted = true;
    state.ordersRemaining -= 1;
    const events = [{ type: 'unit-attacked', attackerId: attacker.id, defenderId: defender.id, damage: dealt, charge: charge > 0 }];
    // Immediate, once-per-exchange counterattack only at melee range.
    if (living(defender) && distance === 1) {
      const counter = Math.max(1, Math.round(UNIT_STATS[defender.type].counter * defender.strength / defender.maxStrength) - UNIT_STATS[attacker.type].armor);
      const counterDealt = applyDamage(attacker, counter);
      events.push({ type: 'counterattacked', attackerId: defender.id, defenderId: attacker.id, damage: counterDealt });
    }
    for (const event of events) turnLog(state, event);
    checkOutcome(state);
    if (state.outcome) events.push({ type: 'battle-completed', winner: state.outcome });
    return accepted(state, events);
  }
  return rejected(original, `Unknown command: ${command.type}`);
}

/**
 * Deterministic small-unit AI: try an attack, otherwise approach the nearest foe.
 * Caller remains in charge of explicitly advancing the phase afterward.
 */
export function runDefenderPhase(original) {
  if (original.phase !== 'defender' || original.outcome) return rejected(original, 'Defender phase is not active');
  let state = original;
  const events = [];
  const ids = activeUnits(state, 'defender').map((unit) => unit.id).sort();
  for (const unitId of ids) {
    if (state.ordersRemaining <= 0 || state.outcome) break;
    let unit = findUnit(state, unitId);
    if (!living(unit)) continue;
    const targets = attackableUnits(state, unitId)
      .sort((a, b) => a.distance - b.distance || a.unitId.localeCompare(b.unitId));
    if (targets.length) {
      const attack = performCombatAction(state, { type: 'attack', unitId, targetUnitId: targets[0].unitId });
      if (attack.accepted) { state = attack.state; events.push(...attack.events); }
      continue;
    }
    const enemies = activeUnits(state, 'attacker');
    if (!enemies.length) break;
    const options = reachableHexes(state, unitId);
    const best = options.map((cell) => ({
      ...cell,
      distance: Math.min(...enemies.map((enemy) => hexDistance(cell, enemy)))
    })).sort((a, b) => a.distance - b.distance || a.cost - b.cost || a.q - b.q || a.r - b.r)[0];
    if (best && best.distance < Math.min(...enemies.map((enemy) => hexDistance(unit, enemy)))) {
      const move = performCombatAction(state, { type: 'move', unitId, q: best.q, r: best.r });
      if (move.accepted) { state = move.state; events.push(...move.events); }
    }
  }
  return accepted(state, events);
}

export function combatLedger(state) {
  return {
    outcome: state.outcome,
    turn: state.turn,
    // Strength is per-hex pips; source identity must be mapped before campaign writes.
    units: state.units.map(({ id, side, participantId, deploymentSourceId, reserve, strength, maxStrength, morale, status }) => ({
      id, side, participantId, deploymentSourceId, reserve, strength, maxStrength, morale, status
    }))
  };
}
