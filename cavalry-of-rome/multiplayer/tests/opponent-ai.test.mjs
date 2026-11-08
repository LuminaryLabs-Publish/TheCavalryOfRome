import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneEncounter} from '../../tactical/encounter-scenario.mjs';
import {createMultiplayerBattle,dispatchMultiplayerAction} from '../turn-rules.mjs';
import {newOpponentModel,publicFeatures,policyLogits,softmax,learnOpponentCard,observeOpponentAction,runAiTurn,snapshotOnnx,INPUTS,OUTPUTS} from '../server/opponent-ai.mjs';

test('online training changes policy weights from public doctrine events',()=>{
 const game=createMultiplayerBattle(sceneEncounter()),model=newOpponentModel('train');
 const old=softmax(policyLogits(model,publicFeatures(game,'attacker')));
 for(let i=0;i<30;i++)assert.equal(learnOpponentCard(model,game,'attacker','lancer-signal'),true);
 const now=softmax(policyLogits(model,publicFeatures(game,'attacker')));
 assert.equal(model.seenCards,30);assert.ok(now[3]>old[3]+.3,`probability did not learn: ${old[3]} -> ${now[3]}`);
 observeOpponentAction(model,{type:'attack'});assert.equal(model.seenMoves,1);assert.ok(model.aggression>.5);
 assert.ok(model.weights.some(x=>x!==0));assert.equal(model.modelVersion,30);
});

test('AI observes no hidden cards or decks when extracting features',()=>{
 const game=createMultiplayerBattle(sceneEncounter());const features=publicFeatures(game);
 game.players.attacker.hand=[{type:'unpublished-private-doctrine'}];game.players.defender.drawPile=[];
 assert.deepEqual(publicFeatures(game),features);
});

test('model export is ONNX protobuf containing MatMul/Add and learned tensors',()=>{
 const model=newOpponentModel('onnx');model.weights[0]=1.5;
 const b=Buffer.from(snapshotOnnx(model));assert.ok(b.length>400);
 for(const name of ['MatMul','Add','logits','input','weights','bias','CavalryOpponentPolicy'])assert.ok(b.includes(Buffer.from(name)),name);
 assert.equal(INPUTS,12);assert.equal(OUTPUTS,8);
});

test('adaptive AI plays with same legal rules and yields after its activation',async()=>{
 let game=createMultiplayerBattle(sceneEncounter(),{seed:'ai-battle'});
 game=dispatchMultiplayerAction(game,'attacker',{type:'end-turn'}).state;
 const model=newOpponentModel('ai-turn');
 const r=await runAiTurn(game,'defender',model);
 assert.ok(r.commands.length>=1);assert.ok(r.commands.some(c=>c.type==='end-turn'||c.type==='attack'));
 for(const cmd of r.commands)assert.ok(['play-doctrine','move','attack','rally','surge','end-turn'].includes(cmd.type));
 assert.ok(r.state.battle.outcome||r.state.battle.phase==='attacker');assert.ok(r.state.sequence>game.sequence);
 assert.equal(game.battle.phase,'defender');
});
