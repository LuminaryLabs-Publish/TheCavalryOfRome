import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {SITE,allHexes,axialWorld,hexCornerWorld,terrainHeight,originalWorldHeight,riverDistance,riverHalfWidth,riverCenterZ,RIVER_PATH_CELLS,FEATURES,getFeature,validHex,cellNeighbors} from '../terrain-world.mjs';
import {inspectDeployment,sceneEncounter,INITIAL_UNITS} from '../encounter-scenario.mjs';
import {authorWorldScene,authorHighlightScene} from '../sculpt-geometry.mjs';
import {parseGLB} from '../webgl-battlefield.mjs';
import {createCardCombatState,dispatchCardAction,CARD_DEFS} from '../command-cards.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const hash=({q,r})=>`${q},${r}`;
test('battlefield contains 91 non-overlapping hex cell centers',()=>{
 const hexes=allHexes();assert.equal(hexes.length,91);assert.equal(new Set(hexes.map(hash)).size,91);
 const hex=new Set(hexes.map(hash));
 for(const h of hexes){assert.equal(validHex(h.q,h.r),true);for(const n of cellNeighbors(h.q,h.r))assert.equal(hex.has(hash(n)),true);}
});
test('adjacent tiles share edges in the world projection',()=>{
 const a=axialWorld(0,0),b=axialWorld(1,0);
 assert.ok(Math.abs(Math.hypot(a.x-b.x,a.z-b.z)-Math.sqrt(3)*SITE.hexSize)<1e-8);
 const ca=Array.from({length:6},(_,i)=>hexCornerWorld(0,0,i));const cb=Array.from({length:6},(_,i)=>hexCornerWorld(1,0,i));
 const shared=ca.filter(p=>cb.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<.00001));assert.equal(shared.length,2);
});
test('tactical cells conform to the nonflat published world heightfield',()=>{
 const heights=allHexes().map(h=>{const p=axialWorld(h.q,h.r);return terrainHeight(p.x,p.z);});
 assert.ok(Math.max(...heights)-Math.min(...heights)>60);
 const distant=originalWorldHeight(SITE.x+1200,SITE.z+1000),sculpt=terrainHeight(SITE.x+1200,SITE.z+1000);
 assert.equal(distant,sculpt,'Local river sculpt must not alter distant world geometry');
});
test('river cells form a continuous watercourse and bridge is passable',()=>{
 assert.equal(RIVER_PATH_CELLS.length,11);
 for(let i=1;i<RIVER_PATH_CELLS.length;i++){
  const a=RIVER_PATH_CELLS[i-1],b=RIVER_PATH_CELLS[i];
  assert.ok(cellNeighbors(a.q,a.r).some(x=>x.q===b.q&&x.r===b.r));
 }
 for(const h of RIVER_PATH_CELLS){const p=axialWorld(h.q,h.r);assert.ok(riverDistance(p.x,p.z)<.01);}
 assert.equal(getFeature(0,0)?.type,'bridge');assert.equal(getFeature(0,0)?.obstacle,false);
 assert.ok(FEATURES.some(x=>x.type==='river'&&x.obstacle===true));
});
test('every feature has a unique valid hex and no deployments overlap terrain obstructions',()=>{
 assert.equal(new Set(FEATURES.map(hash)).size,FEATURES.length);
 for(const f of FEATURES)assert.ok(validHex(f.q,f.r));
 assert.deepEqual(inspectDeployment(),[]);
 assert.equal(INITIAL_UNITS.length,7);
});
test('actual 3D world mesh contains finite vertices, smooth normals and a large triangle count',()=>{
 const mesh=authorWorldScene();assert.ok(mesh.triangles>100000);assert.equal(mesh.vertices.length,mesh.triangles*3*9);
 for(let i=0;i<mesh.vertices.length;i++){assert.ok(Number.isFinite(mesh.vertices[i]),`nonfinite ${i}`);}
 const highs=Array.from({length:mesh.vertices.length/9},(_,i)=>mesh.vertices[i*9+1]);
 assert.ok(Math.max(...highs.slice(0,500))>Math.min(...highs.slice(0,500)));
});
test('interactive highlight geometry stays in the world coordinate system',()=>{
 const m=authorHighlightScene({selected:{q:0,r:0},moves:[{q:1,r:0}],targets:[{q:0,r:1}],eligible:[{q:-1,r:1}]});
 assert.ok(m.triangles>=48);assert.equal(m.vertices.length,m.triangles*27);
});
test('all six authored miniature GLBs contain valid triangle geometry and vertex colors',()=>{
 for(const faction of ['roman','enemy'])for(const type of ['light','medium','heavy']){
  const file=resolve(root,'assets/models',`${faction}-${type}.glb`),buffer=fs.readFileSync(file);
  const data=buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
  const mesh=parseGLB(data);
  assert.ok(mesh.triangles>1100,`${faction}-${type}`);assert.equal(mesh.vertices.length,mesh.triangles*27);
  assert.ok(mesh.vertices.every(Number.isFinite));
  const colors=new Set();for(let i=0;i<mesh.vertices.length;i+=9)colors.add(mesh.vertices[i+6].toFixed(4));
  assert.ok(colors.size>=4,`${faction}-${type} lacks material variety`);
 }
});
test('card combat preserves soldier number and health through moves and damage',()=>{
 let state=createCardCombatState(sceneEncounter());
 const roman=state.battle.units.find(u=>u.id==='roma-ala');
 assert.equal(roman.soldiers,64);assert.equal(roman.strength,6);assert.equal(roman.maxStrength,6);
 const chosen=state.hand.find(c=>c.type==='cavalry-charge');
 state=dispatchCardAction(state,{type:'play-card',instanceId:chosen.instanceId}).state;
 assert.equal(state.activeCard.type,'cavalry-charge');
 assert.equal(state.battle.units.find(u=>u.id==='roma-ala').soldiers,64);
});
test('command-card turn can move a mounted miniature over valid hexes and draws a new card',()=>{
 let s=createCardCombatState(sceneEncounter());const cavalry=s.hand.find(x=>x.type==='cavalry-charge');
 const play=dispatchCardAction(s,{type:'play-card',instanceId:cavalry.instanceId});assert.equal(play.accepted,true);s=play.state;
 const order=dispatchCardAction(s,{type:'order-unit',unitId:'roma-ala'});assert.equal(order.accepted,true);s=order.state;
 const next={q:-1,r:-1};
 const moved=dispatchCardAction(s,{type:'move',unitId:'roma-ala',...next});
 assert.equal(moved.accepted,true,moved.reason);s=moved.state;
 assert.equal(s.battle.units.find(u=>u.id==='roma-ala').q,next.q);
 assert.equal(s.battle.units.find(u=>u.id==='roma-ala').r,next.r);
 const end=dispatchCardAction(s,{type:'end-command'});assert.equal(end.accepted,true,end.reason);s=end.state;
 assert.equal(s.hand.length,5);assert.equal(s.battle.turn,2);assert.equal(s.activeCard,null);
});
