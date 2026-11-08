/** Cavalry of Rome multiplayer match server. Node 22+, no database dependency.
 * One server process, persistent volume and HTTPS reverse proxy for production.
 */
import {createServer as nodeServer} from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readFile,writeFile,rename,mkdir,unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve,extname,sep} from 'node:path';
import {sceneEncounter} from '../../tactical/encounter-scenario.mjs';
import {createMultiplayerBattle,dispatchMultiplayerAction,viewForPlayer} from '../turn-rules.mjs';
import {newOpponentModel,learnOpponentCard,observeOpponentAction,runAiTurn,snapshotOnnx} from './opponent-ai.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const DEFAULT_DB=resolve(ROOT,'../.cavalry-mp-data/matches.json');
const id=()=>randomBytes(12).toString('hex');
const token=()=>randomBytes(32).toString('base64url');
const hash=x=>createHash('sha256').update(x).digest('hex');
const isCode=x=>typeof x==='string'&&/^[A-Z0-9]{8}$/.test(x);
const invite=()=>Array.from(randomBytes(8),x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%32]).join('');
const publicName=s=>(typeof s==='string'?s:'Commander').replace(/[^\p{L}\p{N} ._-]/gu,'').trim().slice(0,35)||'Commander';
const err=(status,message)=>Object.assign(new Error(message),{status});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.glb':'model/gltf-binary','.svg':'image/svg+xml','.json':'application/json'};

export class MatchStore{
 constructor(file=DEFAULT_DB){this.file=resolve(file);this.data={version:1,players:{},matches:{}};this.queue=Promise.resolve();}
 async init(){await mkdir(dirname(this.file),{recursive:true});try{this.data=JSON.parse(await readFile(this.file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}}
 /** Serialize whole-file atomic saves; deploy exactly one writer process. */
 async transaction(callback){
  const task=this.queue.then(async()=>{
   const copy=structuredClone(this.data);const result=await callback(copy);
   const temp=`${this.file}.${process.pid}.${id()}.tmp`;
   try{await writeFile(temp,JSON.stringify(copy),'utf8');await rename(temp,this.file);}catch(e){try{await unlink(temp);}catch{}throw e;}
   this.data=copy;return result;
  });
  this.queue=task.catch(()=>{});return task;
 }
 authenticated(auth){
  const candidate=typeof auth==='string'&&auth.startsWith('Bearer ')?auth.slice(7):null;
  if(!candidate||candidate.length>180)return null;
  const digest=Buffer.from(hash(candidate),'hex');
  for(const player of Object.values(this.data.players)){
   const saved=Buffer.from(player.tokenHash,'hex');
   if(saved.length===digest.length&&timingSafeEqual(saved,digest))return player;
  }
  return null;
 }
}
const ownSeat=(match,playerId)=>match.players.attacker===playerId?'attacker':match.players.defender===playerId?'defender':null;
function matchSummary(m,playerId,peers){const side=ownSeat(m,playerId);if(!side)throw err(403,'Not your match');const opponent=side==='attacker'?'defender':'attacker';
 return {id:m.id,mode:m.mode,inviteCode:m.inviteCode,status:m.status,version:m.version,
  side,turn:m.game.battle.phase,outcome:m.game.battle.outcome,
  updatedAt:m.updatedAt,createdAt:m.createdAt,
  opponentName:m.players[opponent]==='ai'?'Adaptive Opponent':m.players[opponent]?m.names[opponent]:'Awaiting challenger',
  opponentPeer:peers.get(m.players[opponent])?.expires>Date.now()?peers.get(m.players[opponent]).peerId:null};}
function toView(m,playerId,peers){const side=ownSeat(m,playerId);return {...matchSummary(m,playerId,peers),state:viewForPlayer(m.game,side),aiTraining:m.mode==='ai'?{seenCards:m.model.seenCards,seenMoves:m.model.seenMoves,modelVersion:m.model.modelVersion}:null};}
async function jsonBody(req){const buffers=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16000)throw err(413,'Request too large');buffers.push(chunk);}try{return JSON.parse(Buffer.concat(buffers).toString('utf8')||'{}');}catch{throw err(400,'Invalid JSON');}}
function send(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));}
function cors(req,res,allowed){const origin=req.headers.origin;if(!origin)return true;
 if(allowed.includes('*')||allowed.includes(origin)){
  res.setHeader('access-control-allow-origin',allowed.includes('*')?'*':origin);
  res.setHeader('vary','Origin');res.setHeader('access-control-allow-methods','GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers','Authorization, Content-Type');res.setHeader('access-control-max-age','600');return true;
 }return false;}
export async function createMatchServer({file=DEFAULT_DB,allowedOrigins=['http://localhost:5173','http://127.0.0.1:5173','http://localhost:8787','http://127.0.0.1:8787']}={}){
 const store=new MatchStore(file);await store.init();const peers=new Map(),hits=new Map(),signups=new Map();
 const server=nodeServer(async(req,res)=>{
  try{
   if(!cors(req,res,allowedOrigins))throw err(403,'Origin not allowed');
   if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
   const path=new URL(req.url,'http://localhost').pathname;
   if(req.method==='GET'&&path==='/api/health'){send(res,200,{ok:true,rules:'cohorts-supply-momentum-v1',persistent:true});return;}
   if(!path.startsWith('/api/')){
    if(req.method!=='GET'&&req.method!=='HEAD')throw err(405,'Method not allowed');
    if(path==='/'||path==='/index.html'){res.writeHead(302,{'location':'/multiplayer/index.html','cache-control':'no-store'});res.end();return;}
    const decoded=decodeURIComponent(path);
    if(!(/^\/(?:multiplayer|tactical|src)\//.test(decoded)||['/','/index.html'].includes(decoded))||/^\/multiplayer\/(?:server|tests)\//.test(decoded))throw err(403,'Asset path not public');
    const filePath=resolve(ROOT,`.${decoded}`);
    if(!filePath.startsWith(`${ROOT}${sep}`))throw err(403,'Invalid asset path');
    const data=await readFile(filePath);
    res.writeHead(200,{'content-type':mime[extname(filePath)]||'application/octet-stream','cache-control':'public, max-age=120'});
    res.end(req.method==='HEAD'?undefined:data);return;
   }
   if(path==='/api/identity'&&req.method==='POST'){
    const source=req.socket.remoteAddress||'unknown';const recent=(signups.get(source)||[]).filter(t=>Date.now()-t<600000);
    if(recent.length>=12)throw err(429,'Too many new identities');recent.push(Date.now());signups.set(source,recent);
    const body=await jsonBody(req),name=publicName(body.name);
    const playerId=id(),secret=token();
    await store.transaction(data=>{data.players[playerId]={id:playerId,tokenHash:hash(secret),name,createdAt:new Date().toISOString()};});
    send(res,201,{playerId,token:secret,name});return;
   }
   const player=store.authenticated(req.headers.authorization);
   if(!player)throw err(401,'Missing or invalid guest identity');
   if(path==='/api/identity'&&req.method==='GET'){send(res,200,{playerId:player.id,name:player.name});return;}
   const now=Date.now(),recent=hits.get(player.id)||[];
   const within=recent.filter(t=>now-t<60000);
   if(req.method==='POST'&&within.length>=80)throw err(429,'Too many requests');
   if(req.method==='POST'){within.push(now);hits.set(player.id,within);}
   if(path==='/api/matches'&&req.method==='GET'){
    const games=Object.values(store.data.matches).filter(m=>ownSeat(m,player.id)).map(m=>matchSummary(m,player.id,peers));
    games.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));send(res,200,{matches:games});return;
   }
   if(path==='/api/matches'&&req.method==='POST'){
    const body=await jsonBody(req),mode=body.mode;
    if(!['ai','human'].includes(mode))throw err(400,'Mode must be ai or human');
    let game;
    try{game=createMultiplayerBattle(sceneEncounter(),{seed:id()});}catch(e){throw err(500,`Could not initialize encounter: ${e.message}`);}
    const now=new Date().toISOString();const match={id:id(),inviteCode:invite(),version:0,
      mode,status:mode==='ai'?'active':'waiting',createdAt:now,updatedAt:now,
      players:{attacker:player.id,defender:mode==='ai'?'ai':null},names:{attacker:player.name,defender:mode==='ai'?'Adaptive Opponent':null},
      game,model:mode==='ai'?newOpponentModel(id()):null,processed:[],history:[]};
    await store.transaction(data=>{data.matches[match.id]=match;});
    send(res,201,toView(match,player.id,peers));return;
   }
   if(path==='/api/matches/join'&&req.method==='POST'){
    const body=await jsonBody(req),code=String(body.inviteCode||'').trim().toUpperCase();
    if(!isCode(code))throw err(400,'Invalid invite code');
    const result=await store.transaction(data=>{
      const match=Object.values(data.matches).find(m=>m.inviteCode===code);
      if(!match)throw err(404,'Invite not found');
      if(ownSeat(match,player.id))return toView(match,player.id,peers);
      if(match.status!=='waiting'||match.players.defender)throw err(409,'Match already joined');
      match.players.defender=player.id;match.names.defender=player.name;match.status='active';match.version++;
      match.updatedAt=new Date().toISOString();return toView(match,player.id,peers);
    });send(res,200,result);return;
   }
   const hit=path.match(/^\/api\/matches\/([a-f0-9]{24})(?:\/(commands|peer|onnx))?$/);
   if(!hit)throw err(404,'Unknown endpoint');
   const matchId=hit[1],sub=hit[2]??'';
   const current=store.data.matches[matchId];if(!current)throw err(404,'Match not found');
   const seat=ownSeat(current,player.id);if(!seat)throw err(403,'Not your match');
   if(sub===''&&req.method==='GET'){send(res,200,toView(current,player.id,peers));return;}
   if(sub==='peer'&&req.method==='POST'){
    const body=await jsonBody(req),peerId=body.peerId;
    if(typeof peerId!=='string'||!/^[-_A-Za-z0-9]{1,80}$/.test(peerId))throw err(400,'Invalid peer id');
    peers.set(player.id,{peerId,expires:Date.now()+45000});send(res,200,{ok:true});return;
   }
   if(sub==='onnx'&&req.method==='GET'){
    if(current.mode!=='ai')throw err(404,'No AI model for this battle');
    const data=snapshotOnnx(current.model);
    res.writeHead(200,{'content-type':'application/octet-stream','content-disposition':'attachment; filename="cavalry-opponent.onnx"','cache-control':'no-store'});res.end(data);return;
   }
   if(sub==='commands'&&req.method==='POST'){
    const body=await jsonBody(req);
    if(!Number.isSafeInteger(body.expectedVersion)||!body.command||typeof body.command!=='object')throw err(400,'Invalid command packet');
    if(typeof body.actionId!=='string'||!/^[-_A-Za-z0-9]{12,80}$/.test(body.actionId))throw err(400,'Invalid action id');
    const payloadSize=JSON.stringify(body.command).length;if(payloadSize>1600)throw err(400,'Command too large');
    const result=await store.transaction(async data=>{
      const match=data.matches[matchId];
      if(!match||ownSeat(match,player.id)!==seat)throw err(403,'Not your match');
      if(match.processed.includes(`${player.id}:${body.actionId}`))return toView(match,player.id,peers);
      if(match.status!=='active')throw err(409,'Match not active');
      if(match.version!==body.expectedVersion)throw err(409,'Stale match version; reload');
      const humanBefore=match.game;
      const action=dispatchMultiplayerAction(match.game,seat,body.command);
      if(!action.accepted)throw err(422,action.reason);
      if(match.model){
        if(body.command.type==='play-doctrine'){
          const card=humanBefore.players[seat].hand.find(x=>x.instanceId===body.command.instanceId);
          if(card)learnOpponentCard(match.model,humanBefore,seat,card.type);
        }
        observeOpponentAction(match.model,body.command);
      }
      match.game=action.state;
      match.history.push({side:seat,type:body.command.type,cardType:action.events.find(x=>x.type==='doctrine-played')?.cardType||null,seq:match.game.sequence});
      if(match.mode==='ai'&&match.game.battle.phase==='defender'&&!match.game.battle.outcome){
        const response=await runAiTurn(match.game,'defender',match.model);
        match.game=response.state;
        for(const c of response.commands)match.history.push({side:'defender',type:c.type,seq:match.game.sequence});
      }
      if(match.history.length>300)match.history=match.history.slice(-300);
      if(match.game.battle.outcome)match.status='complete';
      match.version++;match.updatedAt=new Date().toISOString();
      match.processed.push(`${player.id}:${body.actionId}`);
      if(match.processed.length>200)match.processed=match.processed.slice(-200);
      return toView(match,player.id,peers);
    });
    send(res,200,result);return;
   }
   throw err(405,'Method not allowed');
  }catch(e){send(res,e.status||((e.code==='ENOENT')?404:500),{error:e.status||e.code==='ENOENT'?e.message:'Unexpected server error'});if(!e.status&&e.code!=='ENOENT')console.error(e);}
 });
 return {server,store,listen:(port=8787,host='127.0.0.1')=>new Promise(resolve=>server.listen(port,host,()=>resolve(server.address()))),close:()=>new Promise(resolve=>server.close(resolve))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=await createMatchServer({file:process.env.CAVALRY_DATA_FILE||DEFAULT_DB,
   allowedOrigins:(process.env.CORS_ORIGINS||'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8787,http://127.0.0.1:8787').split(',')});
 const address=await app.listen(Number(process.env.PORT||8787),process.env.HOST||'0.0.0.0');
 console.log(`Cavalry multiplayer listening on ${address.address}:${address.port}, store=${app.store.file}`);
}
