import * as THREE from "three";
import { createRenderer as createBaseRenderer } from "./renderer.js";

const THEATER_SCALE = 2.55;
const WATER_MIN_CLEARANCE = 2.4;
const WATER_EDGE_CLEARANCE = 3.2;
const RIVER_WAVE_SINK_ALLOWANCE = 1.35;
const LAKE_WAVE_SINK_ALLOWANCE = 0.7;

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

function waterY(x, z, clearance = WATER_MIN_CLEARANCE) {
  return terrainHeight(x, z) + clearance;
}

function clampWaterY(x, z, y, clearance = WATER_MIN_CLEARANCE) {
  return Math.max(y, waterY(x, z, clearance));
}

function scaledPoint(point) {
  return [point[0] * THEATER_SCALE, point[1] * THEATER_SCALE];
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

  for (const ringT of [0.28, 0.48, 0.68]) {
    for (let i = 0; i < 18; i += 1) {
      const angle = (i / 18) * Math.PI * 2;
      const localX = Math.cos(angle) * radiusX * ringT;
      const localZ = Math.sin(angle) * radiusZ * ringT;
      const x = centerX + localX * cosR - localZ * sinR;
      const z = centerZ + localX * sinR + localZ * cosR;
      heights.push(terrainHeight(x, z));
    }
  }

  heights.sort((a, b) => a - b);
  return heights[Math.floor(heights.length * 0.42)] + WATER_MIN_CLEARANCE + LAKE_WAVE_SINK_ALLOWANCE;
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
    const edgeLift = ringT > 0.78 ? (ringT - 0.78) * 9.5 : 0;
    const shorelineSafety = waterY(x, z, WATER_MIN_CLEARANCE + LAKE_WAVE_SINK_ALLOWANCE + edgeLift * 0.55);
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
  cap.renderOrder = 0;
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
    depthWrite: true
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
    mist.position.set(anchor.x, waterY(anchor.x, anchor.z, 7.5), anchor.z);
    mist.scale.set(anchor.width * 5.2, anchor.width * 3.1, 1);
    mist.rotation.set(-Math.PI / 2, 0, anchor.rotation + Math.PI * 0.5);
    mist.renderOrder = 7;
    group.add(mist);
  });

  group.name = "dynamic-water-endpoint-cover";
  return group;
}

function stabilizeWaterSystem(waterSystem) {
  if (!waterSystem || waterSystem.userData.waterSafetyApplied) return;

  for (const river of waterSystem.userData.rivers ?? []) {
    stabilizeRibbonBase(river, RIVER_WAVE_SINK_ALLOWANCE);
  }

  for (let i = 0; i < (waterSystem.userData.lakes ?? []).length; i += 1) {
    stabilizeLakeBase(waterSystem.userData.lakes[i], LAKE_DEFINITIONS[i]);
  }

  for (const ribbon of waterSystem.userData.flowRibbons ?? []) {
    stabilizeRibbonBase(ribbon, 0.9);
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

  for (const ribbon of waterSystem.userData.flowRibbons ?? []) {
    clampAnimatedWater(ribbon, WATER_MIN_CLEARANCE + 0.5);
  }
}

export async function createRenderer(canvas) {
  const base = await createBaseRenderer(canvas);
  const waterSystem = findWaterSystem(base.scene);

  stabilizeWaterSystem(waterSystem);
  base.scene.add(createDynamicEndpointCover());

  const originalRender = base.renderer.render.bind(base.renderer);
  base.renderer.render = (scene, camera) => {
    clampWaterBeforeRender(waterSystem);
    return originalRender(scene, camera);
  };

  return base;
}
