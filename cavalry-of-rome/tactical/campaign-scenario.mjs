/** Bridge the published campaign encounter to the authored 3D hex battlefield.
 * Every deployed unit keeps its original identity and tactical origin.
 */
import {SITE,allHexes,getFeature,validHex,configureCampaignSite,FEATURES} from './terrain-world.mjs';
import {sceneEncounter} from './encounter-scenario.mjs';
export function readCampaignContext(name=globalThis.name, framed=globalThis.parent!==globalThis){
 if(!framed)return null;
 try{
  const packet=JSON.parse(name||'null');
  if(packet?.protocol!=='cavalry:tactical:init:v1'||typeof packet.token!=='string'||packet.token.length>160||!packet.encounter?.active||!Array.isArray(packet.encounter.board?.cells))return null;
  return packet;
 }catch{return null;}
}
export function buildCampaignScenario(source){
 if(!source?.active||!Array.isArray(source?.board?.cells))throw new Error('Active campaign board required');
 const cells=source.board.cells;
 const bySide={attacker:[],defender:[]};
 const ids=new Set();
 for(const c of cells){
  if(!bySide[c.side]||typeof c.unitId!=='string'||!c.unitId||ids.has(c.unitId))throw new Error('Invalid or repeated campaign formation');
  ids.add(c.unitId);bySide[c.side].push(c);
 }
 // Expand only when absolutely needed, keeping the original board positions.
 let available=null,radius=7;
 for(;radius<=13;radius++){
  configureCampaignSite(source,radius);
  available=allHexes(radius).filter(c=>!getFeature(c.q,c.r)?.obstacle);
  if(['attacker','defender'].every(side=>available.filter(c=>side==='attacker'?c.r<0:c.r>0).length>=bySide[side].length))break;
 }
 if(radius>13)throw new Error('Encounter exceeds authoring battlefield capacity');
 const scenario=sceneEncounter();
 const occupied=new Set(),mapped=[];
 const groupSizes=new Map();
 for(const c of cells){const key=c.deploymentSourceId||c.unitId;groupSizes.set(key,(groupSizes.get(key)||0)+1);}
 for(const side of ['attacker','defender']){
  const sideSlots=available.filter(c=>side==='attacker'?c.r<0:c.r>0);
  for(const c of bySide[side]){
   const key=`${c.q},${c.r}`;
   let pos;
   if(validHex(c.q,c.r,radius)&&!getFeature(c.q,c.r)?.obstacle&&!occupied.has(key)&&(side==='attacker'?c.r<0:c.r>0))pos={q:c.q,r:c.r};
   else{
    // Locate an unoccupied, nearby, side-correct hex without creating troops.
    pos=sideSlots.filter(p=>!occupied.has(`${p.q},${p.r}`)).sort((a,b)=>Math.hypot(a.q-c.q,a.r-c.r)-Math.hypot(b.q-c.q,b.r-c.r)||a.q-b.q||a.r-b.r)[0];
   }
   if(!pos)throw new Error('No valid deployment position');
   occupied.add(`${pos.q},${pos.r}`);
   const src=c.deploymentSourceId||c.unitId,number=Number(c.soldiers);
   mapped.push({...c,...pos,side,deploymentSourceId:src,soldiers:Number.isFinite(number)?Math.max(0,Math.round(number/(groupSizes.get(src)||1))):0});
  }
 }
 scenario.center={x:SITE.x,z:SITE.z};scenario.bearing=SITE.bearing;
 scenario.kind=source.kind??'arrival';scenario.hex={radius,cellSize:SITE.hexSize};
 scenario.board={radius,cellSize:SITE.hexSize,cells:mapped,featureCells:FEATURES.map(f=>({...f})),blockedCells:FEATURES.filter(f=>f.obstacle).map(f=>`${f.q},${f.r}`)};
 return scenario;
}
