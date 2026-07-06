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
const BIOMES = [
  { name: "saharan-desert", center: [-260, -1960], radiusX: 1900, radiusZ: 1180, rotation: -0.12, color: "#c99a50", opacity: 0.30 },
  { name: "mauretanian-drylands", center: [-2740, -1860], radiusX: 1400, radiusZ: 840, rotation: 0.35, color: "#b88747", opacity: 0.25 },
  { name: "northern-tundra", center: [-880, 1850], radiusX: 1720, radiusZ: 880, rotation: 0.24, color: "#c7d3cc", opacity: 0.28 },
  { name: "alpine-tundra", center: [-2260, 1360], radiusX: 1180, radiusZ: 680, rotation: -0.38, color: "#a9b8b2", opacity: 0.18 },
  { name: "germanic-forest", center: [1420, 460], radiusX: 1650, radiusZ: 1050, rotation: 0.22, color: "#234a2e", opacity: 0.26 },
  { name: "dacian-forest", center: [2180, -1540], radiusX: 1320, radiusZ: 860, rotation: -0.18, color: "#1d442f", opacity: 0.22 },
  { name: "italian-temperate", center: [420, 1380], radiusX: 1200, radiusZ: 720, rotation: 0.12, color: "#596f37", opacity: 0.18 }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
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
function scaledPath(points, width) {
  const scaled = points.map(([x, z]) => ({ x: x * THEATER_SCALE, z: z * THEATER_SCALE }));
  return scaled.slice(1).map((point, index) => ({ a: scaled[index], b: point, width: width * THEATER_SCALE }));
}
function riverSegments() {
  return [
    ...scaledPath(MAIN_RIVER_POINTS, 74),
    ...scaledPath(BRANCH_RIVER_POINTS, 34),
    ...EXTRA_RIVERS.flatMap((river) => scaledPath(river.points, river.width))
  ];
}
function roadSegments() {
  return ROAD_PATHS.flatMap((path) => scaledPath(path.points, path.width).map((segment) => ({ ...segment, kind: path.kind })));
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
  const p = { x: a.x + ux * s, z: a.z + uz * s };
  const q = { x: c.x + vx * t, z: c.z + vz * t };
  return { p, q, distance: Math.hypot(p.x - q.x, p.z - q.z), s, t };
}
function findWaterSystem(scene) {
  let water = null;
  scene.traverse((object) => {
    if (water) return;
    if (object.userData?.rivers && object.userData?.lakes && object.userData?.waterMaterials) water = object;
  });
  return water;
}
function disposeTree(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    for (const material of materials) material.dispose?.();
  });
}
function createContourEllipse({ center, radiusX, radiusZ, rotation, color, opacity, name, yOffset = 6 }) {
  const rings = 5;
  const segments = 96;
  const centerX = center[0] * THEATER_SCALE;
  const centerZ = center[1] * THEATER_SCALE;
  const rx = radiusX * THEATER_SCALE;
  const rz = radiusZ * THEATER_SCALE;
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const vertices = [];
  const indices = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    const ringT = ring / rings;
    for (let i = 0; i <= segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const wobble = 1 + Math.sin(angle * 3.0 + centerX * 0.0007) * 0.05 + Math.cos(angle * 5.0 + centerZ * 0.0009) * 0.035;
      const lx = Math.cos(angle) * rx * ringT * wobble;
      const lz = Math.sin(angle) * rz * ringT * wobble;
      const x = centerX + lx * cosR - lz * sinR;
      const z = centerZ + lx * sinR + lz * cosR;
      vertices.push(x, terrainHeight(x, z) + yOffset + ringT * 0.6, z);
    }
  }
  const row = segments + 1;
  for (let ring = 0; ring < rings; ring += 1) {
    for (let i = 0; i < segments; i += 1) {
      const a = ring * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -8 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.renderOrder = 6;
  return mesh;
}
function addBiomeOverlays(scene) {
  if (scene.getObjectByName("biome-diversity-overlays")) return;
  const group = new THREE.Group();
  group.name = "biome-diversity-overlays";
  for (const biome of BIOMES) group.add(createContourEllipse(biome));
  scene.add(group);
}
function tuneLighting(scene, renderer) {
  renderer.toneMappingExposure = 1.22;
  if (scene.fog?.density) scene.fog.density = 0.000125;
  scene.traverse((object) => {
    if (object.isDirectionalLight) {
      object.intensity = Math.max(object.intensity, 7.4);
      object.color.set("#ffd19a");
      object.shadow.bias = -0.00018;
      object.shadow.normalBias = 0.025;
    }
    if (object.isHemisphereLight) {
      object.intensity = 1.05;
      object.color.set("#a9c5d4");
      object.groundColor.set("#1f2a20");
    }
  });
  const fill = new THREE.DirectionalLight("#667a91", 0.72);
  fill.position.set(3200, 1900, -4200);
  fill.name = "cool-contrast-fill-light";
  scene.add(fill);
}
function densifyLakeWater(waterSystem) {
  if (!waterSystem || waterSystem.userData.lakeUvDensified) return;
  for (const lake of waterSystem.userData.lakes ?? []) {
    const uv = lake.geometry?.attributes?.uv;
    if (!uv) continue;
    for (let i = 0; i < uv.count; i += 1) {
      uv.setXY(i, uv.getX(i) * 6.5, uv.getY(i) * 6.5);
    }
    uv.needsUpdate = true;
    if (lake.material) lake.material.needsUpdate = true;
    lake.userData.lakeTilingScale = 6.5;
  }
  waterSystem.userData.lakeUvDensified = true;
}
function hideOldProvinceForceCircles(scene) {
  scene.traverse((object) => {
    if (!object.isMesh) return;
    const hex = object.material?.color?.getHexString?.();
    const looksRgbForceCircle = object.geometry?.type === "BufferGeometry" && ["4f9b49", "2d6ecf", "b7332a"].includes(hex) && object.material?.transparent && object.material?.opacity >= 0.35;
    const looksForceDisc = object.geometry?.type === "CylinderGeometry" && ["4f9b49", "2d6ecf", "b7332a"].includes(hex) && object.scale?.x >= 1;
    if (looksRgbForceCircle || looksForceDisc) object.visible = false;
  });
}
function hideOldBridges(scene) {
  const oldBridge = scene.getObjectByName("water-bridge-crossings");
  if (oldBridge) oldBridge.visible = false;
}
function createBridge({ x, z, river, path }) {
  const riverDx = river.b.x - river.a.x;
  const riverDz = river.b.z - river.a.z;
  const riverLen = Math.max(1, Math.hypot(riverDx, riverDz));
  const normal = { x: -riverDz / riverLen, z: riverDx / riverLen };
  const yaw = Math.atan2(-normal.z, normal.x);
  const length = Math.max(150, river.width * 1.75 + 60);
  const width = Math.max(28, path.width * 2.2);
  const group = new THREE.Group();
  group.name = "corrected-river-crossing-bridge";
  group.position.set(x, terrainHeight(x, z) + 46, z);
  group.rotation.y = yaw;
  const deckMat = new THREE.MeshStandardMaterial({ color: "#8a6d46", roughness: 0.88, metalness: 0.0 });
  const railMat = new THREE.MeshStandardMaterial({ color: "#4c3525", roughness: 0.92, metalness: 0.0 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(length, 8, width), deckMat);
  deck.position.y = 4;
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(length * 0.95, 9, 5), railMat);
    rail.position.set(0, 13, side * width * 0.62);
    rail.castShadow = true;
    group.add(rail);
  }
  group.renderOrder = 32;
  return group;
}
function addCorrectedBridges(scene) {
  if (scene.getObjectByName("corrected-water-bridge-crossings")) return;
  hideOldBridges(scene);
  const group = new THREE.Group();
  group.name = "corrected-water-bridge-crossings";
  const made = [];
  const rivers = riverSegments();
  for (const path of roadSegments()) {
    for (const river of rivers) {
      const hit = closestPointsOnSegments(path.a, path.b, river.a, river.b);
      const threshold = river.width * 0.52 + path.width + 18;
      if (hit.distance > threshold || hit.s < 0.03 || hit.s > 0.97 || hit.t < 0.02 || hit.t > 0.98) continue;
      const x = (hit.p.x + hit.q.x) * 0.5;
      const z = (hit.p.z + hit.q.z) * 0.5;
      if (made.some((prior) => Math.hypot(prior.x - x, prior.z - z) < 260)) continue;
      made.push({ x, z });
      group.add(createBridge({ x, z, river, path }));
    }
  }
  scene.add(group);
}
function addMonumentTerraces(scene) {
  if (scene.getObjectByName("monument-carved-terraces")) return;
  const group = new THREE.Group();
  group.name = "monument-carved-terraces";
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  scene.traverse((object) => {
    if (!object.isGroup || object.name.includes("water") || object.name.includes("army") || object.name.includes("unit")) return;
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    box.getCenter(center);
    box.getSize(size);
    const footprint = Math.max(size.x, size.z);
    if (size.y < 80 || footprint < 100 || footprint > 1200) return;
    const radius = clamp(footprint * 0.68, 130, 440);
    const y = terrainHeight(center.x, center.z) + 9.0;
    const geometry = new THREE.CylinderGeometry(radius, radius * 1.08, 7, 9);
    const material = new THREE.MeshStandardMaterial({ color: "#92784e", roughness: 0.94, metalness: 0.0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    const pad = new THREE.Mesh(geometry, material);
    pad.name = "carved-monument-terrace";
    pad.position.set(center.x, y, center.z);
    pad.rotation.y = object.rotation.y;
    pad.scale.z = 0.78;
    pad.receiveShadow = true;
    pad.castShadow = false;
    pad.renderOrder = 9;
    group.add(pad);
  });
  if (group.children.length > 0) scene.add(group);
}
function applyVisualUpgrades(scene, renderer) {
  if (scene.userData.visualUpgradeApplied) return;
  tuneLighting(scene, renderer.renderer ?? renderer);
  addBiomeOverlays(scene);
  const waterSystem = findWaterSystem(scene);
  densifyLakeWater(waterSystem);
  hideOldProvinceForceCircles(scene);
  addCorrectedBridges(scene);
  addMonumentTerraces(scene);
  scene.userData.visualUpgradeApplied = true;
  scene.userData.waterSafetyVersion = "visual-biome-bridge-lighting-pass-6";
}

export async function createRenderer(canvas) {
  const base = await createArmyRenderer(canvas);
  applyVisualUpgrades(base.scene, base.renderer);
  return base;
}
