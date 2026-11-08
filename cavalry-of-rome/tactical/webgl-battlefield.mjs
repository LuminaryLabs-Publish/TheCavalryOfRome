/**
 * Self-contained WebGL2 scene. Real triangle meshes follow the Cavalry of Rome
 * heightfield; custom authored GLB troop minis are loaded and instanced in 3D.
 * No image-based terrain approximation or external JavaScript dependencies.
 */
import {SITE,axialWorld,allHexes,terrainHeight,seeded,clamp,hexCornerWorld} from './terrain-world.mjs';
import {MeshBuilder,authorWorldScene,authorHighlightScene} from './sculpt-geometry.mjs';

const VERT=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec3 aColor;
uniform mat4 uVP;
uniform mat4 uModel;
out vec3 vNormal;
out vec3 vColor;
out vec3 vWorld;
void main(){ vec4 world=uModel*vec4(aPos,1.0);vWorld=world.xyz;vNormal=mat3(uModel)*aNormal;vColor=aColor;gl_Position=uVP*world; }`;
const FRAG=`#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vColor;
in vec3 vWorld;
uniform vec3 uEye;
uniform float uHighlight;
out vec4 frag;
void main(){
 vec3 n=normalize(vNormal);
 if(n.y<0.0)n=-n;
 vec3 sun=normalize(vec3(-0.53,0.85,0.31));
 float diff=max(dot(n,sun),0.0);
 float warm=max(dot(n,normalize(vec3(0.23,0.45,-0.73))),0.0);
 vec3 col=vColor*(0.52+diff*0.62)+vColor*vec3(0.13,0.095,0.04)*warm;
 float haze=smoothstep(1150.0,2900.0,length(vWorld-uEye));
 col=mix(col,vec3(0.20,0.27,0.23),haze*0.58);
 if(uHighlight>0.5)col=vColor*1.24;
 col=pow(clamp(col,0.0,1.0),vec3(0.91));
 frag=vec4(col,1.0);
}`;
function compile(gl,type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader;}
function program(gl){const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,VERT));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;}
const norm=(v)=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const ID=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function perspective(deg,aspect,near,far){const f=1/Math.tan(deg*Math.PI/360);const o=new Float32Array(16);o[0]=f/aspect;o[5]=f;o[10]=(far+near)/(near-far);o[11]=-1;o[14]=2*far*near/(near-far);return o;}
function lookAt(eye,aim){let z=norm(sub(eye,aim)),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function multiply(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];out[c*4+r]=s;}return out;}
function transform(tx,ty,tz,scale=1,spin=0){const c=Math.cos(spin)*scale,s=Math.sin(spin)*scale;return new Float32Array([c,0,-s,0,0,scale,0,0,s,0,c,0,tx,ty,tz,1]);}
function project(point,VP,width,height){const [x,y,z]=point;let cx=VP[0]*x+VP[4]*y+VP[8]*z+VP[12],cy=VP[1]*x+VP[5]*y+VP[9]*z+VP[13],cw=VP[3]*x+VP[7]*y+VP[11]*z+VP[15];if(cw<=0)return null;return {x:(cx/cw*.5+.5)*width,y:(.5-cy/cw*.5)*height,w:cw};}
function createGpuMesh(gl,data){
 const vao=gl.createVertexArray(),buffer=gl.createBuffer();
 gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data.vertices,gl.STATIC_DRAW);
 const stride=9*4;
 gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride,0);
 gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,stride,3*4);
 gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,3,gl.FLOAT,false,stride,6*4);
 gl.bindVertexArray(null);return {vao,buffer,count:data.vertices.length/9,triangles:data.triangles};
}
function disposeGpuMesh(gl,mesh){if(!mesh)return;gl.deleteBuffer(mesh.buffer);gl.deleteVertexArray(mesh.vao);}
export function parseGLB(buffer){
 const dv=new DataView(buffer),u8=new Uint8Array(buffer);
 if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2)throw new Error('Invalid glTF binary version');
 let ptr=12,json=null,bin=null;
 while(ptr<dv.byteLength){const len=dv.getUint32(ptr,true),kind=dv.getUint32(ptr+4,true);ptr+=8;
  if(kind===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(u8.subarray(ptr,ptr+len)));
  if(kind===0x004e4942)bin=u8.subarray(ptr,ptr+len);
  ptr+=len;
 }
 if(!json||!bin)throw new Error('Missing glTF buffers');
 const view=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
 const components={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
 function accessor(index){
  const a=json.accessors[index],v=json.bufferViews[a.bufferView];const num={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
  const len=components[a.componentType],stride=v.byteStride||len*num,offset=(v.byteOffset||0)+(a.byteOffset||0),out=[];
  for(let i=0;i<a.count;i++){
   const arr=[];for(let j=0;j<num;j++){
    const at=offset+i*stride+j*len;let n;
    if(a.componentType===5126)n=view.getFloat32(at,true);
    else if(a.componentType===5125)n=view.getUint32(at,true);
    else if(a.componentType===5123)n=view.getUint16(at,true);
    else if(a.componentType===5122)n=view.getInt16(at,true);
    else if(a.componentType===5121)n=view.getUint8(at);
    else if(a.componentType===5120)n=view.getInt8(at);
    else throw new Error('Unsupported accessor component type');
    if(a.normalized){if(a.componentType===5121)n/=255;else if(a.componentType===5123)n/=65535;else if(a.componentType===5120)n=Math.max(-1,n/127);else if(a.componentType===5122)n=Math.max(-1,n/32767);}
    arr.push(n);
   }out.push(num===1?arr[0]:arr);
  }return out;
 }
 const b=new MeshBuilder();for(const mesh of json.meshes??[]){for(const primitive of mesh.primitives??[]){
  if(primitive.mode!=null&&primitive.mode!==4)throw new Error('Only glTF triangles supported');
  const p=accessor(primitive.attributes.POSITION),c=primitive.attributes.COLOR_0!=null?accessor(primitive.attributes.COLOR_0):null;
  const ids=primitive.indices!=null?accessor(primitive.indices):Array.from({length:p.length},(_,i)=>i);
  for(let i=0;i<ids.length;i+=3){const a=ids[i],bb=ids[i+1],cc=ids[i+2];
   const color=c?c[a].slice(0,3):[.72,.66,.52];b.tri(p[a],p[bb],p[cc],color);
  }
 }}return b.finish();
}
function readEmbedded(path){const encoded=globalThis.__CAVALRY_EMBEDDED_MODELS?.[path];if(!encoded)return null;const raw=atob(encoded),data=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)data[i]=raw.charCodeAt(i);return data.buffer;}
async function loadMiniature(gl,path){const packed=readEmbedded(path);const response=packed??await (await fetch(path)).arrayBuffer();return createGpuMesh(gl,parseGLB(response));}

function authorBases(state){
 const b=new MeshBuilder();
 for(const u of state.battle.units){if(u.status!=='ready'||u.strength<=0)continue;
  const p=axialWorld(u.q,u.r),x=p.x-SITE.x,z=p.z-SITE.z,y=terrainHeight(p.x,p.z)+5.2;
  const roman=u.side==='attacker',trim=roman?[.76,.49,.27]:[.29,.53,.69];
  b.disk(x,y-.5,z,35,35,[.095,.11,.09],16);
  b.tube([x,y,z],[x,y+4,z],30,29,[.19,.17,.13],16);
  b.disk(x,y+4.3,z,28.7,28.7,trim,16);
  b.disk(x,y+4.6,z,26,26,roman?[.26,.23,.18]:[.20,.29,.30],16);
  // A raised bronze standard makes each formation readable from a flying camera.
  b.tube([x+18,y+4,z-10],[x+18,y+42,z-10],.95,.8,roman?[.71,.52,.27]:[.59,.61,.53],7);
  const flag=roman?[.64,.16,.13]:[.16,.35,.47],yy=y+36;
  b.quad([x+18,yy,z-10],[x+31,yy-2,z-10],[x+31,yy+7,z-10],[x+18,yy+9,z-10],flag);
  b.disk(x,y+4.8,z,1.9,1.9,[.84,.66,.34],8);
 }
 return b.finish();
}

export function createBattlefield({canvas,labels,onHexClick,onStatus=()=>{}}){
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,depth:true,powerPreference:'high-performance'});
 if(!gl)throw new Error('WebGL2 unavailable: a GPU-capable browser is required');
 const shader=program(gl);gl.useProgram(shader);
 const loc={VP:gl.getUniformLocation(shader,'uVP'),model:gl.getUniformLocation(shader,'uModel'),eye:gl.getUniformLocation(shader,'uEye'),highlight:gl.getUniformLocation(shader,'uHighlight')};
 gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.clearColor(.11,.18,.16,1);
 const world=createGpuMesh(gl,authorWorldScene());
 let highlights=null,bases=null,cardState=null,selectedId=null,eligible=[],moves=[],targets=[];
 let camYaw=-0.21,camPitch=.96,camDistance=1220,viewProj=ID(),eye=[0,0,0];
 const models=new Map(),animations=new Map();let hoveredId=null;let raf=0,live=true,ready=false,lastSize={w:0,h:0};
 const renderedHexes=allHexes().map(c=>({...c,world:axialWorld(c.q,c.r)}));
 function setState(state,{selectedUnitId=null,eligibleUnits=[],reachableCells=[],attackable=[]}={}){
  if(!state)return;
  if(cardState){
   const old=new Map(cardState.battle.units.map(u=>[u.id,u]));
   for(const unit of state.battle.units){
    const prev=old.get(unit.id);if(prev&&(prev.q!==unit.q||prev.r!==unit.r))animations.set(unit.id,{from:{q:prev.q,r:prev.r},to:{q:unit.q,r:unit.r},started:performance.now(),duration:480});
   }
  }
  cardState=state;selectedId=selectedUnitId;eligible=eligibleUnits;moves=reachableCells;targets=attackable;
  disposeGpuMesh(gl,bases);bases=createGpuMesh(gl,authorBases(state));
  disposeGpuMesh(gl,highlights);
  const found=state.battle.units.find(u=>u.id===selectedUnitId);
  highlights=createGpuMesh(gl,authorHighlightScene({selected:found,moves:reachableCells,targets:attackable.map(u=>({q:u.q,r:u.r})),eligible:eligibleUnits.map(u=>({q:u.q,r:u.r}))}));
  buildLabels();
 }
 function modelPosition(unit,now){
  const a=animations.get(unit.id);if(!a)return axialWorld(unit.q,unit.r);
  const u=clamp((now-a.started)/a.duration,0,1),t=u*u*(3-2*u),from=axialWorld(a.from.q,a.from.r),to=axialWorld(a.to.q,a.to.r);
  if(u>=1)animations.delete(unit.id);
  return {x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t};
 }
 function buildLabels(){
  labels.replaceChildren();if(!cardState)return;
  for(const unit of cardState.battle.units){if(unit.status!=='ready'||unit.strength<=0)continue;
   const tag=document.createElement('div');tag.className='unit-tag '+(unit.side==='attacker'?'roman':'rival');tag.dataset.unitId=unit.id;tag.dataset.strength=String(unit.strength);
   const counts={light:24,medium:42,heavy:64};const nominal=Number(unit.soldiers||counts[unit.type]||24);
   const combatEstimate=Math.round(nominal*unit.strength/unit.maxStrength);
   const header=document.createElement('div');header.className='unit-tag__header';
   const type=document.createElement('b');type.textContent=unit.label||unit.type.toUpperCase();
   const number=document.createElement('strong');number.textContent=String(combatEstimate);number.title='Estimated remaining soldiers';
   header.append(type,number);
   const bar=document.createElement('div');bar.className='unit-tag__bar';
   const fill=document.createElement('i');fill.style.width=`${100*unit.strength/unit.maxStrength}%`;
   const value=document.createElement('span');value.textContent=`${unit.strength}/${unit.maxStrength} HP`;
   bar.append(fill,value);tag.append(header,bar);labels.append(tag);
  }
 }
 function resize(){
  const rect=canvas.getBoundingClientRect();const dpr=Math.min(globalThis.devicePixelRatio||1,1.75);
  const w=Math.round(Math.max(1,rect.width)*dpr),h=Math.round(Math.max(1,rect.height)*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
  lastSize={w:rect.width,h:rect.height};return lastSize;
 }
 function drawMesh(mesh,model,unlit=false){if(!mesh?.count)return;gl.bindVertexArray(mesh.vao);gl.uniformMatrix4fv(loc.model,false,model);gl.uniform1f(loc.highlight,unlit?1:0);gl.drawArrays(gl.TRIANGLES,0,mesh.count);}
 function render(t){
  if(!live)return;raf=requestAnimationFrame(render);
  const dim=resize();if(dim.w<=0||dim.h<=0)return;
  const focusY=terrainHeight(SITE.x,SITE.z)+15;
  const co=Math.cos(camPitch),si=Math.sin(camPitch);
  eye=[Math.sin(camYaw)*camDistance*co,focusY+camDistance*si,-Math.cos(camYaw)*camDistance*co];
  const focus=[0,focusY,0];viewProj=multiply(perspective(46,dim.w/dim.h,1,9000),lookAt(eye,focus));
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(shader);
  gl.uniformMatrix4fv(loc.VP,false,viewProj);gl.uniform3fv(loc.eye,eye);
  drawMesh(world,ID());drawMesh(highlights,ID(),true);drawMesh(bases,ID());
  if(cardState){for(const unit of cardState.battle.units){
   if(unit.status!=='ready'||unit.strength<=0)continue;
   const model=models.get(`${unit.side==='attacker'?'roman':'enemy'}-${unit.type}`);if(!model)continue;
   const p=modelPosition(unit,t),x=p.x-SITE.x,z=p.z-SITE.z,ground=terrainHeight(p.x,p.z)+10.2;
   const facing=unit.side==='attacker'?0:Math.PI,scale=unit.type==='heavy'?1.02:1.08;
   const offsets=unit.type==='heavy'?[[-14,-6],[14,7]]:[[-17,-8],[17,-8],[0,14]];
   for(const [dx,dz] of offsets){const xx=x+dx,zz=z+dz;const y=ground+Math.max(-5,Math.min(6,terrainHeight(SITE.x+xx,SITE.z+zz)-terrainHeight(p.x,p.z)))*.3;drawMesh(model,transform(xx,y,zz,scale,facing));}
  }}
  for(const label of labels.children){
   const unit=cardState?.battle.units.find(u=>u.id===label.dataset.unitId);
   if(!unit)continue;
   const revealed=unit.id===selectedId||unit.id===hoveredId;
   const p=modelPosition(unit,t);
   const offset=revealed?(unit.type==='heavy'?82:70):27;
   const screen=project([p.x-SITE.x,terrainHeight(p.x,p.z)+offset,p.z-SITE.z],viewProj,dim.w,dim.h);
   const horizontalMargin=revealed?96:22;
   if(!screen||screen.x<horizontalMargin||screen.x>dim.w-horizontalMargin||screen.y<28||screen.y>dim.h-12){
    label.style.display='none';continue;
   }
   label.classList.toggle('revealed',revealed);
   label.classList.toggle('selected',unit.id===selectedId);
   label.style.display='block';
   label.style.transform=`translate(${Math.round(screen.x)}px,${Math.round(screen.y)}px) translate(-50%,-100%)`;
  }
 }
 let pointerDown=null;
 canvas.addEventListener('pointerdown',ev=>{
  if(ev.button!==0)return;pointerDown={x:ev.clientX,y:ev.clientY,lastX:ev.clientX,lastY:ev.clientY,drag:false};canvas.setPointerCapture(ev.pointerId);canvas.style.cursor='grabbing';
 });
 canvas.addEventListener('pointermove',ev=>{
  if(!pointerDown){
   const rect=canvas.getBoundingClientRect(),mx=ev.clientX-rect.left,my=ev.clientY-rect.top;
   let best=36,closest=null;
   for(const u of cardState?.battle?.units??[]){
    if(u.status!=='ready'||u.strength<=0)continue;
    const p=axialWorld(u.q,u.r);
    const s=project([p.x-SITE.x,terrainHeight(p.x,p.z)+24,p.z-SITE.z],viewProj,rect.width,rect.height);
    if(!s)continue;
    const d=Math.hypot(s.x-mx,s.y-my);
    if(d<best){best=d;closest=u.id;}
   }
   hoveredId=closest;return;
  }
  const dx=ev.clientX-pointerDown.lastX,dy=ev.clientY-pointerDown.lastY;
  if(Math.hypot(ev.clientX-pointerDown.x,ev.clientY-pointerDown.y)>5)pointerDown.drag=true;
  if(pointerDown.drag){camYaw=clamp(camYaw+dx*.005,-1.25,1.25);camPitch=clamp(camPitch+dy*.004,.49,1.35);}
  pointerDown.lastX=ev.clientX;pointerDown.lastY=ev.clientY;
 });
 canvas.addEventListener('pointerup',ev=>{
  canvas.style.cursor='crosshair';if(!pointerDown)return;
  const drag=pointerDown.drag;pointerDown=null;if(drag)return;
  const rect=canvas.getBoundingClientRect(),mx=ev.clientX-rect.left,my=ev.clientY-rect.top;
  // Compare 3D-projected centers instead of picking against a flattened screen map.
  let hit=null,best=1e10;
  for(const h of renderedHexes){const scr=project([h.world.x-SITE.x,terrainHeight(h.world.x,h.world.z)+4,h.world.z-SITE.z],viewProj,rect.width,rect.height);if(!scr)continue;
    const d=Math.hypot(scr.x-mx,scr.y-my);if(d<best){best=d;hit=h;}
  }
  const approx=project([SITE.hexSize*1.5,terrainHeight(SITE.x,SITE.z)+4,0],viewProj,rect.width,rect.height);
  const center=project([0,terrainHeight(SITE.x,SITE.z)+4,0],viewProj,rect.width,rect.height);
  const threshold=clamp((approx&&center?Math.hypot(approx.x-center.x,approx.y-center.y):43)*1.09,22,96);
  if(hit&&best<threshold)onHexClick({q:hit.q,r:hit.r});
 });
 canvas.addEventListener('pointercancel',()=>{pointerDown=null;canvas.style.cursor='crosshair';});
 canvas.addEventListener('pointerleave',()=>{hoveredId=null;});
 canvas.addEventListener('wheel',ev=>{ev.preventDefault();camDistance=clamp(camDistance*Math.exp(ev.deltaY*.0011),680,2050);},{passive:false});
 const modelPaths=[];for(const side of ['roman','enemy'])for(const type of ['light','medium','heavy'])modelPaths.push(`${side}-${type}`);
 const readyPromise=Promise.all(modelPaths.map(async key=>{
  try{const m=await loadMiniature(gl,`./assets/models/${key}.glb`);models.set(key,m);}
  catch(error){onStatus(`Could not load ${key} miniature: ${error.message}`);}
 })).then(()=>{ready=true;onStatus(`Terrain mesh ${world.triangles.toLocaleString()} triangles • ${models.size}/6 miniature assets loaded.`);});
 raf=requestAnimationFrame(render);
 return {setState,ready:readyPromise,stats:()=>({terrainTriangles:world.triangles,miniatureModels:models.size,webgl2:true}),destroy(){live=false;cancelAnimationFrame(raf);for(const m of [world,highlights,bases,...models.values()])disposeGpuMesh(gl,m);gl.deleteProgram(shader);},projectCell(q,r){const p=axialWorld(q,r);return project([p.x-SITE.x,terrainHeight(p.x,p.z)+4,p.z-SITE.z],viewProj,lastSize.w,lastSize.h);}};
}
