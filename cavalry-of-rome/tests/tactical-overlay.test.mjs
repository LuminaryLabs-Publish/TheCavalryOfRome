import test from 'node:test';
import assert from 'node:assert/strict';
import {createTacticalOverlay} from '../src/tactical-overlay.js';
test('overlay opens for encounter, rejects foreign messages and applies exactly one same-origin result',()=>{
 const original={document:globalThis.document,location:globalThis.location,add:globalThis.addEventListener,remove:globalThis.removeEventListener};
 const listeners=new Map();let iframe,applies=0;
 const encounter={active:true,kind:'arrival',startedAt:4.5,center:{x:100,z:200},marchIds:['march-1'],board:{cells:[]}};
 const campaign={encounter};const engine={cavalry:{getState:()=>({campaign}),resolveEncounter(result){applies++;campaign.encounter=null;return result;}}};
 try{
  globalThis.location={origin:'https://luminarylabs-publish.github.io'};
  globalThis.document={createElement(tag){assert.equal(tag,'iframe');iframe={contentWindow:{},style:{},remove(){this.removed=true;}};return iframe;},body:{append(item){assert.equal(item,iframe);}}};
  globalThis.addEventListener=(name,cb)=>listeners.set(name,cb);
  globalThis.removeEventListener=name=>listeners.delete(name);
  const overlay=createTacticalOverlay({engine});overlay.update(null);assert.equal(overlay.isActive(),false);
  overlay.update(encounter);assert.equal(overlay.isActive(),true);
  assert.equal(new URL(iframe.src).pathname.endsWith('/multiplayer/index.html'),true);
  const init=JSON.parse(iframe.name);assert.equal(init.encounter.center.x,100);assert.equal(init.protocol,'cavalry:tactical:init:v1');
  const send=(source,origin,token)=>listeners.get('message')({source,origin,data:{type:'cavalry:tactical:result:v1',token,winner:'attacker',units:[]}});
  send({},globalThis.location.origin,init.token);send(iframe.contentWindow,'https://evil.example',init.token);send(iframe.contentWindow,globalThis.location.origin,'wrong');
  assert.equal(applies,0);send(iframe.contentWindow,globalThis.location.origin,init.token);
  assert.equal(applies,1);assert.equal(overlay.isActive(),false);assert.equal(iframe.removed,true);
  send(iframe.contentWindow,globalThis.location.origin,init.token);assert.equal(applies,1);
  overlay.destroy();assert.equal(listeners.size,0);
 }finally{globalThis.document=original.document;globalThis.location=original.location;globalThis.addEventListener=original.add;globalThis.removeEventListener=original.remove;}
});
