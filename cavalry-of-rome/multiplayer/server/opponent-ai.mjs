/** Adaptive fallible opponent. Online SGD updates a small ONNX policy's learned
 * weights from PUBLIC doctrine observations; actions are sampled from legal API.
 * ONNX Runtime Node is optional: without it the same MatMul/Add runs in JS.
 * No vision encoder is necessary for structured, public hex-map perception.
 */
import {DOCTRINE_DEFS,DOCTRINE_IDS,dispatchMultiplayerAction,RULES} from '../turn-rules.mjs';
import {reachableHexes,attackableUnits,hexDistance} from '../../tactical/hex-combat.mjs';
import {encodePolicyOnnx} from './onnx-export.mjs';

export const INPUTS=12,OUTPUTS=DOCTRINE_IDS.length;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const hash=s=>{let x=2166136261;for(const c of String(s)){x^=c.charCodeAt(0);x=Math.imul(x,16777619)}return x>>>0;};
function next(model){model.rng=(Math.imul(model.rng||1,1664525)+1013904223)>>>0;return (model.rng+.5)/4294967296;}
const alive=(state,side)=>state.battle.units.filter(u=>u.side===side&&u.status==='ready'&&u.strength>0);
const mean=(list,get)=>list.length?list.reduce((n,x)=>n+get(x),0)/list.length:0;
export function publicFeatures(state,side='attacker'){
 const yours=alive(state,side),theirs=alive(state,side==='attacker'?'defender':'attacker');
 const near=mean(yours,u=>theirs.length?Math.min(...theirs.map(e=>hexDistance(u,e))):6);
 return [1,clamp(yours.length/9,0,1),clamp(theirs.length/9,0,1),
  mean(yours,u=>u.strength/u.maxStrength),mean(theirs,u=>u.strength/u.maxStrength),
  clamp(near/10,0,1),clamp(state.battle.turn/20,0,1),
  clamp(yours.filter(u=>u.type==='heavy').length/4,0,1),
  clamp(theirs.filter(u=>u.type==='heavy').length/4,0,1),
  clamp(yours.filter(u=>u.type==='light').length/4,0,1),
  clamp(state.battle.features.filter(f=>f.type==='woods').length/35,0,1),
  clamp(state.battle.features.filter(f=>f.type==='road').length/20,0,1)];
}
export function newOpponentModel(seed='cavalry-ai'){
 return {version:1,inputs:INPUTS,outputs:OUTPUTS,weights:Array(INPUTS*OUTPUTS).fill(0),bias:Array(OUTPUTS).fill(0),
  seenCards:0,seenMoves:0,aggression:.5,rng:hash(seed)||1,modelVersion:0};
}
export function policyLogits(model,features){
 const out=Array(OUTPUTS).fill(0);
 for(let j=0;j<OUTPUTS;j++){out[j]=model.bias[j];for(let i=0;i<INPUTS;i++)out[j]+=features[i]*model.weights[i*OUTPUTS+j];}
 return out;
}
export function softmax(logits){const top=Math.max(...logits),weights=logits.map(x=>Math.exp(clamp(x-top,-30,30))),sum=weights.reduce((a,b)=>a+b,0);return weights.map(x=>x/sum);}
export function learnOpponentCard(model,state,humanSide,type){
 const target=DOCTRINE_IDS.indexOf(type);if(target<0)return false;
 const x=publicFeatures(state,humanSide),p=softmax(policyLogits(model,x));
 const rate=.24/Math.sqrt(1+model.seenCards*.12);
 for(let j=0;j<OUTPUTS;j++){
  const delta=rate*((j===target?1:0)-p[j]);model.bias[j]=clamp(model.bias[j]+delta,-7,7);
  for(let i=0;i<INPUTS;i++)model.weights[i*OUTPUTS+j]=clamp(model.weights[i*OUTPUTS+j]+delta*x[i],-7,7);
 }
 model.seenCards++;model.modelVersion++;return true;
}
export function observeOpponentAction(model,command){
 if(!['move','attack','rally'].includes(command.type))return;
 const sample=command.type==='attack'?1:command.type==='rally'?0:.3;
 model.aggression=clamp(model.aggression*.91+sample*.09,.04,.96);model.seenMoves++;
}
async function predict(model,x){
 const bytes=encodePolicyOnnx(model);
 try{
  // onnxruntime-web loaded optionally in HTML client (including iframe campaign).
  if(globalThis.ort?.InferenceSession){
   const session=await globalThis.ort.InferenceSession.create(bytes);
   const output=await session.run({input:new globalThis.ort.Tensor('float32',Float32Array.from(x),[1,INPUTS])});
   return Array.from(output.logits.data);
  }
  // Node deployment may opt into native ORT; the fallback is mathematically identical.
  if(typeof process!=='undefined'&&process.versions?.node){
   const ort=await import('onnxruntime-node');
   const session=await ort.InferenceSession.create(bytes);
   const output=await session.run({input:new ort.Tensor('float32',Float32Array.from(x),[1,INPUTS])});
   return Array.from(output.logits.data);
  }
 }catch{/* Browser/WASM or native runtime unavailable: use exact JS MatMul/Add. */}
 return policyLogits(model,x);
}
function weighted(items,score,model){
 const values=items.map(item=>Math.exp(clamp(score(item),-7,7)));
 let p=next(model)*values.reduce((a,b)=>a+b,0);
 for(let i=0;i<items.length;i++){p-=values[i];if(p<=0)return items[i];}
 return items.at(-1);
}
const COUNTERS={
 'marching-cadence':{'eagle-vow':1,'reserve-cohort':.8},
 'supply-train':{'lancer-signal':1,'scouting-dispatch':.7},
 'eagle-vow':{'marching-cadence':.8,'lancer-signal':.6},
 'lancer-signal':{'eagle-vow':1,'reserve-cohort':1.1},
 'scouting-dispatch':{'drum-of-resolve':.8,'road-levy':.5},
 'road-levy':{'marching-cadence':1,'scouting-dispatch':.8},
 'reserve-cohort':{'lancer-signal':.8,'marching-cadence':.7},
 'drum-of-resolve':{'reserve-cohort':.9,'lancer-signal':.7}
};
export async function chooseAiDoctrine(state,side,model){
 const human=side==='attacker'?'defender':'attacker';
 const prob=softmax(await predict(model,publicFeatures(state,human)));
 const candidate=state.players[side].hand.filter(c=>dispatchMultiplayerAction(state,side,{type:'play-doctrine',instanceId:c.instanceId}).accepted);
 if(!candidate.length)return null;
 if(next(model)<.16)return null; // may save the card for a later turn
 return weighted(candidate,c=>{
  const def=DOCTRINE_DEFS[c.type];let val=next(model)*.9-def.cost*.15;
  for(let i=0;i<OUTPUTS;i++)val+=prob[i]*(COUNTERS[DOCTRINE_IDS[i]]?.[c.type]||0)*2;
  if(c.type==='eagle-vow'||c.type==='reserve-cohort')val+=1-model.aggression;
  if(c.type==='lancer-signal')val+=model.aggression;
  return val;
 },model);
}
function possible(state,side,model){
 const p=state.players[side],out=[];
 for(const unit of alive(state,side)){
  if(p.command>=2)for(const target of attackableUnits(state.battle,unit.id))
   out.push({command:{type:'attack',unitId:unit.id,targetUnitId:target.unitId},score:1.6+model.aggression+.3*next(model)});
  if(p.command>=1)for(const cell of reachableHexes(state.battle,unit.id)){
   const enemies=alive(state,side==='attacker'?'defender':'attacker');
   const oldDist=enemies.length?Math.min(...enemies.map(e=>hexDistance(unit,e))):6;
   const newDist=enemies.length?Math.min(...enemies.map(e=>hexDistance(cell,e))):6;
   out.push({command:{type:'move',unitId:unit.id,q:cell.q,r:cell.r},score:.3+(oldDist-newDist)*model.aggression*.4+next(model)*.65});
  }
  if(p.command>=1&&!unit.moved&&!unit.acted&&unit.morale<85)
   out.push({command:{type:'rally',unitId:unit.id},score:.5+(85-unit.morale)/90+next(model)*.2});
 }
 return out;
}
/** Uses only legal game API, imperfectly. Does not manipulate hidden human state. */
export async function runAiTurn(original,side,model){
 if(original.battle.phase!==side||original.battle.outcome)return {state:original,commands:[]};
 let state=original;const commands=[];
 function step(cmd){const r=dispatchMultiplayerAction(state,side,cmd);if(!r.accepted)return false;state=r.state;commands.push(cmd);return true;}
 const doctrine=await chooseAiDoctrine(state,side,model);
 if(doctrine)step({type:'play-doctrine',instanceId:doctrine.instanceId});
 const effort=2+Math.floor(next(model)*6); // leaves some unused command points on purpose
 for(let i=0;i<effort&&!state.battle.outcome;i++){
  if(state.players[side].command<=0)break;
  if(!state.players[side].surged&&state.players[side].command<=1&&state.players[side].momentum>=2&&next(model)>.4)step({type:'surge'});
  const options=possible(state,side,model);
  if(!options.length||next(model)<.1)break;
  const chosen=weighted(options,x=>x.score,model);
  if(!step(chosen.command))break;
 }
 if(!state.battle.outcome)step({type:'end-turn'});
 return {state,commands};
}
export function snapshotOnnx(model){return encodePolicyOnnx(model);}
