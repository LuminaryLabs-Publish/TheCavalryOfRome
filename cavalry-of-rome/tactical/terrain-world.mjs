/**
 * Cavalry of Rome: terrain-coupled tactical battlefield.
 * The base analytic heightfield is transcribed from the published game's
 * src/renderer.js and src/encounter-terrain.js terrainHeight(x,z).
 * The encounter adds a LOCAL, continuous riverbed without flattening the world.
 * This geometry is procedural source; it is not an image mapped onto a plane.
 */
export const SITE = {x:3621,z:1173,bearing:0,hexSize:58,radius:5};
export let ACTIVE_CAMPAIGN_SITE=false;
export const GRID_DIRECTIONS = Object.freeze([[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]]);
export const keyOf=(q,r)=>`${q},${r}`;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function seeded(seed){let h=2166136261;for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967295;}

/** Exact scalar height terms from the current published world renderer. */
export function originalWorldHeight(x,z){
 const ridge=Math.sin(x*.0038)*62+Math.cos(z*.0031)*58;
 const farHills=Math.sin((x+z)*.00165)*150;
 const fineFold=Math.sin(x*.011+z*.0045)*19+Math.cos(z*.009-x*.0032)*16;
 const crag=Math.sin((x-z)*.018)*Math.cos((x+z)*.0085)*11;
 const foothillRibs=Math.sin(x*.026+z*.013)*Math.sin(z*.017-x*.006)*9;
 const erodedCuts=-18*Math.max(0,Math.sin(x*.0065+z*.013))**2;
 const terrace=Math.sin((ridge+farHills)*.18+x*.002)*5.5;
 const valley=-165*Math.exp(-((x+215)**2)/460000);
 const riverCut=-74*Math.exp(-((x+205+Math.sin(z*.0018)*220)**2)/115000);
 const roadShelf=-18*Math.exp(-(x**2)/850000);
 return ridge+farHills+fineFold+crag+foothillRibs+erodedCuts+terrace+valley+riverCut+roadShelf;
}

/** Pointy-top hex axial positions follow the world renderer's conversion. */
export function axialWorld(q,r,site=SITE){
 const lx=Math.sqrt(3)*site.hexSize*(q+r/2),lz=1.5*site.hexSize*r;
 const c=Math.cos(site.bearing||0),s=Math.sin(site.bearing||0);
 // forward=(cos,sin); right=(-sin,cos), matching original hexAxialToWorld
 return {x:site.x-s*lx+c*lz,z:site.z+c*lx+s*lz};
}
export function axialLocal(q,r,site=SITE){
 const p=axialWorld(q,r,site);return {x:p.x-site.x,z:p.z-site.z};
}
export function hexCornerWorld(q,r,index,scale=1,site=SITE){
 const center=axialWorld(q,r,site);
 const a=index*Math.PI/3; // corners align with the renderer's axial neighbor spacing
 const dx=Math.cos(a)*site.hexSize*scale,dz=Math.sin(a)*site.hexSize*scale;
 return {x:center.x+dx,z:center.z+dz};
}
export function validHex(q,r,radius=SITE.radius){return Number.isInteger(q)&&Number.isInteger(r)&&Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=radius;}
export function allHexes(radius=SITE.radius){const list=[];for(let q=-radius;q<=radius;q++)for(let r=-radius;r<=radius;r++)if(validHex(q,r,radius))list.push({q,r});return list;}

/** Encounter river follows world-space points through adjacent hexes. */
export const RIVER_PATH_CELLS=Object.freeze([
 {q:3,r:-5},{q:2,r:-4},{q:2,r:-3},{q:1,r:-2},{q:1,r:-1},
 {q:0,r:0},{q:-1,r:1},{q:-1,r:2},{q:-2,r:3},{q:-2,r:4},{q:-3,r:5}
]);
export const RIVER_POLYLINE=RIVER_PATH_CELLS.map(c=>axialWorld(c.q,c.r));
export function configureCampaignSite(encounter,radius=7){
 const center=encounter?.center??{},x=Number(center.x),z=Number(center.z),bearing=Number(encounter.bearing??0);
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(bearing))throw new Error('Invalid campaign encounter coordinates');
 if(!Number.isInteger(radius)||radius<6||radius>13)throw new Error('Invalid campaign hex radius');
 Object.assign(SITE,{x,z,bearing,hexSize:Number(encounter?.hex?.cellSize??58),radius});
 ACTIVE_CAMPAIGN_SITE=true;
 const features=encounter?.board?.featureCells??[];
 if(!Array.isArray(features))throw new Error('Missing campaign terrain features');
 FEATURES.splice(0,FEATURES.length,...features.map(f=>({...f,
  type:f.type==='settlement'||f.type==='landmark'?'rock':f.type,
  obstacle:Boolean(f.obstacle),
  movement:f.obstacle?'impassable':f.movement??'open',
  blocksLineOfSight:Boolean(f.blocksLineOfSight)
 })).filter(f=>validHex(f.q,f.r)));
 FEATURES_BY_KEY.clear();for(const f of FEATURES)FEATURES_BY_KEY.set(keyOf(f.q,f.r),f);
 const river=FEATURES.filter(f=>f.type==='river').map(f=>axialWorld(f.q,f.r));
 // Trace the actual sampled water cells; no river is authored on a dry battle site.
 const ordered=[];
 if(river.length>0){
  const remaining=[...river];ordered.push(remaining.shift());
  while(remaining.length){const last=ordered.at(-1);remaining.sort((a,b)=>Math.hypot(a.x-last.x,a.z-last.z)-Math.hypot(b.x-last.x,b.z-last.z));ordered.push(remaining.shift());}
 }
 RIVER_POLYLINE.splice(0,RIVER_POLYLINE.length,...ordered);
 return SITE;
}
export function riverCenterZ(x){
 const p=RIVER_POLYLINE;
 if(p.length===0)return SITE.z;
 if(x<=p[0].x)return p[0].z;
 if(x>=p.at(-1).x)return p.at(-1).z;
 for(let i=1;i<p.length;i++)if(x<=p[i].x){
  const t=(x-p[i-1].x)/(p[i].x-p[i-1].x);
  const v=t*t*(3-2*t);
  return p[i-1].z+(p[i].z-p[i-1].z)*v+6*Math.sin(t*Math.PI);
 }
 return SITE.z;
}
export function riverHalfWidth(x){return 18+3.3*Math.sin((x-SITE.x)*.018+1);}
export function riverDistance(x,z){
 if(ACTIVE_CAMPAIGN_SITE){
  if(RIVER_POLYLINE.length<2)return Infinity;
  let best=Infinity;
  for(let i=1;i<RIVER_POLYLINE.length;i++){
   const a=RIVER_POLYLINE[i-1],b=RIVER_POLYLINE[i],dx=b.x-a.x,dz=b.z-a.z;
   const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
   best=Math.min(best,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));
  }
  return best;
 }
 return Math.abs(z-riverCenterZ(x));
}
export function terrainHeight(x,z){
 const original=originalWorldHeight(x,z);
 const d=riverDistance(x,z),width=riverHalfWidth(x);
 // Lower riverbed through banks while leaving distant landscape unchanged.
 const cut=21*(1-smoothstep(width*.78,width+22,d));
 return original-cut;
}
export function waterHeight(x){return originalWorldHeight(x,riverCenterZ(x))-12.2;}
export function terrainSlope(x,z,step=4){const hx=(terrainHeight(x+step,z)-terrainHeight(x-step,z))/(2*step),hz=(terrainHeight(x,z+step)-terrainHeight(x,z-step))/(2*step);return Math.hypot(hx,hz);}

// Features use a continuous river crossed by a bridge and a connected north/south road.
// A river tile is impassable except at the bridge, matching its visible geometry.
export const FEATURES=[
 ...RIVER_PATH_CELLS.filter(c=>c.q!==0||c.r!==0).map(c=>({...c,type:'river',obstacle:true,movement:'impassable',blocksLineOfSight:false})),
 {q:0,r:0,type:'bridge',obstacle:false,movement:'open',blocksLineOfSight:false},
 ...[-4,-3,-2,-1,1,2,3,4].map(r=>({q:0,r,type:'road',obstacle:false,movement:'open',blocksLineOfSight:false})).filter(c=>!RIVER_PATH_CELLS.some(w=>w.q===c.q&&w.r===c.r)),
 {q:1,r:-3,type:'road',obstacle:false,movement:'open',blocksLineOfSight:false},
 {q:-1,r:3,type:'road',obstacle:false,movement:'open',blocksLineOfSight:false},
 ...[[-4,-1],[-3,-1],[-3,-2],[-2,-2],[-2,-3],[-1,-4],[3,-3],[4,-4],[-4,3],[-3,3],[-1,4],[2,3],[3,2],[4,1]].map(([q,r])=>({q,r,type:'woods',obstacle:true,movement:'impassable',blocksLineOfSight:true})),
 ...[[1,3],[2,2],[-2,1],[-1,-3]].map(([q,r])=>({q,r,type:'rock',obstacle:true,movement:'impassable',blocksLineOfSight:true})),
];
export const FEATURES_BY_KEY=new Map(FEATURES.map(cell=>[keyOf(cell.q,cell.r),cell]));
export function getFeature(q,r){return FEATURES_BY_KEY.get(keyOf(q,r))??null;}
export function isOccupiedByNature(q,r){return Boolean(getFeature(q,r)?.obstacle);}
export function cellNeighbors(q,r){return GRID_DIRECTIONS.map(([dq,dr])=>({q:q+dq,r:r+dr})).filter(c=>validHex(c.q,c.r));}
export function tileMaterial(q,r){
 const seed=seeded(`tile:${q}:${r}`),center=axialWorld(q,r),y=terrainHeight(center.x,center.z),slope=terrainSlope(center.x,center.z);
 const feature=getFeature(q,r)?.type;
 if(feature==='river'||feature==='bridge')return [0.35,0.42,0.28];
 if(feature==='road')return [0.35+seed*.06,0.39+seed*.04,0.29+seed*.03];
 if(feature==='woods')return [0.20+seed*.065,0.32+seed*.055,0.19+seed*.035];
 if(feature==='rock'||slope>0.6)return [0.37+seed*.04,0.38+seed*.04,0.28+seed*.04];
 const h=clamp((y-35)/155,0,1);
 return [0.29+seed*.055+h*.055,0.39+seed*.065-h*.035,0.23+seed*.04];
}
