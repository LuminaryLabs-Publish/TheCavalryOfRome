/** Offline campaign and standalone training use exactly the multiplayer rules.
 * The campaign host owns and verifies the encounter and its returned casualty ledger.
 * The browser persists a learning model between encounters, never human hidden cards.
 */
import {createMultiplayerBattle,dispatchMultiplayerAction,viewForPlayer} from './turn-rules.mjs';
import {newOpponentModel,learnOpponentCard,observeOpponentAction,runAiTurn} from './server/opponent-ai.mjs';

export const CAMPAIGN_AI_VERSION='mp001-csm-v1';
const clone=structuredClone;
export function isValidCampaignModel(model){
 return Boolean(model&&model.version===1&&Array.isArray(model.weights)&&model.weights.length===96&&
   Array.isArray(model.bias)&&model.bias.length===8&&
   [...model.weights,...model.bias].every(x=>typeof x==='number'&&Number.isFinite(x))&&
   Number.isInteger(model.rng)&&Number.isInteger(model.seenCards)&&Number.isInteger(model.seenMoves));
}
export function startCampaignBattle(encounter,{seed='cavalry-campaign',model=null}={}){
 return {version:CAMPAIGN_AI_VERSION,
   battle:createMultiplayerBattle(encounter,{seed}),
   model:isValidCampaignModel(model)?clone(model):newOpponentModel('cavalry-persistent-opponent')};
}
export function campaignView(session){return viewForPlayer(session.battle,'attacker');}
/** One player action, followed by an AI activation only when the player ends. */
export async function actCampaign(original,command){
 if(!original?.battle||!original?.model)return {accepted:false,reason:'No campaign encounter',session:original,events:[]};
 const session=clone(original),prior=session.battle;
 const result=dispatchMultiplayerAction(prior,'attacker',command);
 if(!result.accepted)return {accepted:false,reason:result.reason,session:original,events:[]};
 if(command.type==='play-doctrine'){
   const card=prior.players.attacker.hand.find(c=>c.instanceId===command.instanceId);
   if(card)learnOpponentCard(session.model,prior,'attacker',card.type);
 }
 observeOpponentAction(session.model,command);
 session.battle=result.state;
 let aiCommands=[];
 if(session.battle.battle.phase==='defender'&&!session.battle.battle.outcome){
   const reply=await runAiTurn(session.battle,'defender',session.model);
   session.battle=reply.state;aiCommands=reply.commands;
 }
 return {accepted:true,reason:null,session,events:session.battle.events.slice(prior.events.length),aiCommands};
}
export function campaignLedger(session){
 if(!session?.battle?.battle?.outcome)throw Error('Encounter is not finished');
 return {winner:session.battle.battle.outcome,units:session.battle.battle.units.map(u=>({id:u.id,strength:u.strength,maxStrength:u.maxStrength}))};
}
