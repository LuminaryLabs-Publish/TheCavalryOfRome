import test from 'node:test';
import assert from 'node:assert/strict';
import {repairBattlefieldConnectivity,battlefieldIsReachable} from '../battlefield-connectivity.mjs';
const mk=(radius=5,parts=[],features=[])=>({radius,cells:parts.map(([q,r,side],i)=>({q,r,unitId:`u${i}`,side:side||((i%2)?'defender':'attacker')})),featureCells:features,blockedCells:features.filter(f=>f.obstacle).map(f=>`${f.q},${f.r}`)});
const river=(radius,r=0)=>Array.from({length:radius*2+1},(_,i)=>({q:i-radius,r,type:'river',obstacle:true,movement:'impassable'})).filter(f=>Math.max(Math.abs(f.q),Math.abs(f.r),Math.abs(f.q+f.r))<=radius);
test('an already connected dry battlefield remains unchanged',()=>{
 const before=mk(5,[[0,-3],[0,3]]);const after=repairBattlefieldConnectivity(before);
 assert.deepEqual(after.board,before);assert.deepEqual(after.bridges,[]);assert.ok(battlefieldIsReachable(after.board));
});
test('a complete river barrier generates a visible, passable bridge and retains units',()=>{
 const before=mk(5,[[0,-3],[0,3]],river(5));const snapshot=structuredClone(before);
 assert.equal(battlefieldIsReachable(before),false);
 const after=repairBattlefieldConnectivity(before);
 assert.equal(after.bridges.length,1);
 assert.equal(after.passages.length,0);
 assert.ok(after.board.featureCells.some(f=>f.type==='bridge'&&f.riverCrossing&&f.obstacle===false));
 assert.ok(!after.board.blockedCells.includes(`${after.bridges[0].q},${after.bridges[0].r}`));
 assert.ok(battlefieldIsReachable(after.board));assert.deepEqual(before,snapshot);
 assert.deepEqual(after.board.cells,before.cells);
});
test('existing crossing avoids extra construction',()=>{
 const features=river(6).filter(f=>f.q!==0);
 features.push({q:0,r:0,type:'bridge',obstacle:false,movement:'open',riverCrossing:true});
 const before=mk(6,[[0,-3],[0,3]],features);
 const after=repairBattlefieldConnectivity(before);
 assert.ok(battlefieldIsReachable(after.board));assert.equal(after.bridges.length,0);
});
test('several isolated units share one accessible connected battlefield after repair',()=>{
 const features=river(5).concat([
  {q:0,r:-2,type:'woods',obstacle:true,movement:'impassable'},
  {q:-1,r:-3,type:'rock',obstacle:true,movement:'impassable'},
  {q:1,r:2,type:'woods',obstacle:true,movement:'impassable'}
 ]);
 const before=mk(5,[[0,-3],[-2,-3],[0,3],[2,1]],features);
 const after=repairBattlefieldConnectivity(before);
 assert.ok(after.bridges.length>=1);assert.ok(battlefieldIsReachable(after.board));
});
test('impassable forest wall is opened as a road, not as a fictional river bridge',()=>{
 const features=river(5).map(f=>({...f,type:'woods'}));
 const before=mk(5,[[0,-3],[0,3]],features);
 const after=repairBattlefieldConnectivity(before);
 assert.ok(battlefieldIsReachable(after.board));assert.equal(after.bridges.length,0);assert.equal(after.passages.length,1);
});
test('predictable repair across many blocked water channels',()=>{
 for(let n=3;n<=11;n++)for(let q=0;q<=1;q++){
  const features=river(n,q);
  const before=mk(n,[[0,-n],[0,n]],features);
  const repaired=repairBattlefieldConnectivity(before);
  assert.ok(battlefieldIsReachable(repaired.board),`n=${n}, r=${q}`);
  assert.deepEqual(repaired.board,repairBattlefieldConnectivity(before).board);
 }
});
test('rejects a formation deployed into water',()=>{
 const before=mk(4,[[0,0],[0,3]],[{q:0,r:0,type:'river',obstacle:true,movement:'impassable'}]);
 assert.throws(()=>repairBattlefieldConnectivity(before),/impassable/);
});