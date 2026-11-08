import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneEncounter} from '../../tactical/encounter-scenario.mjs';
import {startCampaignBattle,campaignView,actCampaign,isValidCampaignModel,campaignLedger} from '../campaign-session.mjs';

test('single-player campaign encounters use the same doctrines and legal combat as PVP',async()=>{
 let session=startCampaignBattle(sceneEncounter());
 assert.equal(session.battle.battle.phase,'attacker');
 assert.equal(campaignView(session).hand.length,4);
 const friendly=session.battle.battle.units.find(u=>u.side==='attacker');
 const enemy=session.battle.battle.units.find(u=>u.side==='defender');
 assert.ok(friendly);assert.ok(enemy);
 const wrong=await actCampaign(session,{type:'attack',unitId:enemy.id,targetUnitId:friendly.id});
 assert.equal(wrong.accepted,false);
 assert.deepEqual(wrong.session,session);
 const played=await actCampaign(session,{type:'play-doctrine',instanceId:session.battle.players.attacker.hand[0].instanceId});
 if(played.accepted){session=played.session;assert.equal(session.model.seenCards,1);}
 const step=await actCampaign(session,{type:'end-turn'});
 assert.equal(step.accepted,true,step.reason);
 assert.equal(step.session.battle.battle.phase,'attacker');
 assert.ok(step.aiCommands.some(c=>c.type==='end-turn')||step.session.battle.battle.outcome);
 assert.equal(isValidCampaignModel(step.session.model),true);
 assert.equal(step.session.battle.battle.turn,2);
 assert.equal(session.battle.battle.turn,1,'original state is immutable');
});

test('campaign ledger is only available for completed battles and preserves canonical unit IDs',async()=>{
 const before=startCampaignBattle(sceneEncounter());
 assert.throws(()=>campaignLedger(before));
 const after=await actCampaign(before,{type:'resign'});
 assert.equal(after.accepted,true);
 const ledger=campaignLedger(after.session);
 assert.equal(ledger.winner,'defender');
 assert.deepEqual(ledger.units.map(u=>u.id),before.battle.battle.units.map(u=>u.id));
});

test('malformed or untrusted learned models are discarded at campaign start',()=>{
 const m=startCampaignBattle(sceneEncounter(),{model:{version:1,weights:[NaN],bias:[]}}).model;
 assert.equal(isValidCampaignModel(m),true);
});
