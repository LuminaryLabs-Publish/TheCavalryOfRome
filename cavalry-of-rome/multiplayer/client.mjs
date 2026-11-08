/** Battle client. All commands are server validated. PeerJS only sends version hints.
 * Works with itch static hosting once configured with a separate HTTPS API.
 */
import {DOCTRINE_DEFS} from './turn-rules.mjs';
import {doctrineArtwork} from './doctrine-art.mjs';
import {sceneEncounter} from '../tactical/encounter-scenario.mjs';
import {allHexes,getFeature} from '../tactical/terrain-world.mjs';
import {reachableHexes,attackableUnits} from '../tactical/hex-combat.mjs';
import {readCampaignContext,buildCampaignScenario} from '../tactical/campaign-scenario.mjs';
import {startCampaignBattle,actCampaign,campaignView,campaignLedger,isValidCampaignModel} from './campaign-session.mjs';

const $=id=>document.getElementById(id);
const human=(side)=>side==='attacker'?'Rome':'Opposition';
const safeGet=(key)=>{try{return localStorage.getItem(key)}catch{return null}};
const safeSet=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
const params=new URLSearchParams(location.search);
const fallbackApi=location.origin;
const CAMPAIGN_CONTEXT=readCampaignContext();
const PRACTICE_MODE=!CAMPAIGN_CONTEXT&&params.get('practice')==='1';
const OFFLINE_MODE=Boolean(CAMPAIGN_CONTEXT||PRACTICE_MODE);
const LEARNING_MODEL_KEY='cavalry:campaign-adaptive-onnx-policy:v1';
let localSession=null;
let api=(params.get('api')||safeGet('cavalry:api')||fallbackApi).replace(/\/$/,'');
let secret=safeGet(`cavalry:identity:${api}`)||'';
let identity=null,selected=null,selectedUnitId=null,battlefield=null,battlefieldReady=false,busy=false,connection=null,peer=null,peerId=null,observedVersion=-1,pollTimer=null;
const source=OFFLINE_MODE?(CAMPAIGN_CONTEXT?buildCampaignScenario(CAMPAIGN_CONTEXT.encounter):sceneEncounter()):null;
const own=()=>selected?.side;
function toggleCouncil(show=!document.body.classList.contains('council-open')){
 if(OFFLINE_MODE||!document.body.classList.contains('in-battle'))return;
 document.body.classList.toggle('council-open',Boolean(show));
 $('council-toggle').setAttribute('aria-expanded',String(Boolean(show)));
 $('council-scrim').hidden=!show;
 $('war-council').inert=!show;
 if(show)$('council-close').focus();else $('council-toggle').focus();
}
function closePanels(){
 if(document.body.classList.contains('council-open'))toggleCouncil(false);
 const rules=$('rules-panel');rules.hidden=true;$('rules-toggle').setAttribute('aria-expanded','false');
 $('battle-log').classList.remove('log-open');$('log-toggle').setAttribute('aria-expanded','false');
}
function activateBattleUI(){
 document.body.classList.add('in-battle');
 $('war-council').inert=true;
 closePanels();
}

const turn=()=>selected?.state?.battle?.phase===own()&&!selected?.state?.battle?.outcome&&selected?.status==='active';
const alive=u=>u.status==='ready'&&u.strength>0;
function notice(text,error=false){$('status-line').textContent=text;$('status-line').style.color=error?'#e9a78c':'#d2cba9';}
function serverStatus(status){$('connection-status').textContent=status;$('connection-light').classList.toggle('online',status.startsWith('Online'));}
function resolveApi(raw){let u;try{u=new URL(raw)}catch{throw Error('Use a complete HTTPS URL.')}if(!['https:','http:'].includes(u.protocol))throw Error('Use HTTP(S).');if(u.protocol==='http:'&&!['localhost','127.0.0.1'].includes(u.hostname))throw Error('Production server must use HTTPS.');return u.origin+u.pathname.replace(/\/$/,'');}
async function request(path,{method='GET',data=null,auth=true}={}){
 const headers={};if(auth&&secret)headers.Authorization=`Bearer ${secret}`;if(data!==null)headers['Content-Type']='application/json';
 let response;try{response=await fetch(`${api}${path}`,{method,headers,body:data===null?undefined:JSON.stringify(data),cache:'no-store'});}catch{throw Error('Server unreachable. Check URL, TLS and CORS.');}
 let json;try{json=await response.json();}catch{throw Error('Not a Cavalry match API. Configure its HTTPS URL.');}
 if(!response.ok)throw Object.assign(new Error(json.error||`Server returned ${response.status}`),{status:response.status});
 return json;
}
function setIdentity(id){identity=id;secret=id.token;safeSet(`cavalry:identity:${api}`,secret);$('identity-create').hidden=true;$('identity-ready').hidden=false;$('match-controls').hidden=false;$('commander-display').textContent=id.name;notice('Welcome, commander. Create a battle or enter an invitation code.');}
async function validateIdentity(){if(!secret)return;
 try{const id=await request('/api/identity');setIdentity({...id,token:secret});await listMatches();}catch(e){secret='';identity=null;notice(`Sign-in needs attention: ${e.message}`,true);}}
async function register(){const name=$('commander-name').value.trim()||'Commander';try{setIdentity(await request('/api/identity',{method:'POST',data:{name},auth:false}));await listMatches();}catch(e){notice(e.message,true);}}
async function recover(){const candidate=$('recovery-token').value.trim();if(candidate.length<30){notice('Enter a complete private recovery token.',true);return;}const previous=secret;secret=candidate;try{const me=await request('/api/identity');setIdentity({...me,token:secret});$('recovery-token').value='';await listMatches();}catch(e){secret=previous;notice(`Recovery failed: ${e.message}`,true);}}
async function listMatches(){if(!identity)return;const list=await request('/api/matches');const root=$('match-list');root.replaceChildren();
 if(!list.matches.length){const p=document.createElement('p');p.className='muted';p.textContent='No battles yet.';root.append(p);return;}
 for(const m of list.matches){const button=document.createElement('button');button.classList.toggle('active',selected?.id===m.id);
  const title=document.createElement('b');title.textContent=m.opponentName;
  const sub=document.createElement('small');sub.textContent=`${m.mode==='ai'?'AI':'PVP'} · ${m.status.toUpperCase()} · ${m.outcome?`WINNER: ${m.outcome.toUpperCase()}`:m.turn===m.side?'YOUR TURN':'WAITING'}`;
  button.append(title,sub);button.addEventListener('click',()=>openMatch(m.id));root.append(button);
 }
}
async function create(mode){try{const m=await request('/api/matches',{method:'POST',data:{mode}});await openMatch(m.id,m);notice(mode==='human'?`Invite a friend using code ${m.inviteCode}.`:'Adaptive AI battle created. Your turn.');}catch(e){notice(e.message,true);}}
async function join(){const code=$('invite-code').value.trim().toUpperCase();try{const m=await request('/api/matches/join',{method:'POST',data:{inviteCode:code}});await openMatch(m.id,m);$('invite-code').value='';notice(`Joined your opponent's match ${code}.`);}catch(e){notice(e.message,true);}}
async function openMatch(id,initial=null){
 try{const view=initial||await request(`/api/matches/${id}`);const changed=selected?.id!==view.id;
  selected=view;if(changed){selectedUnitId=null;observedVersion=-1;connection?.close();connection=null;}
  $('welcome').hidden=true;$('battle-ui').hidden=false;
  activateBattleUI();
  if(!battlefieldReady)await initializeBoard();
  render();await listMatches();if(changed)notice(view.status==='waiting'?`Share invitation ${view.inviteCode} to invite another commander.`:`Battle loaded. ${human(view.side)} is yours to command.`);
  await offerPeer();
 }catch(e){notice(e.message,true);}
}
function recentEvents(){const entries=selected?.state?.events||[];const container=$('events');container.replaceChildren();
 for(const e of entries.slice(-7).reverse()){const div=document.createElement('div');div.textContent=`#${e.seq} · ${human(e.side)} · ${e.type.replaceAll('-',' ')}${e.cardType?` · ${DOCTRINE_DEFS[e.cardType]?.title||e.cardType}`:''}`;container.append(div);}}
function redrawResources(){const p=selected?.state?.resources?.own;const b=selected?.state?.battle;
 const vals=[p?.command??'—',p?.supply??'—',p?.momentum??'—',b?.turn??'—'];
 [...$('resources').children].forEach((node,i)=>node.querySelector('strong').textContent=vals[i]);}
const iconSvg=doctrineArtwork;
function renderHand(){const hand=$('hand');hand.replaceChildren();if(!selected)return;
 const active=turn(),p=selected.state.resources.own;
 for(const [index,c] of selected.state.hand.entries()){const def=DOCTRINE_DEFS[c.type];if(!def)continue;
  const button=document.createElement('button');button.type='button';button.className='doctrine-card';button.dataset.doctrine=c.type;
  const arc=index-(selected.state.hand.length-1)/2;
  button.style.setProperty('--fan-rotation',`${arc*2.7}deg`);
  button.style.setProperty('--fan-offset',`${Math.abs(arc)*7}px`);
  button.disabled=!active||p.doctrinePlayed||p.supply<def.cost||busy;
  button.title=`${def.title} · ${def.cost} Supply · ${active?'Click to play':'Available on your turn'}`;
  const art=document.createElement('div');art.className='art';art.innerHTML=iconSvg(c.type);
  const tag=document.createElement('span');tag.className='card-cost';tag.textContent=def.cost;
  const title=document.createElement('strong');title.className='card-name';title.textContent=def.title;
  const text=document.createElement('span');text.className='card-desc';text.textContent=def.description;
  button.append(art,tag,title,text);button.setAttribute('aria-label',`${def.title}: ${def.description} Costs ${def.cost} Supply.`);
  button.addEventListener('click',()=>submit({type:'play-doctrine',instanceId:c.instanceId}));hand.append(button);
 }
 if(!selected.state.hand.length)hand.textContent='Your doctrine hand is empty.';
}
function chosen(){return selected?.state?.battle?.units.find(u=>u.id===selectedUnitId&&alive(u));}
function render(){if(!selected)return;
 const b=selected.state.battle,p=selected.state.resources.own,active=turn();
 document.body.classList.add('in-battle');
 $('war-council').inert=!document.body.classList.contains('council-open');
 $('battle-role').textContent=`YOU COMMAND ${human(own()).toUpperCase()} · ${selected.mode.toUpperCase()}`;
 $('battle-label').textContent=b.outcome?`Battle finished · ${b.outcome==='draw'?'Draw':human(b.outcome)+' victorious'}`:`Round ${b.turn} · ${human(b.phase)} activation`;
 $('battle-opponent').textContent=`Against ${selected.opponentName}. ${selected.status==='waiting'?'Invitation pending.':''}`;
 $('battle-phase').textContent=b.outcome?'COMPLETE':selected.status==='waiting'?'INVITE A FRIEND':active?'YOUR TURN':'AWAITING THEIR TURN';
 $('copy-invite').hidden=selected.status!=='waiting';$('copy-invite').disabled=selected.status!=='waiting';
 $('resign').disabled=!!b.outcome||selected.status!=='active'||busy;
 $('return-campaign').hidden=!(OFFLINE_MODE&&b.outcome);
 if(OFFLINE_MODE&&b.outcome)$('return-campaign').textContent=CAMPAIGN_CONTEXT?'RETURN TO CAMPAIGN':'FIGHT AGAIN';
 $('end-turn').disabled=!active||busy;
 $('rally').disabled=!active||busy||!chosen()||p.command<1||chosen().moved||chosen().acted||chosen().morale===100;
 $('surge').disabled=!active||busy||p.momentum<2||p.surged||p.command>=6;
 if(chosen()){
  const u=chosen();$('selected-unit').textContent=`${u.label} · ${u.type.toUpperCase()}`;
  $('selected-description').textContent=`${u.strength}/${u.maxStrength} strength · ${u.morale} morale · ${u.soldiers} soldiers · (${u.q},${u.r})`;
 }else{$('selected-unit').textContent='Select a friendly formation';$('selected-description').textContent='Choose any living formation; cards do not restrict unit orders.';}
 $('match-version').textContent=`STATE ${selected.version} · SEQUENCE ${selected.state.sequence}`;
 $('doctrine-instruction').textContent=p.doctrinePlayed?'DOCTRINE DEPLOYED':active?'ONE DOCTRINE PER ACTIVATION':'AWAITING ORDERS';
 $('battle-ui').classList.toggle('local-turn',active);
 $('unit-controls').classList.toggle('has-formation',Boolean(chosen()));
 redrawResources();renderHand();recentEvents();renderBoard();
}
async function submit(command){if(!selected||busy)return;
 if(OFFLINE_MODE){
  busy=true;render();
  try{
   const result=await actCampaign(localSession,command);
   if(!result.accepted){notice(result.reason,true);return;}
   localSession=result.session;selected.version++;selected.state=campaignView(localSession);
   rememberOffline();
   notice(selected.state.battle.outcome?'Battle concluded. Return to the strategic campaign.':
     result.aiCommands.length?`The opposing commander responded with ${result.aiCommands.length} orders.`:`${command.type.replaceAll('-',' ')} accepted.`);
  }catch(e){notice(`Encounter could not advance: ${e.message}`,true);}
  finally{busy=false;render();}
  return;
 }
 busy=true;const expectedVersion=selected.version;render();try{
  const r=await request(`/api/matches/${selected.id}/commands`,{method:'POST',data:{actionId:crypto.randomUUID().replaceAll('-',''),expectedVersion,command}});
  selected=r;notice(r.state.battle.outcome?'Battle concluded. Result saved.':`${command.type.replaceAll('-',' ')} accepted. Match saved.`);render();publishHint();await listMatches();
 }catch(e){notice(e.message,true);if(e.status===409){const id=selected.id;selected=await request(`/api/matches/${id}`);render();}}finally{busy=false;render();}}
function worldCellClick(cell){if(!selected||busy)return;const unit=selected.state.battle.units.find(u=>alive(u)&&u.q===cell.q&&u.r===cell.r);
 if(unit?.side===own()){selectedUnitId=selectedUnitId===unit.id?null:unit.id;render();return;}
 if(!turn()){notice('This is not your activation. You can inspect the board while waiting.');return;}
 const focus=chosen();if(!focus){notice('Select a friendly formation first.');return;}
 if(unit){if(attackableUnits(selected.state.battle,focus.id).some(x=>x.unitId===unit.id))submit({type:'attack',unitId:focus.id,targetUnitId:unit.id});else notice('Enemy is outside your attack range or line of sight.',true);}
 else if(reachableHexes(selected.state.battle,focus.id).some(x=>x.q===cell.q&&x.r===cell.r))submit({type:'move',unitId:focus.id,q:cell.q,r:cell.r});
 else notice('Destination is blocked, occupied, or out of range.',true);
}
async function initializeBoard(){if(battlefieldReady)return;battlefieldReady=true;
 try{const {createBattlefield}=await import('../tactical/webgl-battlefield.mjs');
 battlefield=createBattlefield({canvas:$('battle'),labels:$('unit-labels'),onHexClick:worldCellClick,onStatus:text=>$('render-status').textContent=text});
 battlefield.ready.then(()=>{$('render-status').textContent=`3D battlefield ready · ${battlefield.stats().miniatureModels}/6 miniatures`;}).catch(e=>notice(`3D assets: ${e.message}`,true));
 }catch(e){$('battle').hidden=true;$('unit-labels').hidden=true;$('camera-tip')?.remove?.();$('hex-fallback').hidden=false;$('render-status').textContent='2D tactical fallback · 3D unavailable';notice(`3D rendering unavailable: ${e.message}. Hex board remains playable.`,true);}
}
function renderBoard(){if(!selected)return;const s=selected.state,focus=chosen();
 const moves=focus&&turn()?reachableHexes(s.battle,focus.id):[];
 const attacks=focus&&turn()?attackableUnits(s.battle,focus.id):[];
 if(battlefield){battlefield.setState(s,{selectedUnitId:focus?.id??null,eligibleUnits:turn()?s.battle.units.filter(u=>u.side===own()&&alive(u)):[],reachableCells:moves,attackable:s.battle.units.filter(u=>attacks.some(x=>x.unitId===u.id))});return;}
 const grid=$('hex-fallback');grid.replaceChildren();
 const radius=s.battle.radius,hexes=allHexes(radius),blocked=new Set(s.battle.blockedCells);
 const unitByCell=new Map(s.battle.units.filter(alive).map(u=>[`${u.q},${u.r}`,u]));
 const width=grid.clientWidth||640,height=grid.clientHeight||420;
 const cellSize=Math.min(width/(radius*3.5+5),height/(radius*2.95+3));
 for(const h of hexes){const key=`${h.q},${h.r}`,f=s.battle.features.find(x=>x.q===h.q&&x.r===h.r),u=unitByCell.get(key);
  const hex=document.createElement('button');hex.type='button';hex.className=`hex-cell ${f?.type||'field'}`;
  if(u)hex.classList.add(u.side===own()?'our-unit':'enemy-unit');
  if(u?.id===selectedUnitId)hex.classList.add('selected');
  if(moves.some(x=>x.q===h.q&&x.r===h.r))hex.classList.add('reachable');
  hex.style.width=`${cellSize*1.7}px`;hex.style.height=`${cellSize*1.92}px`;
  hex.style.left=`${width/2+(h.q+h.r/2)*cellSize*1.55}px`;
  hex.style.top=`${height/2+h.r*cellSize*1.48}px`;
  if(u){const mark=document.createElement('span');mark.className='hex-unit';mark.textContent=`${u.type[0].toUpperCase()}${u.strength}`;hex.append(mark);}
  hex.title=u?`${u.label}: ${u.strength}/${u.maxStrength} strength`:`Hex ${h.q},${h.r}${blocked.has(key)?' (blocked)':''}`;
  hex.setAttribute('aria-label',hex.title);hex.addEventListener('click',()=>worldCellClick(h));grid.append(hex);
 }
}
function publishHint(){if(connection?.open&&selected)connection.send({kind:'match-updated',matchId:selected.id,version:selected.version});}
function wireConnection(c){connection=c;c.on('data',d=>{if(d?.kind==='match-updated'&&d.matchId===selected?.id&&Number.isInteger(d.version)&&d.version>selected.version)refreshCurrent();});c.on('error',()=>{});}
async function offerPeer(){if(!identity||!selected)return;
 try{
  if(!peer&&typeof window.Peer==='function'){
   peer=new window.Peer();peer.on('open',id=>{peerId=id;offerPeer().catch(()=>{});});peer.on('connection',c=>wireConnection(c));peer.on('error',()=>{peerId=null;});
  }
  if(peerId){await request(`/api/matches/${selected.id}/peer`,{method:'POST',data:{peerId}});
   const fresh=await request(`/api/matches/${selected.id}`);selected=fresh;render();
   if(fresh.opponentPeer&&fresh.opponentPeer!==peerId&&(!connection||!connection.open)){
    wireConnection(peer.connect(fresh.opponentPeer,{reliable:true}));
   }
  }
 }catch{/* HTTP polling remains authoritative when PeerJS signaling fails. */}
}
async function refreshCurrent(){if(!selected||busy)return;try{const fresh=await request(`/api/matches/${selected.id}`);if(fresh.version!==selected.version){selected=fresh;render();await listMatches();notice('New opponent turn received. The saved match is current.');} }catch(e){notice(e.message,true);}}
async function polling(){if(!identity)return;try{await refreshCurrent();await listMatches();if(selected&&peerId)await offerPeer();}catch{}}
function bind(){
 $('api-url').value=api;
 $('council-toggle').addEventListener('click',()=>toggleCouncil());
 $('council-close').addEventListener('click',()=>toggleCouncil(false));
 $('council-scrim').addEventListener('click',()=>toggleCouncil(false));
 $('rules-toggle').addEventListener('click',()=>{
  const opening=$('rules-panel').hidden;
  $('rules-panel').hidden=!opening;
  $('rules-toggle').setAttribute('aria-expanded',String(opening));
 });
 $('log-toggle').addEventListener('click',()=>{
  const expanded=$('battle-log').classList.toggle('log-open');
  $('log-toggle').setAttribute('aria-expanded',String(expanded));
 });
 window.addEventListener('keydown',event=>{
  if(!document.body.classList.contains('in-battle')||event.altKey||event.ctrlKey||event.metaKey)return;
  if(event.key==='Escape'){
   if(document.body.classList.contains('council-open')){toggleCouncil(false);event.preventDefault();return;}
   if(!$('rules-panel').hidden||$('battle-log').classList.contains('log-open')){closePanels();event.preventDefault();}
   return;
  }
  if(document.body.classList.contains('council-open')||!selected||busy||
    ['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName)||event.target?.isContentEditable)return;
  const key=event.key.toLowerCase();
  if(['1','2','3','4'].includes(key)){
   const card=$('hand').querySelectorAll('.doctrine-card')[Number(key)-1];
   if(card&&!card.disabled){event.preventDefault();card.click();}return;
  }
  const control={e:'end-turn',r:'rally',m:'surge',h:'rules-toggle',l:'log-toggle'}[key];
  if(control){const button=$(control);if(button&&!button.disabled){event.preventDefault();button.click();}}
 });
 $('api-save').addEventListener('click',()=>{try{const updated=resolveApi($('api-url').value);api=updated;secret=safeGet(`cavalry:identity:${api}`)||'';identity=null;selected=null;safeSet('cavalry:api',api);$('identity-create').hidden=false;$('identity-ready').hidden=true;$('match-controls').hidden=true;$('welcome').hidden=false;$('battle-ui').hidden=true;document.body.classList.remove('in-battle','council-open');$('council-scrim').hidden=true;$('war-council').inert=false;connect();}catch(e){notice(e.message,true);}});
 $('register').addEventListener('click',register);$('recover').addEventListener('click',recover);
 $('copy-identity').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(secret);notice('Recovery token copied. Treat it like a password.');}catch{notice('Clipboard unavailable. Copy the recovery token from the secure browser context.',true);}});
 $('create-human').addEventListener('click',()=>create('human'));$('create-ai').addEventListener('click',()=>create('ai'));$('join').addEventListener('click',join);
 $('refresh-list').addEventListener('click',()=>listMatches().catch(e=>notice(e.message,true)));
 $('copy-invite').addEventListener('click',async()=>{if(!selected)return;try{await navigator.clipboard.writeText(selected.inviteCode);notice(`Invite code ${selected.inviteCode} copied.`);}catch{notice(`Invitation code: ${selected.inviteCode}`);}});
 $('rally').addEventListener('click',()=>{if(chosen())submit({type:'rally',unitId:selectedUnitId});});$('surge').addEventListener('click',()=>submit({type:'surge'}));$('end-turn').addEventListener('click',()=>submit({type:'end-turn'}));
 $('resign').addEventListener('click',()=>{if(confirm('Concede this battle? The opponent wins immediately.'))submit({type:'resign'});});
 $('return-campaign').addEventListener('click',()=>{
  if(!OFFLINE_MODE||!localSession?.battle?.battle?.outcome)return;
  if(PRACTICE_MODE){localSession=startCampaignBattle(sceneEncounter(),{seed:`practice-${Date.now()}`,model:localSession.model});selected.version=0;selected.state=campaignView(localSession);selectedUnitId=null;rememberOffline();render();notice('New battle started against the learning commander.');return;}
  const ledger=campaignLedger(localSession);
  globalThis.parent.postMessage({type:'cavalry:tactical:result:v1',token:CAMPAIGN_CONTEXT.token,...ledger},location.origin);
  notice('Battle ledger submitted. Waiting for the campaign to confirm it.');
 });
 if(CAMPAIGN_CONTEXT)globalThis.addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.type==='cavalry:tactical:error:v1')notice(e.data.reason||'The campaign rejected this result. Retry returning.',true);});
 window.addEventListener('resize',()=>{if(selected&&!battlefield)renderBoard();});
}
async function connect(){try{const r=await request('/api/health',{auth:false});serverStatus(`Online · ${r.rules}`);if(secret)await validateIdentity();else notice('Server online. Enter a commander name to begin.');}catch(e){serverStatus('Server offline / URL needed');notice(e.message,true);}}
function rememberOffline(){
 if(!OFFLINE_MODE||!localSession)return;
 try{
  localStorage.setItem(LEARNING_MODEL_KEY,JSON.stringify(localSession.model));
  if(CAMPAIGN_CONTEXT)sessionStorage.setItem(`cavalry:encounter:${CAMPAIGN_CONTEXT.token}`,JSON.stringify(localSession));
 }catch{/* Storage is optional in third-party iframes. */}
}
async function startOffline(){
 document.body.classList.add('offline-campaign');
 const seed=CAMPAIGN_CONTEXT?.token||'cavalry-practice';
 let learned=null;
 try{const value=JSON.parse(localStorage.getItem(LEARNING_MODEL_KEY)||'null');if(isValidCampaignModel(value))learned=value;}catch{}
 const fresh=startCampaignBattle(source,{seed,model:learned});
 localSession=fresh;
 if(CAMPAIGN_CONTEXT){
  try{
   const saved=JSON.parse(sessionStorage.getItem(`cavalry:encounter:${seed}`)||'null');
   if(saved?.version===fresh.version&&isValidCampaignModel(saved.model)&&saved.battle?.seed===seed&&
      saved.battle?.battle?.units?.map(u=>u.id).join('|')===fresh.battle.battle.units.map(u=>u.id).join('|'))localSession=saved;
  }catch{}
 }
 selected={id:seed,side:'attacker',status:'active',mode:'ai',version:0,opponentName:'Learning Commander',state:campaignView(localSession)};
 $('identity-create').hidden=true;$('identity-ready').hidden=true;$('match-controls').hidden=true;
 $('welcome').hidden=true;$('battle-ui').hidden=false;
 activateBattleUI();
 $('connection-status').textContent=CAMPAIGN_CONTEXT?'SINGLE-PLAYER CAMPAIGN':'OFFLINE PRACTICE';
 $('connection-light').classList.add('online');
 await initializeBoard();render();
 notice('Cohorts, Supply & Momentum. Your AI opponent learns from public actions across battles.');
}
async function main(){bind();if(OFFLINE_MODE){await startOffline();return;}await connect();pollTimer=setInterval(polling,7500);const invite=params.get('invite');if(invite){$('invite-code').value=invite.toUpperCase();notice('Invitation detected. Sign in, then select JOIN.');}}
main().catch(e=>notice(e.message,true));
