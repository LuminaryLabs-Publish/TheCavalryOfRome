const THEATER_SCALE = 2.55;

const RIVER_PATHS = [
  [[-640, 2250], [-560, 1880], [-470, 1510], [-390, 1160], [-330, 760], [-245, 520], [-160, 260], [-105, 20], [-20, -220], [35, -470], [105, -760], [185, -1160], [255, -1560], [360, -2040], [470, -2400]],
  [[-1850, 1320], [-1520, 1130], [-1190, 930], [-850, 680], [-650, 520], [-500, 390], [-360, 260], [-230, 130], [-145, 15], [-100, -80]],
  [[-3100, -380], [-2660, -210], [-2210, -40], [-1760, 210], [-1360, 470], [-1030, 680], [-760, 980]],
  [[-420, 2820], [-330, 2440], [-190, 2060], [60, 1710], [420, 1380], [750, 1110], [970, 820]],
  [[1640, 2380], [1420, 1960], [1220, 1540], [1140, 1050], [1420, 460], [1600, -120]],
  [[2650, -2450], [2360, -1980], [2180, -1540], [1980, -1080], [1760, -620], [1500, -250]],
  [[-2860, -2100], [-2400, -1920], [-1920, -1640], [-1680, -860], [-1440, -420], [-1180, -120]]
];

const LAKES = [
  { center: [-2520, -240], radiusX: 340, radiusZ: 190, rotation: 0.35 },
  { center: [3020, 760], radiusX: 420, radiusZ: 230, rotation: -0.25 },
  { center: [-1180, 2320], radiusX: 300, radiusZ: 180, rotation: 0.12 },
  { center: [1780, -2240], radiusX: 380, radiusZ: 210, rotation: 0.48 },
  { center: [420, -360], radiusX: 260, radiusZ: 145, rotation: -0.42 },
  { center: [-3260, 1020], radiusX: 280, radiusZ: 170, rotation: 0.78 }
];

const STRONGHOLDS = [
  [-2260, 1360], [-1680, -860], [-880, 1850], [-260, -1960], [420, 1380],
  [880, -820], [1420, 460], [2180, -1540], [2500, 1820], [-2740, -1860]
];

function seededRandom(seed) {
  return Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
}

function encounterCellWorld(encounter, q, r, size) {
  const bearing = Number(encounter.bearing ?? 0);
  const forward = { x: Math.cos(bearing), z: Math.sin(bearing) };
  const right = { x: -forward.z, z: forward.x };
  const localX = Math.sqrt(3) * size * (q + r / 2);
  const localZ = 1.5 * size * r;
  return {
    x: encounter.center.x + right.x * localX + forward.x * localZ,
    z: encounter.center.z + right.z * localX + forward.z * localZ
  };
}

function nearestPathSegment(paths, x, z) {
  let best = { distance: Infinity, direction: 0 };
  for (const path of paths) {
    for (let index = 1; index < path.length; index += 1) {
      const ax = path[index - 1][0] * THEATER_SCALE;
      const az = path[index - 1][1] * THEATER_SCALE;
      const bx = path[index][0] * THEATER_SCALE;
      const bz = path[index][1] * THEATER_SCALE;
      const dx = bx - ax;
      const dz = bz - az;
      const lengthSq = dx * dx + dz * dz;
      const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lengthSq)) : 0;
      const px = ax + dx * t;
      const pz = az + dz * t;
      const distance = Math.hypot(px - x, pz - z);
      if (distance < best.distance) best = { distance, direction: Math.atan2(dz, dx) };
    }
  }
  return best;
}

function isInsideLake(x, z, padding = 0) {
  return LAKES.some((lake) => {
    const centerX = lake.center[0] * THEATER_SCALE;
    const centerZ = lake.center[1] * THEATER_SCALE;
    const cosR = Math.cos(-lake.rotation);
    const sinR = Math.sin(-lake.rotation);
    const dx = x - centerX;
    const dz = z - centerZ;
    const localX = dx * cosR - dz * sinR;
    const localZ = dx * sinR + dz * cosR;
    const radiusX = lake.radiusX * THEATER_SCALE + padding;
    const radiusZ = lake.radiusZ * THEATER_SCALE + padding;
    return (localX * localX) / (radiusX * radiusX) + (localZ * localZ) / (radiusZ * radiusZ) <= 1;
  });
}

function settlementAt(x, z, clearance) {
  for (let strongholdIndex = 0; strongholdIndex < STRONGHOLDS.length; strongholdIndex += 1) {
    const [baseX, baseZ] = STRONGHOLDS[strongholdIndex];
    const centerX = baseX * THEATER_SCALE;
    const centerZ = baseZ * THEATER_SCALE;
    for (let houseIndex = 0; houseIndex < 5; houseIndex += 1) {
      const ring = 110 + seededRandom(strongholdIndex * 20 + houseIndex + 1040) * 260;
      const angle = seededRandom(strongholdIndex * 20 + houseIndex + 1050) * Math.PI * 2;
      const roadBias = seededRandom(strongholdIndex * 20 + houseIndex + 1060) > 0.55 ? 1.45 : 0.72;
      const houseX = centerX + Math.cos(angle) * ring * roadBias;
      const houseZ = centerZ + Math.sin(angle) * ring;
      if (Math.hypot(houseX - x, houseZ - z) < clearance) return true;
    }
  }
  return false;
}

export function classifyBlockingEncounterCell(encounter, q, r, size) {
  const world = encounterCellWorld(encounter, q, r, size);
  const river = nearestPathSegment(RIVER_PATHS, world.x, world.z);
  if (river.distance <= size * 0.98 || isInsideLake(world.x, world.z, size * 0.72)) {
    return { type: "river", direction: river.direction, obstacle: true, movement: "impassable", blocksLineOfSight: false };
  }

  const landmark = STRONGHOLDS.some(([baseX, baseZ]) => Math.hypot(baseX * THEATER_SCALE - world.x, baseZ * THEATER_SCALE - world.z) < size * 1.55);
  if (landmark) return { type: "landmark", direction: 0, obstacle: true, movement: "impassable", blocksLineOfSight: true };
  if (settlementAt(world.x, world.z, size * 1.15)) {
    return { type: "settlement", direction: 0, obstacle: true, movement: "impassable", blocksLineOfSight: true };
  }
  return null;
}

export function blockingEncounterCells(encounter) {
  const radius = encounter.hex?.radius ?? 6;
  const size = encounter.hex?.cellSize ?? 72;
  const cells = [];
  for (let q = -radius; q <= radius; q += 1) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r += 1) {
      const feature = classifyBlockingEncounterCell(encounter, q, r, size);
      if (feature) cells.push({ q, r, ...feature });
    }
  }
  return cells;
}
