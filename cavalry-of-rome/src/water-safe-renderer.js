import * as THREE from "three";
import { createRenderer as createBaseRenderer } from "./renderer.js";

const THEATER_SCALE = 2.55;
const WATER_MIN_CLEARANCE = 14.0;
const WATER_EDGE_CLEARANCE = 18.0;
const RIVER_WAVE_SINK_ALLOWANCE = 4.0;
const LAKE_CONTOUR_CLEARANCE = 4.2;
const LAKE_EDGE_CLEARANCE = 5.6;
const LAKE_WAVE_SINK_ALLOWANCE = 0.8;
const WATER_RENDER_ORDER = 20;
const WATER_OVERLAY_RENDER_ORDER = 21;
const BRIDGE_RENDER_ORDER = 26;
const STRUCTURE_FLAT_RADIUS = 1180;
const STRUCTURE_FLAT_SAMPLES = 64;

const MAIN_RIVER_POINTS = [
  [-640, 2250], [-560, 1880], [-470, 1510], [-390, 1160], [-330, 760],
  [-245, 520], [-160, 260], [-105, 20], [-20, -220], [35, -470],
  [105, -760], [185, -1160], [255, -1560], [360, -2040], [470, -2400]
];

const BRANCH_RIVER_POINTS = [
  [-1850, 1320], [-1520, 1130], [-1190, 930], [-850, 680], [-650, 520],
  [-500, 390], [-360, 260], [-230, 130], [-145, 15], [-100, -80]
];

const ADDITIONAL_RIVER_SYSTEMS = [
  { width: 42, points: [[-3100, -380], [-2660, -210], [-2210, -40], [-1760, 210], [-1360, 470], [-1030, 680], [-760, 980]] },
  { width: 36, points: [[-420, 2820], [-330, 2440], [-190, 2060], [60, 1710], [420, 1380], [750, 1110], [970, 820]] },
  { width: 32, points: [[1640, 2380], [1420, 1960], [1220, 1540], [1140, 1050], [1420, 460], [1600, -120]] },
  { width: 38, points: [[2650, -2450], [2360, -1980], [2180, -1540], [1980, -1080], [1760, -620], [1500, -250]] },
  { width: 28, points: [[-2860, -2100], [-2400, -1920], [-1920, -1640], [-1680, -860], [-1440, -420], [-1180, -120]] }
];

const LAKE_ENDPOINT_SOURCES = [
  { system: { width: 74, points: MAIN_RIVER_POINTS }, end: "start", radiusX: 360, radiusZ: 205, basinRadius: 820 },
  { system: { width: 74, points: MAIN_RIVER_POINTS }, end: "end", radiusX: 440, radiusZ: 245, basinRadius: 940 },
  { system: { width: 34, points: BRANCH_RIVER_POINTS }, end: "start", radiusX: 310, radiusZ: 180, basinRadius: 720 },
  { system: ADDITIONAL_RIVER_SYSTEMS[0], end: "start", radiusX: 360, radiusZ: 200, basinRadius: 860 },
  { system: ADDITIONAL_RIVER_SYSTEMS[2], end: "end", radiusX: 330, radiusZ: 190, basinRadius: 760 },
  { system: ADDITIONAL_RIVER_SYSTEMS[3], end: "start", radiusX: 390, radiusZ: 220, basinRadius: 900 }
];

const ROAD_PATHS = [
  { width: 16, kind: "road", points: [[900, 2480], [690, 2080], [820, 1700], [570, 1360], [360, 1100], [510, 850], [315, 610], [430, 335], [230, 60], [360, -250], [305, -590], [520, -930], [390, -1080], [650, -1540], [840, -2300]] },
  { width: 9, kind: "track", points: [[-1330, 2140], [-1080, 1660], [-760, 980], [-700, 690], [-650, 430], [-600, 140], [-560, -160], [-530, -510], [-500, -1010], [-610, -1540], [-830, -2120]] },
  { width: 7, kind: "track", points: [[115, 585], [190, 650], [275, 760], [360, 880], [520, 1040], [770, 1260]] },
  { width: 11, kind: "cobble", points: [[-2500, 1400], [-2120, 1280], [-1760, 1120], [-1420, 820], [-1120, 500], [-820, 260]] },
  { width: 11, kind: "cobble", points: [[-1940, -860], [-1620, -760], [-1260, -610], [-900, -420], [-540, -160], [-180, 120], [260, 420]] },
  { width: 11, kind: "cobble", points: [[-1030, 1740], [-660, 1640], [-300, 1500], [90, 1390], [420, 1380], [760, 1540], [1120, 1780]] },
  { width: 11, kind: "cobble", points: [[160, -1900], [440, -1640], [720, -1240], [880, -820], [1060, -450], [1330, -90]] },
  { width: 11, kind: "cobble", points: [[1060, 520], [1420, 460], [1740, 120], [1970, -430], [2180, -1540]] },
  { width: 11, kind: "cobble", points: [[2180, -1540], [2460, -1040], [2720, -420], [2860, 310], [2500, 1820]] },
  { width: 6, kind: "dirt", points: [[-2740, -1860], [-2440, -1660], [-2160, -1280], [-1900, -970], [-1680, -860]] },
  { width: 6, kind: "dirt", points: [[-2260, 1360], [-2540, 980], [-2780, 560], [-2920, 20], [-2820, -620]] },
  { width: 6, kind: "dirt", points: [[-880, 1850], [-1110, 1460], [-1300, 970], [-1480, 760], [-1680, -860]] },
  { width: 6, kind: "dirt", points: [[-260, -1960], [-30, -1560], [210, -1180], [560, -1010], [880, -820]] },
  { width: 6, kind: "dirt", points: [[420, 1380], [220, 990], [115, 585], [-130, 310], [-520, 60]] },
  { width: 6, kind: "dirt", points: [[880, -820], [1210, -1130], [1580, -1320], [2180, -1540]] },
  { width: 6, kind: "dirt", points: [[1420, 460], [1740, 760], [2100, 1080], [2500, 1820]] },
  { width: 6, kind: "dirt", points: [[-2740, -1860], [-2210, -2110], [-1660, -2240], [-910, -2160], [-260, -1960]] },
  { width: 6, kind: "dirt", points: [[-2260, 1360], [-1780, 1760], [-1280, 1990], [-880, 1850]] },
  { width: 6, kind: "dirt", points: [[420, 1380], [840, 1080], [1170, 760], [1420, 460]] }
];

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function terrainHeight(x, z) {
  const ridge = Math.sin(x * 0.0038) * 62 + Math.cos(z * 0.0031) * 58;
  const farHills = Math.sin((x + z) * 0.00165) * 150;
  const fineFold = Math.sin(x * 0.011 + z * 0.0045) * 19 + Math.cos(z * 0.009 - x * 0.0032) * 16;
  const crag = Math.sin((x - z) * 0.018) * Math.cos((x + z) * 0.0085) * 11;
  const foothillRibs = Math.sin(x * 0.026 + z * 0.013) * Math.sin(z * 0.017 - x * 0.006) * 9;
  const erodedCuts = -18 * Math.max(0, Math.sin(x * 0.0065 + z * 0.013)) ** 2;
  const terrace = Math.sin((ridge + farHills) * 0.18 + x * 0.002) * 5.5;
  const valley = -165 * Math.exp(-((x + 215) ** 2) / 460000);
  const riverCut = -74 * Math.exp(-((x + 205 + Math.sin(z * 0.0018) * 220) ** 2) / 115000);
  const roadShelf = -18 * Math.exp(-(x ** 2) / 850000);
  return ridge + farHills + fineFold + crag + foothillRibs + erodedCuts + terrace + valley + riverCut + roadShelf;
}

function terrainSlope(x, z, step = 42) {
  return Math.abs(terrainHeight(x + step, z) - terrainHeight(x - step, z)) + Math.abs(terrainHeight(x, z + step) - terrainHeight(x, z - step));
}

function waterY(x, z, clearance = WATER_MIN_CLEARANCE) { return terrainHeight(x, z) + clearance; }
function lakeY(x, z, clearance = LAKE_CONTOUR_CLEARANCE) { return terrainHeight(x, z) + clearance; }
function scaledPoint(point) { return [point[0] * THEATER_SCALE, point[1] * THEATER_SCALE]; }
function seededRandom(seed) { return Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1; }

function pathToSegments(path) {
  const scaled = path.points.map(([x, z]) => ({ x: x * THEATER_SCALE, z: z * THEATER_SCALE }));
  return scaled.slice(1).map((point, index) => ({ a: scaled[index], b: point, width: path.width * THEATER_SCALE, kind: path.kind }));
}
function riverSegments() {
  const systems = [{ points: MAIN_RIVER_POINTS, width: 74 }, { points: BRANCH_RIVER_POINTS, width: 34 }, ...ADDITIONAL_RIVER_SYSTEMS];
  return systems.flatMap((system) => pathToSegments({ points: system.points, width: system.width, kind: "river" }));
}
function segmentPoint(a, b, t) { return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }; }
function distanceToSegment2D(px, pz, ax, az, bx, bz) {
  const abx = bx - ax; const abz = bz - az;
  const apx = px - ax; const apz = pz - az;
  const lenSq = abx * abx + abz * abz;
  const t = lenSq === 0 ? 0 : clamp((apx * abx + apz * abz) / lenSq, 0, 1);
  const x = ax + abx * t; const z = az + abz * t;
  return Math.hypot(px - x, pz - z);
}
function closestPointsOnSegments(a, b, c, d) {
  const ux = b.x - a.x; const uz = b.z - a.z;
  const vx = d.x - c.x; const vz = d.z - c.z;
  const wx = a.x - c.x; const wz = a.z - c.z;
  const aa = ux * ux + uz * uz;
  const bb = ux * vx + uz * vz;
  const cc = vx * vx + vz * vz;
  const dd = ux * wx + uz * wz;
  const ee = vx * wx + vz * wz;
  const denom = aa * cc - bb * bb;
  let s = denom === 0 ? 0 : clamp((bb * ee - cc * dd) / denom, 0, 1);
  let t = cc === 0 ? 0 : clamp((bb * s + ee) / cc, 0, 1);
  s = aa === 0 ? 0 : clamp((bb * t - dd) / aa, 0, 1);
  const p = segmentPoint(a, b, s);
  const q = segmentPoint(c, d, t);
  return { p, q, distance: Math.hypot(p.x - q.x, p.z - q.z), s, t };
}

function endpointSourceWorld(source) {
  const points = source.system.points;
  const endpoint = source.end === "start" ? points[0] : points[points.length - 1];
  const neighbor = source.end === "start" ? points[1] : points[points.length - 2];
  const [x, z] = scaledPoint(endpoint);
  const [nx, nz] = scaledPoint(neighbor);
  return { x, z, nx, nz };
}

function findLowBasinNear(x, z, radius, seed) {
  let best = { x, z, height: terrainHeight(x, z), slope: terrainSlope(x, z), distance: 0 };
  for (let i = 0; i < 48; i += 1) {
    const angle = (i / 48) * Math.PI * 2;
    for (const ringT of [0.18, 0.34, 0.52, 0.72, 0.92, 1.0]) {
      const wobble = 0.88 + seededRandom(seed * 200 + i * 13 + Math.floor(ringT * 100)) * 0.24;
      const candidateX = x + Math.cos(angle) * radius * ringT * wobble;
      const candidateZ = z + Math.sin(angle) * radius * ringT * wobble;
      const distance = Math.hypot(candidateX - x, candidateZ - z);
      const height = terrainHeight(candidateX, candidateZ);
      const slope = terrainSlope(candidateX, candidateZ);
      const score = height + slope * 1.8 + distance * 0.035;
      const bestScore = best.height + best.slope * 1.8 + best.distance * 0.035;
      if (score < bestScore) best = { x: candidateX, z: candidateZ, height, slope, distance };
    }
  }
  return best;
}

let resolvedLakeDefinitions = null;
function getLakeDefinitions() {
  if (resolvedLakeDefinitions) return resolvedLakeDefinitions;
  resolvedLakeDefinitions = LAKE_ENDPOINT_SOURCES.map((source, index) => {
    const endpoint = endpointSourceWorld(source);
    const basin = findLowBasinNear(endpoint.x, endpoint.z, source.basinRadius, index + 10);
    const maxCenterShift = source.radiusX * THEATER_SCALE * 0.62;
    const shiftDistance = Math.hypot(basin.x - endpoint.x, basin.z - endpoint.z);
    const shiftT = shiftDistance > maxCenterShift ? maxCenterShift / shiftDistance : 1;
    const centerX = endpoint.x + (basin.x - endpoint.x) * shiftT;
    const centerZ = endpoint.z + (basin.z - endpoint.z) * shiftT;
    const tangentYaw = Math.atan2(endpoint.nz - endpoint.z, endpoint.nx - endpoint.x);
    return {
      center: [centerX / THEATER_SCALE, centerZ / THEATER_SCALE],
      radiusX: source.radiusX,
      radiusZ: source.radiusZ,
      rotation: tangentYaw + Math.PI * 0.5,
      source: source.end,
      hydrology: "river-end-basin"
    };
  });
  return resolvedLakeDefinitions;
}

function lakeLocalRadius(definition, x, z) {
  const centerX = definition.center[0] * THEATER_SCALE;
  const centerZ = definition.center[1] * THEATER_SCALE;
  const cosR = Math.cos(-definition.rotation);
  const sinR = Math.sin(-definition.rotation);
  const dx = x - centerX;
  const dz = z - centerZ;
  const localX = dx * cosR - dz * sinR;
  const localZ = dx * sinR + dz * cosR;
  const radiusX = definition.radiusX * THEATER_SCALE;
  const radiusZ = definition.radiusZ * THEATER_SCALE;
  return Math.sqrt((localX * localX) / (radiusX * radiusX) + (localZ * localZ) / (radiusZ * radiusZ));
}
function isInsideLake(x, z, margin = 0) {
  return getLakeDefinitions().some((lake) => lakeLocalRadius({ ...lake, radiusX: lake.radiusX + margin / THEATER_SCALE, radiusZ: lake.radiusZ + margin / THEATER_SCALE }, x, z) < 1.0);
}
function isNearKnownWater(x, z, clearance = 260) {
  for (const segment of riverSegments()) {
    if (distanceToSegment2D(x, z, segment.a.x, segment.a.z, segment.b.x, segment.b.z) < clearance + segment.width) return true;
  }
  return isInsideLake(x, z, clearance);
}

function findBestStructureSpot(x, z, radius = STRUCTURE_FLAT_RADIUS, samples = STRUCTURE_FLAT_SAMPLES) {
  let best = { x, z, slope: terrainSlope(x, z), waterPenalty: isNearKnownWater(x, z) ? 950 : 0, distance: 0 };
  for (let i = 0; i < samples; i += 1) {
    const angle = (i / samples) * Math.PI * 2;
    for (const ringT of [0.16, 0.3, 0.46, 0.64, 0.84, 1.0]) {
      const wobble = 0.92 + seededRandom(i * 101 + Math.floor(ringT * 1000)) * 0.18;
      const candidateX = x + Math.cos(angle) * radius * ringT * wobble;
      const candidateZ = z + Math.sin(angle) * radius * ringT * wobble;
      const distance = Math.hypot(candidateX - x, candidateZ - z);
      const waterPenalty = isNearKnownWater(candidateX, candidateZ) ? 950 : 0;
      const slope = terrainSlope(candidateX, candidateZ);
      const score = slope + waterPenalty + distance * 0.0025;
      const bestScore = best.slope + best.waterPenalty + best.distance * 0.0025;
      if (score < bestScore) best = { x: candidateX, z: candidateZ, slope, waterPenalty, distance };
    }
  }
  return best;
}

function findWaterSystem(scene) {
  let waterSystem = null;
  scene.traverse((object) => {
    if (waterSystem) return;
    if (object.userData?.rivers && object.userData?.lakes && object.userData?.waterMaterials) waterSystem = object;
  });
  return waterSystem;
}
function asMaterialList(material) { return !material ? [] : Array.isArray(material) ? material : [material]; }
function applyWaterMaterialSafety(material, { overlay = false } = {}) {
  for (const entry of asMaterialList(material)) {
    entry.polygonOffset = true;
    entry.polygonOffsetFactor = -10;
    entry.polygonOffsetUnits = -20;
    entry.depthTest = true;
    entry.depthWrite = !overlay;
    entry.needsUpdate = true;
  }
}
function applyWaterMeshSafety(mesh, { overlay = false } = {}) {
  if (!mesh) return;
  mesh.renderOrder = overlay ? WATER_OVERLAY_RENDER_ORDER : WATER_RENDER_ORDER;
  applyWaterMaterialSafety(mesh.material, { overlay });
}

function stabilizeRibbonBase(mesh, sinkAllowance = RIVER_WAVE_SINK_ALLOWANCE) {
  const positions = mesh.geometry?.attributes?.position;
  const baseY = mesh.userData?.baseY;
  if (!positions || !baseY) return;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i); const z = positions.getZ(i);
    const safeBase = waterY(x, z, WATER_MIN_CLEARANCE + sinkAllowance);
    baseY[i] = Math.max(baseY[i], safeBase);
    positions.setY(i, Math.max(positions.getY(i), baseY[i]));
  }
  positions.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

function repositionLakeMeshToDefinition(mesh, definition) {
  const positions = mesh.geometry?.attributes?.position;
  const baseY = mesh.userData?.baseY;
  if (!positions || !baseY || !definition) return;
  const centerX = definition.center[0] * THEATER_SCALE;
  const centerZ = definition.center[1] * THEATER_SCALE;
  const radiusX = definition.radiusX * THEATER_SCALE;
  const radiusZ = definition.radiusZ * THEATER_SCALE;
  const cosR = Math.cos(definition.rotation);
  const sinR = Math.sin(definition.rotation);
  const rings = 5;
  const segments = Math.max(8, Math.round(positions.count / (rings + 1)) - 1);
  const row = segments + 1;
  for (let i = 0; i < positions.count; i += 1) {
    const ring = Math.floor(i / row);
    const column = i % row;
    const ringT = Math.min(1, ring / rings);
    const angle = (column / segments) * Math.PI * 2;
    const localX = Math.cos(angle) * radiusX * ringT;
    const localZ = Math.sin(angle) * radiusZ * ringT;
    const x = centerX + localX * cosR - localZ * sinR;
    const z = centerZ + localX * sinR + localZ * cosR;
    const edgeLift = ringT > 0.86 ? (ringT - 0.86) * 4.0 : 0;
    const y = terrainHeight(x, z) + LAKE_CONTOUR_CLEARANCE + edgeLift;
    positions.setXYZ(i, x, y, z);
    baseY[i] = y;
  }
  positions.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.userData.hydrology = "river-end-basin";
}

function clampAnimatedWater(mesh, clearance = WATER_MIN_CLEARANCE, yResolver = waterY) {
  const positions = mesh.geometry?.attributes?.position;
  if (!positions) return;
  let changed = false;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i); const z = positions.getZ(i); const y = positions.getY(i);
    const safeY = Math.max(y, yResolver(x, z, clearance));
    if (safeY !== y) { positions.setY(i, safeY); changed = true; }
  }
  if (changed) { positions.needsUpdate = true; mesh.geometry.computeVertexNormals(); }
}

function createMistTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 126);
  gradient.addColorStop(0, "rgba(255,255,255,0.88)");
  gradient.addColorStop(0.32, "rgba(255,255,255,0.34)");
  gradient.addColorStop(0.72, "rgba(255,255,255,0.08)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
  return texture;
}

function createTerrainEndcap({ x, z, radiusX, radiusZ, rotation, material }) {
  const segments = 40;
  const vertices = [x, waterY(x, z, WATER_EDGE_CLEARANCE), z];
  const indices = [];
  const cosR = Math.cos(rotation); const sinR = Math.sin(rotation);
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const localX = Math.cos(angle) * radiusX; const localZ = Math.sin(angle) * radiusZ;
    const vx = x + localX * cosR - localZ * sinR;
    const vz = z + localX * sinR + localZ * cosR;
    vertices.push(vx, waterY(vx, vz, WATER_EDGE_CLEARANCE), vz);
    if (i < segments) indices.push(0, i + 1, i + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const cap = new THREE.Mesh(geometry, material);
  cap.receiveShadow = true; cap.renderOrder = WATER_RENDER_ORDER - 1;
  return cap;
}

function riverEndpointAnchors() {
  const systems = [{ points: MAIN_RIVER_POINTS, width: 74 }, { points: BRANCH_RIVER_POINTS, width: 34 }, ...ADDITIONAL_RIVER_SYSTEMS];
  const anchors = [];
  for (const system of systems) {
    const first = system.points[0]; const second = system.points[1] ?? first;
    const last = system.points[system.points.length - 1]; const beforeLast = system.points[system.points.length - 2] ?? last;
    for (const [point, neighbor] of [[first, second], [last, beforeLast]]) {
      const [x, z] = scaledPoint(point); const [nx, nz] = scaledPoint(neighbor);
      anchors.push({ x, z, width: system.width * THEATER_SCALE, rotation: Math.atan2(nz - z, nx - x) });
    }
  }
  return anchors;
}

function createDynamicEndpointCover() {
  const group = new THREE.Group();
  const mistTexture = createMistTexture();
  const mistGeometry = new THREE.PlaneGeometry(1, 1);
  const capMaterial = new THREE.MeshStandardMaterial({ color: "#6d6246", roughness: 0.98, metalness: 0.0, transparent: true, opacity: 0.72, depthWrite: true, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -10 });
  riverEndpointAnchors().forEach((anchor, index) => {
    if (isInsideLake(anchor.x, anchor.z, 220)) return;
    group.add(createTerrainEndcap({ x: anchor.x, z: anchor.z, radiusX: anchor.width * 0.9, radiusZ: anchor.width * 0.48, rotation: anchor.rotation, material: capMaterial }));
    const mistMaterial = new THREE.MeshBasicMaterial({ color: index % 2 ? "#d5ded4" : "#c8d2c9", map: mistTexture, transparent: true, opacity: 0.24, depthWrite: false, blending: THREE.NormalBlending });
    const mist = new THREE.Mesh(mistGeometry, mistMaterial);
    mist.position.set(anchor.x, waterY(anchor.x, anchor.z, 16.0), anchor.z);
    mist.scale.set(anchor.width * 5.2, anchor.width * 3.1, 1);
    mist.rotation.set(-Math.PI / 2, 0, anchor.rotation + Math.PI * 0.5);
    mist.renderOrder = WATER_OVERLAY_RENDER_ORDER + 2;
    group.add(mist);
  });
  group.name = "dynamic-water-endpoint-cover";
  return group;
}

function stabilizeWaterSystem(waterSystem) {
  if (!waterSystem || waterSystem.userData.waterSafetyApplied) return;
  const lakeDefinitions = getLakeDefinitions();
  for (const material of waterSystem.userData.waterMaterials ?? []) applyWaterMaterialSafety(material);
  for (const river of waterSystem.userData.rivers ?? []) { stabilizeRibbonBase(river, RIVER_WAVE_SINK_ALLOWANCE); applyWaterMeshSafety(river); }
  for (let i = 0; i < (waterSystem.userData.lakes ?? []).length; i += 1) {
    const lake = waterSystem.userData.lakes[i];
    repositionLakeMeshToDefinition(lake, lakeDefinitions[i % lakeDefinitions.length]);
    applyWaterMeshSafety(lake);
  }
  for (const ribbon of waterSystem.userData.flowRibbons ?? []) {
    ribbon.visible = false;
    for (const material of asMaterialList(ribbon.material)) { material.opacity = 0; material.needsUpdate = true; }
  }
  waterSystem.userData.lakeDefinitions = lakeDefinitions;
  waterSystem.userData.waterSafetyApplied = true;
}

function clampWaterBeforeRender(waterSystem) {
  if (!waterSystem) return;
  for (const river of waterSystem.userData.rivers ?? []) clampAnimatedWater(river, WATER_MIN_CLEARANCE, waterY);
  for (const lake of waterSystem.userData.lakes ?? []) clampAnimatedWater(lake, LAKE_CONTOUR_CLEARANCE, lakeY);
}

function removeSceneSunDisc(scene) {
  const removals = [];
  scene.traverse((object) => {
    if (!object.isMesh) return;
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    if (object.geometry?.type === "CircleGeometry" && material?.isMeshBasicMaterial && material?.blending === THREE.AdditiveBlending) removals.push(object);
  });
  for (const object of removals) {
    object.parent?.remove(object); object.geometry?.dispose?.();
    for (const material of asMaterialList(object.material)) material.dispose?.();
  }
}

function createBridgeDeck({ x, z, yaw, length, width, kind }) {
  const group = new THREE.Group();
  const deckMaterial = new THREE.MeshStandardMaterial({ color: kind === "dirt" ? "#6f5438" : "#80684b", roughness: 0.9, metalness: 0.0 });
  const railMaterial = new THREE.MeshStandardMaterial({ color: "#4e3828", roughness: 0.88, metalness: 0.0 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(length, 8, width), deckMaterial);
  deck.position.y = 5;
  deck.castShadow = true; deck.receiveShadow = true; deck.renderOrder = BRIDGE_RENDER_ORDER;
  group.add(deck);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(length * 0.92, 7, 5), railMaterial);
    rail.position.set(0, 12, side * width * 0.55);
    rail.castShadow = true; rail.renderOrder = BRIDGE_RENDER_ORDER + 1;
    group.add(rail);
  }
  group.position.set(x, waterY(x, z, 30), z);
  group.rotation.y = yaw;
  group.name = "water-crossing-bridge";
  return group;
}

function createRiverBridges() {
  const group = new THREE.Group();
  group.name = "water-bridge-crossings";
  const made = [];
  const rivers = riverSegments();
  for (const path of ROAD_PATHS) {
    for (const pathSegment of pathToSegments(path)) {
      const pathYaw = Math.atan2(pathSegment.b.x - pathSegment.a.x, pathSegment.b.z - pathSegment.a.z);
      for (const river of rivers) {
        const hit = closestPointsOnSegments(pathSegment.a, pathSegment.b, river.a, river.b);
        const threshold = river.width * 0.52 + pathSegment.width + 18;
        if (hit.distance > threshold || hit.s < 0.03 || hit.s > 0.97 || hit.t < 0.02 || hit.t > 0.98) continue;
        const x = (hit.p.x + hit.q.x) * 0.5;
        const z = (hit.p.z + hit.q.z) * 0.5;
        if (isInsideLake(x, z, 140)) continue;
        if (made.some((prior) => Math.hypot(prior.x - x, prior.z - z) < 260)) continue;
        made.push({ x, z });
        group.add(createBridgeDeck({ x, z, yaw: pathYaw, length: Math.max(120, river.width * 1.55), width: Math.max(34, pathSegment.width * 2.7), kind: path.kind }));
      }
    }
  }
  return group;
}

function pathMaterialLooksLikePath(material) {
  const color = material?.color?.getHexString?.();
  return ["a8895a", "6d593d", "817666", "8b6842"].includes(color);
}
function sinkPathVerticesInsideLakes(scene) {
  scene.traverse((object) => {
    if (!object.isMesh || !object.geometry?.attributes?.position || !asMaterialList(object.material).some(pathMaterialLooksLikePath)) return;
    const positions = object.geometry.attributes.position;
    let changed = false;
    for (let i = 0; i < positions.count; i += 1) {
      const local = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      object.localToWorld(local);
      if (!isInsideLake(local.x, local.z, 52)) continue;
      const sunkWorldY = terrainHeight(local.x, local.z) - 28;
      const sunkLocal = object.worldToLocal(new THREE.Vector3(local.x, sunkWorldY, local.z));
      positions.setY(i, sunkLocal.y);
      changed = true;
    }
    if (changed) { positions.needsUpdate = true; object.geometry.computeVertexNormals(); object.userData.lakeIntersectionMasked = true; }
  });
}

function isLargeGroundedStructure(object) {
  if (!object.isGroup || object.position.lengthSq() < 1 || object.name === "dynamic-water-endpoint-cover") return false;
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return false;
  const size = new THREE.Vector3(); box.getSize(size);
  const hasManyMeshes = object.children.filter((child) => child.isMesh || child.isGroup).length >= 2;
  const tallEnough = size.y > 70;
  const wideEnough = Math.max(size.x, size.z) > 80;
  const tooSmallForPalacePass = size.y < 260 && Math.max(size.x, size.z) < 70;
  return hasManyMeshes && tallEnough && wideEnough && !tooSmallForPalacePass;
}
function createStructurePad(x, z, radius, y) {
  const segments = 72;
  const vertices = [x, y, z];
  const indices = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const vx = x + Math.cos(angle) * radius;
    const vz = z + Math.sin(angle) * radius * 0.78;
    vertices.push(vx, y, vz);
    if (i < segments) indices.push(0, i + 1, i + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: "#8b7650", roughness: 0.96, metalness: 0.0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const pad = new THREE.Mesh(geometry, material); pad.receiveShadow = true; pad.renderOrder = 8;
  return pad;
}
function flattenMajorGroundedStructures(scene) {
  const structures = [];
  scene.traverse((object) => { if (isLargeGroundedStructure(object)) structures.push(object); });
  const padGroup = new THREE.Group(); padGroup.name = "major-structure-flat-ground-pads";
  for (const structure of structures) {
    const box = new THREE.Box3().setFromObject(structure);
    const size = new THREE.Vector3(); box.getSize(size);
    const currentX = structure.position.x; const currentZ = structure.position.z;
    const currentOffset = clamp(structure.position.y - terrainHeight(currentX, currentZ), 10, 32);
    const spot = findBestStructureSpot(currentX, currentZ);
    const padRadius = clamp(Math.max(size.x, size.z) * 0.72, 145, 520);
    const padY = terrainHeight(spot.x, spot.z) + 7.5;
    structure.position.set(spot.x, padY + currentOffset, spot.z);
    structure.rotation.x = 0; structure.rotation.z = 0; structure.up.set(0, 1, 0);
    structure.updateMatrixWorld(true); structure.userData.flatGroundAdjusted = true;
    padGroup.add(createStructurePad(spot.x, spot.z, padRadius, padY - 1.6));
  }
  if (padGroup.children.length > 0) scene.add(padGroup);
}

export async function createRenderer(canvas) {
  const base = await createBaseRenderer(canvas);
  const waterSystem = findWaterSystem(base.scene);

  removeSceneSunDisc(base.scene);
  stabilizeWaterSystem(waterSystem);
  sinkPathVerticesInsideLakes(base.scene);
  flattenMajorGroundedStructures(base.scene);
  base.scene.add(createRiverBridges());
  base.scene.add(createDynamicEndpointCover());
  base.scene.userData.waterSafetyVersion = "river-end-basin-lakes-pass-4";

  const originalRender = base.renderer.render.bind(base.renderer);
  base.renderer.render = (scene, camera) => {
    clampWaterBeforeRender(waterSystem);
    return originalRender(scene, camera);
  };

  return base;
}
