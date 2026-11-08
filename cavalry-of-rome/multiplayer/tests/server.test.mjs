import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createMatchServer} from '../server/index.mjs';

async function fixture(){const dir=await mkdtemp(join(tmpdir(),'cavalry-mp-'));const file=join(dir,'matches.json');let app=await createMatchServer({file,allowedOrigins:['*']});let addr=await app.listen(0);let base=`http://127.0.0.1:${addr.port}`;
 async function req(path,{method='GET',token=null,data=null}={}){
  const headers={};if(token)headers.authorization=`Bearer ${token}`;if(data!==null)headers['content-type']='application/json';
  const res=await fetch(`${base}${path}`,{method,headers,body:data===null?undefined:JSON.stringify(data)});
  const json=res.headers.get('content-type')?.includes('application/json')?await res.json():null;
  return {status:res.status,data:json,res};
 }
 const identity=async name=>{const r=await req('/api/identity',{method:'POST',data:{name}});assert.equal(r.status,201);return r.data;};
 return {req,identity,file,get app(){return app},restart:async()=>{await app.close();app=await createMatchServer({file,allowedOrigins:['*']});addr=await app.listen(0);base=`http://127.0.0.1:${addr.port}`;},end:async()=>{await app.close();await rm(dir,{recursive:true,force:true});}};
}

test('independent persistent multiplayer matches, private hands, idempotent and stale rejection',async()=>{
 const fx=await fixture();try{
  const a=await fx.identity('Scipio'),b=await fx.identity('Aulus'),c=await fx.identity('Guest');
  const tokenA=a.token,tokenB=b.token,tokenC=c.token;
  const one=await fx.req('/api/matches',{method:'POST',token:tokenA,data:{mode:'human'}});
  assert.equal(one.status,201);assert.equal(one.data.status,'waiting');assert.match(one.data.inviteCode,/^[A-Z0-9]{8}$/);
  const two=await fx.req('/api/matches',{method:'POST',token:tokenA,data:{mode:'human'}});assert.equal(two.status,201);
  assert.notEqual(one.data.id,two.data.id);
  assert.equal((await fx.req(`/api/matches/${one.data.id}`,{token:tokenC})).status,403);
  const joined=await fx.req('/api/matches/join',{method:'POST',token:tokenB,data:{inviteCode:one.data.inviteCode}});
  assert.equal(joined.status,200);assert.equal(joined.data.side,'defender');
  const own=await fx.req(`/api/matches/${one.data.id}`,{token:tokenA});
  assert.equal(own.data.status,'active');assert.equal(own.data.state.hand.length,4);
  assert.ok(own.data.state.hand.every(x=>x.instanceId.startsWith('attacker')));
  assert.ok(joined.data.state.hand.every(x=>x.instanceId.startsWith('defender')));
  assert.equal(own.data.state.resources.opponent.handCount,4);
  assert.equal(JSON.stringify(own.data.state).includes('defender-supply-train'),false);
  const path=`/api/matches/${one.data.id}/commands`;
  const actionId='abcdef0123456789',payload={actionId,expectedVersion:joined.data.version,command:{type:'end-turn'}};
  assert.equal((await fx.req(path,{method:'POST',token:tokenB,data:payload})).status,422); // wrong turn
  const committed=await fx.req(path,{method:'POST',token:tokenA,data:payload});assert.equal(committed.status,200);
  assert.equal(committed.data.state.battle.phase,'defender');const current=committed.data.version;
  assert.equal((await fx.req(path,{method:'POST',token:tokenA,data:payload})).data.version,current); // replay safe
  assert.equal((await fx.req(path,{method:'POST',token:tokenA,data:{...payload,actionId:'zzzzzzzzzzzzzzzz'}})).status,409);
  const other=await fx.req(`/api/matches/${two.data.id}`,{token:tokenA});assert.equal(other.data.status,'waiting');assert.equal(other.data.state.battle.phase,'attacker');
  const completed=await fx.req(path,{method:'POST',token:tokenB,data:{actionId:'b123456789012345',expectedVersion:current,command:{type:'end-turn'}}});
  assert.equal(completed.status,200);assert.equal(completed.data.state.battle.phase,'attacker');
  await fx.restart();const again=await fx.req(`/api/matches/${one.data.id}`,{token:tokenA});
  assert.equal(again.status,200);assert.equal(again.data.version,completed.data.version);assert.equal(again.data.state.battle.turn,2);
  assert.equal((await fx.req('/api/identity',{token:tokenA})).data.name,'Scipio');
 }finally{await fx.end();}
});

test('AI match updates learned ONNX model, exports snapshot and runs next defender activation',async()=>{
 const fx=await fixture();try{
  const p=await fx.identity('Commander'),created=await fx.req('/api/matches',{method:'POST',token:p.token,data:{mode:'ai'}});
  assert.equal(created.status,201);const m=created.data;
  assert.equal(m.aiTraining.seenCards,0);
  let accepted=null;
  for(const c of m.state.hand){const r=await fx.req(`/api/matches/${m.id}/commands`,{method:'POST',token:p.token,data:{actionId:`a${c.instanceId.replaceAll('-','')}abcdef01234`.slice(0,78),expectedVersion:m.version,command:{type:'play-doctrine',instanceId:c.instanceId}}});if(r.status===200){accepted=r;break;}}
  assert.ok(accepted,'No playable doctrine card on initial hand');assert.equal(accepted.data.aiTraining.seenCards,1);
  const after=await fx.req(`/api/matches/${m.id}/commands`,{method:'POST',token:p.token,data:{actionId:'finishturn7890',expectedVersion:accepted.data.version,command:{type:'end-turn'}}});
  assert.equal(after.status,200);assert.ok(after.data.state.battle.phase==='attacker'||after.data.state.battle.outcome);
  assert.ok(after.data.state.sequence>accepted.data.state.sequence);
  const onnx=await fx.req(`/api/matches/${m.id}/onnx`,{token:p.token});
  assert.equal(onnx.status,200);const binary=Buffer.from(await onnx.res.arrayBuffer());assert.ok(binary.includes(Buffer.from('MatMul')));
  await fx.restart();const saved=await fx.req(`/api/matches/${m.id}`,{token:p.token});assert.equal(saved.data.aiTraining.seenCards,1);
 }finally{await fx.end();}
});

test('request boundaries reject malformed identities, commands and private server assets',async()=>{
 const fx=await fixture();try{
  assert.equal((await fx.req('/api/matches')).status,401);
  assert.equal((await fx.req('/.git/config')).status,403);
  assert.equal((await fx.req('/multiplayer/server/index.mjs')).status,403);
  assert.equal((await fx.req('/multiplayer/tests/server.test.mjs')).status,403);
  const p=await fx.identity('Legate');assert.equal((await fx.req('/api/matches',{method:'POST',token:p.token,data:{mode:'unknown'}})).status,400);
  const m=(await fx.req('/api/matches',{method:'POST',token:p.token,data:{mode:'human'}})).data;
  assert.equal((await fx.req(`/api/matches/${m.id}/commands`,{method:'POST',token:p.token,data:{actionId:'bad',expectedVersion:0,command:{type:'end-turn'}}})).status,400);
  assert.equal((await fx.req(`/api/matches/${m.id}/peer`,{method:'POST',token:p.token,data:{peerId:'bad id'}})).status,400);
 }finally{await fx.end();}
});
