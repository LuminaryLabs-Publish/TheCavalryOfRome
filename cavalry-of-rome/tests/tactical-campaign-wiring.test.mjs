import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRealtimeGame} from '../src/runtime.js';
import {createCavalryOfRomeKit,routePointAt} from '../src/cavalry-of-rome-kit.js';
import {createStrategicBoardGameLoopKit} from '../src/strategic-board-game-loop-kit.js';
import {cavalryOfRomeLevel01} from '../src/level-01.js';

function game(){
 return createRealtimeGame({kits:[
  createCavalryOfRomeKit({level:cavalryOfRomeLevel01}),
  createStrategicBoardGameLoopKit({activeFaction:'rome',startingGold:120,maxWorldActions:2})
 ]});
}
function expedite(march){march.remainingSeconds=0;march.progress=1;march.currentPosition=routePointAt(march.route,1);}

test('real campaign victory reconciles individual casualties and strategic province ownership',()=>{
 const engine=game();const from=engine.cavalry.getState().campaign;
 const attacker=from.units.find(u=>u.regionId==='hispania'&&u.unitType==='heavy'&&u.status==='garrison');
 assert.ok(attacker);
 engine.cavalry.selectUnit(attacker.id);engine.tick(1/60);
 engine.cavalry.moveUnits('gallia');engine.tick(1/60);
 const march=engine.cavalry.getState().campaign.marches[0];assert.ok(march);
 expedite(march);engine.tick(1/60);
 const enc=engine.cavalry.getState().campaign.encounter;
 assert.equal(enc?.active,true);assert.equal(enc.kind,'arrival');
 assert.ok(enc.board.cells.some(u=>u.deploymentSourceId===attacker.id));
 const tacticalUnits=enc.board.cells.map(c=>({id:c.unitId,strength:c.side==='attacker'?4:0,maxStrength:6}));
 const result=engine.cavalry.resolveEncounter({winner:'attacker',units:tacticalUnits});
 assert.equal(result.capturedRegionId,'gallia');
 const after=engine.cavalry.getState().campaign;
 const survivor=after.units.find(u=>u.id===attacker.id);
 assert.equal(survivor.regionId,'gallia');assert.equal(survivor.status,'garrison');
 assert.equal(survivor.soldiers,Math.round(attacker.soldiers*4/6));
 assert.equal(after.regions.gallia.owner,'rome');
 assert.equal(engine.strategy.getState().regions.gallia.owner,'rome');
 assert.equal(after.encounter,null);
 assert.equal(after.marches.length,0);
 assert.equal(after.selectedUnitIds.length,0);
});

test('arriving at friendly province reinforces without a friendly-fire encounter',()=>{
 const engine=game();const u=engine.cavalry.getState().campaign.units.find(u=>u.regionId==='hispania'&&u.unitType==='light');
 engine.cavalry.selectUnit(u.id);engine.tick(1/60);
 engine.cavalry.moveUnits('italia');engine.tick(1/60);
 const march=engine.cavalry.getState().campaign.marches[0];expedite(march);engine.tick(1/60);
 const campaign=engine.cavalry.getState().campaign;
 assert.equal(campaign.encounter,null);
 assert.equal(campaign.units.find(x=>x.id===u.id).regionId,'italia');
 assert.equal(campaign.marches.length,0);
});
