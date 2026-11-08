/** Low-level portable authoring primitives: each produced face is 3D geometry. */
import {terrainHeight, originalWorldHeight,axialWorld,hexCornerWorld,SITE, seeded,clamp,allHexes,getFeature,riverCenterZ,riverHalfWidth,riverDistance,waterHeight,terrainSlope,cellNeighbors,keyOf,RIVER_PATH_CELLS,RIVER_POLYLINE,ACTIVE_CAMPAIGN_SITE,FEATURES,GRID_DIRECTIONS,tileMaterial} from './terrain-world.mjs';
export const add3=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const normal3=v=>{const l=Math.hypot(...v)||1;return v.map(c=>c/l);};
const tint=(color,mul)=>color.map(v=>clamp(v*mul,0,1));
const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
export class MeshBuilder{
 constructor(){this.values=[];this.triangles=0;}
 triNormals(a,b,c,color,normals){
  for(let i=0;i<3;i++){const p=[a,b,c][i],n=normals[i];this.values.push(p[0],p[1],p[2],n[0],n[1],n[2],...color);}
  this.triangles++;
 }
 quadNormals(a,b,c,d,color,normals){this.triNormals(a,b,c,color,[normals[0],normals[1],normals[2]]);this.triNormals(a,c,d,color,[normals[0],normals[2],normals[3]]);}
 tri(a,b,c,color,reverse=false){
  const n=normal3(cross3(sub3(b,a),sub3(c,a)));
  const shade=reverse?-1:1;
  for(const p of [a,b,c])this.values.push(p[0],p[1],p[2],n[0]*shade,n[1]*shade,n[2]*shade,...color);
  this.triangles++;
 }
 quad(a,b,c,d,color){this.tri(a,b,c,color);this.tri(a,c,d,color);}
 polygon(v,color){for(let i=1;i<v.length-1;i++)this.tri(v[0],v[i],v[i+1],color);}
 band(a,b,width,color,offset=0){
  const dx=b[0]-a[0],dz=b[2]-a[2],n=Math.hypot(dx,dz)||1;
  const rx=-dz/n*width/2,rz=dx/n*width/2;
  const p=(x,y,z)=>[x,y+offset,z];
  this.quad(p(a[0]+rx,a[1],a[2]+rz),p(b[0]+rx,b[1],b[2]+rz),p(b[0]-rx,b[1],b[2]-rz),p(a[0]-rx,a[1],a[2]-rz),color);
 }
 disk(cx,cy,cz,rx,rz,color,steps=12){
  const m=[cx,cy,cz];for(let i=0;i<steps;i++){const a=i/steps*Math.PI*2,b=(i+1)/steps*Math.PI*2;
    this.tri(m,[cx+rx*Math.cos(a),cy,cz+rz*Math.sin(a)],[cx+rx*Math.cos(b),cy,cz+rz*Math.sin(b)],color);}
 }
 tube(a,b,ra,rb,col,steps=8){
  const axis=normal3(sub3(b,a)),other=Math.abs(axis[1])<.93?[0,1,0]:[1,0,0];
  const tangent=normal3(cross3(axis,other)),bitangent=normal3(cross3(axis,tangent));
  const ring=(c,r,i)=>{const t=i/steps*Math.PI*2;return add3(c,add3(tangent.map(v=>v*Math.cos(t)*r),bitangent.map(v=>v*Math.sin(t)*r)));};
  for(let i=0;i<steps;i++){const j=(i+1)%steps;this.quad(ring(a,ra,i),ring(a,ra,j),ring(b,rb,j),ring(b,rb,i),col);}
  if(rb===0){return;}
  for(let i=0;i<steps;i++){const j=(i+1)%steps;this.tri(a,ring(a,ra,j),ring(a,ra,i),col);this.tri(b,ring(b,rb,i),ring(b,rb,j),col);}
 }
 cone(cx,cy,cz,r,h,color,steps=8){this.tube([cx,cy,cz],[cx,cy+h,cz],r,0,color,steps);}
 ball(cx,cy,cz,rx,ry,rz,color,rings=5,sides=8){
  for(let i=0;i<rings;i++){
   const a=i/rings*Math.PI-Math.PI/2,b=(i+1)/rings*Math.PI-Math.PI/2;
   for(let j=0;j<sides;j++){
    const u=j/sides*Math.PI*2,v=(j+1)/sides*Math.PI*2;
    const p=(lat,lon)=>[cx+Math.cos(lat)*Math.cos(lon)*rx,cy+Math.sin(lat)*ry,cz+Math.cos(lat)*Math.sin(lon)*rz];
    this.quad(p(a,u),p(b,u),p(b,v),p(a,v),color);
   }
  }
 }
 box(cx,cy,cz,w,h,d,color){
  const x0=cx-w/2,x1=cx+w/2,y0=cy-h/2,y1=cy+h/2,z0=cz-d/2,z1=cz+d/2;
  const v=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
  for(const f of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]])this.quad(...f.map(k=>v[k]),color);
 }
 finish(){return {vertices:new Float32Array(this.values),triangles:this.triangles};}
}

function naturalHeight(x,z,offset=0){return terrainHeight(x,z)+offset;}
function surfaceNormal(x,z){const e=4,hx=(terrainHeight(x+e,z)-terrainHeight(x-e,z))/(2*e),hz=(terrainHeight(x,z+e)-terrainHeight(x,z-e))/(2*e);return normal3([-hx,1,-hz]);}
function normAt(p){return surfaceNormal(SITE.x+p[0],SITE.z+p[2]);}
const local=(x,z,dy=0)=>[x-SITE.x,naturalHeight(x,z,dy),z-SITE.z];
const water=(x,z,dy=0)=>[x-SITE.x,waterHeight(x)+dy,z-SITE.z];
function cellSurface(q,r,dy=0){const p=axialWorld(q,r);return local(p.x,p.z,dy);}
function cellFraction(q,r,scale,angle,dy=0){const center=axialWorld(q,r);const x=center.x+Math.cos(angle)*SITE.hexSize*scale,z=center.z+Math.sin(angle)*SITE.hexSize*scale;return local(x,z,dy);}

function addWorldGround(b){
 const W=1080,D=1040,div=118;
 const colA=[.18,.27,.19],colB=[.28,.35,.24],colR=[.31,.32,.27];
 for(let ix=0;ix<div;ix++){
  const x0=SITE.x+(-W+2*W*ix/div),x1=SITE.x+(-W+2*W*(ix+1)/div);
  for(let iz=0;iz<div;iz++){
   const z0=SITE.z+(-D+2*D*iz/div),z1=SITE.z+(-D+2*D*(iz+1)/div);
   const s=seeded(`${ix}:${iz}`),avgx=(x0+x1)/2,avgz=(z0+z1)/2;
   const slope=terrainSlope(avgx,avgz,8),color=mix(colA,colB,(Math.sin(avgx*.012+avgz*.01)+1)*.22+s*.33);
   const c=mix(color,colR,clamp((slope-.3)*.7,0,.65));
   const a=local(x0,z0,-2.4),d=local(x0,z1,-2.4),e=local(x1,z0,-2.4),f=local(x1,z1,-2.4);
   const n0=surfaceNormal(x0,z0),n1=surfaceNormal(x1,z0),n2=surfaceNormal(x1,z1),n3=surfaceNormal(x0,z1);
   b.triNormals(a,e,f,tint(c,1.03),[n0,n1,n2]);b.triNormals(a,f,d,tint(c,.99),[n0,n2,n3]);
  }
 }
}

function addHexTile(b,q,r){
 const col=tileMaterial(q,r),feat=getFeature(q,r),seed=seeded(`hex:${q}:${r}`);
 const light=feat?.type==='woods'?.68:feat?.type==='river'?.91:1;
 const fill=mix(tint(col,light),[.53,.49,.35],seed*.12);
 const n=6*5,rings=[.0,.28,.64,.91,.975],heights=[2.4,2.55,2.7,2.95,3.1];
 // Radial mesh follows the sampled world height at every vertex.
 for(let ring=1;ring<rings.length;ring++){
  for(let i=0;i<n;i++){
   const a=i/n*Math.PI*2,beta=(i+1)/n*Math.PI*2;
   const p0=cellFraction(q,r,rings[ring-1],a,heights[ring-1]),p1=cellFraction(q,r,rings[ring-1],beta,heights[ring-1]);
   const p2=cellFraction(q,r,rings[ring],beta,heights[ring]),p3=cellFraction(q,r,rings[ring],a,heights[ring]);
   const cr=tint(fill,.92+.045*Math.sin(i*.87+seed*15));b.quadNormals(p0,p1,p2,p3,cr,[normAt(p0),normAt(p1),normAt(p2),normAt(p3)]);
  }
 }
 // Beveled, bronze-inlaid edges with dark-earth skirts, not flat overlay polygons.
 for(let i=0;i<n;i++){
  const a=i/n*Math.PI*2,beta=(i+1)/n*Math.PI*2;
  const v0=cellFraction(q,r,.975,a,3.1),v1=cellFraction(q,r,.975,beta,3.1);
  const v2=cellFraction(q,r,.995,beta,1.75),v3=cellFraction(q,r,.995,a,1.75);
  b.quad(v0,v1,v2,v3,[.25,.23,.16]);
  const k0=cellFraction(q,r,.999,a,-.65),k1=cellFraction(q,r,.999,beta,-.65);
  b.quad(v3,v2,k1,k0,[.155,.17,.12]);
 }
 // top inset trim, thin enough to keep the underlying 3D relief visible
 for(let i=0;i<6;i++){
  const a0=i*Math.PI/3,a1=(i+1)*Math.PI/3;
  const aa=cellFraction(q,r,.96,a0,3.45),bb=cellFraction(q,r,.96,a1,3.45);
  b.band(aa,bb,.95,[.55,.47,.31]);
 }
}

function addDirtRoad(b){
 if(ACTIVE_CAMPAIGN_SITE){
  const roadCells=FEATURES.filter(f=>f.type==='road'||f.type==='bridge');
  const roadSet=new Set(roadCells.map(c=>`${c.q},${c.r}`));
  for(const a of roadCells)for(const [dq,dr] of GRID_DIRECTIONS){
   const key=`${a.q+dq},${a.r+dr}`;
   if(!roadSet.has(key)||`${a.q},${a.r}`>=key)continue;
   const from=axialWorld(a.q,a.r),to=axialWorld(a.q+dq,a.r+dr);
   b.band(local(from.x,from.z,4.2),local(to.x,to.z,4.2),18,[.46,.37,.24]);
   b.band(local(from.x,from.z,4.8),local(to.x,to.z,4.8),10,[.59,.51,.36]);
  }
  return;
 }

 const rvalues=[-5,-4,-3,-2,-1,0,1,2,3,4,5];
 const smooth=[];
 for(let i=0;i<rvalues.length-1;i++){
  const a=axialWorld(0,rvalues[i]),z=axialWorld(0,rvalues[i+1]);
  for(let t=0;t<9;t++){
   const u=t/9;
   const x=a.x*(1-u)+z.x*u,z0=a.z*(1-u)+z.z*u;
   const winding=3*Math.sin(i*2.7+u*Math.PI*2);
   smooth.push([x,z0+winding]);
  }
 }
 smooth.push(Object.values(axialWorld(0,5)));
 for(let i=1;i<smooth.length;i++){
  const [x,z]=smooth[i-1],[x2,z2]=smooth[i];
  if(Math.abs(x-SITE.x)<29||Math.abs(x2-SITE.x)<29)continue;
  const a=local(x,z,3.5),c=local(x2,z2,3.5);
  b.band(a,c,24,[.34,.29,.19]);b.band(local(x,z,4.3),local(x2,z2,4.3),17,[.52,.43,.29]);
  if(i%3===0){ // raised cobbles and wheel ruts follow the same terrain
   const m=(x+x2)/2,n=(z+z2)/2,base=naturalHeight(m,n,4.8);
   const k=seeded(`cobble${i}`);
   for(let j=0;j<3;j++){
    const dx=(j-1)*5.8+(k-.5)*3;
    b.ball(m-SITE.x+dx,base,n-SITE.z+Math.cos(i*j)*1.7,2.4,1.0,3.0,[.55+k*.1,.50+k*.08,.38+k*.06],3,6);
   }
  }
 }
 // A small branching track joins the main road without creating isolated decals.
 const branches=[[axialWorld(0,-4),axialWorld(1,-3)],[axialWorld(0,3),axialWorld(-1,3)]];
 for(const [a,c] of branches){const steps=14;for(let i=0;i<steps;i++){const p=i/steps,q=(i+1)/steps;const k=t=>local(a.x*(1-t)+c.x*t,a.z*(1-t)+c.z*t,3.45);b.band(k(p),k(q),13,[.49,.41,.27]);}}
}

function addWatercourse(b){
 if(ACTIVE_CAMPAIGN_SITE){
  for(let i=1;i<RIVER_POLYLINE.length;i++){
   const a=RIVER_POLYLINE[i-1],c=RIVER_POLYLINE[i];
   const steps=Math.max(2,Math.ceil(Math.hypot(c.x-a.x,c.z-a.z)/18));
   for(let j=0;j<steps;j++){
    const t=j/steps,u=(j+1)/steps;
    const x=a.x+(c.x-a.x)*t,z=a.z+(c.z-a.z)*t;
    const xx=a.x+(c.x-a.x)*u,zz=a.z+(c.z-a.z)*u;
    const y=originalWorldHeight(x,z)-11,yy=originalWorldHeight(xx,zz)-11;
    b.band([x-SITE.x,y,z-SITE.z],[xx-SITE.x,yy,zz-SITE.z],37,[.18,.38,.43]);
    b.band([x-SITE.x,y+.4,z-SITE.z],[xx-SITE.x,yy+.4,zz-SITE.z],1.3,[.63,.74,.66]);
   }
  }
  return;
 }

 const start=SITE.x-590,end=SITE.x+590,steps=210;
 const sandy=[.38,.36,.29],waterBlue=[.20,.42,.45],seaGreen=[.20,.36,.33],foam=[.62,.73,.66];
 for(let i=0;i<steps;i++){
  const x=start+(end-start)*i/steps,xx=start+(end-start)*(i+1)/steps;
  const p=(u,side,extra=0)=>{
    const z=riverCenterZ(u)+side*(riverHalfWidth(u)+extra);
    return [u-SITE.x,extra>0?terrainHeight(u,z)+4.5:waterHeight(u)+(extra===0?1.2:0),z-SITE.z];
  };
  // shallow gravel shelves give a physical bank transition.
  b.quad(p(x,-1,14),p(xx,-1,14),p(xx,-1,3),p(x,-1,3),sandy);
  b.quad(p(x,1,3),p(xx,1,3),p(xx,1,14),p(x,1,14),sandy);
  const z0=riverCenterZ(x),z1=riverCenterZ(xx),w0=riverHalfWidth(x),w1=riverHalfWidth(xx);
  const left=[x-SITE.x,waterHeight(x)+1.0,z0-SITE.z-w0];
  const right=[x-SITE.x,waterHeight(x)+1.0,z0-SITE.z+w0];
  const l2=[xx-SITE.x,waterHeight(xx)+1.0,z1-SITE.z-w1];
  const r2=[xx-SITE.x,waterHeight(xx)+1.0,z1-SITE.z+w1];
  const c=mix(waterBlue,seaGreen,.24+.22*Math.sin(i*.15));
  b.quad(left,l2,r2,right,c);
  if(i%5===0){
   for(const side of [-.6,.32]){
    const s0=[x-SITE.x,waterHeight(x)+1.7,z0-SITE.z+w0*side],s1=[xx-SITE.x,waterHeight(xx)+1.7,z1-SITE.z+w1*side];
    b.band(s0,s1,.75,foam);
   }
  }
  if(i%19===0){
   for(const sign of [-1,1]){
    const z=z0+sign*(w0+9),y=terrainHeight(x,z)+5;
    b.ball(x-SITE.x,y,z-SITE.z,3.5,2.0,4.8,[.50,.49,.41],4,7);
   }
  }
 }
}

function addBridge(b){
 // Draw a real bridge on EACH passable crossing, not at a hard-coded center hex.
 const crossings=ACTIVE_CAMPAIGN_SITE?FEATURES.filter(f=>f.type==='bridge'):[{q:0,r:0}];
 for(const crossing of crossings){
  const center=axialWorld(crossing.q,crossing.r);
  const waterNeighbors=GRID_DIRECTIONS.map(([dq,dr])=>getFeature(crossing.q+dq,crossing.r+dr))
   .filter(f=>f&&(f.type==='river'||f.riverCrossing))
   .map(f=>axialWorld(f.q,f.r));
  let flow;
  if(waterNeighbors.length>=2){
   const first=waterNeighbors[0],last=waterNeighbors.at(-1);
   flow=normal3([last.x-first.x,0,last.z-first.z]);
  }else if(waterNeighbors.length){
   flow=normal3([waterNeighbors[0].x-center.x,0,waterNeighbors[0].z-center.z]);
  }else{
   const angle=Number.isFinite(crossing.direction)?crossing.direction:0;
   flow=[Math.cos(angle),0,Math.sin(angle)];
  }
  if(Math.hypot(flow[0],flow[2])<.01)flow=[1,0,0];
  const forward=normal3([-flow[2],0,flow[0]]),right=[-forward[2],0,forward[0]];
  const half=Math.max(41,SITE.hexSize*.83);
  const bankAt=t=>terrainHeight(center.x+forward[0]*t,center.z+forward[2]*t);
  const high=Math.max(terrainHeight(center.x,center.z)+11,bankAt(-half)+5,bankAt(half)+5);
  const segment=(t,w,dy=0)=>[
   center.x-SITE.x+forward[0]*t+right[0]*w,
   high+dy,
   center.z-SITE.z+forward[2]*t+right[2]*w
  ];
  // Planked Roman trestle, visible at the true river hex with bank abutments.
  for(const width of [-15,15])b.band(segment(-half,width),segment(half,width),3,[.34,.23,.14]);
  const planks=Math.max(8,Math.round(half*2/8));
  for(let j=0;j<planks;j++){
   const t=-half+(j+.5)*2*half/planks;
   b.band(segment(t,-18,1.4),segment(t,18,1.4),6.4,j%2?[.59,.40,.25]:[.49,.33,.21]);
  }
  for(const t of [-half*.76,-half*.28,half*.28,half*.76])for(const side of [-19,19]){
   b.tube(segment(t,side,-10),segment(t,side,15),1.6,1.4,[.38,.25,.15],7);
  }
  for(const side of [-19,19])b.band(segment(-half*.92,side,15),segment(half*.92,side,15),2.6,[.43,.29,.17]);
  for(const t of [-half,half])for(const side of [-14,14])b.box(...segment(t,side,-5),14,15,14,[.47,.45,.39]);
 }
}
function addWoods(b,q,r){
 const c=axialWorld(q,r),n=9+Math.floor(seeded(`trees:${q}:${r}`)*4);
 const colors=[[.20,.32,.17],[.27,.39,.20],[.19,.29,.20],[.34,.43,.22],[.29,.38,.23]];
 for(let i=0;i<n;i++){
  const a=seeded(`tree-angle:${q}:${r}:${i}`)*Math.PI*2,rad=SITE.hexSize*.66*Math.sqrt(seeded(`tree-radius:${q}:${r}:${i}`));
  const x=c.x+Math.cos(a)*rad,z=c.z+Math.sin(a)*rad,y=naturalHeight(x,z,4);
  const k=seeded(`tree-shape:${q}:${r}:${i}`),scale=1.14+k*.92;
  const pine=k<.69;
  b.disk(x-SITE.x,y-.25,z-SITE.z,6*scale,5*scale,[.16,.24,.12],9);
  b.tube([x-SITE.x,y,z-SITE.z],[x-SITE.x+1.3*scale,y+20*scale,z-SITE.z],2.2*scale,1.4*scale,[.27,.21,.13],7);
  if(pine){
   for(let k=0;k<3;k++){
    const ty=y+6*scale+k*9*scale,r0=(13-k*2.9)*scale;
    b.cone(x-SITE.x,ty,z-SITE.z,r0,25*scale,colors[(i+k)%colors.length],8);
   }
  }else{
   const col=colors[(i+3)%colors.length];
   b.ball(x-SITE.x-5*scale,y+22*scale,z-SITE.z,10*scale,10*scale,10*scale,col,4,7);
   b.ball(x-SITE.x+6*scale,y+27*scale,z-SITE.z+2*scale,12*scale,12*scale,9*scale,tint(col,1.1),5,8);
   b.ball(x-SITE.x,y+36*scale,z-SITE.z,9*scale,9*scale,8*scale,tint(col,.96),5,8);
  }
 }
 // Rocks and fallen trunks break the repeating conifer silhouette.
 for(let j=0;j<4;j++){
  const theta=seeded(`stone:${q}:${r}:${j}`)*Math.PI*2,rr=SITE.hexSize*.52*seeded(`rr:${q}:${r}:${j}`),x=c.x+Math.cos(theta)*rr,z=c.z+Math.sin(theta)*rr;
  b.ball(x-SITE.x,terrainHeight(x,z)+4,z-SITE.z,3.0+j%2*1.5,2.5,4.0,[.40,.39,.32],3,6);
 }
}
function addRockfield(b,q,r){
 const c=axialWorld(q,r);
 for(let j=0;j<7;j++){
  const a=seeded(`rocka:${q},${r}:${j}`)*Math.PI*2,s=seeded(`rocks:${q},${r}:${j}`),rr=SITE.hexSize*.60*s;
  const x=c.x+Math.cos(a)*rr,z=c.z+Math.sin(a)*rr,y=terrainHeight(x,z)+5;
  b.ball(x-SITE.x,y,z-SITE.z,5+s*7,4+s*6,6+s*6,j%2?[.45,.43,.36]:[.37,.40,.34],4,7);
 }
}
function addFieldDressing(b,q,r){
 const f=getFeature(q,r),c=axialWorld(q,r);if(f?.type==='bridge'||f?.type==='river'||f?.type==='woods')return;
 for(let i=0;i<9;i++){
  const a=seeded(`grass-a:${q},${r}:${i}`)*Math.PI*2,rad=48*Math.sqrt(seeded(`grass-r:${q},${r}:${i}`)),x=c.x+Math.cos(a)*rad,z=c.z+Math.sin(a)*rad;
  if((ACTIVE_CAMPAIGN_SITE?riverDistance(x,z):Math.abs(z-riverCenterZ(x)))<riverHalfWidth(x)+16)continue;
  const y=terrainHeight(x,z)+3.7;
  const s=seeded(`grass-s:${q},${r}:${i}`),slope=terrainSlope(x,z,6);
  if(s>.8||slope>.6){b.ball(x-SITE.x,y,z-SITE.z,2.6+s*4,1.6+s*3,2+s*4,[.44,.42,.32],3,6);}
  else{
   for(let j=0;j<3;j++){
    const ang=a+j*2.09;b.tube([x-SITE.x,y,z-SITE.z],[x-SITE.x+Math.cos(ang)*2.1,y+3.4+s*4,z-SITE.z+Math.sin(ang)*2.1],.55,.05,j%2?[.32,.45,.22]:[.40,.48,.26],4);
   }
  }
 }
}
export function authorWorldScene(){
 const b=new MeshBuilder();addWorldGround(b);
 for(const h of allHexes())addHexTile(b,h.q,h.r);
 addDirtRoad(b);addWatercourse(b);addBridge(b);
 for(const h of allHexes()){
  const f=getFeature(h.q,h.r);
  if(f?.type==='woods')addWoods(b,h.q,h.r);
  else if(f?.type==='rock')addRockfield(b,h.q,h.r);
  else addFieldDressing(b,h.q,h.r);
 }
 return b.finish();
}
export function authorHighlightScene({selected=null,moves=[],targets=[],eligible=[]}={}){
 const b=new MeshBuilder();const add=(q,r,color,thickness)=>{
  for(let i=0;i<6;i++){
   const aa=hexCornerWorld(q,r,i,.82),bb=hexCornerWorld(q,r,(i+1)%6,.82);
   b.band(local(aa.x,aa.z,6.3),local(bb.x,bb.z,6.3),thickness,color);
  }
 };
 for(const c of moves)add(c.q,c.r,[.76,.90,.37],2.1);
 for(const c of targets)add(c.q,c.r,[.94,.34,.25],3.4);
 for(const c of eligible)add(c.q,c.r,[.93,.70,.30],2.5);
 if(selected)add(selected.q,selected.r,[1,.87,.42],4.2);
 return b.finish();
}
