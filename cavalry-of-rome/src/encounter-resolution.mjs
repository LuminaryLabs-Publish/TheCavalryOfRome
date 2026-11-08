/**
 * Resolves an authored tactical-card result against actual campaign units.
 * Pure state mutation of a caller-owned campaign clone.  No extra reserve units.
 */
export const ENCOUNTER_RESULT_VERSION = '1.0.0';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const active=u=>Number(u?.soldiers)>0 && u?.status!=='destroyed';

export function applyTacticalEncounterResult(campaign, packet) {
  const encounter=campaign?.encounter;
  if (!encounter?.active || !Array.isArray(encounter.board?.cells)) throw new Error('No active tactical encounter');
  if (!packet || !['attacker','defender','draw'].includes(packet.winner)) throw new Error('Invalid tactical winner');
  const cells=encounter.board.cells;
  const results=packet.units;
  if (!Array.isArray(results) || results.length!==cells.length) throw new Error('Incomplete tactical result');
  const byId=new Map();
  for(const result of results){
    if(!result || typeof result.id!=='string'||byId.has(result.id)) throw new Error('Invalid tactical unit identities');
    const health=Number(result.strength),max=Number(result.maxStrength);
    if(!Number.isFinite(health)||!Number.isFinite(max)||max<=0||health<0||health>max) throw new Error(`Invalid tactical health for ${result.id}`);
    byId.set(result.id,result);
  }
  if(cells.some(cell=>!byId.has(cell.unitId)) || byId.size!==cells.length) throw new Error('Unknown/missing tactical unit');
  const bySource=new Map();
  for(const cell of cells){
    const result=byId.get(cell.unitId);
    const source=String(cell.deploymentSourceId||cell.unitId);
    const entry=bySource.get(source)||{hp:0,max:0,side:cell.side};
    if(entry.side!==cell.side)throw new Error('Mixed-side deployment identity');
    entry.hp+=Number(result.strength);entry.max+=Number(result.maxStrength);
    bySource.set(source,entry);
  }
  // Do not accept invented/reserve source identities, cross-faction identities,
  // or results for units that did not belong to this encounter.
  const roster = new Map((campaign.units ?? []).map(unit => [unit.id, unit]));
  const sideOwners = new Map((encounter.participants ?? []).map(p => [p.side, p.owner]));
  for (const [sourceId, entry] of bySource) {
    const unit = roster.get(sourceId);
    if (!unit || (sideOwners.has(entry.side) && unit.owner !== sideOwners.get(entry.side))) {
      throw new Error(`Invalid strategic source ${sourceId}`);
    }
  }
  let casualties=0;
  for(const unit of campaign.units??[]){
    const entry=bySource.get(unit.id);
    if(!entry)continue;
    const before=Number(unit.soldiers||0);
    const after=clamp(Math.round(before*entry.hp/entry.max),0,before);
    casualties+=before-after;unit.soldiers=after;
    if(after<=0){unit.status='destroyed';unit.regionId=null;unit.marchId=null;}
  }
  const participantById=new Map((encounter.participants??[]).map(p=>[p.id,p]));
  const marchIds=new Set(encounter.marchIds??[]);
  const engaged=campaign.marches.filter(m=>marchIds.has(m.id));
  // Collision participants carry side explicitly. Arrival is an attacking march.
  const sideOfMarch=m=>participantById.get(m.id)?.side??'attacker';
  let capturedRegionId=null;
  let winnerOwner=null;
  if(packet.winner==='attacker' || packet.winner==='defender') {
    winnerOwner=(encounter.participants??[]).find(p=>p.side===packet.winner)?.owner??null;
  }
  const keep=[];
  for(const march of campaign.marches){
    if(!marchIds.has(march.id)){
      if(march.status==='paused')march.status='marching';
      keep.push(march);continue;
    }
    const side=sideOfMarch(march);
    const winner=side===packet.winner;
    const survivors=[];
    for(const unitId of march.unitIds??[]){
      const unit=campaign.units.find(u=>u.id===unitId);
      if(!active(unit))continue;
      survivors.push(unit);
      if(encounter.kind==='arrival' && winner){
        unit.status='garrison';unit.regionId=march.toRegionId;unit.marchId=null;
      }else if(winner){
        unit.status='marching';unit.marchId=march.id;
      }else{
        unit.status='garrison';unit.regionId=march.fromRegionId;unit.marchId=null;
      }
    }
    if(winner && encounter.kind==='collision' && survivors.length){
      march.unitIds=survivors.map(u=>u.id);
      march.units=(march.units??[]).filter(u=>survivors.some(v=>v.id===u.id)).map(u=>({...u,soldiers:survivors.find(v=>v.id===u.id).soldiers}));
      march.soldiers=survivors.reduce((sum,u)=>sum+u.soldiers,0);march.count=survivors.length;
      march.status='marching';
      keep.push(march);
    }
  }
  campaign.marches=keep;
  if(encounter.kind==='arrival' && packet.winner==='attacker' && engaged.length){
    const destination=engaged[0].toRegionId;
    const owner=engaged[0].owner;
    if(campaign.regions?.[destination] && owner && campaign.regions[destination].owner!==owner){
      campaign.regions[destination].owner=owner;
      capturedRegionId=destination;winnerOwner=owner;
    }
    // Defeated defenders cannot remain as a garrison in a captured province.
    for(const unit of campaign.units??[]){
      if(unit.regionId===destination && unit.status==='garrison' && unit.owner!==owner){
        unit.status='routed';unit.regionId=null;unit.marchId=null;
      }
    }
  }
  const result={winner:packet.winner,kind:encounter.kind,capturedRegionId,winnerOwner,casualties,remainingUnits:campaign.units.filter(u=>u.status==='garrison'||u.status==='marching').length};
  campaign.encounter=null;
  campaign.selectedUnitIds=[];
  campaign.selectedUnits=[];
  campaign.selectedArmy=null;
  campaign.lastArmyEvent=capturedRegionId?`Rome's command battle captured ${campaign.regions[capturedRegionId].label}.`:`Tactical card battle resolved: ${packet.winner}.`;
  campaign.lastTacticalResult=result;
  return result;
}
