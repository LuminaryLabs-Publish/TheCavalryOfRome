/** The Sabine crossing: authored on the published world's heightfield. */
import {SITE,FEATURES,validHex,axialWorld,getFeature} from './terrain-world.mjs';
export const INITIAL_UNITS=Object.freeze([
 {unitId:'roma-ala',side:'attacker',unitType:'heavy',q:-1,r:-2,label:'Ala Augusta',soldiers:64,owner:'rome'},
 {unitId:'roma-velites',side:'attacker',unitType:'light',q:0,r:-3,label:'Roman Velites',soldiers:24,owner:'rome'},
 {unitId:'roma-legion',side:'attacker',unitType:'medium',q:1,r:-4,label:'Legio Italica',soldiers:42,owner:'rome'},
 {unitId:'raider-scouts',side:'defender',unitType:'light',q:-3,r:2,label:'Hill Scouts',soldiers:24,owner:'blue'},
 {unitId:'raider-spears',side:'defender',unitType:'medium',q:-1,r:3,label:'Hill Raiders',soldiers:42,owner:'blue'},
 {unitId:'warband-riders',side:'defender',unitType:'heavy',q:1,r:2,label:'Warband Riders',soldiers:64,owner:'blue'},
 {unitId:'river-javelins',side:'defender',unitType:'light',q:3,r:1,label:'River Javelins',soldiers:24,owner:'blue'}
]);
export function sceneEncounter(){
 return {active:true,kind:'arrival',center:{x:SITE.x,z:SITE.z},bearing:SITE.bearing,
  hex:{radius:SITE.radius,cellSize:SITE.hexSize},
  board:{radius:SITE.radius,cellSize:SITE.hexSize,cells:INITIAL_UNITS.map(x=>({...x})),featureCells:FEATURES.map(x=>({...x})),blockedCells:FEATURES.filter(f=>f.obstacle).map(f=>`${f.q},${f.r}`)}};
}
export function inspectDeployment(){const errors=[],set=new Set();for(const u of INITIAL_UNITS){const id=`${u.q},${u.r}`;if(!validHex(u.q,u.r))errors.push(`${u.unitId} out of board`);if(getFeature(u.q,u.r)?.obstacle)errors.push(`${u.unitId} on blocked ${id}`);if(set.has(id))errors.push(`overlap at ${id}`);set.add(id);}return errors;}
