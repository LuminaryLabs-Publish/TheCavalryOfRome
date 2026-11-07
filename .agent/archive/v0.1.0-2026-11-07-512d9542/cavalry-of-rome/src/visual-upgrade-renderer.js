import * as THREE from "three";
import { createRenderer as createArmyRenderer } from "./army-renderer.js";

const THEATER_SCALE = 2.55;
const MAIN_RIVER_POINTS = [[-640, 2250], [-560, 1880], [-470, 1510], [-390, 1160], [-330, 760], [-245, 520], [-160, 260], [-105, 20], [-20, -220], [35, -470], [105, -760], [185, -1160], [255, -1560], [360, -2040], [470, -2400]];
const BRANCH_RIVER_POINTS = [[-1850, 1320], [-1520, 1130], [-1190, 930], [-850, 680], [-650, 520], [-500, 390], [-360, 260], [-230, 130], [-145, 15], [-100, -80]];
const EXTRA_RIVERS = [
  { width: 42, points: [[-3100, -380], [-2660, -210], [-2210, -40], [-1760, 210], [-1360, 470], [-1030, 680], [-760, 980]] },
  { width: 36, points: [[-420, 2820], [-330, 2440], [-190, 2060], [60, 1710], [420, 1380], [750, 1110], [970, 820]] },
  { width: 32, points: [[1640, 2380], [1420, 1960], [1220, 1540], [1140, 1050], [1420, 460], [1600, -120]] },
  { width: 38, points: [[2650, -2450], [2360, -1980], [2180, -1540], [1980, -1080], [1760, -620], [1500, -250]] },
  { width: 28, points: [[-2860, -2100], [-2400, -1920], [-1920, -1640], [-1680, -860], [-1440, -420], [-1180, -120]] }
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
  { width: 11, kind: "cobble", points: [[2180, -1540], [2460, -1040], [2720, -420], [2860, 310], [2500, 1820]] }
];
const ROAD_MATERIAL_HEXES = new Set(["a8895a", "6d593d", "817666", "8b6842"]);

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function smoothstep(edge0, edge1, x) { const t = clamp((x - edge0) / (edge1 - edge0), 0, 1); return t * t * (3 - 2 * t); }
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
function terrainSlope(x, z) { return Math.abs(terrainHeight(x + 42, z) - terrainHeight(x - 42, z)) + Math.abs(terrainHeight(x, z + 42) - terrainHeight(x, z - 42)); }
function terrainNoise(x, z) { return Math.sin(x * 0.0017 + z * 0.0023) * 0.5 + Math.cos(x * 0.0041 - z * 0.0019) * 0.32 + Math.sin((x + z) * 0.0061) * 0.18; }
function ellipseMask(x, z, center, radiusX, radiusZ, rotation, inner = 0.58, outer = 1.12) {
  const cx = center[0] * THEATER_SCALE; const cz = center[1] * THEATER_SCALE;
  const rx = radiusX * THEATER_SCALE; const rz = radiusZ * THEATER_SCALE;
  const cosR = Math.cos(-rotation); const sinR = Math.sin(-rotation);
  const dx = x - cx; const dz = z - cz;
  const lx = dx * cosR - dz * sinR; const lz = dx * sinR + dz * cosR;
  const d = Math.sqrt((lx * lx) / (rx * rx) + (lz * lz) / (rz * rz));
  return 1 - smoothstep(inner, outer, d);
}
function biomeColor(x, z, height) {
  const n = terrainNoise(x, z);
  const slope = terrainSlope(x, z);
  const heightT = clamp((height + 165) / 460, 0, 1);
  const base = new THREE.Color("#536f38").lerp(new THREE.Color("#7a7458"), heightT * 0.55).lerp(new THREE.Color("#293b28"), clamp(slope * 0.012, 0, 0.42));
  const desert = Math.max(ellipseMask(x, z, [-260, -1960], 1900, 1180, -0.12), ellipseMask(x, z, [-2740, -1860], 1400, 840, 0.35), smoothstep(-2800, -4600, z));
  const tundra = Math.max(ellipseMask(x, z, [-880, 1850], 1720, 880, 0.24), ellipseMask(x, z, [-2260, 1360], 1180, 680, -0.38), smoothstep(4200, 6500, z) * 0.75, smoothstep(250, 430, height) * 0.65);
  const forest = Math.max(ellipseMask(x, z, [1420, 460], 1650, 1050, 0.22), ellipseMask(x, z, [2180, -1540], 1320, 860, -0.18), n > 0.24 ? 0.25 : 0);
  const desertColor = new THREE.Color("#b88645").lerp(new THREE.Color("#d1ad68"), clamp(n * 0.7 + 0.5, 0, 1)).lerp(new THREE.Color("#6f5b3b"), clamp(slope * 0.016, 0, 0.35));
  const tundraColor = new THREE.Color("#8fa198").lerp(new THREE.Color("#d6ddd6"), clamp(heightT * 0.75 + n * 0.14, 0, 1)).lerp(new THREE.Color("#67716b"), clamp(slope * 0.012, 0, 0.45));
  const forestColor = new THREE.Color("#253f28").lerp(new THREE.Color("#3f5b32"), clamp(n * 0.65 + 0.45, 0, 1)).lerp(new THREE.Color("#172618"), clamp(slope * 0.012, 0, 0.35));
  const color = base.clone();
  color.lerp(desertColor, clamp(desert * (1 - tundra * 0.45), 0, 0.86));
  color.lerp(forestColor, clamp(forest * (1 - desert * 0.65), 0, 0.72));
  color.lerp(tundraColor, clamp(tundra * (1 - desert * 0.2), 0, 0.82));
  color.multiplyScalar(0.96 + n * 0.055);
  return color;
}
function findTerrain(scene) {
  let best = null;
  scene.traverse((object) => {
    const pos = object.geometry?.attributes?.position;
    if (!object.isMesh || !pos) return;
    if (!best || pos.count > best.geometry.attributes.position.count) best = object;
  });
  return best;
}
function disposeTree(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    for (const material of materials) material.dispose?.();
  });
}
function removeOldTerraceMeshes(scene) {
  for (const name of ["biome-diversity-overlays", "monument-carved-terraces"]) {
    const old = scene.getObjectByName(name);
    if (old) { scene.remove(old); disposeTree(old); }
  }
}
function majorMonumentTargets(scene) {
  const targets = [];
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  scene.traverse((object) => {
    if (!object.isGroup || object.name.includes("water") || object.name.includes("army") || object.name.includes("unit") || object.name.includes("bridge")) return;
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    box.getCenter(center); box.getSize(size);
    const footprint = Math.max(size.x, size.z);
    if (size.y < 80 || footprint < 105 || footprint > 1200) return;
    targets.push({ x: center.x, z: center.z, y: box.min.y - 1.2, radius: clamp(footprint * 0.72, 145, 500), feather: clamp(footprint * 0.42, 80, 260) });
  });
  return targets;
}
function carveTempleTerrain(scene, terrain) {
  if (!terrain || terrain.userData.templeTerrainCarved) return;
  const targets = majorMonumentTargets(scene);
  if (targets.length === 0) return;
  const positions = terrain.geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i); const z = positions.getZ(i);
    let y = positions.getY(i);
    for (const target of targets) {
      const d = Math.hypot(x - target.x, z - target.z);
      if (d > target.radius + target.feather) continue;
      const flatT = 1 - smoothstep(target.radius, target.radius + target.feather, d);
      y = THREE.MathUtils.lerp(y, target.y, flatT);
    }
    positions.setY(i, y);
  }
  positions.needsUpdate = true;
  terrain.geometry.computeVertexNormals();
  terrain.userData.templeTerrainCarved = true;
  scene.userData.templeTerrainCarveCount = targets.length;
}
function recolorTerrain(scene, terrain) {
  if (!terrain || terrain.userData.terrainBiomeRecolored) return;
  const positions = terrain.geometry.attributes.position;
  let colors = terrain.geometry.attributes.color;
  if (!colors) {
    colors = new THREE.Float32BufferAttribute(new Float32Array(positions.count * 3), 3);
    terrain.geometry.setAttribute("color", colors);
  }
  const c = new THREE.Color();
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i); const z = positions.getZ(i); const y = positions.getY(i);
    c.copy(biomeColor(x, z, y));
    colors.setXYZ(i, c.r, c.g, c.b);
  }
  colors.needsUpdate = true;
  terrain.userData.terrainBiomeRecolored = true;
}
function createCobbleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#6f6758"; ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    const offset = (y / 32) % 2 ? 16 : 0;
    for (let x = -32; x < 256; x += 32) {
      const shade = 84 + ((x * 13 + y * 7) % 42);
      ctx.fillStyle = `rgb(${shade + 12},${shade + 4},${shade - 8})`;
      ctx.fillRect(x + offset + 2, y + 2, 28, 28);
      ctx.strokeStyle = "rgba(34,29,22,0.55)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + offset + 2, y + 2, 28, 28);
      ctx.strokeStyle = "rgba(218,199,162,0.18)";
      ctx.strokeRect(x + offset + 4, y + 4, 22, 22);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(18, 18);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function looksLikeRoadMaterial(material) {
  const list = Array.isArray(material) ? material : material ? [material] : [];
  return list.some((entry) => ROAD_MATERIAL_HEXES.has(entry?.color?.getHexString?.()));
}
function applyCobblestoneRoads(scene) {
  if (scene.userData.cobblestoneRoadsApplied) return;
  const cobbleTexture = createCobbleTexture();
  scene.traverse((object) => {
    if (!object.isMesh || !looksLikeRoadMaterial(object.material)) return;
    const oldMaterial = object.material;
    const material = new THREE.MeshStandardMaterial({
      color: "#8b806c",
      map: object.geometry?.attributes?.uv ? cobbleTexture : null,
      bumpMap: object.geometry?.attributes?.uv ? cobbleTexture : null,
      bumpScale: 2.2,
      roughness: 0.96,
      metalness: 0.0,
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -5
    });
    const positions = object.geometry.attributes.position;
    const colors = new THREE.Float32BufferAttribute(new Float32Array(positions.count * 3), 3);
    const c = new THREE.Color();
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i); const z = positions.getZ(i);
      const cell = (Math.floor(x * 0.035) + Math.floor(z * 0.035)) % 3;
      c.set(cell === 0 ? "#8f836e" : cell === 1 ? "#746b5b" : "#a09278");
      colors.setXYZ(i, c.r, c.g, c.b);
    }
    object.geometry.setAttribute("color", colors);
    object.material = material;
    const oldList = Array.isArray(oldMaterial) ? oldMaterial : [oldMaterial];
    for (const entry of oldList) entry?.dispose?.();
  });
  scene.userData.cobblestoneRoadsApplied = true;
}
function scaledPath(points, width) { const scaled = points.map(([x, z]) => ({ x: x * THEATER_SCALE, z: z * THEATER_SCALE })); return scaled.slice(1).map((point, index) => ({ a: scaled[index], b: point, width: width * THEATER_SCALE })); }
function riverSegments() { return [...scaledPath(MAIN_RIVER_POINTS, 74), ...scaledPath(BRANCH_RIVER_POINTS, 34), ...EXTRA_RIVERS.flatMap((river) => scaledPath(river.points, river.width))]; }
function roadSegments() { return ROAD_PATHS.flatMap((path) => scaledPath(path.points, path.width).map((segment) => ({ ...segment, kind: path.kind }))); }
function closestPointsOnSegments(a, b, c, d) {
  const ux = b.x - a.x; const uz = b.z - a.z; const vx = d.x - c.x; const vz = d.z - c.z; const wx = a.x - c.x; const wz = a.z - c.z;
  const aa = ux * ux + uz * uz; const bb = ux * vx + uz * vz; const cc = vx * vx + vz * vz; const dd = ux * wx + uz * wz; const ee = vx * wx + vz * wz;
  const denom = aa * cc - bb * bb;
  let s = denom === 0 ? 0 : clamp((bb * ee - cc * dd) / denom, 0, 1);
  let t = cc === 0 ? 0 : clamp((bb * s + ee) / cc, 0, 1);
  s = aa === 0 ? 0 : clamp((bb * t - dd) / aa, 0, 1);
  const p = { x: a.x + ux * s, z: a.z + uz * s }; const q = { x: c.x + vx * t, z: c.z + vz * t };
  return { p, q, distance: Math.hypot(p.x - q.x, p.z - q.z), s, t };
}
function findWaterSystem(scene) { let water = null; scene.traverse((object) => { if (!water && object.userData?.rivers && object.userData?.lakes && object.userData?.waterMaterials) water = object; }); return water; }
function tuneFogAndLighting(scene, renderer) {
  renderer.toneMappingExposure = 1.18;
  renderer.setClearColor?.("#789198", 1);
  if (scene.fog?.density) scene.fog.density = 0.00007;
  scene.traverse((object) => {
    if (object.material?.uniforms?.fogDensity) object.material.uniforms.fogDensity.value = 0.000075;
    if (object.isDirectionalLight) { object.intensity = Math.max(object.intensity, 7.1); object.color.set("#ffd09a"); object.shadow.bias = -0.00018; object.shadow.normalBias = 0.025; }
    if (object.isHemisphereLight) { object.intensity = 0.92; object.color.set("#a5bdca"); object.groundColor.set("#182318"); }
  });
  if (!scene.getObjectByName("cool-contrast-fill-light")) {
    const fill = new THREE.DirectionalLight("#5b6f87", 0.55);
    fill.position.set(3200, 1900, -4200);
    fill.name = "cool-contrast-fill-light";
    scene.add(fill);
  }
}
function densifyLakeWater(waterSystem) {
  if (!waterSystem || waterSystem.userData.lakeUvDensifiedNaturalPass) return;
  for (const lake of waterSystem.userData.lakes ?? []) {
    const uv = lake.geometry?.attributes?.uv;
    if (!uv) continue;
    for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * 8.0, uv.getY(i) * 8.0);
    uv.needsUpdate = true;
    lake.userData.lakeTilingScale = 8.0;
  }
  waterSystem.userData.lakeUvDensifiedNaturalPass = true;
}
function hideOldProvinceForceCircles(scene) {
  scene.traverse((object) => {
    if (!object.isMesh) return;
    const hex = object.material?.color?.getHexString?.();
    if (["4f9b49", "2d6ecf", "b7332a"].includes(hex) && object.material?.transparent && object.material?.opacity >= 0.2) object.visible = false;
  });
}
function hideOldBridges(scene) { const oldBridge = scene.getObjectByName("water-bridge-crossings"); if (oldBridge) oldBridge.visible = false; }
function createBridge({ x, z, river, path }) {
  const riverDx = river.b.x - river.a.x; const riverDz = river.b.z - river.a.z; const riverLen = Math.max(1, Math.hypot(riverDx, riverDz));
  const normal = { x: -riverDz / riverLen, z: riverDx / riverLen };
  const yaw = Math.atan2(-normal.z, normal.x);
  const length = Math.max(160, river.width * 1.85 + 72); const width = Math.max(30, path.width * 2.2);
  const group = new THREE.Group(); group.name = "corrected-river-crossing-bridge"; group.position.set(x, terrainHeight(x, z) + 46, z); group.rotation.y = yaw;
  const deckMat = new THREE.MeshStandardMaterial({ color: "#8a6d46", roughness: 0.88, metalness: 0.0 }); const railMat = new THREE.MeshStandardMaterial({ color: "#4c3525", roughness: 0.92, metalness: 0.0 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(length, 8, width), deckMat); deck.position.y = 4; deck.castShadow = true; deck.receiveShadow = true; group.add(deck);
  for (const side of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(length * 0.95, 9, 5), railMat); rail.position.set(0, 13, side * width * 0.62); rail.castShadow = true; group.add(rail); }
  return group;
}
function addCorrectedBridges(scene) {
  if (scene.getObjectByName("corrected-water-bridge-crossings")) return;
  hideOldBridges(scene);
  const group = new THREE.Group(); group.name = "corrected-water-bridge-crossings"; const made = []; const rivers = riverSegments();
  for (const path of roadSegments()) for (const river of rivers) {
    const hit = closestPointsOnSegments(path.a, path.b, river.a, river.b); const threshold = river.width * 0.52 + path.width + 18;
    if (hit.distance > threshold || hit.s < 0.03 || hit.s > 0.97 || hit.t < 0.02 || hit.t > 0.98) continue;
    const x = (hit.p.x + hit.q.x) * 0.5; const z = (hit.p.z + hit.q.z) * 0.5;
    if (made.some((prior) => Math.hypot(prior.x - x, prior.z - z) < 260)) continue;
    made.push({ x, z }); group.add(createBridge({ x, z, river, path }));
  }
  scene.add(group);
  scene.userData.worldEncounterReplaceables?.push(group);
}
function applyVisualUpgrades(scene, renderer) {
  if (scene.userData.visualUpgradeAppliedTempleRoadPass) return;
  removeOldTerraceMeshes(scene);
  tuneFogAndLighting(scene, renderer.renderer ?? renderer);
  const terrain = findTerrain(scene);
  carveTempleTerrain(scene, terrain);
  recolorTerrain(scene, terrain);
  applyCobblestoneRoads(scene);
  densifyLakeWater(findWaterSystem(scene));
  hideOldProvinceForceCircles(scene);
  addCorrectedBridges(scene);
  scene.userData.visualUpgradeAppliedTempleRoadPass = true;
  scene.userData.waterSafetyVersion = "terrain-carved-temples-cobblestone-roads-pass-8";
}

export async function createRenderer(canvas) {
  const base = await createArmyRenderer(canvas);
  applyVisualUpgrades(base.scene, base.renderer);
  base.captureScreenshot = () => {
    try { return base.renderer.domElement.toDataURL("image/png"); } catch { return null; }
  };
  return base;
}
