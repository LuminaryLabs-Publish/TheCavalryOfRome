import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD_DEFS, HAND_SIZE, cardEligibleUnit, createCardCombatState,
  dispatchCardAction, eligibleFormations, sectionOf
} from '../command-cards.mjs';

function encounter(cells){
 return {active:true,kind:'arrival',hex:{radius:5,cellSize:58},board:{radius:5,cells:cells??[
  {unitId:'heavy',side:'attacker',unitType:'heavy',q:-2,r:-2,label:'Ala Augusta'},
  {unitId:'light',side:'attacker',unitType:'light',q:0,r:-3,label:'Velites'},
  {unitId:'medium',side:'attacker',unitType:'medium',q:2,r:-3,label:'Legion'},
  {unitId:'enemy',side:'defender',unitType:'medium',q:0,r:2,label:'Warband'}
 ],featureCells:[],blockedCells:[]}};
}
const choose=(s,type)=>s.hand.find(c=>c.type===type);
const act=(s,command)=>dispatchCardAction(s,command);
function ok(s,command){const r=act(s,command);assert.equal(r.accepted,true,`${JSON.stringify(command)}: ${r.reason}`);return r.state;}
function play(s,type){return ok(ok(s,{type:'preview-card',instanceId:choose(s,type).instanceId}),{type:'play-card',instanceId:choose(s,type).instanceId});}

test('opening hand has five illustrated unique command cards and reproducible deck',()=>{
 const a=createCardCombatState(encounter()),b=createCardCombatState(encounter());
 assert.deepEqual(a,b);assert.equal(a.hand.length,HAND_SIZE);assert.equal(a.drawPile.length,22);
 assert.equal(new Set(a.hand.map(c=>c.instanceId)).size,HAND_SIZE);
 assert.ok(Object.values(CARD_DEFS).every(c=>c.art.endsWith('.webp')&&c.rule&&c.capacity>0));
 assert.ok(a.hand.some(c=>c.type==='cavalry-charge'));
});
test('movement and attacks cannot occur before a card has been played',()=>{
 const s=createCardCombatState(encounter());
 assert.equal(act(s,{type:'order-unit',unitId:'heavy'}).accepted,false);
 assert.equal(act(s,{type:'move',unitId:'heavy',q:-2,r:-1}).accepted,false);
 assert.equal(act(s,{type:'end-command'}).accepted,false);
});
test('playing a card consumes it from hand and records a single active card',()=>{
 const src=createCardCombatState(encounter()),s=play(src,'left-wing');
 assert.equal(src.hand.length,5);assert.equal(src.activeCard,null);
 assert.equal(s.hand.length,4);assert.equal(s.activeCard.type,'left-wing');
 assert.equal(act(s,{type:'play-card',instanceId:s.hand[0].instanceId}).accepted,false);
});
test('left, center and right sections are computed from axial hex geometry',()=>{
 const s=createCardCombatState(encounter());
 assert.equal(sectionOf(s.battle.units.find(u=>u.id==='heavy'),s.battle),'left');
 assert.equal(sectionOf(s.battle.units.find(u=>u.id==='medium'),s.battle),'center');
 assert.equal(sectionOf({...s.battle.units[0],q:4,r:-1},s.battle),'right');
});
test('left-wing card excludes center units',()=>{
 let s=play(createCardCombatState(encounter()),'left-wing');
 assert.deepEqual(eligibleFormations(s).map(u=>u.id),['heavy']);
 assert.equal(act(s,{type:'order-unit',unitId:'medium'}).accepted,false);
 s=ok(s,{type:'order-unit',unitId:'heavy'});
 assert.equal(s.orderedUnitIds.length,1);
});
test('card capacity applies per distinct formation, not number of clicks',()=>{
 const units=[
  {unitId:'a',side:'attacker',unitType:'medium',q:-3,r:-1},
  {unitId:'b',side:'attacker',unitType:'medium',q:-2,r:-2},
  {unitId:'c',side:'attacker',unitType:'medium',q:-4,r:0},
  {unitId:'enemy',side:'defender',unitType:'heavy',q:2,r:2}
 ];
 let s=play(createCardCombatState(encounter(units)),'left-wing');
 s=ok(s,{type:'order-unit',unitId:'a'});
 s=ok(s,{type:'order-unit',unitId:'a'});
 s=ok(s,{type:'order-unit',unitId:'b'});
 assert.equal(s.orderedUnitIds.length,2);
 assert.equal(act(s,{type:'order-unit',unitId:'c'}).accepted,false);
});
test('a card-authorized formation can move, and cannot move twice',()=>{
 let s=play(createCardCombatState(encounter()),'left-wing');s=ok(s,{type:'order-unit',unitId:'heavy'});
 const next={q:-2,r:-1};
 s=ok(s,{type:'move',unitId:'heavy',...next});
 assert.equal(s.battle.units.find(u=>u.id==='heavy').r,-1);
 assert.equal(act(s,{type:'move',unitId:'heavy',q:-1,r:-1}).accepted,false);
});
test('uncommanded units cannot use actions permitted by another unit order',()=>{
 let s=play(createCardCombatState(encounter()),'center-push');s=ok(s,{type:'order-unit',unitId:'medium'});
 assert.equal(act(s,{type:'move',unitId:'light',q:0,r:-2}).accepted,false);
});
test('cavalry card requires heavy units',()=>{
 let s=play(createCardCombatState(encounter()),'cavalry-charge');
 assert.equal(act(s,{type:'order-unit',unitId:'medium'}).accepted,false);
 assert.equal(act(s,{type:'order-unit',unitId:'heavy'}).accepted,true);
});
test('volley allows light attacks only, never moving',()=>{
 let s=play(createCardCombatState(encounter()),'skirmish-volley');s=ok(s,{type:'order-unit',unitId:'light'});
 assert.equal(act(s,{type:'move',unitId:'light',q:0,r:-2}).accepted,false);
 assert.equal(act(s,{type:'attack',unitId:'light',targetUnitId:'enemy'}).accepted,false); // out of range is still enforced
});
test('rally card restores morale, not soldiers, and cannot be repeated',()=>{
 let s=createCardCombatState(encounter());s.battle.units.find(u=>u.id==='heavy').morale=43;
 s=play(s,'raise-the-eagle');s=ok(s,{type:'order-unit',unitId:'heavy'});
 const before=s.battle.units.find(u=>u.id==='heavy').strength;
 s=ok(s,{type:'rally',unitId:'heavy'});
 assert.equal(s.battle.units.find(u=>u.id==='heavy').morale,68);
 assert.equal(s.battle.units.find(u=>u.id==='heavy').strength,before);
 assert.equal(act(s,{type:'rally',unitId:'heavy'}).accepted,false);
});
test('end command invokes enemy phase and replenishes one card',()=>{
 const initial=createCardCombatState(encounter());let s=play(initial,'left-wing');
 const a=act(s,{type:'end-command'}),b=act(s,{type:'end-command'});
 assert.equal(a.accepted,true,a.reason);assert.deepEqual(a,b);
 assert.equal(a.state.battle.phase,'attacker');assert.equal(a.state.battle.turn,2);
 assert.equal(a.state.activeCard,null);assert.equal(a.state.hand.length,5);
 assert.equal(a.state.drawPile.length,initial.drawPile.length-1);
 assert.equal(a.state.discardPile.length,1);
 assert.equal(initial.battle.turn,1);
});
test('cancelled or invalid commands leave state untouched',()=>{
 let s=createCardCombatState(encounter());let original=structuredClone(s);
 assert.equal(act(s,{type:'play-card',instanceId:'fake'}).accepted,false);assert.deepEqual(s,original);
 s=play(s,'left-wing');original=structuredClone(s);
 assert.equal(act(s,{type:'order-unit',unitId:'unknown'}).accepted,false);assert.deepEqual(s,original);
});
test('withdrawal closes the card battle and blocks future card actions',()=>{
 let s=createCardCombatState(encounter());s=ok(s,{type:'withdraw'});
 assert.equal(s.battle.outcome,'defender');assert.equal(act(s,{type:'end-command'}).accepted,false);
});
test('when the deck is empty, discards are reshuffled after card play',()=>{
 let s=play(createCardCombatState(encounter()),'left-wing');
 s.drawPile=[];
 s.discardPile=[{instanceId:'skirmish-volley:99',type:'skirmish-volley'}];
 s=ok(s,{type:'end-command'});
 assert.equal(s.hand.length,5);assert.equal(s.drawPile.length,1);assert.equal(s.discardPile.length,0);
 assert.ok(s.hand.some(c=>['skirmish-volley:99','left-wing:1','left-wing:2','left-wing:3','left-wing:4'].includes(c.instanceId)));
});
test('card restrictions refer to underlying combat mechanics, not cosmetic art',()=>{
 const s=createCardCombatState(encounter());
 for(const template of Object.values(CARD_DEFS)){
   assert.ok(['left','center','right','any'].includes(template.section));
   assert.ok(template.allowed.length>0);
   for(const type of template.allowed)assert.ok(['move','attack','rally'].includes(type));
 }
 assert.equal(cardEligibleUnit(CARD_DEFS['cavalry-charge'],s.battle.units.find(u=>u.id==='heavy'),s.battle),true);
 assert.equal(cardEligibleUnit(CARD_DEFS['cavalry-charge'],s.battle.units.find(u=>u.id==='light'),s.battle),false);
});
