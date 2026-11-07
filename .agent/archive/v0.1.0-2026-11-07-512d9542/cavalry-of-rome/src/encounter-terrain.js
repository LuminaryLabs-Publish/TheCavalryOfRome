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

const ROAD_PATHS = [
  [[900, 2480], [690, 2080], [820, 1700], [570, 1360], [360, 1100], [510, 850], [315, 610], [430, 335], [230, 60], [360, -250], [305, -590], [520, -930], [390, -1080], [650, -1540], [840, -2300]],
  [[-1330, 2140], [-1080, 1660], [-760, 980], [-700, 690], [-650, 430], [-600, 140], [-560, -160], [-530, -510], [-500, -1010], [-610, -1540], [-830, -2120]],
  [[115, 585], [190, 650], [275, 760], [360, 880], [520, 1040], [770, 1260]],
  [[-2500, 1400], [-2120, 1280], [-1760, 1120], [-1420, 820], [-1120, 500], [-820, 260]],
  [[-1940, -860], [-1620, -760], [-1260, -610], [-900, -420], [-540, -160], [-180, 120], [260, 420]],
  [[-1030, 1740], [-660, 1640], [-300, 1500], [90, 1390], [420, 1380], [760, 1540], [1120, 1780]],
  [[160, -1900], [440, -1640], [720, -1240], [880, -820], [1060, -450], [1330, -90]],
  [[1060, 520], [1420, 460], [1740, 120], [1970, -430], [2180, -1540]],
  [[2180, -1540], [2460, -1040], [2720, -420], [2860, 310], [2500, 1820]],
  [[-2740, -1860], [-2440, -1660], [-2160, -1280], [-1900, -970], [-1680, -860]],
  [[-2260, 1360], [-2540, 980], [-2780, 560], [-2920, 20], [-2820, -620]],
  [[-880, 1850], [-1110, 1460], [-1300, 970], [-1480, 760], [-1680, -860]],
  [[-260, -1960], [-30, -1560], [210, -1180], [560, -1010], [880, -820]],
  [[420, 1380], [220, 990], [115, 585], [-130, 310], [-520, 60]],
  [[880, -820], [1210, -1130], [1580, -1320], [2180, -1540]],
  [[1420, 460], [1740, 760], [2100, 1080], [2500, 1820]],
  [[-2740, -1860], [-2210, -2110], [-1660, -2240], [-910, -2160], [-260, -1960]],
  [[-2260, 1360], [-1780, 1760], [-1280, 1990], [-880, 1850]],
  [[420, 1380], [840, 1080], [1170, 760], [1420, 460]]
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

function terrainSlope(x, z, step) {
  return Math.abs(terrainHeight(x + step, z) - terrainHeight(x - step, z))
    + Math.abs(terrainHeight(x, z + step) - terrainHeight(x, z - step));
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

export function classifyEncounterTerrainCell(encounter, q, r, size) {
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
  const road = nearestPathSegment(ROAD_PATHS, world.x, world.z);
  if (road.distance <= size * 0.86) {
    return { type: "road", direction: road.direction, obstacle: false, movement: "open", blocksLineOfSight: false };
  }
  if (terrainSlope(world.x, world.z, size * 0.34) > 18) {
    return { type: "woods", direction: 0, obstacle: true, movement: "impassable", blocksLineOfSight: true };
  }
  return null;
}

export function encounterTerrainCells(encounter) {
  const radius = encounter.hex?.radius ?? 6;
  const size = encounter.hex?.cellSize ?? 72;
  const cells = [];
  for (let q = -radius; q <= radius; q += 1) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r += 1) {
      const feature = classifyEncounterTerrainCell(encounter, q, r, size);
      if (feature) cells.push({ q, r, ...feature });
    }
  }
  return cells;
}
