/** Original, self-contained engraved emblems for the eight Cavalry of Rome doctrines.
 * This module owns symbols independently of the tactical rules and GPU renderer.
 */
export const DOCTRINE_EMBLEMS=Object.freeze({
  'reserve-cohort':{
    title:'Reinforcement shield',
    theme:'#d8bc79',
    glyph:`<path d="M75 19 115 35v33c0 30-16 48-40 62-24-14-40-32-40-62V35z" fill="#d9bc77" fill-opacity=".13"/>
      <path d="M75 20 115 35v33c0 30-16 48-40 62-24-14-40-32-40-62V35z"/>
      <path d="M75 39v52M49 65h52" stroke-width="8"/>
      <path d="M56 102q19 14 38 0" stroke-width="2"/>`
  },
  'marching-cadence':{
    title:'Advancing Roman standards',
    theme:'#d6bc89',
    glyph:`<path d="M27 112V41m0 1 20-9v20l-20-6M77 112V29m0 1 19-9v21l-19-6"/>
      <path d="m22 91 24-20m-24 40 24-20m26 0 26-20m-26 40 26-20" stroke-width="6"/>
      <path d="M20 119h98M56 117V58m0 0 12-11m-12 11-12-11" stroke-width="3"/>`
  },
  'road-levy':{
    title:'Stone road and milestone',
    theme:'#e1c696',
    glyph:`<path d="M25 124 53 27m73 97L97 27" stroke-width="6"/>
      <path d="M75 120v-19m0-13V72m0-13V44" stroke-width="4" stroke-dasharray="11 7"/>
      <path d="M101 57h26v43h-26z" fill="#e4c995" fill-opacity=".2"/>
      <path d="M107 64h14m-12 11h10m-12 11h14" stroke-width="2"/>
      <path d="M18 127h116" stroke-width="3"/>`
  },
  'supply-train':{
    title:'Supply wagon and cargo',
    theme:'#dec18b',
    glyph:`<path d="M27 68h95v34H27z" fill="#d7b87a" fill-opacity=".16"/>
      <path d="M27 68h95v34H27zM37 68l16-26h50l14 26M61 44v24m33-24v24"/>
      <circle cx="48" cy="110" r="13" fill="#1d3129"/><circle cx="104" cy="110" r="13" fill="#1d3129"/>
      <path d="M39 67V53h22v14M77 67V51h23v16M35 88h78" stroke-width="3"/>`
  },
  'eagle-vow':{
    title:'Legion eagle standard',
    theme:'#efcc84',
    glyph:`<path d="M75 40v82M70 121h11M46 119h58" stroke-width="4"/>
      <path d="M75 38c-8-18-23-21-34-19 10 8 12 13 15 24L25 34c10 22 28 30 50 24 22 6 40-2 50-24l-31 9c3-11 5-16 15-24-11-2-26 1-34 19z" fill="#e4cb8c" fill-opacity=".26"/>
      <path d="M75 38c-8-18-23-21-34-19 10 8 12 13 15 24L25 34c10 22 28 30 50 24 22 6 40-2 50-24l-31 9c3-11 5-16 15-24-11-2-26 1-34 19z"/>
      <path d="M67 62l8 14 8-14M58 98h34" stroke-width="4"/>`
  },
  'lancer-signal':{
    title:'Raised cavalry lance with pennant',
    theme:'#e6b77c',
    glyph:`<path d="M24 120 106 20M37 108 119 42" stroke-width="5"/>
      <path d="m106 20 22 6-17 24-6-15" fill="#d7ae72" fill-opacity=".3"/>
      <path d="M104 22 126 27l-17 24-5-16" stroke-width="3"/>
      <path d="M47 120c17-25 37-23 55-3M59 95l8 8m12-15 7 9" stroke-width="3"/>`
  },
  'scouting-dispatch':{
    title:'Scouting telescope and dispatch',
    theme:'#b8cfb5',
    glyph:`<path d="M20 100 89 44l17 20-68 55z" fill="#bad0af" fill-opacity=".18"/>
      <path d="M20 100 89 44l17 20-68 55zM80 52l18 20M32 91l18 20"/>
      <path d="M89 28h38v45h-15M101 36h18m-18 10h18m-18 10h12" stroke-width="3"/>
      <path d="M28 119h90" stroke-width="3"/>`
  },
  'drum-of-resolve':{
    title:'Roman war drum and crossed beaters',
    theme:'#d8aa88',
    glyph:`<ellipse cx="75" cy="66" rx="39" ry="17" fill="#d8a77c" fill-opacity=".16"/>
      <path d="M36 66v37c25 20 53 20 78 0V66M36 66c9-20 69-20 78 0-10 19-68 19-78 0z"/>
      <path d="M39 82l72 24m0-24-72 24M48 59l27 11 27-11" stroke-width="3"/>
      <path d="m38 28 30 30m44-30L82 58" stroke-width="5"/>`
  }
});
export function doctrineArtwork(type){
  const d=DOCTRINE_EMBLEMS[type];
  if(!d)throw new Error(`Unknown doctrine art: ${type}`);
  return `<svg viewBox="0 0 150 140" aria-hidden="true" focusable="false" data-emblem="${type}" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="seal-${type}"><stop stop-color="${d.theme}" stop-opacity=".12"/><stop offset="1" stop-color="${d.theme}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="75" cy="72" r="62" fill="url(#seal-${type})" stroke="${d.theme}" stroke-opacity=".22" stroke-width="1.4"/>
    <g fill="none" stroke="${d.theme}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round">${d.glyph}</g>
  </svg>`;
}