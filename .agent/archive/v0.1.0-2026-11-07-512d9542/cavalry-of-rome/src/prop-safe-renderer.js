import * as THREE from "three";
import { createRenderer as createWaterSafeRenderer } from "./water-safe-renderer.js";

const THEATER_SCALE = 2.55;
const RIVER_MARGIN = 58;
const LAKE_MARGIN = 74;
const RESERVED_COLORS = new Set(["4f9b49", "2d6ecf", "b7332a", "5fc9ff", "d9b847"]);

const MAIN_RIVER_POINTS = [[-640, 2250], [-560, 1880], [-470, 1510], [-390, 1160], [-330, 760], [-245, 520], [-160, 260], [-105, 20], [-20, -220], [35, -470], [105, -760], [185, -1160], [255, -1560], [360, -2040], [470, -2400]];
const BRANCH_RIVER_POINTS = [[-1850, 1320], [-1520, 1130], [-1190, 930], [-850, 680], [-650, 520], [-500, 390], [-360, 260], [-230, 130], [-145, 15], [-100, -80]];
const EXTRA_RIVERS = [
  { width: 42, points: [[-3100, -380], [-2660, -210], [-2210, -40], [-1760, 210], [-1360, 470], [-1030, 680], [-760, 980]] },
  { width: 36, points: [[-420, 2820], [-330, 2440], [-190, 2060], [60, 1710], [420, 1380], [750, 1110], [970, 820]] },
  { width: 32, points: [[1640, 2380], [1420, 1960], [1220, 1540], [1140, 1050], [1420, 460], [1600, -120]] },
  { width: 38, points: [[2650, -2450], [2360, -1980], [2180, -1540], [1980, -1080], [1760, -620], [1500, -250]] },
  { width: 28, points: [[-2860, -2100], [-2400, -1920], [-1920, -1640], [-1680, -860], [-1440, -420], [-1180, -120]] }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeSegments(points, width) {
  const scaled = points.map(([x, z]) => ({ x: x * THEATER_SCALE, z: z * THEATER_SCALE }));
  return scaled.slice(1).map((point, index) => ({ a: scaled[index], b: point, width: width * THEATER_SCALE }));
}

const RIVER_SEGMENTS = [
  ...makeSegments(MAIN_RIVER_POINTS, 74),
  ...makeSegments(BRANCH_RIVER_POINTS, 34),
  ...EXTRA_RIVERS.flatMap((river) => makeSegments(river.points, river.width))
];

function distanceToSegment(x, z, segment) {
  const abx = segment.b.x - segment.a.x;
  const abz = segment.b.z - segment.a.z;
  const apx = x - segment.a.x;
  const apz = z - segment.a.z;
  const lenSq = abx * abx + abz * abz;
  const t = lenSq === 0 ? 0 : clamp((apx * abx + apz * abz) / lenSq, 0, 1);
  const px = segment.a.x + abx * t;
  const pz = segment.a.z + abz * t;
  return Math.hypot(x - px, z - pz);
}

function materialColors(material) {
  const list = !material ? [] : Array.isArray(material) ? material : [material];
  return list.map((entry) => entry?.color?.getHexString?.()).filter(Boolean);
}

function findWaterSystem(scene) {
  let result = null;
  scene.traverse((object) => {
    if (result) return;
    if (object.userData?.rivers && object.userData?.lakes && object.userData?.waterMaterials) result = object;
  });
  return result;
}

function lakeRadius(lake, x, z, margin) {
  const centerX = lake.center[0] * THEATER_SCALE;
  const centerZ = lake.center[1] * THEATER_SCALE;
  const cosR = Math.cos(-lake.rotation);
  const sinR = Math.sin(-lake.rotation);
  const dx = x - centerX;
  const dz = z - centerZ;
  const localX = dx * cosR - dz * sinR;
  const localZ = dx * sinR + dz * cosR;
  const radiusX = lake.radiusX * THEATER_SCALE + margin;
  const radiusZ = lake.radiusZ * THEATER_SCALE + margin;
  return Math.sqrt((localX * localX) / (radiusX * radiusX) + (localZ * localZ) / (radiusZ * radiusZ));
}

function inLake(lakes, x, z) {
  return lakes.some((lake) => lakeRadius(lake, x, z, LAKE_MARGIN) < 1.0);
}

function inRiver(x, z) {
  return RIVER_SEGMENTS.some((segment) => distanceToSegment(x, z, segment) < segment.width * 0.58 + RIVER_MARGIN);
}

function inWater(lakes, x, z) {
  return inLake(lakes, x, z) || inRiver(x, z);
}

function protectInstanced(mesh) {
  return materialColors(mesh.material).some((hex) => RESERVED_COLORS.has(hex));
}

function clearInstancedProps(scene, lakes) {
  const matrix = new THREE.Matrix4();
  const world = new THREE.Vector3();
  const parked = new THREE.Matrix4().compose(new THREE.Vector3(0, -10000, 0), new THREE.Quaternion(), new THREE.Vector3(0.001, 0.001, 0.001));
  let moved = 0;

  scene.traverse((object) => {
    if (!object.isInstancedMesh || protectInstanced(object)) return;
    let changed = false;
    for (let i = 0; i < object.count; i += 1) {
      object.getMatrixAt(i, matrix);
      world.setFromMatrixPosition(matrix);
      object.localToWorld(world);
      if (!inWater(lakes, world.x, world.z)) continue;
      object.setMatrixAt(i, parked);
      changed = true;
      moved += 1;
    }
    if (changed) {
      object.instanceMatrix.needsUpdate = true;
      object.userData.waterClearanceAdjusted = true;
    }
  });

  return moved;
}

function protectedNode(object) {
  let node = object;
  while (node) {
    const name = String(node.name ?? "");
    if (name.includes("bridge") || name.includes("water") || name.includes("river") || name.includes("lake") || name.includes("province") || name.includes("region") || name.includes("sky") || name.includes("terrain")) return true;
    if (node.userData?.rivers || node.userData?.lakes || node.userData?.regionId || node.userData?.laneId) return true;
    node = node.parent;
  }
  return false;
}

function clearLooseProps(scene, lakes) {
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  let moved = 0;

  scene.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh || protectedNode(object)) return;
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    box.getCenter(center);
    box.getSize(size);
    if (Math.max(size.x, size.y, size.z) > 80) return;
    if (!inWater(lakes, center.x, center.z)) return;
    object.visible = false;
    object.userData.waterClearanceAdjusted = true;
    moved += 1;
  });

  return moved;
}

function applyPropClearance(scene) {
  if (scene.userData.propWaterClearanceApplied) return;
  const waterSystem = findWaterSystem(scene);
  const lakes = waterSystem?.userData?.lakeDefinitions ?? [];
  if (lakes.length === 0) return;

  const instances = clearInstancedProps(scene, lakes);
  const meshes = clearLooseProps(scene, lakes);
  scene.userData.propWaterClearanceApplied = true;
  scene.userData.propWaterClearanceStats = { instances, meshes };
  scene.userData.waterSafetyVersion = "prop-water-clearance-pass-5";
}

export async function createRenderer(canvas) {
  const renderer = await createWaterSafeRenderer(canvas);
  applyPropClearance(renderer.scene);
  return renderer;
}
