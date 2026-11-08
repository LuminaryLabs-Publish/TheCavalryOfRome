import test from 'node:test';
import assert from 'node:assert/strict';
import {applyTacticalEncounterResult} from '../src/encounter-resolution.mjs';
const unit=(id,owner,regionId,status='garrison',soldiers=64)=>({id,owner,regionId,status,soldiers,marchId:status==='marching'?'march-1':null,unitType:'heavy'});
function campaign({kind='arrival',duplicates=false}={}){
 const a=unit('roman','rome','italia','marching');
 const d=unit('garrison','blue','gallia');
 const cell=(id,side,sourceId=id)=>({unitId:id,deploymentSourceId:sourceId,side});
 const cells=[cell('roman','attacker'),cell('garrison','defender'),...(duplicates?[cell('garrison-reserve','defender','garrison')]:[])];
 const marches=[{id:'march-1',owner:'rome',fromRegionId:'italia',toRegionId:'gallia',unitIds:['roman'],units:[{id:'roman',soldiers:64}],soldiers:64,count:1,status:'encountering',progress:.9}];
 const p=[{id:'march-1',side:'attacker',owner:'rome'},{id:'province-gallia',side:'defender',owner:'blue'}];
 return {regions:{italia:{id:'italia',owner:'rome',label:'Italia'},gallia:{id:'gallia',owner:'blue',label:'Gallia'}},units:[a,d],marches,encounter:{active:true,kind,board:{cells},marchIds:['march-1'],participants:p},selectedUnitIds:['roman']};
}
const result=(winner='attacker',strengths=[6,0],max=6)=>({winner,units:strengths.map((strength,i)=>({id:['roman','garrison','garrison-reserve'][i],strength,maxStrength:max}))});
test('victory captures enemy province and moves surviving attackers, no duplicate soldiers',()=>{
 const c=campaign();const r=applyTacticalEncounterResult(c,result('attacker',[3,0]));
 assert.equal(r.capturedRegionId,'gallia');assert.equal(c.regions.gallia.owner,'rome');
 assert.equal(c.units[0].soldiers,32);assert.equal(c.units[0].status,'garrison');assert.equal(c.units[0].regionId,'gallia');
 assert.equal(c.units[1].soldiers,0);assert.equal(c.units[1].status,'destroyed');
 assert.equal(c.marches.length,0);assert.equal(c.encounter,null);
});
test('defender victory retreats attackers and preserves province',()=>{
 const c=campaign();const r=applyTacticalEncounterResult(c,result('defender',[2,6]));
 assert.equal(r.capturedRegionId,null);assert.equal(c.regions.gallia.owner,'blue');
 assert.equal(c.units[0].soldiers,21);assert.equal(c.units[0].regionId,'italia');assert.equal(c.units[0].status,'garrison');
 assert.equal(c.units[1].soldiers,64);assert.equal(c.marches.length,0);
});
test('draw returns marcher without conquest',()=>{
 const c=campaign();applyTacticalEncounterResult(c,result('draw',[4,3]));
 assert.equal(c.units[0].regionId,'italia');assert.equal(c.units[1].regionId,'gallia');
 assert.equal(c.regions.gallia.owner,'blue');
});
test('reserve duplicate does not count as extra strategic unit',()=>{
 const c=campaign({duplicates:true});
 applyTacticalEncounterResult(c,result('attacker',[6,6,0]));
 assert.equal(c.units[1].soldiers,32);assert.equal(c.units.length,2);
});
test('refuses incomplete, unknown, forged or duplicated result before mutation',()=>{
 for (const bad of [result('illegal',[6,0]),result('attacker',[6]),result('attacker',[7,0]),result('attacker',[-1,0]),{winner:'attacker',units:[{id:'roman',strength:6,maxStrength:6},{id:'roman',strength:5,maxStrength:6}]}, {winner:'attacker',units:[{id:'roman',strength:6,maxStrength:6},{id:'unknown',strength:5,maxStrength:6}]}]){
 const c=campaign(),before=JSON.stringify(c);assert.throws(()=>applyTacticalEncounterResult(c,bad));assert.equal(JSON.stringify(c),before);
 }
});
test('no campaign encounter is rejected',()=>assert.throws(()=>applyTacticalEncounterResult({encounter:null},result())));
test('nonengaged marches resume after battle',()=>{
 const c=campaign();c.marches.push({id:'march-2',status:'paused',owner:'rome',fromRegionId:'italia',toRegionId:'gallia',unitIds:[]});
 applyTacticalEncounterResult(c,result());assert.equal(c.marches[0].status,'marching');
});
test('collision winner resumes surviving march; losing march returns to origin',()=>{
 const c=campaign({kind:'collision'});
 c.units[1].status='marching';c.units[1].regionId='gallia';c.units[1].marchId='march-2';
 c.marches.push({id:'march-2',owner:'blue',fromRegionId:'gallia',toRegionId:'italia',unitIds:['garrison'],units:[{id:'garrison',soldiers:64}],count:1,soldiers:64,status:'encountering'});
 c.encounter.marchIds=['march-1','march-2'];c.encounter.participants[1].id='march-2';
 applyTacticalEncounterResult(c,result('attacker',[3,3]));
 assert.equal(c.marches.length,1);assert.equal(c.marches[0].status,'marching');
 assert.equal(c.marches[0].soldiers,32);assert.equal(c.units[1].regionId,'gallia');assert.equal(c.units[1].status,'garrison');
});
test('rejects a result whose reserve source does not exist in the strategic roster',()=>{
 const c=campaign({duplicates:true});c.encounter.board.cells.at(-1).deploymentSourceId='fabricated-army';
 const before=JSON.stringify(c);assert.throws(()=>applyTacticalEncounterResult(c,result('attacker',[6,6,0])),/Invalid strategic source/);
 assert.equal(JSON.stringify(c),before);
});
test('territory changes do not invent new units or overwrite unrelated factions',()=>{
 const c=campaign();c.units.push(unit('unrelated','yellow','italia'));
 applyTacticalEncounterResult(c,result('attacker',[6,0]));
 assert.equal(c.units.length,3);assert.equal(c.units[2].soldiers,64);
 assert.equal(c.units[2].status,'garrison');
});
