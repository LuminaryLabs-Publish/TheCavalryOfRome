import * as THREE from "three";
import { createRenderer as createBaseRenderer } from "./renderer.js";

const THEATER_SCALE = 2.55;
const WATER_MIN_CLEARANCE = 14.0;
const WATER_EDGE_CLEARANCE = 18.0;
const RIVER_WAVE_SINK_ALLOWANCE = 4.0;
const LAKE_WAVE_SINK_ALLOWANCE = 3.0;
const WATER_RENDER_ORDER = 20;
const WATER_OVERLAY_RENDER_ORDER = 21;
const STRUCTURE_FLAT_RADIUS = 1180;
const STRUCTURE_FLAT_SAMPLES = 64;

const MAIN_RIVER_POINTS = [
  [-640, 2250],
  [-560, 1880],
  [-470, 1510],
  [-390, 1160],
  [-330, 760],
  [-245, 520],
  [-160, 260],
  [-105, 20],
  [-20, -220],
  [35, -470],
  [105, -760],
  [185, -1160],
  [255, -1560],
  [360, -2040],
  [470, -2400]
];

const BRANCH_RIVER_POINTS = [
  [-1850, 1320],
  [-1520, 1130],
  [-1190, 930],
  [-850, 680],
  [-650, 520],
  [-500, 390],
  [-360, 260],
  [-230, 130],
  [-145, 15],
  [-100, -80]
];

const ADDITIONAL_RIVER_SYSTEMS = [
  {
    width: 42,
    points: [[-3100, -380], [-2660, -210], [-2210, -40], [-1760, 210], [-1360, 470], [-1030, 680], [-760, 980]]
  },
  {
    width: 36,
    points: [[-420, 2820], [-330, 2440], [-190, 2060], [60, 1710], [420, 1380], [750, 1110], [970, 820]]
  },
  {
    width: 32,
    points: [[1640, 2380], [1420, 1960], [1220, 1540], [1140, 1050], [1420, 460], [1600, -120]]
  },
  {
    width: 38,
    points: [[2650, -2450], [2360, -1980], [2180, -1540], [1980, -1080], [1760, -620], [1500, -250]]
  },
  {
    width: 28,
    points: [[-2860, -2100], [-2400, -1920], [-1920, -1640], [-1680, -860], [-1440, -420], [-1180, -120]]
  }
];

const LAKE_DEFINITIONS = [
  { center: [-2520, -240], radiusX: 340, radiusZ: 190, rotation: 0.35 },
  { center: [3020, 760], radiusX: 420, radiusZ: 230, rotation: -0.25 },
  { center: [-1180, 2320], radiusX: 300, radiusZ: 180, rotation: 0.12 },
  { center: [1780, -2240], radiusX: 380, radiusZ: 210, rotation: 0.48 },
  { center: [420, -360], radiusX: 260, radiusZ: 145, rotation: -0.42 },
  { center: [-3260, 1020], radiusX: 280, radiusZ: 170, rotation: 0.78 }
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

function terrainSlope(x, z, step = 42) {
  const dx = Math.abs(terrainHeight(x + step, z) - terrainHeight(x - step, z));
  const dz = Math.abs(terrainHeight(x, z + step) - terrainHeight(x, z - step));
  return dx + dz;
}

function waterY(x, z, clearance = WATER_MIN_CLEARANCE) {
  return terrainHeight(x, z) + clearance;
}

function clampWaterY(x, z, y, clearance = WATER_MIN_CLEARANCE) {
  return Math.max(y, waterY(x, z, clearance));
}

function scaledPoint(point) {
  return [point[0] * THEATER_SCALE, point[1] * THEATER_SCALE];
}

function seededRandom(seed) {
  return Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
}

function distanceToSegment2D(px, pz, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const apx = px - ax;
  const apz = pz - az;
  const lenSq = abx * abx + abz * abz;
  const t = lenSq === 0 ? 0 : clamp((apx * abx + apz * abz) / lenSq, 0, 1);
  const x = ax + abx * t;
  const z = az + abz * t;
  const dx = px - x;
  const dz = pz - z;
  return Math.sqrt(dx * dx + dz * dz);
}

function isNearKnownWater(x, z, clearance = 260) {
  const systems = [
    { points: MAIN_RIVER_POINTS, width: 74 },
    { points: BRANCH_RIVER_POINTS, width: 34 },
    ...ADDITIONAL_RIVER_SYSTEMS
  ];

  for (const system of systems) {
    for (let i = 1; i < system.points.length; i += 1) {
      const [ax, az] = scaledPoint(system.points[i - 1]);
      const [bx, bz] = scaledPoint(system.points[i]);
      if (distanceToSegment2D(x, z, ax, az, bx, bz) < clearance + system.width * THEATER_SCALE) return true;
    }
  }

  for (const lake of LAKE_DEFINITIONS) {
    const centerX = lake.center[0] * THEATER_SCALE;
    const centerZ = lake.center[1] * THEATER_SCALE;
    const cosR = Math.cos(-lake.rotation);
    const sinR = Math.sin(-lake.rotation);
    const dx = x - centerX;
    const dz = z - centerZ;
    const localX = dx * cosR - dz * sinR;
    const localZ = dx * sinR + dz * cosR;
    const radiusX = lake.radiusX * THEATER_SCALE + clearance;
    const radiusZ = lake.radiusZ * THEATER_SCALE + clearance;
    const lakeDistance = (localX * localX) / (radiusX * radiusX) + (localZ * localZ) / (radiusZ * radiusZ);
    if (lakeDistance < 1.0) return true;
  }

  return false;
}

function findBestStructureSpot(x, z, radius = STRUCTURE_FLAT_RADIUS, samples = STRUCTURE_FLAT_SAMPLES) {
  let best = {
    x,
    z,
    slope: terrainSlope(x, z),
    waterPenalty: isNearKnownWater(x, z) ? 950 : 0,
    distance: 0
  };

  for (let i = 0; i < samples; i += 1) {
    const angle = (i / samples) * Math.PI * 2;
    for (const ringT of [0.16, 0.3, 0.46, 0.64, 0.84, 1.0]) {
      const wobble = 0.92 + seededRandom(i * 101 + Math.floor(ringT * 1000)) * 0.18;
      const candidateX = x + Math.cos(angle) * radius * ringT * wobble;
      const candidateZ = z + Math.sin(angle) * radius * ringT * wobble;
      const distance = Math.sqrt((candidateX - x) ** 2 + (candidateZ - z) ** 2);
      const waterPenalty = isNearKnownWater(candidateX, candidateZ) ? 950 : 0;
      const slope = terrainSlope(candidateX, candidateZ);
      const score = slope + waterPenalty + distance * 0.0025;
      const bestScore = best.slope + best.waterPenalty + best.distance * 0.0025;
      if (score < bestScore) {
        best = { x: candidateX, z: candidateZ, slope, waterPenalty, distance };
      }
    }
  }

  return best;
}

function findWaterSystem(scene) {
  let waterSystem = null;
  scene.traverse((object) => {
    if (waterSystem) return;
    if (object.userData?.rivers && object.userData?.lakes && object.userData?.waterMaterials) {
      waterSystem = object;
    }
  });
  return waterSystem;
}

function asMaterialList(material) {
  if (!material) return [];
  return Array.isArray(material) ? material : [material];
}

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
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const safeBase = waterY(x, z, WATER_MIN_CLEARANCE + sinkAllowance);
    baseY[i] = Math.max(baseY[i], safeBase);
    positions.setY(i, Math.max(positions.getY(i), baseY[i]));
  }

  positions.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
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

function lakeBasinY(definition) {
  const centerX = definition.center[0] * THEATER_SCALE;
  const centerZ = definition.center[1] * THEATER_SCALE;
  const radiusX = definition.radiusX * THEATER_SCALE;
  const radiusZ = definition.radiusZ * THEATER_SCALE;
  const cosR = Math.cos(definition.rotation);
  const sinR = Math.sin(definition.rotation);
  const heights = [terrainHeight(centerX, centerZ)];

  for (const ringT of [0.22, 0.38, 0.54, 0.7, 0.84]) {
    for (let i = 0; i < 32; i += 1) {
      const angle = (i / 32) * Math.PI * 2;
      const localX = Math.cos(angle) * radiusX * ringT;
      const localZ = Math.sin(angle) * radiusZ * ringT;
      const x = centerX + localX * cosR - localZ * sinR;
      const z = centerZ + localX * sinR + localZ * cosR;
      heights.push(terrainHeight(x, z));
    }
  }

  heights.sort((a, b) => a - b);
  return heights[Math.floor(heights.length * 0.86)] + WATER_MIN_CLEARANCE + LAKE_WAVE_SINK_ALLOWANCE;
}

function stabilizeLakeBase(mesh, definition) {
  const positions = mesh.geometry?.attributes?.position;
  const baseY = mesh.userData?.baseY;
  if (!positions || !baseY || !definition) return;

  const basinY = lakeBasinY(definition);

  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const ringT = clamp(lakeLocalRadius(definition, x, z), 0, 1.35);
    const edgeLift = ringT > 0.76 ? (ringT - 0.76) * 14.0 : 0;
    const shorelineSafety = waterY(x, z, WATER_MIN_CLEARANCE + LAKE_WAVE_SINK_ALLOWANCE + edgeLift * 0.7);
    const stableY = Math.max(basinY + edgeLift, shorelineSafety);
    baseY[i] = stableY;
    positions.setY(i, stableY);
  }

  positions.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

function clampAnimatedWater(mesh, clearance = WATER_MIN_CLEARANCE) {
  const positions = mesh.geometry?.attributes?.position;
  if (!positions) return;

  let changed = false;
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = positions.getY(i);
    const safeY = clampWaterY(x, z, y, clearance);
    if (safeY !== y) {
      positions.setY(i, safeY);
      changed = true;
    }
  }

  if (changed) {
    positions.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }
}

function createMistTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 126);
  gradient.addColorStop(0, "rgba(255,255,255,0.88)");
  gradient.addColorStop(0.32, "rgba(255,255,255,0.34)");
  gradient.addColorStop(0.72, "rgba(255,255,255,0.08)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createTerrainEndcap({ x, z, radiusX, radiusZ, rotation, material }) {
  const segments = 40;
  const vertices = [x, waterY(x, z, WATER_EDGE_CLEARANCE), z];
  const indices = [];
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);

  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const localX = Math.cos(angle) * radiusX;
    const localZ = Math.sin(angle) * radiusZ;
    const vx = x + localX * cosR - localZ * sinR;
    const vz = z + localX * sinR + localZ * cosR;
    vertices.push(vx, waterY(vx, vz, WATER_EDGE_CLEARANCE), vz);

    if (i < segments) {
      indices.push(0, i + 1, i + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const cap = new THREE.Mesh(geometry, material);
  cap.receiveShadow = true;
  cap.renderOrder = WATER_RENDER_ORDER - 1;
  return cap;
}

function riverEndpointAnchors() {
  const systems = [
    { points: MAIN_RIVER_POINTS, width: 74 },
    { points: BRANCH_RIVER_POINTS, width: 34 },
    ...ADDITIONAL_RIVER_SYSTEMS
  ];
  const anchors = [];

  for (const system of systems) {
    const first = system.points[0];
    const second = system.points[1] ?? first;
    const last = system.points[system.points.length - 1];
    const beforeLast = system.points[system.points.length - 2] ?? last;

    for (const [point, neighbor] of [[first, second], [last, beforeLast]]) {
      const [x, z] = scaledPoint(point);
      const [nx, nz] = scaledPoint(neighbor);
      anchors.push({
        x,
        z,
        width: system.width * THEATER_SCALE,
        rotation: Math.atan2(nz - z, nx - x)
      });
    }
  }

  return anchors;
}

function createDynamicEndpointCover() {
  const group = new THREE.Group();
  const mistTexture = createMistTexture();
  const mistGeometry = new THREE.PlaneGeometry(1, 1);
  const capMaterial = new THREE.MeshStandardMaterial({
    color: "#6d6246",
    roughness: 0.98,
    metalness: 0.0,
    transparent: true,
    opacity: 0.72,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -10
  });

  riverEndpointAnchors().forEach((anchor, index) => {
    const cap = createTerrainEndcap({
      x: anchor.x,
      z: anchor.z,
      radiusX: anchor.width * 0.9,
      radiusZ: anchor.width * 0.48,
      rotation: anchor.rotation,
      material: capMaterial
    });
    group.add(cap);

    const mistMaterial = new THREE.MeshBasicMaterial({
      color: index % 2 ? "#d5ded4" : "#c8d2c9",
      map: mistTexture,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
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

  for (const material of waterSystem.userData.waterMaterials ?? []) {
    applyWaterMaterialSafety(material);
  }

  for (const river of waterSystem.userData.rivers ?? []) {
    stabilizeRibbonBase(river, RIVER_WAVE_SINK_ALLOWANCE);
    applyWaterMeshSafety(river);
  }

  for (let i = 0; i < (waterSystem.userData.lakes ?? []).length; i += 1) {
    const lake = waterSystem.userData.lakes[i];
    stabilizeLakeBase(lake, LAKE_DEFINITIONS[i]);
    applyWaterMeshSafety(lake);
  }

  for (const ribbon of waterSystem.userData.flowRibbons ?? []) {
    ribbon.visible = false;
    for (const material of asMaterialList(ribbon.material)) {
      material.opacity = 0;
      material.needsUpdate = true;
    }
  }

  waterSystem.userData.waterSafetyApplied = true;
}

function clampWaterBeforeRender(waterSystem) {
  if (!waterSystem) return;

  for (const river of waterSystem.userData.rivers ?? []) {
    clampAnimatedWater(river, WATER_MIN_CLEARANCE);
  }

  for (const lake of waterSystem.userData.lakes ?? []) {
    clampAnimatedWater(lake, WATER_MIN_CLEARANCE);
  }
}

function removeSceneSunDisc(scene) {
  const removals = [];
  scene.traverse((object) => {
    if (!object.isMesh) return;
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    const isCircleSun = object.geometry?.type === "CircleGeometry" && material?.isMeshBasicMaterial;
    const isAdditiveSun = material?.blending === THREE.AdditiveBlending && material?.opacity >= 0.5 && material?.opacity <= 0.65;
    if (isCircleSun && isAdditiveSun) removals.push(object);
  });

  for (const object of removals) {
    object.parent?.remove(object);
    object.geometry?.dispose?.();
    for (const material of asMaterialList(object.material)) material.dispose?.();
  }
}

function isLargeGroundedStructure(object) {
  if (!object.isGroup || object.position.lengthSq() < 1 || object.name === "dynamic-water-endpoint-cover") return false;
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return false;
  const size = new THREE.Vector3();
  box.getSize(size);
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
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: "#8b7650",
    roughness: 0.96,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8
  });
  const pad = new THREE.Mesh(geometry, material);
  pad.receiveShadow = true;
  pad.renderOrder = 8;
  return pad;
}

function flattenMajorGroundedStructures(scene) {
  const structures = [];
  scene.traverse((object) => {
    if (isLargeGroundedStructure(object)) structures.push(object);
  });

  const padGroup = new THREE.Group();
  padGroup.name = "major-structure-flat-ground-pads";

  for (const structure of structures) {
    const box = new THREE.Box3().setFromObject(structure);
    const size = new THREE.Vector3();
    box.getSize(size);
    const currentX = structure.position.x;
    const currentZ = structure.position.z;
    const currentOffset = clamp(structure.position.y - terrainHeight(currentX, currentZ), 10, 32);
    const spot = findBestStructureSpot(currentX, currentZ);
    const padRadius = clamp(Math.max(size.x, size.z) * 0.72, 145, 520);
    const padY = terrainHeight(spot.x, spot.z) + 7.5;
    structure.position.set(spot.x, padY + currentOffset, spot.z);
    structure.rotation.x = 0;
    structure.rotation.z = 0;
    structure.up.set(0, 1, 0);
    structure.updateMatrixWorld(true);
    structure.userData.flatGroundAdjusted = true;
    padGroup.add(createStructurePad(spot.x, spot.z, padRadius, padY - 1.6));
  }

  if (padGroup.children.length > 0) scene.add(padGroup);
}

export async function createRenderer(canvas) {
  const base = await createBaseRenderer(canvas);
  const waterSystem = findWaterSystem(base.scene);

  removeSceneSunDisc(base.scene);
  stabilizeWaterSystem(waterSystem);
  flattenMajorGroundedStructures(base.scene);
  base.scene.add(createDynamicEndpointCover());
  base.scene.userData.waterSafetyVersion = "visible-water-structure-pass-2";

  const originalRender = base.renderer.render.bind(base.renderer);
  base.renderer.render = (scene, camera) => {
    clampWaterBeforeRender(waterSystem);
    return originalRender(scene, camera);
  };

  return base;
}
