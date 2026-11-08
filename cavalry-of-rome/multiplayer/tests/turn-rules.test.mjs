import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneEncounter} from '../../tactical/encounter-scenario.mjs';
import {reachableHexes} from '../../tactical/hex-combat.mjs';
import {RULES,DOCTRINE_IDS,DOCTRINE_DEFS,createMultiplayerBattle,dispatchMultiplayerAction,viewForPlayer} from '../turn-rules.mjs';
const setup=()=>createMultiplayerBattle(sceneEncounter(),{seed:'mp001-test'});
function apply(s,side,command){const r=dispatchMultiplayerAction(s,side,command);assert.equal(r.accepted,true,`${JSON.stringify(command)} :: ${r.reason}`);return r.state;}
function injectCard(s,type){s=structuredClone(s);s.players.attacker.hand=[{instanceId:`attacker-${type}-test`,type}];s.players.attacker.supply=4;return s;}

test('MP-001 opening has two seeded independent private doctrine decks and symmetric resources',()=>{
 const a=setup(),b=setup();assert.deepEqual(a,b);assert.equal(a.battle.phase,'attacker');
 for(const side of ['attacker','defender']){
  const p=a.players[side];assert.equal(p.command,4);assert.equal(p.supply,3);assert.equal(p.momentum,0);
  assert.equal(p.hand.length,4);assert.equal(p.drawPile.length,20);assert.equal(p.discardPile.length,0);
  assert.ok(p.hand.every(c=>c.instanceId.startsWith(side)));
 }
 assert.equal(DOCTRINE_IDS.length,8);assert.equal(new Set(DOCTRINE_IDS).size,8);
 const attacker=viewForPlayer(a,'attacker'),defender=viewForPlayer(a,'defender');
 assert.notDeepEqual(attacker.hand,defender.hand);assert.equal(attacker.resources.opponent.handCount,4);
 assert.equal('players' in attacker,false);assert.equal('drawPile' in attacker,false);
 assert.equal(JSON.stringify(attacker).includes('defender-supply-train'),false);
});

test('turns enforce side ownership and Command-point economy without needing cards',()=>{
 let s=setup();const unit=s.battle.units.find(u=>u.side==='attacker');const move=reachableHexes(s.battle,unit.id)[0];assert.ok(move);
 assert.equal(dispatchMultiplayerAction(s,'defender',{type:'move',unitId:unit.id,q:move.q,r:move.r}).accepted,false);
 const before=structuredClone(s);s=apply(s,'attacker',{type:'move',unitId:unit.id,q:move.q,r:move.r});
 assert.equal(s.players.attacker.command,3);assert.equal(before.players.attacker.command,4);
 assert.equal(dispatchMultiplayerAction(s,'attacker',{type:'move',unitId:unit.id,q:move.q,r:move.r}).accepted,false);
 const old=s;assert.equal(dispatchMultiplayerAction(s,'attacker',{type:'attack',unitId:'raider-scouts',targetUnitId:unit.id}).accepted,false);assert.deepEqual(s,old);
 s=apply(s,'attacker',{type:'end-turn'});assert.equal(s.battle.phase,'defender');assert.equal(s.players.attacker.supply,4);
 assert.equal(dispatchMultiplayerAction(s,'attacker',{type:'end-turn'}).accepted,false);
 const enemy=s.battle.units.find(u=>u.side==='defender');const next=reachableHexes(s.battle,enemy.id)[0];assert.ok(next);
 s=apply(s,'defender',{type:'move',unitId:enemy.id,q:next.q,r:next.r});assert.equal(s.players.defender.command,3);
 s=apply(s,'defender',{type:'end-turn'});assert.equal(s.battle.phase,'attacker');assert.equal(s.battle.turn,2);assert.equal(s.players.attacker.command,4);
});

test('all 8 original doctrines apply effects, pay supply, and cannot be played twice',()=>{
 const cases={
  'marching-cadence':(s)=>assert.equal(s.players.attacker.command,5),
  'supply-train':s=>assert.equal(s.players.attacker.supply,6),
  'eagle-vow':s=>assert.equal(s.battle.units.find(u=>u.side==='attacker').morale,65),
  'lancer-signal':s=>assert.equal(s.players.attacker.momentum,1),
  'scouting-dispatch':s=>assert.equal(s.players.attacker.command,5),
  'road-levy':s=>assert.equal(s.players.attacker.supply,5),
  'reserve-cohort':s=>assert.equal(s.battle.units.find(u=>u.id==='roma-ala').strength,5),
  'drum-of-resolve':s=>assert.equal(s.battle.units.find(u=>u.id==='roma-ala').morale,75)
 };
 for(const type of DOCTRINE_IDS){let s=injectCard(setup(),type),p=s.players.attacker;
  if(type==='eagle-vow')for(const u of s.battle.units.filter(u=>u.side==='attacker'))u.morale=50;
  if(type==='road-levy'){const unit=s.battle.units.find(u=>u.id==='roma-ala');unit.q=0;unit.r=-2;}
  if(type==='reserve-cohort')s.battle.units.find(u=>u.id==='roma-ala').strength=4;
  if(type==='drum-of-resolve')s.battle.units.find(u=>u.id==='roma-ala').morale=55;
  const oldSupply=p.supply;s=apply(s,'attacker',{type:'play-doctrine',instanceId:`attacker-${type}-test`});
  cases[type](s);assert.equal(s.players.attacker.supply>=oldSupply-DOCTRINE_DEFS[type].cost,true,type);
  assert.equal(s.players.attacker.doctrinePlayed,true);assert.equal(s.players.attacker.hand.length,0);
  assert.equal(dispatchMultiplayerAction(s,'attacker',{type:'play-doctrine',instanceId:`attacker-${type}-test`}).accepted,false);
 }
});

test('momentum surge requires two points and is limited once per activation',()=>{
 let s=setup();assert.equal(dispatchMultiplayerAction(s,'attacker',{type:'surge'}).accepted,false);
 s.players.attacker.momentum=4;s=apply(s,'attacker',{type:'surge'});
 assert.equal(s.players.attacker.momentum,2);assert.equal(s.players.attacker.command,5);
 assert.equal(dispatchMultiplayerAction(s,'attacker',{type:'surge'}).accepted,false);
});

test('resignation and 20-round scoring finish deterministically',()=>{
 let s=setup();s=apply(s,'attacker',{type:'resign'});assert.equal(s.battle.outcome,'defender');assert.equal(s.battle.phase,'complete');
 assert.equal(dispatchMultiplayerAction(s,'defender',{type:'end-turn'}).accepted,false);
 s=setup();for(let i=0;i<40;i++){const side=s.battle.phase;s=apply(s,side,{type:'end-turn'});}
 assert.equal(s.battle.turn,21);assert.equal(s.battle.outcome,'defender');
 assert.equal(s.events.at(-1).type,'round-limit');
});

test('unknown types, unaffordable tactics, forged unit moves fail without modifying source',()=>{
 const s=setup(),before=JSON.stringify(s);
 const bad=[['attacker',{type:'play-doctrine',instanceId:'defender-fake'}],['attacker',{type:'move',unitId:'made-up',q:0,r:0}],['attacker',{type:'issue-orders'}],['defender',{type:'resign-and-attack'}]];
 for(const [side,command] of bad)assert.equal(dispatchMultiplayerAction(s,side,command).accepted,false);
 assert.equal(JSON.stringify(s),before);
});

test('doctrines with no positive effect are rejected instead of consuming a card',()=>{
 const original=setup();
 const state=structuredClone(original);
 const p=state.players.attacker;
 const find=type=>{
  const all=[...p.hand,...p.drawPile,...p.discardPile];
  const c=all.find(c=>c.type===type);
  assert.ok(c,type);
  p.hand=[c];p.drawPile=all.filter(x=>x.instanceId!==c.instanceId);p.discardPile=[];
  return c;
 };
 p.supply=RULES.supplyCap;
 let card=find('supply-train');
 let result=dispatchMultiplayerAction(state,'attacker',{type:'play-doctrine',instanceId:card.instanceId});
 assert.equal(result.accepted,false);
 assert.equal(state.players.attacker.hand.length,1);
 card=find('road-levy');
 result=dispatchMultiplayerAction(state,'attacker',{type:'play-doctrine',instanceId:card.instanceId});
 assert.equal(result.accepted,false);
 card=find('eagle-vow');p.supply=3;
 state.battle.units.filter(u=>u.side==='attacker').forEach(u=>u.morale=100);
 result=dispatchMultiplayerAction(state,'attacker',{type:'play-doctrine',instanceId:card.instanceId});
 assert.equal(result.accepted,false);
 card=find('lancer-signal');p.momentum=RULES.momentumCap;
 result=dispatchMultiplayerAction(state,'attacker',{type:'play-doctrine',instanceId:card.instanceId});
 assert.equal(result.accepted,false);
 card=find('scouting-dispatch');p.command=RULES.commandCap;
 result=dispatchMultiplayerAction(state,'attacker',{type:'play-doctrine',instanceId:card.instanceId});
 assert.equal(result.accepted,false);
});
