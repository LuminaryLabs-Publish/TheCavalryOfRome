import {createCardCombatState,CARD_DEFS,dispatchCardAction,eligibleFormations,sectionOf} from './command-cards.mjs';
import {reachableHexes,attackableUnits} from './hex-combat.mjs';
import {sceneEncounter,inspectDeployment} from './encounter-scenario.mjs';
import {createBattlefield} from './webgl-battlefield.mjs';
import {readCampaignContext,buildCampaignScenario} from './campaign-scenario.mjs';

const $=id=>document.getElementById(id);
const canvas=$('battle'),labels=$('unit-labels');
const CAMPAIGN_CONTEXT=readCampaignContext();
const GAME_SCENARIO=CAMPAIGN_CONTEXT?buildCampaignScenario(CAMPAIGN_CONTEXT.encounter):sceneEncounter();
let game=createCardCombatState(GAME_SCENARIO,{seed:CAMPAIGN_CONTEXT?.token||'the-sabine-road'});
function reportToCampaign(){
 if(!CAMPAIGN_CONTEXT||!game.battle.outcome)return;
 const units=game.battle.units.map(u=>({id:u.id,strength:u.strength,maxStrength:u.maxStrength}));
 globalThis.parent.postMessage({type:'cavalry:tactical:result:v1',token:CAMPAIGN_CONTEXT.token,winner:game.battle.outcome,units},globalThis.location.origin);
}

let note='Choose a card from your hand to command the 3D formations.';
let showHelp=false,lastEvent=null;
const alive=u=>u.status==='ready'&&u.strength>0;
const activeCard=()=>game.activeCard?CARD_DEFS[game.activeCard.type]:null;
const previewCard=()=>CARD_DEFS[game.hand.find(c=>c.instanceId===game.previewCardId)?.type]??null;
const selectedUnit=()=>game.battle.units.find(u=>u.id===game.currentUnitId&&alive(u));
const remainingOrders=()=>activeCard()?activeCard().capacity-game.orderedUnitIds.length:0;
const orderedUnitCount=()=>game.orderedUnitIds.length;
let battlefield=null;

function reset(){if(CAMPAIGN_CONTEXT)return;game=createCardCombatState(GAME_SCENARIO);note='A new battle begins. Play a command card to order your 3D troops.';lastEvent=null;refresh();}
function message(text){note=text;$('field-message').textContent=text;}
function send(command){
 const result=dispatchCardAction(game,command);
 if(!result.accepted){message(result.reason);refresh(false);return false;}
 game=result.state;lastEvent=result.events.at(-1)??null;
 if(command.type==='preview-card')message(`${previewCard()?.title??'Card'} — ${previewCard()?.rule??''}`);
 else if(command.type==='play-card')message(`Card played: ${activeCard()?.title}. Select the gold-rimmed Roman miniatures.`);
 else if(command.type==='order-unit')message(`Ordered ${selectedUnit()?.label??'formation'}. Select a reachable hex or adjacent enemy.`);
 else if(command.type==='move')message(`${selectedUnit()?.label??'Formation'} advanced through the terrain.`);
 else if(command.type==='attack'){
   const hit=result.events.find(e=>e.type==='unit-attacked');
   message(`The formations clash: ${hit?.damage??0} damage${hit?.charge?' from a charge':''}.`);
 }else if(command.type==='rally')message(`${selectedUnit()?.label??'Formation'} rallies beneath the Eagle!`);
 else if(command.type==='end-command')message(game.battle.outcome?'Battle resolved.':'Enemy responded. A fresh command card joins your hand.');
 else if(command.type==='withdraw')message('The Roman army has withdrawn.');
 refresh();return true;
}
function preview(instanceId){send({type:'preview-card',instanceId});}
function playCard(){const instanceId=game.previewCardId;if(!instanceId){message('Choose a card from the hand first.');return;}send({type:'play-card',instanceId});}
function endCommand(){send({type:'end-command'});}
function renderHand(){
 const hand=$('hand');hand.replaceChildren();const count=game.hand.length;
 for(let i=0;i<count;i++){
  const c=game.hand[i],def=CARD_DEFS[c.type];const button=document.createElement('button');
  button.type='button';button.className='command-card';
  if(game.previewCardId===c.instanceId)button.classList.add('is-selected');
  button.style.setProperty('--rotate',`${(i-(count-1)/2)*4.7}deg`);
  button.style.zIndex=game.previewCardId===c.instanceId?'20':String(i+1);
  button.setAttribute('aria-pressed',game.previewCardId===c.instanceId?'true':'false');
  button.setAttribute('aria-label',`${def.title}. ${def.rule}`);button.title=def.rule;
  const face=document.createElement('div');face.className='card-face';
  const picture=document.createElement('img');picture.className='card-art';picture.src=`./assets/cards/${def.art}`;picture.alt='';picture.draggable=false;
  const shade=document.createElement('div');shade.className='card-darken';
  const head=document.createElement('div');head.className='card-rank';
  const chapter=document.createElement('span');chapter.className='card-chapter';chapter.textContent=def.chapter;
  const number=document.createElement('span');number.className='rank-number';number.textContent=def.capacity;head.append(chapter,number);
  const copy=document.createElement('div');copy.className='card-copy';
  const title=document.createElement('strong');title.textContent=def.title;
  const rule=document.createElement('p');rule.textContent=def.rule;
  const flavor=document.createElement('small');flavor.textContent=def.flavor;
  copy.append(title,rule,flavor);face.append(picture,shade,head,copy);button.append(face);
  button.addEventListener('click',()=>preview(c.instanceId));hand.append(button);
 }
}
function updateUI(){
 const b=game.battle,active=activeCard(),preview=previewCard(),focus=active??preview;
 $('turn').textContent=String(b.turn).padStart(2,'0');
 $('attacker-count').textContent=b.units.filter(u=>u.side==='attacker'&&alive(u)).length;
 $('defender-count').textContent=b.units.filter(u=>u.side==='defender'&&alive(u)).length;
 $('phase').textContent=b.outcome?'FINISHED':active?'COMMANDING':'DRAW / PLAY';
 $('deck-count').textContent=game.drawPile.length;
 $('command-status').textContent=active?`${orderedUnitCount()} / ${active.capacity} FORMATIONS ORDERED`:'PLAY ONE CARD EACH TURN';
 $('command-kicker').textContent=active?'CARD IN PLAY':preview?'SELECTED FROM HAND':'AVAILABLE COMMAND';
 $('command-name').textContent=focus?.title??'Your next move begins here.';
 $('command-rule').textContent=focus?.rule??'Choose a card below to see its order and eligible formations.';
 $('play-card').disabled=!!active||!game.previewCardId||!!b.outcome;
 $('end-command').disabled=!active||!!b.outcome;
 const unit=selectedUnit();
 $('selected-kicker').textContent=unit?'FORMATION SELECTED':active?'CARD ORDERS':'AWAITING ORDERS';
 $('selected-name').textContent=unit?.label??(active?`${remainingOrders()} orders available`:'Choose a command card');
 $('selected-meta').textContent=unit?`${unit.type.toUpperCase()} · ${unit.strength}/${unit.maxStrength} HP · ${Math.round(unit.soldiers*unit.strength/unit.maxStrength)} soldiers · ${unit.morale} morale · ${sectionOf(unit,b).toUpperCase()}`:active?`Select gold-rimmed formations. ${active.allowed.join(' / ').toUpperCase()} permitted.`:'Cards determine the orders each formation can receive.';
 const p=$('played-cover');p.classList.toggle('has-card',!!active);
 p.style.backgroundImage=active?`linear-gradient(to top,rgba(0,0,0,.75),transparent),url('./assets/cards/${active.art}')`:'';
 $('played-title').textContent=active?.title??'NO CARD';
 $('played-orders').textContent=active?`${orderedUnitCount()} OF ${active.capacity} ORDERED`:'PLAY A CARD';
 $('battle-summary').textContent=b.outcome?`BATTLE FINISHED · ${b.outcome.toUpperCase()}`:active?`${active.title.toUpperCase()} · COMMANDS: ${active.allowed.join(' / ').toUpperCase()}`:'CARDS CONVEY ORDERS · TERRAIN DECIDES MOVEMENT';
 const outcome=$('battle-outcome');outcome.hidden=!b.outcome;
 if(b.outcome){$('outcome-label').textContent=b.outcome==='attacker'?'ROMAN VICTORY':b.outcome==='draw'?'BATTLE ENDED':'ROMANS DEFEATED';$('outcome-description').textContent=CAMPAIGN_CONTEXT?'Return to the strategic campaign with the surviving troops.':b.outcome==='attacker'?'The eagle flies above a conquered field.':'The army must regroup for another campaign.';$('replay').textContent=CAMPAIGN_CONTEXT?'RETURN TO CAMPAIGN':'FIGHT AGAIN';}
 $('field-message').textContent=note;renderHand();
}
function updateBattlefield(){
 if(!battlefield)return;
 const active=activeCard(),u=selectedUnit();
 const moves=u&&active?.allowed.includes('move')?reachableHexes(game.battle,u.id):[];
 const targetIds=new Set(u&&active?.allowed.includes('attack')?attackableUnits(game.battle,u.id).map(x=>x.unitId):[]);
 battlefield.setState(game,{selectedUnitId:u?.id??null,eligibleUnits:active?eligibleFormations(game):[],reachableCells:moves,attackable:game.battle.units.filter(x=>targetIds.has(x.id))});
}
function refresh(rebuild=true){if(rebuild)updateUI();updateBattlefield();}
function clickedHex(cell){
 const battle=game.battle;if(battle.outcome)return;
 if(!game.activeCard){message('First choose a command card and press PLAY CARD.');return;}
 const unit=battle.units.find(u=>alive(u)&&u.q===cell.q&&u.r===cell.r);
 if(unit?.side==='attacker'){
  const ordered=send({type:'order-unit',unitId:unit.id});
  if(ordered&&activeCard()?.allowed.includes('rally'))send({type:'rally',unitId:unit.id});
  return;
 }
 if(!game.currentUnitId){message('Click a gold-highlighted Roman formation first.');return;}
 if(unit?.side==='defender')send({type:'attack',unitId:game.currentUnitId,targetUnitId:unit.id});
 else send({type:'move',unitId:game.currentUnitId,q:cell.q,r:cell.r});
}
$('play-card').addEventListener('click',playCard);
$('end-command').addEventListener('click',endCommand);
$('withdraw').addEventListener('click',()=>send({type:'withdraw'}));
$('restart').addEventListener('click',reset);if(CAMPAIGN_CONTEXT){$('restart').hidden=true;document.querySelector('.game-identity p').textContent='THE COMMANDER’S HAND ◆ ACTIVE CAMPAIGN ENCOUNTER';}
$('replay').addEventListener('click',CAMPAIGN_CONTEXT?reportToCampaign:reset);
$('help-toggle').addEventListener('click',()=>{showHelp=!showHelp;$('help-panel').hidden=!showHelp;$('help-toggle').setAttribute('aria-expanded',String(showHelp));});
addEventListener('keydown',event=>{
 const target=event.target;if(['INPUT','TEXTAREA'].includes(target?.tagName)||target?.isContentEditable)return;
 if(['1','2','3','4','5'].includes(event.key)&&!game.activeCard){const c=game.hand[Number(event.key)-1];if(c){event.preventDefault();preview(c.instanceId);}}
 if(event.key==='Enter'&&target?.tagName!=='BUTTON'){event.preventDefault();if(game.activeCard)endCommand();else playCard();}
 if(event.key==='Escape'){event.preventDefault();if(showHelp){showHelp=false;$('help-panel').hidden=true;$('help-toggle').setAttribute('aria-expanded','false');}game={...game,currentUnitId:null};message('Formation focus cleared; previous orders are retained.');refresh();}
 if(event.key.toLowerCase()==='h'&&!event.ctrlKey){$('help-toggle').click();}
});
function boot(){
 const invalid=CAMPAIGN_CONTEXT?[]:inspectDeployment();if(invalid.length)throw new Error(`Invalid 3D deployment: ${invalid.join('; ')}`);
 updateUI();
 battlefield=createBattlefield({canvas,labels,onHexClick:clickedHex,onStatus(text){$('scene-status').textContent=text;}});
 updateBattlefield();
 battlefield.ready.then(()=>{const stats=battlefield.stats();window.__Cavalry3DReady=true;window.__Cavalry3DStats=stats;}).catch(error=>{$('scene-status').textContent=String(error);});
 window.__CardCombatSandbox={getState:()=>structuredClone(game),dispatch:send,reset,issueOrder:unitId=>send({type:'order-unit',unitId}),endCommand,renderStats:()=>battlefield.stats(),projectCell:(q,r)=>battlefield.projectCell(q,r),campaignMode:Boolean(CAMPAIGN_CONTEXT)};
}
try{boot();}catch(error){console.error(error);$('error').hidden=false;$('error').textContent=String(error?.stack??error);}
