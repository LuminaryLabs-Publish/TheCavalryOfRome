import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEncounterCombatState, reachableHexes, attackableUnits,
  performCombatAction, hexDistance, runDefenderPhase, combatLedger
} from '../hex-combat.mjs';

function encounter({ cells, features = [], radius = 4 } = {}) {
  return {
    active: true, kind: 'arrival', hex: { radius, cellSize: 58 },
    board: {
      radius,
      cells: cells ?? [
        { unitId: 'roman', side: 'attacker', unitType: 'heavy', q: 0, r: -2, label: 'Roman cavalry' },
        { unitId: 'aux', side: 'attacker', unitType: 'light', q: -1, r: -1 },
        { unitId: 'enemy', side: 'defender', unitType: 'medium', q: 0, r: 1 },
        { unitId: 'archers', side: 'defender', unitType: 'light', q: 1, r: 1 }
      ],
      featureCells: features,
      blockedCells: features.filter(f => f.obstacle).map(f => `${f.q},${f.r}`)
    }
  };
}
const act = (state, command) => performCombatAction(state, command);
const expectAccepted = (result) => { assert.equal(result.accepted, true, result.reason); return result.state; };

test('creates an immutable, deterministic battle state', () => {
  const src = encounter();
  const a = createEncounterCombatState(src), b = createEncounterCombatState(src);
  assert.deepEqual(a, b);
  assert.equal(a.units.length, 4);
  assert.equal(a.phase, 'attacker');
  assert.equal(a.ordersRemaining, 6);
  assert.equal(src.board.cells[0].strength, undefined);
});

test('rejects non-unique IDs, blocked, overlapping and invalid deployment hexes', () => {
  const src = encounter();
  src.board.cells[1].unitId = 'roman';
  assert.throws(() => createEncounterCombatState(src), /duplicated/);
  src.board.cells[1].unitId = 'aux';
  src.board.cells[1].q = 0; src.board.cells[1].r = -2;
  assert.throws(() => createEncounterCombatState(src), /occupied/);
  src.board.cells[1].r = -5;
  assert.throws(() => createEncounterCombatState(src), /deployment/);
});

test('hex distance obeys axial coordinates', () => {
  assert.equal(hexDistance({q:0,r:0}, {q:3,r:-3}), 3);
  assert.equal(hexDistance({q:-1,r:2}, {q:2,r:-2}), 4);
});

test('movement respects board edge, water/woods, occupied cells and cannot teleport', () => {
  const state = createEncounterCombatState(encounter({ features: [{q:0,r:-1,type:'river',obstacle:true,movement:'impassable'}] }));
  const targets = reachableHexes(state, 'roman');
  assert.ok(!targets.some(c => c.q === 0 && c.r === -1));
  assert.ok(!targets.some(c => c.q === 0 && c.r === 1));
  assert.ok(targets.every(c => c.cost <= 2));
  assert.equal(act(state, {type:'move',unitId:'roman',q:4,r:0}).accepted, false);
  assert.equal(act(state, {type:'move',unitId:'roman',q:0,r:-1}).accepted, false);
  assert.equal(act(state, {type:'move',unitId:'roman',q:0,r:1}).accepted, false);
});

test('move changes position, consumes an order, cannot move again, leaves original unchanged', () => {
  const initial = createEncounterCombatState(encounter());
  const to = reachableHexes(initial, 'roman')[0];
  const next = expectAccepted(act(initial,{type:'move',unitId:'roman',q:to.q,r:to.r}));
  assert.equal(next.ordersRemaining, 5);
  assert.equal(next.units.find(u => u.id === 'roman').moved, true);
  assert.deepEqual(initial.units[0], createEncounterCombatState(encounter()).units[0]);
  assert.equal(act(next,{type:'move',unitId:'roman',q:1,r:-2}).accepted,false);
});

test('select cannot choose enemy and select does not spend orders', () => {
  const initial = createEncounterCombatState(encounter());
  assert.equal(act(initial,{type:'select',unitId:'enemy'}).accepted,false);
  const next = expectAccepted(act(initial,{type:'select',unitId:'roman'}));
  assert.equal(next.selectedUnitId,'roman');
  assert.equal(next.ordersRemaining,initial.ordersRemaining);
});

test('opposing phase cannot act; ending phase refreshes only active units', () => {
  const initial = createEncounterCombatState(encounter());
  assert.equal(act(initial,{type:'move',unitId:'enemy',q:1,r:0}).accepted,false);
  const defender = expectAccepted(act(initial,{type:'end-turn'}));
  assert.equal(defender.phase,'defender');
  assert.equal(defender.turn,1);
  assert.equal(act(defender,{type:'select',unitId:'roman'}).accepted,false);
  const round2 = expectAccepted(act(defender,{type:'end-turn'}));
  assert.equal(round2.phase,'attacker');
  assert.equal(round2.turn,2);
});

test('light ranged units can attack only within range and with clear line of sight', () => {
  const close = createEncounterCombatState(encounter({ cells:[
    {unitId:'a',side:'attacker',unitType:'light',q:0,r:0},
    {unitId:'b',side:'defender',unitType:'medium',q:0,r:2}
  ] }));
  assert.deepEqual(attackableUnits(close,'a'),[{unitId:'b',distance:2}]);
  const covered = createEncounterCombatState(encounter({ cells:[
    {unitId:'a',side:'attacker',unitType:'light',q:0,r:0},
    {unitId:'b',side:'defender',unitType:'medium',q:0,r:2}
  ], features:[{q:0,r:1,type:'woods',obstacle:true,movement:'impassable',blocksLineOfSight:true}]}));
  assert.deepEqual(attackableUnits(covered,'a'),[]);
  assert.equal(act(covered,{type:'attack',unitId:'a',targetUnitId:'b'}).accepted,false);
});

test('attacks damage enemy, trigger melee retaliation, and prohibit repeat attack', () => {
  const initial = createEncounterCombatState(encounter({cells:[
    {unitId:'a',side:'attacker',unitType:'medium',q:0,r:0},
    {unitId:'b',side:'defender',unitType:'heavy',q:0,r:1}
  ] }));
  const result = act(initial,{type:'attack',unitId:'a',targetUnitId:'b'});
  const next = expectAccepted(result);
  assert.ok(result.events.some(e=>e.type==='counterattacked'));
  assert.ok(next.units.find(u=>u.id==='b').strength < 6);
  assert.ok(next.units.find(u=>u.id==='a').strength < 6);
  assert.equal(next.ordersRemaining,5);
  assert.equal(act(next,{type:'attack',unitId:'a',targetUnitId:'b'}).accepted,false);
  assert.equal(initial.units.find(u=>u.id==='b').strength,6);
});

test('ranged fire receives no melee retaliation', () => {
  const initial = createEncounterCombatState(encounter({cells:[
    {unitId:'a',side:'attacker',unitType:'light',q:0,r:0},
    {unitId:'b',side:'defender',unitType:'heavy',q:0,r:2}
  ] }));
  const result = act(initial,{type:'attack',unitId:'a',targetUnitId:'b'});
  assert.equal(result.accepted,true);
  assert.equal(result.events.filter(e=>e.type==='counterattacked').length,0);
});

test('defeating the final enemy automatically ends the battle', () => {
  let state = createEncounterCombatState(encounter({cells:[
    {unitId:'a',side:'attacker',unitType:'heavy',q:0,r:0},
    {unitId:'b',side:'defender',unitType:'light',q:0,r:1}
  ] }));
  for (let i=0;i<8 && !state.outcome;i++) {
    if (state.phase==='attacker') {
      const atk=act(state,{type:'attack',unitId:'a',targetUnitId:'b'});
      if (atk.accepted) state=atk.state;
    }
    if (!state.outcome) state = expectAccepted(act(state,{type:'end-turn'}));
    if (!state.outcome && state.phase==='defender') state = expectAccepted(act(state,{type:'end-turn'}));
  }
  assert.equal(state.outcome,'attacker');
  assert.equal(state.phase,'complete');
  assert.equal(act(state,{type:'end-turn'}).accepted,false);
});

test('withdrawal resolves defensively and makes further commands illegal', () => {
  const state=createEncounterCombatState(encounter());
  const next=expectAccepted(act(state,{type:'withdraw'}));
  assert.equal(next.outcome,'defender');
  assert.equal(next.log.at(-1).type,'attacker-withdrew');
  assert.equal(act(next,{type:'end-turn'}).accepted,false);
});

test('AI executes legal, deterministic defender actions without mutating input', () => {
  const origin=createEncounterCombatState(encounter());
  const initial=expectAccepted(act(origin,{type:'end-turn'}));
  const a=runDefenderPhase(initial), b=runDefenderPhase(initial);
  assert.equal(a.accepted,true);
  assert.deepEqual(a.state,b.state);
  assert.equal(initial.ordersRemaining,6);
  assert.ok(a.state.ordersRemaining<=6);
  assert.ok(a.events.every(e=>['unit-moved','unit-attacked','counterattacked','battle-completed'].includes(e.type)));
});

test('ledger reports pip strength, never fabricates campaign casualties', () => {
  const state=createEncounterCombatState(encounter());
  const ledger=combatLedger(state);
  assert.equal(ledger.units.length,4);
  assert.ok(ledger.units.every(u=>'strength' in u && !('soldiers' in u)));
});

test('attack authorization rejects friendly fire and unknown target IDs', () => {
  const state=createEncounterCombatState(encounter());
  assert.equal(act(state,{type:'attack',unitId:'roman',targetUnitId:'aux'}).accepted,false);
  assert.equal(act(state,{type:'attack',unitId:'roman',targetUnitId:'none'}).accepted,false);
});

test('orders are bounded by per-phase budget', () => {
  let state=createEncounterCombatState(encounter({cells:[
    {unitId:'a',side:'attacker',unitType:'medium',q:0,r:0},
    {unitId:'b',side:'defender',unitType:'medium',q:0,r:1}
  ]}),{maxOrders:1});
  state=expectAccepted(act(state,{type:'attack',unitId:'a',targetUnitId:'b'}));
  assert.equal(state.ordersRemaining,0);
  assert.equal(act(state,{type:'move',unitId:'a',q:1,r:0}).accepted,false);
  const next=expectAccepted(act(state,{type:'end-turn'}));
  assert.equal(next.ordersRemaining,1);
});
