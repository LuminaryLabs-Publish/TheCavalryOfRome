/** MP-001 — Cohorts, Supply & Momentum.
 * Independent multiplayer rules using the existing deterministic hex-combat core.
 * Unlike section-command card systems, any ready unit may receive ordinary orders.
 * Doctrine cards affect resources, not command authorization.
 */
import {createEncounterCombatState, performCombatAction} from '../tactical/hex-combat.mjs';

export const MULTIPLAYER_RULES_VERSION = '1.0.0';
export const RULES = Object.freeze({command:4, commandCap:6, supply:3, supplyCap:6, momentumCap:4, handSize:4, maxRounds:20});
export const DOCTRINE_DEFS = Object.freeze({
  'marching-cadence':Object.freeze({id:'marching-cadence',title:'Marching Cadence',cost:1,description:'Gain 1 Command point.',icon:'footprints'}),
  'supply-train':Object.freeze({id:'supply-train',title:'Supply Train',cost:0,description:'Recover 2 Supply.',icon:'package'}),
  'eagle-vow':Object.freeze({id:'eagle-vow',title:'Eagle Vow',cost:2,description:'All friendly formations gain 15 morale.',icon:'flag'}),
  'lancer-signal':Object.freeze({id:'lancer-signal',title:'Lancer Signal',cost:1,description:'Gain 1 Momentum if cavalry survives.',icon:'swords'}),
  'scouting-dispatch':Object.freeze({id:'scouting-dispatch',title:'Scouting Dispatch',cost:1,description:'Gain 1 Command if scouts survive.',icon:'binoculars'}),
  'road-levy':Object.freeze({id:'road-levy',title:'Road Levy',cost:0,description:'Gain 1 Supply from a road or bridge.',icon:'route'}),
  'reserve-cohort':Object.freeze({id:'reserve-cohort',title:'Reserve Cohort',cost:2,description:'Restore 1 strength to a weakened formation.',icon:'shield-plus'}),
  'drum-of-resolve':Object.freeze({id:'drum-of-resolve',title:'Drum of Resolve',cost:1,description:'Raise the lowest friendly morale by 20.',icon:'drum'})
});
export const DOCTRINE_IDS=Object.freeze(Object.keys(DOCTRINE_DEFS));
const clone=structuredClone;
const sides=['attacker','defender'];
const other=x=>x==='attacker'?'defender':'attacker';
const cap=(v,max)=>Math.max(0,Math.min(max,v));
const alive=u=>u.status==='ready'&&u.strength>0;
const ok=(state,events=[])=>({accepted:true,reason:null,state,events});
const bad=(state,reason)=>({accepted:false,reason,state,events:[]});
function stableHash(s){let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function shuffle(cards,seed){let h=stableHash(seed)||1;const copy=[...cards];for(let i=copy.length-1;i>0;i--){h^=h<<13;h^=h>>>17;h^=h<<5;const j=(h>>>0)%(i+1);[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
function addEvent(s,type,data={}){const e={seq:++s.sequence,turn:s.battle.turn,side:s.battle.phase,type,...data};s.events.push(e);if(s.events.length>160)s.events.shift();return e;}
function draw(s,side){const p=s.players[side];if(p.hand.length>=RULES.handSize)return;
 if(!p.drawPile.length&&p.discardPile.length){p.drawPile=shuffle(p.discardPile,`${s.seed}:${side}:${p.reshuffles++}`);p.discardPile=[];}
 if(p.drawPile.length)p.hand.push(p.drawPile.shift());
}
function friend(s,side){return s.battle.units.filter(u=>u.side===side&&alive(u));}
function terrain(s,u){return s.battle.features.find(f=>f.q===u.q&&f.r===u.r)?.type;}
function canPlay(state,side,id){
 const p=state.players[side],def=DOCTRINE_DEFS[id];if(!def||p.supply<def.cost||p.doctrinePlayed)return false;
 const friends=friend(state,side);
 if(id==='lancer-signal')return p.momentum<RULES.momentumCap&&friends.some(u=>u.type==='heavy');
 if(id==='scouting-dispatch')return p.command<RULES.commandCap&&friends.some(u=>u.type==='light');
 if(id==='road-levy')return p.supply<RULES.supplyCap&&friends.some(u=>['road','bridge'].includes(terrain(state,u)));
 if(id==='reserve-cohort')return friends.some(u=>u.strength<u.maxStrength);
 if(id==='drum-of-resolve')return friends.some(u=>u.morale<100);
 if(id==='eagle-vow')return friends.some(u=>u.morale<100);
 if(id==='marching-cadence'||id==='scouting-dispatch')return p.command<RULES.commandCap;
 if(id==='supply-train')return p.supply<RULES.supplyCap;
 return true;
}
export function createMultiplayerBattle(encounter,{seed='cavalry-multiplayer'}={}){
 const battle=createEncounterCombatState(encounter,{maxOrders:12});
 const players={};
 for(const side of sides){const copies=DOCTRINE_IDS.flatMap(type=>Array.from({length:3},(_,i)=>({instanceId:`${side}-${type}-${i+1}`,type})));
 const pile=shuffle(copies,`${seed}:${side}`);players[side]={command:RULES.command,supply:RULES.supply,momentum:0,doctrinePlayed:false,surged:false,roadMomentumEarned:false,hand:pile.splice(0,RULES.handSize),drawPile:pile,discardPile:[],reshuffles:0};}
 return {version:MULTIPLAYER_RULES_VERSION,seed,sequence:0,battle,players,events:[]};
}
function resolveDoctrine(state,side,type){const p=state.players[side],units=friend(state,side);
 switch(type){
 case 'marching-cadence':p.command=cap(p.command+1,RULES.commandCap);break;
 case 'supply-train':p.supply=cap(p.supply+2,RULES.supplyCap);break;
 case 'eagle-vow':for(const u of units)u.morale=cap(u.morale+15,100);break;
 case 'lancer-signal':p.momentum=cap(p.momentum+1,RULES.momentumCap);break;
 case 'scouting-dispatch':p.command=cap(p.command+1,RULES.commandCap);break;
 case 'road-levy':p.supply=cap(p.supply+1,RULES.supplyCap);break;
 case 'reserve-cohort':{const injured=units.filter(u=>u.strength<u.maxStrength).sort((a,b)=>a.strength/a.maxStrength-b.strength/b.maxStrength||a.id.localeCompare(b.id));if(injured.length)injured[0].strength++;break;}
 case 'drum-of-resolve':{const low=[...units].sort((a,b)=>a.morale-b.morale||a.id.localeCompare(b.id))[0];if(low)low.morale=cap(low.morale+20,100);break;}
 }
}
function finishTwentyRounds(state){if(state.battle.turn<=RULES.maxRounds||state.battle.outcome)return null;
 const attacker=friend(state,'attacker').reduce((x,u)=>x+u.strength,0);
 const defender=friend(state,'defender').reduce((x,u)=>x+u.strength,0);
 state.battle.outcome=attacker>defender?'attacker':defender>attacker?'defender':'draw';
 state.battle.phase='complete';state.battle.ordersRemaining=0;
 return addEvent(state,'round-limit',{winner:state.battle.outcome,attackerStrength:attacker,defenderStrength:defender});
}
export function dispatchMultiplayerAction(original,side,command){
 if(!original?.battle||!sides.includes(side)||!command||typeof command.type!=='string')return bad(original,'Invalid command');
 if(original.battle.outcome)return bad(original,'The battle has finished');
 if(command.type==='resign'){
  const s=clone(original);s.battle.outcome=other(side);s.battle.phase='complete';s.battle.ordersRemaining=0;
  return ok(s,[addEvent(s,'resignation',{resigningSide:side,winner:other(side)})]);
 }
 if(original.battle.phase!==side)return bad(original,'Wait for your turn');
 const current=original.players?.[side];if(!current)return bad(original,'Missing player resources');
 if(command.type==='play-doctrine'){
  if(typeof command.instanceId!=='string')return bad(original,'Choose a doctrine card');
  const chosen=current.hand.find(c=>c.instanceId===command.instanceId);
  if(!chosen)return bad(original,'The card is not in your hand');
  if(!canPlay(original,side,chosen.type))return bad(original,'Insufficient supply or doctrine conditions are unmet');
  const s=clone(original),p=s.players[side];p.supply-=DOCTRINE_DEFS[chosen.type].cost;p.doctrinePlayed=true;
  p.hand=p.hand.filter(c=>c.instanceId!==chosen.instanceId);p.discardPile.push(chosen);
  resolveDoctrine(s,side,chosen.type);
  return ok(s,[addEvent(s,'doctrine-played',{cardType:chosen.type})]);
 }
 if(command.type==='surge'){
  if(current.momentum<2||current.surged||current.command>=RULES.commandCap)return bad(original,'Momentum surge unavailable');
  const s=clone(original),p=s.players[side];p.momentum-=2;p.command++;p.surged=true;
  return ok(s,[addEvent(s,'momentum-surge',{command:p.command,momentum:p.momentum})]);
 }
 if(command.type==='end-turn'){
  const s=clone(original),p=s.players[side];p.supply=cap(p.supply+1,RULES.supplyCap);draw(s,side);
  const advanced=performCombatAction(s.battle,{type:'end-turn'});if(!advanced.accepted)return bad(original,advanced.reason);
  s.battle=advanced.state;
  const next=s.players[other(side)];next.command=RULES.command;next.doctrinePlayed=false;next.surged=false;next.roadMomentumEarned=false;
  const e=addEvent(s,'activation-ended',{side,finishedSide:side,nextSide:other(side)});
  const limit=finishTwentyRounds(s);
  return ok(s,limit?[e,limit]:[e]);
 }
 if(!['move','attack','rally'].includes(command.type))return bad(original,`Unknown command: ${command.type}`);
 const cost=command.type==='attack'?2:1;
 if(current.command<cost)return bad(original,'Not enough Command points');
 const unit=original.battle.units.find(u=>u.id===command.unitId);
 if(!unit||unit.side!==side||!alive(unit))return bad(original,'Select an available friendly formation');
 if(command.type==='rally'){
  if(unit.moved||unit.acted||unit.morale>=100||original.battle.ordersRemaining<=0)return bad(original,'Formation cannot rally now');
  const s=clone(original),u=s.battle.units.find(u=>u.id===unit.id);
  u.morale=cap(u.morale+25,100);u.moved=true;u.acted=true;
  s.players[side].command-=1;s.battle.ordersRemaining--;
  return ok(s,[addEvent(s,'formation-rallied',{unitId:u.id,morale:u.morale})]);
 }
 const result=performCombatAction(original.battle,command);
 if(!result.accepted)return bad(original,result.reason);
 const s=clone(original),p=s.players[side];p.command-=cost;s.battle=result.state;
 if(command.type==='attack'&&result.events.some(e=>e.type==='unit-attacked'&&e.damage>0))p.momentum=cap(p.momentum+1,RULES.momentumCap);
 if(command.type==='move'&&!p.roadMomentumEarned){const moved=s.battle.units.find(u=>u.id===unit.id);
  if(['road','bridge'].includes(terrain(s,moved))){p.momentum=cap(p.momentum+1,RULES.momentumCap);p.roadMomentumEarned=true;}}
 const events=result.events.map(e=>addEvent(s,e.type,Object.fromEntries(Object.entries(e).filter(([k])=>k!=='type'))));
 return ok(s,events);
}
/** Client views are safely redacted; never send a raw match or full game state. */
export function viewForPlayer(state,side){
 if(!state||!sides.includes(side))throw new Error('Invalid match viewer');
 const yours=state.players[side],enemy=state.players[other(side)];
 return {version:state.version,sequence:state.sequence,battle:clone(state.battle),
  resources:{own:{command:yours.command,supply:yours.supply,momentum:yours.momentum,doctrinePlayed:yours.doctrinePlayed,surged:yours.surged},
   opponent:{supply:enemy.supply,momentum:enemy.momentum,handCount:enemy.hand.length}},
  hand:clone(yours.hand),drawCount:yours.drawPile.length,discardCount:yours.discardPile.length,
  events:clone(state.events)};
}
