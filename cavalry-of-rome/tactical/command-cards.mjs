/**
 * Cavalry of Rome — original card-command layer for the isolated sandbox combat prototype.
 * One illustrated card is played per Roman turn. Card determines which and how many
 * formations may receive commands. No dependency on a renderer, DOM, or network.
 * This is not a reproduction of any other game's cards or artwork.
 */
import { createEncounterCombatState, performCombatAction, runDefenderPhase } from './hex-combat.mjs';

export const CARD_COMBAT_VERSION = '0.2.0-sandbox';

const CARD_TEMPLATES = [
  { id:'left-wing',       title:'The Left Wing',     chapter:'FIELD ORDER', section:'left',   type:null,      capacity:2, allowed:['move','attack'], art:'left-wing.webp',       flavor:'Press the wooded flank.',       rule:'Order up to 2 formations on the left. They may move and attack.' },
  { id:'center-push',     title:'Center Advance',    chapter:'FIELD ORDER', section:'center', type:null,      capacity:2, allowed:['move','attack'], art:'center-push.webp',     flavor:'Break them on the road.',      rule:'Order up to 2 formations in the center. They may move and attack.' },
  { id:'right-wheel',     title:'Wheel Right',       chapter:'FIELD ORDER', section:'right',  type:null,      capacity:2, allowed:['move','attack'], art:'right-wheel.webp',     flavor:'Turn their open flank.',       rule:'Order up to 2 formations on the right. They may move and attack.' },
  { id:'forced-march',    title:'Double Time',       chapter:'MANEUVER',    section:'any',    type:null,      capacity:3, allowed:['move'],          art:'forced-march.webp',    flavor:'Boots before blades.',         rule:'Order up to 3 formations anywhere. Move only; no attacks.' },
  { id:'cavalry-charge',  title:'Cavalry Thunder',   chapter:'BATTLE CRY',  section:'any',    type:'heavy',   capacity:2, allowed:['move','attack'], art:'cavalry-charge.webp',  flavor:'Hooves shake the earth.',     rule:'Order up to 2 heavy formations. Moving 2 hexes before melee earns charge impact.' },
  { id:'skirmish-volley', title:'Rain of Javelins',  chapter:'TACTIC',      section:'any',    type:'light',   capacity:2, allowed:['attack'],        art:'skirmish-volley.webp', flavor:'Darken the enemy ranks.',     rule:'Order up to 2 light formations. Ranged or melee attack only.' },
  { id:'raise-the-eagle', title:'Raise the Eagle',   chapter:'MORALE',      section:'any',    type:null,      capacity:3, allowed:['rally'],         art:'raise-the-eagle.webp', flavor:'Let every soldier see Rome.', rule:'Rally up to 3 formations anywhere. Restore 25 morale each.' },
  { id:'shield-wall',    title:'Hold the Line',     chapter:'DEFENSE',     section:'any',    type:'medium',  capacity:2, allowed:['attack'],        art:'shield-wall.webp',    flavor:'Shield against shield.',      rule:'Order up to 2 medium formations. Attack without moving.' }
];
export const CARD_DEFS = Object.freeze(Object.fromEntries(CARD_TEMPLATES.map(c=>[c.id,Object.freeze({...c,allowed:Object.freeze(c.allowed)})])));
export const HAND_SIZE = 5;
const COPIES = Object.freeze({'left-wing':4,'center-push':4,'right-wheel':4,'forced-march':3,'cavalry-charge':3,'skirmish-volley':3,'raise-the-eagle':3,'shield-wall':3});
const INITIAL_HAND = Object.freeze(['left-wing','center-push','cavalry-charge','skirmish-volley','raise-the-eagle']);
const clone = value => JSON.parse(JSON.stringify(value));
const good = (state,events=[]) => ({accepted:true,reason:null,state,events});
const bad = (state,reason) => ({accepted:false,reason,state,events:[]});

function seededHash(str){let n=2166136261;for(const c of String(str)){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return n>>>0;}
function shuffle(cards,seed){const a=[...cards];let n=seededHash(seed)||1;for(let i=a.length-1;i>0;i--){n^=n<<13;n^=n>>>17;n^=n<<5;const j=(n>>>0)%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function fullDeck(seed){const cards=[];for(const [type,count] of Object.entries(COPIES))for(let i=1;i<=count;i++)cards.push({instanceId:`${type}:${i}`,type});return shuffle(cards,seed);}

export function createCardCombatState(encounter,{seed='the-sabine-road',handSize=HAND_SIZE}={}){
  const battle = createEncounterCombatState(encounter,{maxOrders:12});
  let drawPile=fullDeck(seed);
  const hand=[];
  for(const type of INITIAL_HAND.slice(0,handSize)){
    const i=drawPile.findIndex(c=>c.type===type);
    if(i>=0)hand.push(drawPile.splice(i,1)[0]);
  }
  while(hand.length<handSize&&drawPile.length)hand.push(drawPile.shift());
  return {
    version:CARD_COMBAT_VERSION,seed,handSize,drawPile,discardPile:[],hand,
    previewCardId:null,activeCard:null,orderedUnitIds:[],currentUnitId:null,
    battle,turnsPlayed:0,events:[{type:'battle-ready',text:'Choose a command card from your hand.'}]
  };
}

export function sectionOf(unit,battle){
  const x=unit.q+unit.r/2;
  const boundary=battle.radius*0.32;
  return x < -boundary ? 'left' : x > boundary ? 'right' : 'center';
}

export function cardEligibleUnit(card,unit,battle){
  if(!card||!unit||!battle||unit.side!=='attacker'||unit.status!=='ready'||unit.strength<=0)return false;
  if(card.type&&unit.type!==card.type)return false;
  return card.section==='any'||sectionOf(unit,battle)===card.section;
}

export function eligibleFormations(state){
  if(state.battle.outcome ||state.battle.phase!=='attacker'||!state.activeCard)return [];
  const card=CARD_DEFS[state.activeCard.type];
  return state.battle.units.filter(u=>cardEligibleUnit(card,u,state.battle));
}

export function canUseCurrentUnit(state,unitId){return Boolean(state.activeCard&&state.orderedUnitIds.includes(unitId));}

function putEvent(state,event){state.events.push(event);if(state.events.length>25)state.events.shift();}

export function dispatchCardAction(original,command){
  if(!original?.battle||!command?.type)return bad(original,'Invalid card combat command');
  if(original.battle.outcome&&command.type!=='restart')return bad(original,'The battle is already over.');
  if(command.type==='preview-card'){
    if(original.activeCard)return bad(original,'Finish your current command card.');
    const inHand=original.hand.some(c=>c.instanceId===command.instanceId);
    if(!inHand)return bad(original,'This card is not in your hand.');
    const state=clone(original);state.previewCardId=command.instanceId;
    return good(state,[{type:'card-previewed',instanceId:command.instanceId}]);
  }
  if(command.type==='play-card'){
    if(original.battle.phase!=='attacker'||original.activeCard)return bad(original,'A command card is already being resolved.');
    const candidate=original.hand.find(c=>c.instanceId===command.instanceId);
    if(!candidate)return bad(original,'Choose a card from your hand.');
    const state=clone(original);
    state.hand=state.hand.filter(c=>c.instanceId!==candidate.instanceId);
    state.activeCard={...candidate};state.previewCardId=null;
    state.currentUnitId=null;state.orderedUnitIds=[];
    const event={type:'card-played',cardType:candidate.type,title:CARD_DEFS[candidate.type].title};
    putEvent(state,event);return good(state,[event]);
  }
  if(command.type==='order-unit'){
    if(!original.activeCard)return bad(original,'Play a command card first.');
    const unit=original.battle.units.find(u=>u.id===command.unitId);
    const card=CARD_DEFS[original.activeCard.type];
    if(!cardEligibleUnit(card,unit,original.battle))return bad(original,'That formation is not eligible for this card.');
    if(!original.orderedUnitIds.includes(unit.id)&&original.orderedUnitIds.length>=card.capacity)return bad(original,'All formations permitted by the card are already ordered.');
    const state=clone(original);state.currentUnitId=unit.id;
    if(!state.orderedUnitIds.includes(unit.id))state.orderedUnitIds.push(unit.id);
    const event={type:'formation-ordered',unitId:unit.id};putEvent(state,event);return good(state,[event]);
  }
  if(['move','attack','rally'].includes(command.type)){
    if(!original.activeCard)return bad(original,'Play a command card first.');
    if(!original.orderedUnitIds.includes(command.unitId))return bad(original,'Order this formation with your card first.');
    const card=CARD_DEFS[original.activeCard.type];
    if(!card.allowed.includes(command.type))return bad(original,`${card.title} does not permit ${command.type}.`);
    if(command.type==='rally'){
      const unit=original.battle.units.find(u=>u.id===command.unitId);
      if(!unit||unit.status!=='ready')return bad(original,'Only living formations can rally.');
      if(unit.acted||unit.moved)return bad(original,'Formation has already acted this turn.');
      const state=clone(original), target=state.battle.units.find(u=>u.id===unit.id);
      target.morale=Math.min(100,target.morale+25);
      target.acted=true;target.moved=true;state.battle.ordersRemaining-=1;
      const event={type:'formation-rallied',unitId:unit.id,morale:target.morale};putEvent(state,event);return good(state,[event]);
    }
    const result=performCombatAction(original.battle,command);
    if(!result.accepted)return bad(original,result.reason);
    const state=clone(original);state.battle=result.state;
    for(const e of result.events)putEvent(state,e);
    return good(state,result.events);
  }
  if(command.type==='end-command'){
    if(!original.activeCard)return bad(original,'Play a card before ending the turn.');
    if(original.battle.phase!=='attacker')return bad(original,'Not the Roman command phase.');
    const state=clone(original),events=[];
    state.discardPile.push(state.activeCard);state.activeCard=null;
    state.previewCardId=null;state.currentUnitId=null;state.orderedUnitIds=[];
    if(!state.battle.outcome){
      const enemyPhase=performCombatAction(state.battle,{type:'end-turn'});
      if(!enemyPhase.accepted)return bad(original,enemyPhase.reason);
      state.battle=enemyPhase.state;
      const enemy=runDefenderPhase(state.battle);
      if(!enemy.accepted)return bad(original,enemy.reason);
      state.battle=enemy.state;
      events.push({type:'enemy-responded',actions:enemy.events.length});
      for(const e of enemy.events)putEvent(state,e);
      if(!state.battle.outcome){
        const romanPhase=performCombatAction(state.battle,{type:'end-turn'});
        if(!romanPhase.accepted)return bad(original,romanPhase.reason);
        state.battle=romanPhase.state;
      }
    }
    state.turnsPlayed+=1;
    if(!state.battle.outcome){
      if(!state.drawPile.length && state.discardPile.length){
        state.drawPile=shuffle(state.discardPile,`${state.seed}:reshuffle:${state.turnsPlayed}`);
        state.discardPile=[];
      }
      if(state.drawPile.length){const next=state.drawPile.shift();state.hand.push(next);events.push({type:'card-drawn',cardType:next.type});}
    }
    const end={type:'command-completed',turn:state.battle.turn,outcome:state.battle.outcome};events.push(end);putEvent(state,end);
    return good(state,events);
  }
  if(command.type==='withdraw'){
    const result=performCombatAction(original.battle,{type:'withdraw'});
    if(!result.accepted)return bad(original,result.reason);
    const state=clone(original);state.battle=result.state;
    state.activeCard=null;state.orderedUnitIds=[];state.previewCardId=null;state.currentUnitId=null;
    putEvent(state,{type:'withdrawal'});
    return good(state,result.events);
  }
  return bad(original,`Unknown card command: ${command.type}`);
}
