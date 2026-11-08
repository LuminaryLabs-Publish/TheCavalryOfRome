/**
 * The published 3D strategic map remains mounted underneath the tactical iframe.
 * It opens only for a genuine campaign encounter and closes after a validated
 * battle result has been committed to the campaign resource.
 */
export function createTacticalOverlay({engine, onError = console.error} = {}) {
  if (!engine?.cavalry?.getState || !engine.cavalry?.resolveEncounter) throw new Error('Tactical overlay requires campaign APIs');
  let frame = null;
  let token = null;
  let busy = false;
  function encounterToken(encounter) {
    return [encounter.kind, Number(encounter.startedAt).toFixed(5), Math.round(encounter.center?.x||0), Math.round(encounter.center?.z||0), ...(encounter.marchIds||[])].join(':');
  }
  function close() {
    frame?.remove();
    frame = null;token = null;busy = false;
  }
  function open(encounter) {
    token = encounterToken(encounter);
    const el = document.createElement('iframe');
    el.title = 'Cavalry of Rome — 3D doctrine battle';
    el.className = 'cavalry-tactical-overlay';
    el.style.cssText='position:fixed;inset:0;z-index:999;width:100vw;height:100vh;border:0;background:#132019;display:block';
    // about:blank inherits the page's origin, preserving window.name on navigation.
    el.name = JSON.stringify({protocol:'cavalry:tactical:init:v1',token,encounter});
    el.src = new URL('../multiplayer/index.html',import.meta.url).href;
    frame=el;
    document.body.append(el);
  }
  function onMessage(event) {
    if (!frame || !token || busy || event.source!==frame.contentWindow || event.origin!==location.origin) return;
    const data=event.data;
    if (!data || data.type!=='cavalry:tactical:result:v1' || data.token!==token) return;
    if (!['attacker','defender','draw'].includes(data.winner) || !Array.isArray(data.units)) return;
    const active=engine.cavalry.getState()?.campaign?.encounter;
    if (!active?.active || encounterToken(active)!==token) return;
    busy=true;
    try {
      // Campaign API applies a validated, source-ID-preserving casualty ledger.
      const result=engine.cavalry.resolveEncounter({winner:data.winner,units:data.units});
      if (!result?.winner) throw new Error('Tactical result was not committed');
      close();
    } catch(error) {
      busy=false;
      onError(error);
      frame?.contentWindow?.postMessage({type:'cavalry:tactical:error:v1',reason:'Battle outcome could not be applied. You can retry returning to campaign.'},location.origin);
    }
  }
  globalThis.addEventListener('message',onMessage);
  return {
    update(encounter) {
      if (!encounter?.active) { if(frame)close();return; }
      const requested=encounterToken(encounter);
      if (!frame)open(encounter);
      else if (token!==requested) {close();open(encounter);}
    },
    isActive:()=>Boolean(frame),
    destroy(){close();globalThis.removeEventListener('message',onMessage);}
  };
}
