import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCampaignScenario,readCampaignContext} from '../campaign-scenario.mjs';
import {SITE,FEATURES,riverDistance,ACTIVE_CAMPAIGN_SITE} from '../terrain-world.mjs';
import {createCardCombatState,dispatchCardAction} from '../command-cards.mjs';
const cell=(unitId,side,q,r,extra={})=>({unitId,side,q,r,unitType:side==='attacker'?'heavy':'medium',soldiers:64,owner:side==='attacker'?'rome':'blue',...extra});
const fixture=(overrides={})=>({active:true,kind:'arrival',center:{x:1000,z:480},bearing:.3,hex:{radius:6,cellSize:58},board:{cells:[cell('a','attacker',-2,-1),cell('b','defender',2,1)],featureCells:[{q:0,r:0,type:'woods',obstacle:true,movement:'impassable',blocksLineOfSight:true}]},...overrides});
test('adapter retains true world location, unit IDs, positions and map features',()=>{
 const e=fixture(),result=buildCampaignScenario(e);
 assert.equal(SITE.x,1000);assert.equal(SITE.z,480);
 assert.deepEqual(result.board.cells.map(c=>[c.unitId,c.q,c.r]),[['a',-2,-1],['b',2,1]]);
 assert.ok(result.board.blockedCells.includes('0,0'));
 assert.deepEqual(result.board.featureCells.map(c=>c.type),['woods']);
 assert.equal(riverDistance(SITE.x,SITE.z),Infinity);
 assert.ok(ACTIVE_CAMPAIGN_SITE);
 const game=createCardCombatState(result);
 assert.equal(game.battle.units.length,2);
 assert.equal(game.battle.units[0].id,'a');
});
test('adapter moves obstructed and overlapping formation to free friendly-side cells',()=>{
 const e=fixture();e.board.cells=[cell('a','attacker',0,-1),cell('b','defender',0,0),cell('c','defender',0,0)];
 const result=buildCampaignScenario(e);const seen=new Set();
 for(const c of result.board.cells){
  const key=`${c.q},${c.r}`;assert.ok(!seen.has(key));seen.add(key);
  assert.ok(!result.board.blockedCells.includes(key));
  assert.ok(c.side==='attacker'?c.r<0:c.r>0);
 }
});
test('adapter does not invent strategic source for reserve units',()=>{
 const e=fixture();e.board.cells=[cell('a','attacker',-2,-1),cell('b','defender',2,1),cell('b-reserve','defender',3,1,{deploymentSourceId:'b',soldiers:64})];
 const scenario=buildCampaignScenario(e);const byId=new Map(scenario.board.cells.map(c=>[c.unitId,c]));
 assert.equal(byId.get('b-reserve').deploymentSourceId,'b');
 assert.equal(byId.get('b-reserve').soldiers,32);
 assert.equal(byId.get('b').soldiers,32);
});
test('context loading requires framed active campaign encounter and a matching protocol',()=>{
 const packet={protocol:'cavalry:tactical:init:v1',token:'token',encounter:fixture()};
 assert.equal(readCampaignContext(JSON.stringify(packet),true)?.token,'token');
 assert.equal(readCampaignContext(JSON.stringify(packet),false),null);
 assert.equal(readCampaignContext('{nonsense',true),null);
 assert.equal(readCampaignContext(JSON.stringify({...packet,protocol:'unknown'}),true),null);
});
