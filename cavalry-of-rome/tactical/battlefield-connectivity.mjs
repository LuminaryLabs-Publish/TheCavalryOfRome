/**
 * Enforce tactical reachability without changing strategic unit identities.
 * Rebuild a minimal passable route only when existing deployment components
 * cannot meet. Water becomes a visible bridge; other obstacles become trails.
 * Pure data transformation: the incoming board is never mutated.
 */
const DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const key = (q, r) => `${q},${r}`;
const parse = k => { const [q, r] = k.split(',').map(Number); return {q, r}; };
const valid = (q, r, n) => Number.isInteger(q) && Number.isInteger(r) &&
  Math.max(Math.abs(q), Math.abs(r), Math.abs(q+r)) <= n;
const adjacent = (k, n) => {
  const {q,r}=parse(k);
  return DIRECTIONS.map(([dq,dr]) => key(q+dq,r+dr))
    .filter(next => {const p=parse(next);return valid(p.q,p.r,n);});
};
function index(board) {
  const n=Number(board?.radius);
  if(!Number.isInteger(n) || n<1 || n>30 || !Array.isArray(board?.cells) || !Array.isArray(board?.featureCells)) {
    throw new Error('Battlefield requires valid radius, cells, and features');
  }
  const features=new Map();
  for(const f of board.featureCells){
    if(valid(f.q,f.r,n))features.set(key(f.q,f.r),f);
  }
  const blocked=new Set((board.blockedCells||[]).filter(k=>{const p=parse(k);return valid(p.q,p.r,n);}));
  for(const [k,f] of features)if(f.obstacle || f.movement==='impassable')blocked.add(k);
  const positions=board.cells.filter(u=>u.strength!==0 && u.status!=='destroyed')
    .map(u=>key(u.q,u.r));
  if(positions.some(k=>{const p=parse(k);return !valid(p.q,p.r,n)||blocked.has(k);})){
    throw new Error('Deployed formation occupies impassable terrain');
  }
  return {n,features,blocked,positions};
}
function flood(start, blocked, n) {
  if(start==null)return new Set();
  const seen=new Set([start]),queue=[start];
  for(let i=0;i<queue.length;i++){
    for(const next of adjacent(queue[i],n)){
      if(blocked.has(next)||seen.has(next))continue;
      seen.add(next);queue.push(next);
    }
  }
  return seen;
}
export function battlefieldIsReachable(board) {
  const {n,blocked,positions}=index(board);
  return positions.length<2 || positions.every(p=>flood(positions[0],blocked,n).has(p));
}
// Heavily prefer routes that need fewer changes, especially fewer bridges.
function findPassage({n,features,blocked,positions},connected) {
  const remaining=new Set(positions.filter(p=>!connected.has(p)));
  const dist=new Map(),previous=new Map(),frontier=[];
  for(const start of connected){dist.set(start,0);frontier.push({k:start,cost:0});}
  while(frontier.length){
    frontier.sort((a,b)=>a.cost-b.cost||a.k.localeCompare(b.k));
    const next=frontier.shift();if(dist.get(next.k)!==next.cost)continue;
    if(remaining.has(next.k)){
      const path=[];let current=next.k;
      while(current){path.push(current);current=previous.get(current);}
      return path.reverse();
    }
    for(const cell of adjacent(next.k,n)){
      const feature=features.get(cell);
      // Ordinary walking should beat destroying a forest or crossing water.
      const extra=blocked.has(cell) ? (feature?.type==='river'?340:740) : 0;
      const cost=next.cost+1+extra;
      if(cost < (dist.get(cell)??Infinity)){
        dist.set(cell,cost);previous.set(cell,next.k);frontier.push({k:cell,cost});
      }
    }
  }
  throw new Error('Unable to connect tactical deployment cells');
}
export function repairBattlefieldConnectivity(board) {
  const result=structuredClone(board);
  let {n,features,blocked,positions}=index(result);
  if(positions.length<2)return {board:result,bridges:[],passages:[]};
  const bridges=[],passages=[];
  let connected=flood(positions[0],blocked,n);
  for(let attempt=0;attempt<=3*n*n;attempt++){
    if(positions.every(p=>connected.has(p))) {
      result.featureCells=[...features.values()];
      result.blockedCells=[...blocked];
      return {board:result,bridges,passages};
    }
    const path=findPassage({n,features,blocked,positions},connected);
    let repaired=0;
    for(const cell of path){
      if(!blocked.has(cell))continue;
      const at=parse(cell),old=features.get(cell)||{...at};
      const river=old.type==='river';
      features.set(cell,{...old,...at,type:river?'bridge':'road',
        obstacle:false,movement:'open',blocksLineOfSight:false,
        ...(river?{riverCrossing:true,generatedCrossing:true}:{generatedPassage:true})});
      blocked.delete(cell);repaired++;
      (river?bridges:passages).push(at);
    }
    if(!repaired)throw new Error('Battlefield passage repair made no progress');
    connected=flood(positions[0],blocked,n);
  }
  throw new Error('Battlefield connectivity repair limit reached');
}