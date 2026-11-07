import * as THREE from "three";
import { classifyEncounterTerrainCell } from "./encounter-terrain.js";

const WORLD_SIZE = 18000;
const TERRAIN_SEGMENTS = 520;
const THEATER_SCALE = 2.55;
const REGIONAL_OBJECT_SCALE = 0.34;
const CLOCK = new THREE.Clock();

const LANE_POSITIONS = {
  left: new THREE.Vector3(-310, 18, -430),
  center: new THREE.Vector3(0, 20, -560),
  right: new THREE.Vector3(330, 22, -460)
};

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

const ROAD_PATHS = {
  eastRidge: [
    [900, 2480],
    [690, 2080],
    [820, 1700],
    [570, 1360],
    [360, 1100],
    [510, 850],
    [315, 610],
    [430, 335],
    [230, 60],
    [360, -250],
    [305, -590],
    [520, -930],
    [390, -1080],
    [650, -1540],
    [840, -2300]
  ],
  westPatrol: [
    [-1330, 2140],
    [-1080, 1660],
    [-760, 980],
    [-700, 690],
    [-650, 430],
    [-600, 140],
    [-560, -160],
    [-530, -510],
    [-500, -1010],
    [-610, -1540],
    [-830, -2120]
  ],
  campSpur: [
    [115, 585],
    [190, 650],
    [275, 760],
    [360, 880],
    [520, 1040],
    [770, 1260]
  ]
};

const COBBLED_PATHS = [
  [[-2500, 1400], [-2120, 1280], [-1760, 1120], [-1420, 820], [-1120, 500], [-820, 260]],
  [[-1940, -860], [-1620, -760], [-1260, -610], [-900, -420], [-540, -160], [-180, 120], [260, 420]],
  [[-1030, 1740], [-660, 1640], [-300, 1500], [90, 1390], [420, 1380], [760, 1540], [1120, 1780]],
  [[160, -1900], [440, -1640], [720, -1240], [880, -820], [1060, -450], [1330, -90]],
  [[1060, 520], [1420, 460], [1740, 120], [1970, -430], [2180, -1540]],
  [[2180, -1540], [2460, -1040], [2720, -420], [2860, 310], [2500, 1820]]
];

const DIRT_PATHS = [
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

const TERRITORY_BOUNDARIES = [
  [
    [-2500, 1600],
    [-1950, 1240],
    [-1480, 760],
    [-1010, 220],
    [-690, -420],
    [-410, -1120],
    [-180, -2060]
  ],
  [
    [-1600, -2050],
    [-1070, -1560],
    [-560, -980],
    [-140, -260],
    [300, 420],
    [870, 1040],
    [1510, 1590]
  ],
  [
    [2100, 2140],
    [1580, 1640],
    [1150, 1030],
    [960, 240],
    [1180, -620],
    [1710, -1320],
    [2260, -2120]
  ],
  [
    [-2820, -620],
    [-2240, -270],
    [-1740, 120],
    [-1210, 560],
    [-730, 930],
    [-220, 1210],
    [420, 1460]
  ],
  [
    [360, -2360],
    [810, -1810],
    [1180, -1220],
    [1470, -540],
    [1730, 150],
    [2170, 860],
    [2720, 1460]
  ]
];

const REGIONS = [
  { id: "gallia", label: "Gallia", center: [-2260, 1360], owner: "blue" },
  { id: "hispania", label: "Hispania", center: [-1680, -860], owner: "rome" },
  { id: "britannia", label: "Britannia", center: [-880, 1850], owner: "neutral" },
  { id: "africa", label: "Africa", center: [-260, -1960], owner: "red" },
  { id: "italia", label: "Italia", center: [420, 1380], owner: "rome" },
  { id: "illyria", label: "Illyria", center: [880, -820], owner: "yellow" },
  { id: "germania", label: "Germania", center: [1420, 460], owner: "green" },
  { id: "dacia", label: "Dacia", center: [2180, -1540], owner: "blue" },
  { id: "asia", label: "Asia Minor", center: [2500, 1820], owner: "neutral" },
  { id: "mauretania", label: "Mauretania", center: [-2740, -1860], owner: "neutral" }
];

const REGIONAL_STRONGHOLDS = REGIONS.map((region) => region.center);

const FORCE_MARKER_COLORS = ["#4f9b49", "#2d6ecf", "#b7332a"];
const OWNER_COLORS = {
  neutral: "#8b9188",
  yellow: "#d9b847",
  green: "#4f9b49",
  rome: "#b7332a",
  red: "#b7332a",
  blue: "#2d6ecf"
};

const OWNER_LABELS = {
  neutral: "Uncontrolled",
  yellow: "Yellow AI",
  green: "Green AI",
  rome: "Rome",
  red: "Red AI",
  blue: "Blue AI"
};

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

function terrainNormal(x, z) {
  const step = 6;
  const left = terrainHeight(x - step, z);
  const right = terrainHeight(x + step, z);
  const down = terrainHeight(x, z - step);
  const up = terrainHeight(x, z + step);
  return new THREE.Vector3(left - right, step * 2, down - up).normalize();
}

function terrainSlope(x, z, step = 34) {
  const dx = Math.abs(terrainHeight(x + step, z) - terrainHeight(x - step, z));
  const dz = Math.abs(terrainHeight(x, z + step) - terrainHeight(x, z - step));
  return dx + dz;
}

function findFlatSpot(x, z, radius = 420, samples = 18) {
  let best = { x, z, slope: terrainSlope(x, z) };

  for (let i = 0; i < samples; i += 1) {
    const angle = (i / samples) * Math.PI * 2;
    const innerX = x + Math.cos(angle) * radius * 0.45;
    const innerZ = z + Math.sin(angle) * radius * 0.45;
    const outerX = x + Math.cos(angle) * radius;
    const outerZ = z + Math.sin(angle) * radius;
    const candidates = [
      { x: innerX, z: innerZ, slope: terrainSlope(innerX, innerZ) },
      { x: outerX, z: outerZ, slope: terrainSlope(outerX, outerZ) }
    ];

    for (const candidate of candidates) {
      if (candidate.slope < best.slope) best = candidate;
    }
  }

  return best;
}

function terrainQuaternion(x, z, yaw = 0) {
  const normal = terrainNormal(x, z);
  const align = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const spin = new THREE.Quaternion().setFromAxisAngle(normal, yaw);
  return align.multiply(spin);
}

function terrainTiltQuaternion(x, z, yaw = 0, strength = 0.42) {
  const normal = terrainNormal(x, z);
  const align = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  align.slerp(new THREE.Quaternion(), 1 - strength);
  const spin = new THREE.Quaternion().setFromAxisAngle(normal, yaw);
  return align.multiply(spin);
}

function fixedTreeQuaternion(seed, yaw) {
  const yawRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const tiltAmount = seededRandom(seed + 1) > 0.58 ? 0.08 + seededRandom(seed + 2) * 0.14 : seededRandom(seed + 3) * 0.035;
  const tiltAxis = new THREE.Vector3(
    Math.cos(seededRandom(seed + 4) * Math.PI * 2),
    0,
    Math.sin(seededRandom(seed + 4) * Math.PI * 2)
  ).normalize();
  const tilt = new THREE.Quaternion().setFromAxisAngle(tiltAxis, tiltAmount);
  return tilt.multiply(yawRotation);
}

function terrainPattern(x, z) {
  return (
    Math.sin(x * 0.0042 + z * 0.0011) * 0.45 +
    Math.cos(z * 0.0051 - x * 0.0019) * 0.35 +
    Math.sin((x + z) * 0.0105) * 0.2
  );
}

function colorForHeight(height, slopeTint, x, z, slope) {
  const low = new THREE.Color("#213832");
  const grass = new THREE.Color("#536f38");
  const moss = new THREE.Color("#496543");
  const scrub = new THREE.Color("#697447");
  const field = new THREE.Color("#8f8655");
  const rock = new THREE.Color("#746d59");
  const limestone = new THREE.Color("#918568");
  const dryRidge = new THREE.Color("#b09b6f");
  const shadow = new THREE.Color("#243126");
  const t = clamp((height + 130) / 310, 0, 1);
  const pattern = terrainPattern(x, z);
  const fieldGrid = Math.sin(x * 0.017) * Math.sin(z * 0.014);
  const contour = Math.abs(Math.sin(height * 0.055));
  const ravine = Math.max(0, Math.sin(x * 0.007 + z * 0.011));
  const flatness = clamp(1 - slope * 0.065, 0, 1);
  let color;

  if (t < 0.43) {
    color = low.clone().lerp(grass, t / 0.43);
  } else if (t < 0.78) {
    color = grass.clone().lerp(rock, (t - 0.43) / 0.35);
  } else {
    color = rock.clone().lerp(dryRidge, (t - 0.78) / 0.22);
  }

  if (flatness > 0.42 && t > 0.34 && t < 0.74 && fieldGrid > 0.42) {
    color.lerp(field, 0.34 * flatness);
  }

  if (pattern > 0.32) {
    color.lerp(scrub, 0.2);
  } else if (pattern < -0.38) {
    color.lerp(moss, 0.22);
  }

  if (contour > 0.94 && t > 0.48) {
    color.lerp(limestone, 0.18);
  }

  if (ravine > 0.86 && slope > 7) {
    color.lerp(shadow, 0.28);
  }

  return color.multiplyScalar(slopeTint);
}

function createTerrainShaderMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      iTime: { value: 0 },
      sunDir: { value: new THREE.Vector3(0.5, 0.6, 0.48).normalize() },
      sunColour: { value: new THREE.Color(1.0, 0.95, 0.8) },
      fogColor: { value: new THREE.Color("#9ba99d") },
      fogDensity: { value: 0.00017 }
    },
    vertexShader: `
      attribute vec3 color;

      varying vec3 vColor;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying float vHeight;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);

        vColor = color;
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vHeight = worldPosition.y;

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      #define MOD3 vec3(.1031,.11369,.13787)
      #define MOD4 vec4(.1031,.11369,.13787, .09987)

      uniform float iTime;
      uniform vec3 sunDir;
      uniform vec3 sunColour;
      uniform vec3 fogColor;
      uniform float fogDensity;

      varying vec3 vColor;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying float vHeight;

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * MOD3);
        p3 += dot(p3, p3.yzx + 19.19);
        return fract((p3.x + p3.y) * p3.z);
      }

      float tri(float x) {
        return abs(fract(x) - .5);
      }

      vec3 tri3(vec3 p) {
        return vec3(
          tri(p.z + tri(p.y)),
          tri(p.z + tri(p.x)),
          tri(p.y + tri(p.x))
        );
      }

      mat2 m2 = mat2(0.970, 0.242, -0.242, 0.970);

      float triNoise3d(vec3 p) {
        float z = 1.2;
        float rz = 0.0;
        vec3 bp = p;

        for (int octave = 0; octave < 5; octave++) {
          vec3 dg = tri3(bp);
          p += dg;
          bp *= 2.0;
          z *= 1.5;
          p *= 1.2;
          p.xz *= m2;
          rz += tri(p.z + tri(p.x + tri(p.y))) / z;
          bp += 0.18;
        }

        return max(rz - .3, 0.0) * 2.5;
      }

      float turbulence(vec3 p) {
        return triNoise3d(p * .04);
      }

      float ridgeMask(float heightValue, vec2 xz) {
        float s = sin(xz.x * .006 - xz.y * .0132) * 12.0 + 33.0;
        float w = mod(heightValue, s) / s;
        w = w * w * (3.0 - 2.0 * w);
        return smoothstep(.035, .18, min(w, 1.0 - w));
      }

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec2 terrainUv = vWorldPosition.xz * 0.001;
        float height01 = clamp((vHeight + 170.0) / 430.0, 0.0, 1.0);
        float slope = clamp(1.0 - normal.y, 0.0, 1.0);
        float flatness = 1.0 - smoothstep(0.08, 0.42, slope);

        vec3 noisePos = vec3(vWorldPosition.x * .30, vHeight, vWorldPosition.z * .30);
        float broadNoise = turbulence(noisePos);
        float fineNoise = triNoise3d(vec3(vWorldPosition.xz * .021, vHeight * .018 + iTime * .025));
        float ridge = ridgeMask(vHeight + broadNoise * 16.0 + 70.0, vWorldPosition.xz * .30);
        float parcel = smoothstep(.78, .96, sin(vWorldPosition.x * .0095) * sin(vWorldPosition.z * .007));
        float farmMask = parcel * flatness * smoothstep(.24, .58, height01) * (1.0 - smoothstep(.74, .88, height01));

        vec3 colour = vColor;
        colour = mix(colour, vec3(.20, .34, .25), broadNoise * .18);
        colour = mix(colour, vec3(.66, .60, .39), farmMask * .26);
        colour = mix(colour, vec3(.53, .48, .37), slope * .24);
        colour = mix(colour, vec3(.74, .68, .52), smoothstep(.62, .94, height01) * .24);
        colour = mix(colour * .82, colour * 1.12, ridge);
        colour += (hash12(floor(terrainUv * 180.0)) - .5) * .028;
        colour += fineNoise * .032;

        float sunAmount = max(dot(normal, normalize(sunDir)), 0.0);
        float rim = pow(1.0 - max(dot(normalize(cameraPosition - vWorldPosition), normal), 0.0), 2.0);
        vec3 skyBounce = vec3(.62, .70, .63) * (0.50 + normal.y * .36);
        vec3 light = skyBounce + sunColour * (sunAmount * 1.28 + pow(sunAmount, 6.0) * .16);
        colour *= light;
        colour *= 1.08;
        colour += rim * vec3(.09, .11, .09) * smoothstep(.35, .95, height01);

        float distanceToCamera = length(cameraPosition - vWorldPosition);
        float fogFactor = 1.0 - exp(-distanceToCamera * fogDensity);
        fogFactor = clamp(fogFactor * fogFactor, 0.0, .82);
        colour = mix(colour, fogColor, fogFactor);

        gl_FragColor = vec4(colour, 1.0);
      }
    `
  });
}

function createTerrain() {
  const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  const colors = [];

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const height = terrainHeight(x, z);
    const slope = Math.abs(terrainHeight(x + 10, z) - terrainHeight(x, z + 10));
    const slopeTint = clamp(1.12 - slope * 0.011, 0.56, 1.1);
    const color = colorForHeight(height, slopeTint, x, z, slope);

    position.setY(i, height);
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = createTerrainShaderMaterial();

  const terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  return terrain;
}

function createCurve(points) {
  return new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x * THEATER_SCALE, 0, z * THEATER_SCALE)), false, "catmullrom", 0.35);
}

function sampleRiverPoint(curve, t, lateral = 0, yOffset = 2.2) {
  const center = curve.getPoint(clamp(t, 0, 1));
  const tangent = curve.getTangent(clamp(t, 0, 1)).normalize();
  const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  const x = center.x + side.x * lateral;
  const z = center.z + side.z * lateral;
  const bankBlend = clamp(Math.abs(lateral) / 72, 0, 1);
  const y = terrainHeight(x, z) + yOffset + bankBlend * 0.8;
  return new THREE.Vector3(x, y, z);
}

function createWaterShaderMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector2(512, 512) }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float iTime;
      uniform vec2 iResolution;
      varying vec2 vUv;

      // Found this on GLSL sandbox. I really liked it, changed a few things and made it tileable.
      // :)
      // by David Hoskins.
      // Original water turbulence effect by joltz0r

      #define TAU 6.28318530718
      #define MAX_ITER 5

      void mainImage( out vec4 fragColor, in vec2 fragCoord )
      {
        float time = iTime * .5+23.0;
          // uv should be the 0-1 uv of texture...
        vec2 uv = fragCoord.xy / iResolution.xy;

        vec2 p = mod(uv*TAU, TAU)-250.0;
        vec2 i = vec2(p);
        float c = 1.0;
        float inten = .005;

        for (int n = 0; n < MAX_ITER; n++)
        {
          float t = time * (1.0 - (3.5 / float(n+1)));
          i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
          c += 1.0/length(vec2(p.x / (sin(i.x+t)/inten),p.y / (cos(i.y+t)/inten)));
        }
        c /= float(MAX_ITER);
        c = 1.17-pow(c, 1.4);
        vec3 colour = vec3(pow(abs(c), 8.0));
          colour = clamp(colour + vec3(0.0, 0.35, 0.5), 0.0, 1.0);

        fragColor = vec4(colour, 1.0);
      }

      void main() {
        mainImage(gl_FragColor, vUv * iResolution.xy);
      }
    `,
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: false
  });
}

function createRiverRibbon({ curve, width, lengthSegments, widthSegments, material }) {
  const vertices = [];
  const uvs = [];
  const indices = [];
  const baseY = [];

  for (let i = 0; i <= lengthSegments; i += 1) {
    const t = i / lengthSegments;
    const widthPulse = width * (0.84 + Math.sin(t * Math.PI * 3.2) * 0.08 + Math.sin(t * Math.PI * 8.5) * 0.035);

    for (let j = 0; j <= widthSegments; j += 1) {
      const across = j / widthSegments - 0.5;
      const bankFalloff = 1 - Math.abs(across) * 2;
      const point = sampleRiverPoint(curve, t, across * widthPulse, 1.5 + bankFalloff * 1.1);
      vertices.push(point.x, point.y, point.z);
      baseY.push(point.y);
      uvs.push(j / widthSegments, t * 9);
    }
  }

  for (let i = 0; i < lengthSegments; i += 1) {
    for (let j = 0; j < widthSegments; j += 1) {
      const row = widthSegments + 1;
      const a = i * row + j;
      indices.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const river = new THREE.Mesh(geometry, material);
  river.userData.baseY = baseY;
  river.receiveShadow = true;
  river.renderOrder = 1;
  return river;
}

function createRiverBank({ curve, width, lengthSegments }) {
  const material = new THREE.MeshStandardMaterial({
    color: "#695d42",
    roughness: 0.96,
    metalness: 0.0
  });
  const group = new THREE.Group();

  for (const sideSign of [-1, 1]) {
    const vertices = [];
    const indices = [];

    for (let i = 0; i <= lengthSegments; i += 1) {
      const t = i / lengthSegments;
      const inner = sampleRiverPoint(curve, t, sideSign * width * 0.51, 1.15);
      const outer = sampleRiverPoint(curve, t, sideSign * width * 0.68, 2.8);
      vertices.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);

      if (i < lengthSegments) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const bank = new THREE.Mesh(geometry, material);
    bank.receiveShadow = true;
    group.add(bank);
  }

  return group;
}

function createFlowRibbon({ curve, lateral, width, material }) {
  const lengthSegments = 120;
  const widthSegments = 1;
  const vertices = [];
  const indices = [];
  const baseY = [];

  for (let i = 0; i <= lengthSegments; i += 1) {
    const t = i / lengthSegments;
    const sidePulse = lateral + Math.sin(t * Math.PI * 6) * 7;

    for (let j = 0; j <= widthSegments; j += 1) {
      const across = (j / widthSegments - 0.5) * width;
      const point = sampleRiverPoint(curve, t, sidePulse + across, 3.0);
      vertices.push(point.x, point.y, point.z);
      baseY.push(point.y);
    }
  }

  for (let i = 0; i < lengthSegments; i += 1) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const ribbon = new THREE.Mesh(geometry, material.clone());
  ribbon.userData.baseY = baseY;
  ribbon.userData.phase = lateral * 0.07;
  ribbon.renderOrder = 2;
  return ribbon;
}

function createLakeMesh({ center, radiusX, radiusZ, rotation }, material) {
  const scaledCenter = new THREE.Vector3(center[0] * THEATER_SCALE, 0, center[1] * THEATER_SCALE);
  const rings = 5;
  const segments = 80;
  const vertices = [];
  const uvs = [];
  const indices = [];
  const baseY = [];
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const scaledRadiusX = radiusX * THEATER_SCALE;
  const scaledRadiusZ = radiusZ * THEATER_SCALE;

  for (let ring = 0; ring <= rings; ring += 1) {
    const ringT = ring / rings;

    for (let i = 0; i <= segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const localX = Math.cos(angle) * scaledRadiusX * ringT;
      const localZ = Math.sin(angle) * scaledRadiusZ * ringT;
      const x = scaledCenter.x + localX * cosR - localZ * sinR;
      const z = scaledCenter.z + localX * sinR + localZ * cosR;
      const edgeLift = ringT > 0.82 ? (ringT - 0.82) * 9 : 0;
      const y = terrainHeight(x, z) + 3.2 + edgeLift;

      vertices.push(x, y, z);
      baseY.push(y);
      uvs.push((localX / scaledRadiusX + 1) * 0.5, (localZ / scaledRadiusZ + 1) * 0.5);
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
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const lake = new THREE.Mesh(geometry, material);
  lake.userData.baseY = baseY;
  lake.receiveShadow = true;
  lake.renderOrder = 1;
  return lake;
}

function createLakeBank({ center, radiusX, radiusZ, rotation }) {
  const material = new THREE.MeshStandardMaterial({
    color: "#665a3f",
    roughness: 0.97,
    metalness: 0.0
  });
  const scaledCenter = new THREE.Vector3(center[0] * THEATER_SCALE, 0, center[1] * THEATER_SCALE);
  const segments = 96;
  const vertices = [];
  const indices = [];
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const innerX = radiusX * THEATER_SCALE * 0.98;
  const innerZ = radiusZ * THEATER_SCALE * 0.98;
  const outerX = radiusX * THEATER_SCALE * 1.08;
  const outerZ = radiusZ * THEATER_SCALE * 1.08;

  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;

    for (const [rx, rz, yOffset] of [[innerX, innerZ, 2.1], [outerX, outerZ, 3.4]]) {
      const localX = Math.cos(angle) * rx;
      const localZ = Math.sin(angle) * rz;
      const x = scaledCenter.x + localX * cosR - localZ * sinR;
      const z = scaledCenter.z + localX * sinR + localZ * cosR;
      vertices.push(x, terrainHeight(x, z) + yOffset, z);
    }

    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const bank = new THREE.Mesh(geometry, material);
  bank.receiveShadow = true;
  return bank;
}

function createRiverSystem() {
  const group = new THREE.Group();
  const mainCurve = createCurve(MAIN_RIVER_POINTS);
  const branchCurve = createCurve(BRANCH_RIVER_POINTS);
  const waterMaterial = createWaterShaderMaterial();
  const flowMaterial = new THREE.MeshBasicMaterial({
    color: "#d5f3e8",
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const rivers = [
    createRiverRibbon({ curve: mainCurve, width: 74, lengthSegments: 260, widthSegments: 10, material: waterMaterial }),
    createRiverRibbon({ curve: branchCurve, width: 34, lengthSegments: 160, widthSegments: 6, material: waterMaterial })
  ];

  group.add(createRiverBank({ curve: mainCurve, width: 74, lengthSegments: 260 }));
  group.add(createRiverBank({ curve: branchCurve, width: 34, lengthSegments: 160 }));

  for (const riverSystem of ADDITIONAL_RIVER_SYSTEMS) {
    const curve = createCurve(riverSystem.points);
    const segments = Math.max(110, Math.floor(riverSystem.points.length * 38));
    rivers.push(createRiverRibbon({
      curve,
      width: riverSystem.width,
      lengthSegments: segments,
      widthSegments: 7,
      material: waterMaterial
    }));
    group.add(createRiverBank({ curve, width: riverSystem.width, lengthSegments: segments }));
    group.add(createFlowRibbon({ curve, lateral: 0, width: 2.4, material: flowMaterial }));
  }

  const lakes = LAKE_DEFINITIONS.map((lake) => createLakeMesh(lake, waterMaterial));
  const lakeBanks = LAKE_DEFINITIONS.map((lake) => createLakeBank(lake));

  for (const river of rivers) {
    group.add(river);
  }

  for (const lake of lakes) {
    group.add(lake);
  }

  for (const lakeBank of lakeBanks) {
    group.add(lakeBank);
  }

  for (const lateral of [-16, 12]) {
    group.add(createFlowRibbon({ curve: mainCurve, lateral, width: 3, material: flowMaterial }));
  }

  for (const lateral of [0]) {
    group.add(createFlowRibbon({ curve: branchCurve, lateral, width: 2.4, material: flowMaterial }));
  }

  group.userData.rivers = rivers;
  group.userData.lakes = lakes;
  group.userData.waterMaterials = [waterMaterial];
  group.userData.flowRibbons = group.children.filter((child) => child.userData?.baseY && !rivers.includes(child) && !lakes.includes(child));
  return group;
}

function createMistBand({ count, radius, y, z, scale, color, opacity }) {
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(1, 1);
  const texture = createMistTexture();

  for (let i = 0; i < count; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color,
      map: texture,
      transparent: true,
      opacity: opacity * (0.58 + Math.random() * 0.42),
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    const cloud = new THREE.Mesh(geometry, material);
    cloud.position.set((Math.random() - 0.5) * radius, y + Math.random() * 42, z + (Math.random() - 0.5) * radius * 0.6);
    cloud.scale.set(scale * (0.65 + Math.random()), scale * (0.16 + Math.random() * 0.18), 1);
    cloud.rotation.set(-0.25, 0, Math.random() * Math.PI);
    cloud.userData.drift = 3 + Math.random() * 9;
    cloud.userData.phase = Math.random() * Math.PI * 2;
    group.add(cloud);
  }

  return group;
}

function createMistTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 12, 128, 128, 126);
  gradient.addColorStop(0, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.34, "rgba(255,255,255,0.42)");
  gradient.addColorStop(0.72, "rgba(255,255,255,0.1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createEndpointFog() {
  const group = new THREE.Group();
  const texture = createMistTexture();
  const geometry = new THREE.PlaneGeometry(1, 1);
  const anchors = [
    [-620, 2210, 560, 310],
    [470, -2350, 620, 340],
    [-1780, 1320, 470, 270],
    [900, 2480, 430, 250],
    [840, -2300, 480, 270],
    [-830, -2120, 460, 260],
    [770, 1260, 380, 220]
  ];

  for (let i = 0; i < anchors.length; i += 1) {
    const [x, z, width, height] = anchors[i];
    const material = new THREE.MeshBasicMaterial({
      color: i % 2 ? "#d2d8ca" : "#c3cec3",
      map: texture,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    const fog = new THREE.Mesh(geometry, material);
    const scaledX = x * THEATER_SCALE;
    const scaledZ = z * THEATER_SCALE;
    fog.position.set(scaledX, terrainHeight(scaledX, scaledZ) + 5, scaledZ);
    fog.scale.set(width * THEATER_SCALE * 0.78, height * THEATER_SCALE * 0.78, 1);
    fog.rotation.set(-Math.PI / 2, 0, seededRandom(i + 200) * Math.PI);
    group.add(fog);
  }

  return group;
}

function createPathRibbon(points, width, material, segments = 180) {
  const curve = createCurve(points);
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const indices = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const widthPulse = width * (0.92 + Math.sin(t * Math.PI * 5) * 0.04);
    const left = point.clone().addScaledVector(side, -widthPulse * 0.5);
    const right = point.clone().addScaledVector(side, widthPulse * 0.5);
    left.y = terrainHeight(left.x, left.z) + 1.35;
    right.y = terrainHeight(right.x, right.z) + 1.35;

    vertices.push(left.x, left.y, left.z);
    vertices.push(right.x, right.y, right.z);

    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const path = new THREE.Mesh(geometry, material);
  path.receiveShadow = true;
  return path;
}

function createRoad() {
  const group = new THREE.Group();
  const roadMaterial = new THREE.MeshStandardMaterial({
    color: "#a8895a",
    roughness: 0.94,
    metalness: 0.0
  });
  const trackMaterial = new THREE.MeshStandardMaterial({
    color: "#6d593d",
    roughness: 0.98,
    metalness: 0.0
  });

  group.add(createPathRibbon(ROAD_PATHS.eastRidge, 16, roadMaterial, 330));
  group.add(createPathRibbon(ROAD_PATHS.westPatrol, 9, trackMaterial, 290));
  group.add(createPathRibbon(ROAD_PATHS.campSpur, 7, trackMaterial, 150));
  return group;
}

function createDenseTravelPaths() {
  const group = new THREE.Group();
  const cobbleMaterial = new THREE.MeshStandardMaterial({
    color: "#817666",
    roughness: 0.92,
    metalness: 0.0
  });
  const dirtMaterial = new THREE.MeshStandardMaterial({
    color: "#8b6842",
    roughness: 0.97,
    metalness: 0.0
  });

  for (const path of COBBLED_PATHS) {
    group.add(createPathRibbon(path, 11, cobbleMaterial, 210));
  }

  for (const path of DIRT_PATHS) {
    group.add(createPathRibbon(path, 6, dirtMaterial, 170));
  }

  return group;
}

function createRegionalBorders() {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: "#5fc9ff",
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    depthTest: false,
    fog: false,
    blending: THREE.AdditiveBlending
  });
  const dotGeometry = new THREE.CylinderGeometry(8, 8, 1.3, 10);
  const dotCount = TERRITORY_BOUNDARIES.length * 64;
  const dots = new THREE.InstancedMesh(dotGeometry, material, dotCount);
  const matrix = new THREE.Matrix4();
  let dotIndex = 0;

  for (const boundary of TERRITORY_BOUNDARIES) {
    const curve = createCurve(boundary);

    for (let i = 0; i < 64; i += 1) {
      const t = (i + 0.35) / 64;
      const point = curve.getPoint(t);
      const x = point.x;
      const z = point.z;
      const y = terrainHeight(x, z) + 9;
      const scale = 0.8 + Math.sin(i * 1.7) * 0.16;
      matrix.compose(
        new THREE.Vector3(x, y, z),
        terrainTiltQuaternion(x, z, 0, 0.36),
        new THREE.Vector3(scale, scale, scale)
      );
      dots.setMatrixAt(dotIndex, matrix);
      dotIndex += 1;
    }
  }

  dots.renderOrder = 4;
  group.add(dots);
  return group;
}

function tagRegionObject(object, region) {
  object.userData.regionId = region.id;
  object.userData.regionLabel = region.label;
  object.traverse((child) => {
    child.userData.regionId = region.id;
    child.userData.regionLabel = region.label;
  });
}

function createWesternCastle(materials) {
  const group = new THREE.Group();
  const keep = new THREE.Mesh(new THREE.BoxGeometry(58, 74, 58), materials.stone);
  keep.position.y = 46;
  keep.castShadow = true;
  group.add(keep);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(46, 28, 4), materials.roof);
  roof.position.y = 98;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  const wallPositions = [
    [0, 18, -84, 150, 28, 14],
    [0, 18, 84, 150, 28, 14],
    [-84, 18, 0, 14, 28, 150],
    [84, 18, 0, 14, 28, 150]
  ];
  for (const [x, y, z, width, height, depth] of wallPositions) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials.wall);
    wall.position.set(x, y, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  }

  for (const x of [-82, 82]) {
    for (const z of [-82, 82]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(17, 20, 72, 7), materials.stone);
      tower.position.set(x, 39, z);
      tower.castShadow = true;
      group.add(tower);

      const cap = new THREE.Mesh(new THREE.ConeGeometry(23, 28, 7), materials.roof);
      cap.position.set(x, 88, z);
      cap.castShadow = true;
      group.add(cap);
    }
  }

  const gate = new THREE.Mesh(new THREE.BoxGeometry(32, 30, 10), materials.dark);
  gate.position.set(0, 19, -91);
  gate.castShadow = true;
  group.add(gate);

  return group;
}

function createEasternTemple(materials) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(165, 20, 132), materials.sandstone);
  base.position.y = 12;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  for (let tier = 0; tier < 3; tier += 1) {
    const tierMesh = new THREE.Mesh(new THREE.BoxGeometry(128 - tier * 24, 18, 98 - tier * 18), materials.sandstone);
    tierMesh.position.y = 34 + tier * 19;
    tierMesh.castShadow = true;
    tierMesh.receiveShadow = true;
    group.add(tierMesh);
  }

  const dome = new THREE.Mesh(new THREE.SphereGeometry(38, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), materials.dome);
  dome.position.y = 101;
  dome.castShadow = true;
  group.add(dome);

  for (const x of [-82, 82]) {
    for (const z of [-62, 62]) {
      const minaret = new THREE.Mesh(new THREE.CylinderGeometry(8, 11, 105, 8), materials.sandstone);
      minaret.position.set(x, 62, z);
      minaret.castShadow = true;
      group.add(minaret);

      const spire = new THREE.Mesh(new THREE.ConeGeometry(14, 36, 8), materials.dome);
      spire.position.set(x, 132, z);
      spire.castShadow = true;
      group.add(spire);
    }
  }

  for (const x of [-48, 0, 48]) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 46, 7), materials.column);
    column.position.set(x, 56, -72);
    column.castShadow = true;
    group.add(column);
  }

  return group;
}

function createRegionalStrongholds() {
  const group = new THREE.Group();
  const materials = {
    stone: new THREE.MeshStandardMaterial({ color: "#706b5d", roughness: 0.82 }),
    wall: new THREE.MeshStandardMaterial({ color: "#5f5d52", roughness: 0.88 }),
    roof: new THREE.MeshStandardMaterial({ color: "#51352f", roughness: 0.74 }),
    dark: new THREE.MeshStandardMaterial({ color: "#2c241c", roughness: 0.86 }),
    sandstone: new THREE.MeshStandardMaterial({ color: "#b49362", roughness: 0.78 }),
    dome: new THREE.MeshStandardMaterial({ color: "#c58b48", metalness: 0.08, roughness: 0.48 }),
    column: new THREE.MeshStandardMaterial({ color: "#d1bd8a", roughness: 0.62 })
  };

  for (let i = 0; i < REGIONAL_STRONGHOLDS.length; i += 1) {
    const region = REGIONS[i];
    const [baseX, baseZ] = REGIONAL_STRONGHOLDS[i];
    const x = baseX * THEATER_SCALE;
    const z = baseZ * THEATER_SCALE;
    const yaw = seededRandom(i + 920) * Math.PI * 2;
    const eastern = region.id === "asia" || region.id === "dacia" || region.id === "africa";
    const marker = eastern ? createEasternTemple(materials) : createWesternCastle(materials);
    const flatSpot = findFlatSpot(x, z, 360, 20);
    marker.scale.setScalar(eastern ? 1.55 : 1.38);
    placeUprightOnTerrain(marker, flatSpot.x, flatSpot.z, yaw, 17);
    tagRegionObject(marker, region);
    group.add(marker);
  }

  return group;
}

function createVillageClusters() {
  const group = new THREE.Group();
  const count = 280;
  const wallMaterial = new THREE.MeshStandardMaterial({ color: "#9a7a52", roughness: 0.9 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: "#6f3c2d", roughness: 0.82 });
  const houseBody = new THREE.InstancedMesh(new THREE.BoxGeometry(18, 12, 16), wallMaterial, count);
  const houseRoof = new THREE.InstancedMesh(new THREE.ConeGeometry(14, 11, 4), roofMaterial, count);
  const matrix = new THREE.Matrix4();

  for (let i = 0; i < count; i += 1) {
    const [baseX, baseZ] = REGIONAL_STRONGHOLDS[i % REGIONAL_STRONGHOLDS.length];
    const ring = 110 + seededRandom(i + 1040) * 260;
    const angle = seededRandom(i + 1050) * Math.PI * 2;
    const roadBias = seededRandom(i + 1060) > 0.55 ? 1.45 : 0.72;
    const x = baseX * THEATER_SCALE + Math.cos(angle) * ring * roadBias;
    const z = baseZ * THEATER_SCALE + Math.sin(angle) * ring;
    const y = terrainHeight(x, z);
    const yaw = seededRandom(i + 1070) * Math.PI * 2;
    const rotation = terrainTiltQuaternion(x, z, yaw, 0.65);
    const scale = 0.75 + seededRandom(i + 1080) * 0.65;

    matrix.compose(
      new THREE.Vector3(x, y + 7 * scale, z),
      rotation,
      new THREE.Vector3(scale, scale, scale)
    );
    houseBody.setMatrixAt(i, matrix);

    matrix.compose(
      new THREE.Vector3(x, y + 18 * scale, z),
      rotation,
      new THREE.Vector3(scale, scale * 0.8, scale)
    );
    houseRoof.setMatrixAt(i, matrix);
  }

  houseBody.castShadow = true;
  houseBody.receiveShadow = true;
  houseRoof.castShadow = true;
  group.add(houseBody);
  group.add(houseRoof);
  return group;
}

function createOutlyingFarmsteads() {
  const group = new THREE.Group();
  const count = 220;
  const timberMaterial = new THREE.MeshStandardMaterial({ color: "#7b5b38", roughness: 0.88 });
  const thatchMaterial = new THREE.MeshStandardMaterial({ color: "#b39a62", roughness: 0.92 });
  const fenceMaterial = new THREE.MeshStandardMaterial({ color: "#57432d", roughness: 0.9 });
  const house = new THREE.InstancedMesh(new THREE.BoxGeometry(24, 13, 18), timberMaterial, count);
  const roof = new THREE.InstancedMesh(new THREE.ConeGeometry(18, 12, 4), thatchMaterial, count);
  const silo = new THREE.InstancedMesh(new THREE.CylinderGeometry(5, 6, 22, 6), timberMaterial, count);
  const fence = new THREE.InstancedMesh(new THREE.BoxGeometry(58, 3, 5), fenceMaterial, count);
  const matrix = new THREE.Matrix4();

  for (let i = 0; i < count; i += 1) {
    const region = REGIONS[Math.floor(seededRandom(i + 2100) * REGIONS.length)];
    const [baseX, baseZ] = region.center;
    const angle = seededRandom(i + 2110) * Math.PI * 2;
    const distance = 560 + seededRandom(i + 2120) * 1280;
    const x = baseX * THEATER_SCALE + Math.cos(angle) * distance;
    const z = baseZ * THEATER_SCALE + Math.sin(angle) * distance;
    const y = terrainHeight(x, z);
    const yaw = seededRandom(i + 2130) * Math.PI * 2;
    const rotation = terrainTiltQuaternion(x, z, yaw, 0.62);
    const scale = 0.85 + seededRandom(i + 2140) * 0.55;

    matrix.compose(new THREE.Vector3(x, y + 7 * scale, z), rotation, new THREE.Vector3(scale, scale, scale));
    house.setMatrixAt(i, matrix);

    matrix.compose(new THREE.Vector3(x, y + 18 * scale, z), rotation, new THREE.Vector3(scale, scale * 0.75, scale));
    roof.setMatrixAt(i, matrix);

    matrix.compose(
      new THREE.Vector3(x + Math.cos(yaw + 0.9) * 32 * scale, y + 12 * scale, z + Math.sin(yaw + 0.9) * 32 * scale),
      rotation,
      new THREE.Vector3(scale, scale, scale)
    );
    silo.setMatrixAt(i, matrix);

    matrix.compose(
      new THREE.Vector3(x + Math.cos(yaw - 0.8) * 46 * scale, y + 2 * scale, z + Math.sin(yaw - 0.8) * 46 * scale),
      rotation,
      new THREE.Vector3(scale, scale, scale)
    );
    fence.setMatrixAt(i, matrix);
  }

  house.castShadow = true;
  roof.castShadow = true;
  silo.castShadow = true;
  fence.castShadow = true;
  group.add(house);
  group.add(roof);
  group.add(silo);
  group.add(fence);
  return group;
}

function createTerrainCircle(centerX, centerZ, radius, color, options = {}) {
  const segments = 42;
  const yOffset = options.yOffset ?? 8.2;
  const vertices = [centerX, terrainHeight(centerX, centerZ) + yOffset, centerZ];
  const indices = [];

  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius;
    const z = centerZ + Math.sin(angle) * radius;
    vertices.push(x, terrainHeight(x, z) + yOffset + 0.6, z);

    if (i > 0) {
      indices.push(0, i, i + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: options.opacity ?? 0.5,
    depthWrite: false,
    depthTest: options.depthTest ?? false,
    fog: options.fog ?? false,
    side: THREE.DoubleSide
  });
  const circle = new THREE.Mesh(geometry, material);
  circle.renderOrder = options.renderOrder ?? 3;
  circle.userData.baseRenderOrder = circle.renderOrder;
  return circle;
}

function createProvinceFootprint(region, index, options = {}) {
  const segments = options.segments ?? 72;
  const rings = options.rings ?? 6;
  const yOffset = options.yOffset ?? 12;
  const [baseX, baseZ] = region.center;
  const centerX = baseX * THEATER_SCALE;
  const centerZ = baseZ * THEATER_SCALE;
  const yaw = seededRandom(index + 3400) * Math.PI * 2;
  const radius = options.radius ?? (1180 + seededRandom(index + 3410) * 360);
  const stretchX = 0.82 + seededRandom(index + 3420) * 0.46;
  const stretchZ = 0.82 + seededRandom(index + 3430) * 0.46;
  const vertices = [centerX, terrainHeight(centerX, centerZ) + yOffset, centerZ];
  const indices = [];
  const radialScales = [];

  for (let i = 0; i < segments; i += 1) {
    const wave =
      Math.sin(i * 0.61 + index * 1.9) * 0.12 +
      Math.sin(i * 0.19 + index * 3.1) * 0.09 +
      (seededRandom(index * 100 + i + 3440) - 0.5) * 0.12;
    radialScales.push(clamp(1 + wave, 0.78, 1.26));
  }

  for (let ring = 1; ring <= rings; ring += 1) {
    const ringT = ring / rings;
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const rotatedX = Math.cos(angle) * stretchX * radialScales[i];
      const rotatedZ = Math.sin(angle) * stretchZ * radialScales[i];
      const x = centerX + (Math.cos(yaw) * rotatedX - Math.sin(yaw) * rotatedZ) * radius * ringT;
      const z = centerZ + (Math.sin(yaw) * rotatedX + Math.cos(yaw) * rotatedZ) * radius * ringT;
      const edgeLift = ring === rings ? 2.2 : 0;
      vertices.push(x, terrainHeight(x, z) + yOffset + edgeLift, z);
    }
  }

  for (let i = 0; i < segments; i += 1) {
    indices.push(0, 1 + i, 1 + ((i + 1) % segments));
  }

  for (let ring = 2; ring <= rings; ring += 1) {
    const innerStart = 1 + (ring - 2) * segments;
    const outerStart = 1 + (ring - 1) * segments;

    for (let i = 0; i < segments; i += 1) {
      const next = (i + 1) % segments;
      indices.push(innerStart + i, outerStart + i, outerStart + next);
      indices.push(innerStart + i, outerStart + next, innerStart + next);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({
    color: options.color ?? OWNER_COLORS[region.owner] ?? OWNER_COLORS.neutral,
    transparent: true,
    opacity: options.opacity ?? 0.08,
    depthWrite: false,
    depthTest: options.depthTest ?? false,
    fog: options.fog ?? false,
    side: THREE.DoubleSide
  });
  const footprint = new THREE.Mesh(geometry, material);
  footprint.renderOrder = options.renderOrder ?? 2;
  footprint.name = `${options.namePrefix ?? "province"}-${region.id}`;
  footprint.userData.regionId = region.id;
  footprint.userData.regionLabel = region.label;
  footprint.userData.owner = region.owner;
  footprint.userData.ownerLabel = OWNER_LABELS[region.owner] ?? region.owner;
  footprint.userData.baseOpacity = options.opacity ?? 0.08;
  footprint.userData.selectedOpacity = options.selectedOpacity ?? 0.36;
  footprint.userData.selectedScale = options.selectedScale ?? 1;
  footprint.userData.baseRenderOrder = footprint.renderOrder;
  return footprint;
}

function createRegionSelectionLayer() {
  const group = new THREE.Group();
  group.userData.regionDiscs = [];
  group.userData.regionSurfaces = [];
  group.userData.regionFog = [];
  group.userData.regionPickSurfaces = [];

  for (let i = 0; i < REGIONS.length; i += 1) {
    const region = REGIONS[i];
    const [baseX, baseZ] = region.center;
    const x = baseX * THEATER_SCALE;
    const z = baseZ * THEATER_SCALE;
    const ownerColor = OWNER_COLORS[region.owner] ?? OWNER_COLORS.neutral;
    const surface = createProvinceFootprint(region, i, {
      color: ownerColor,
      opacity: 0.008,
      selectedOpacity: 0.28,
      yOffset: 13,
      renderOrder: 2,
      namePrefix: "province-surface"
    });
    const fog = createProvinceFootprint(region, i, {
      color: ownerColor,
      opacity: 0.055,
      selectedOpacity: 0.14,
      yOffset: 95,
      radius: 1080 + seededRandom(i + 3610) * 320,
      renderOrder: 1,
      namePrefix: "province-fog"
    });
    const disc = createTerrainCircle(x, z, 390, OWNER_COLORS[region.owner], {
      opacity: 0.08,
      yOffset: 11,
      renderOrder: 2
    });
    disc.name = `region-${region.id}`;
    disc.userData.regionId = region.id;
    disc.userData.regionLabel = region.label;
    disc.userData.baseOpacity = 0.08;
    disc.userData.selectedOpacity = 0.34;
    disc.userData.selectedScale = 1;
    disc.userData.owner = region.owner;
    disc.userData.ownerLabel = OWNER_LABELS[region.owner] ?? region.owner;
    fog.userData.pickThrough = true;
    group.userData.regionSurfaces.push(surface);
    group.userData.regionFog.push(fog);
    group.userData.regionPickSurfaces.push(surface);
    group.userData.regionDiscs.push(disc);
    group.add(fog);
    group.add(surface);
    group.add(disc);
  }

  return group;
}

function createProvinceForceMarkers() {
  const group = new THREE.Group();
  const troopMaterials = FORCE_MARKER_COLORS.map((color) => new THREE.MeshStandardMaterial({
    color,
    roughness: 0.62,
    metalness: 0.04
  }));
  const darkMaterial = new THREE.MeshStandardMaterial({ color: "#28241d", roughness: 0.84 });

  for (let provinceIndex = 0; provinceIndex < REGIONAL_STRONGHOLDS.length; provinceIndex += 1) {
    const region = REGIONS[provinceIndex];
    const [baseX, baseZ] = REGIONAL_STRONGHOLDS[provinceIndex];
    const provinceX = baseX * THEATER_SCALE;
    const provinceZ = baseZ * THEATER_SCALE;

    for (let markerIndex = 0; markerIndex < FORCE_MARKER_COLORS.length; markerIndex += 1) {
      const angle = (markerIndex / FORCE_MARKER_COLORS.length) * Math.PI * 2 + seededRandom(provinceIndex + 1200) * 0.55;
      const distance = 235 + seededRandom(provinceIndex * 10 + markerIndex + 1210) * 115;
      const x = provinceX + Math.cos(angle) * distance;
      const z = provinceZ + Math.sin(angle) * distance;
      const marker = new THREE.Group();
      marker.userData.regionId = region.id;
      marker.userData.regionLabel = region.label;
      const circle = createTerrainCircle(x, z, 96, FORCE_MARKER_COLORS[markerIndex]);
      circle.userData.regionId = region.id;
      circle.userData.regionLabel = region.label;
      marker.add(circle);

      for (let troopIndex = 0; troopIndex < 7; troopIndex += 1) {
        const row = Math.floor(troopIndex / 3);
        const column = troopIndex % 3;
        const troopX = x + (column - 1) * 20 + seededRandom(provinceIndex * 100 + troopIndex + 1220) * 5;
        const troopZ = z + (row - 1) * 20 + seededRandom(provinceIndex * 100 + troopIndex + 1230) * 5;
        const troop = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 20, 6), troopMaterials[markerIndex]);
        body.position.y = 10;
        body.castShadow = true;
        troop.add(body);

        const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 34, 5), darkMaterial);
        spear.position.set(7, 19, 0);
        spear.rotation.z = -0.18;
        spear.castShadow = true;
        troop.add(spear);

        troop.scale.setScalar(0.55);
        placeOnTerrain(troop, troopX, troopZ, seededRandom(provinceIndex * 100 + troopIndex + 1240) * Math.PI * 2, 3.5);
        troop.userData.regionId = region.id;
        troop.userData.regionLabel = region.label;
        troop.traverse((child) => {
          child.userData.regionId = region.id;
          child.userData.regionLabel = region.label;
        });
        marker.add(troop);
      }

      group.add(marker);
    }
  }

  return group;
}

function createRiverDressing() {
  const group = new THREE.Group();
  const count = 1250;
  const reedMaterial = new THREE.MeshStandardMaterial({ color: "#40513d", roughness: 0.88 });
  const seedHeadMaterial = new THREE.MeshStandardMaterial({ color: "#8b6d43", roughness: 0.86 });
  const reed = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.34, 8, 5), reedMaterial, count);
  const seedHead = new THREE.InstancedMesh(new THREE.ConeGeometry(0.7, 2.5, 5), seedHeadMaterial, count);
  const mainCurve = createCurve(MAIN_RIVER_POINTS);
  const branchCurve = createCurve(BRANCH_RIVER_POINTS);
  const matrix = new THREE.Matrix4();

  for (let i = 0; i < count; i += 1) {
    const useBranch = seededRandom(i + 600) > 0.72;
    const curve = useBranch ? branchCurve : mainCurve;
    const t = seededRandom(i + 610);
    const side = seededRandom(i + 620) > 0.5 ? 1 : -1;
    const bankWidth = useBranch ? 24 : 48;
    const lateral = side * (bankWidth + seededRandom(i + 630) * 24);
    const point = sampleRiverPoint(curve, t, lateral, 0.6);
    const yaw = seededRandom(i + 640) * Math.PI * 2;
    const lean = fixedTreeQuaternion(i + 650, yaw);
    const scale = 0.45 + seededRandom(i + 660) * 0.48;

    matrix.compose(
      new THREE.Vector3(point.x, point.y + 4 * scale, point.z),
      lean,
      new THREE.Vector3(scale, scale, scale)
    );
    reed.setMatrixAt(i, matrix);

    matrix.compose(
      new THREE.Vector3(point.x, point.y + 9 * scale, point.z),
      lean,
      new THREE.Vector3(scale, scale, scale)
    );
    seedHead.setMatrixAt(i, matrix);
  }

  reed.castShadow = true;
  seedHead.castShadow = true;
  group.add(reed);
  group.add(seedHead);
  return group;
}

function createPathDressing() {
  const group = new THREE.Group();
  const count = 980;
  const material = new THREE.MeshStandardMaterial({
    color: "#786344",
    roughness: 0.96,
    metalness: 0.0
  });
  const stones = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), material, count);
  const matrix = new THREE.Matrix4();

  const entries = [
    [ROAD_PATHS.eastRidge, 10],
    [ROAD_PATHS.westPatrol, 6],
    [ROAD_PATHS.campSpur, 5]
  ];

  for (let i = 0; i < count; i += 1) {
    const [points, roadHalfWidth] = entries[Math.floor(seededRandom(i + 710) * entries.length)];
    const curve = createCurve(points);
    const t = seededRandom(i + 720);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const base = curve.getPoint(t);
    const sideSign = seededRandom(i + 730) > 0.5 ? 1 : -1;
    const offset = sideSign * (roadHalfWidth + 4 + seededRandom(i + 740) * 12);
    const x = base.x + side.x * offset;
    const z = base.z + side.z * offset;
    const y = terrainHeight(x, z) + 1.3;
    const scale = 0.8 + seededRandom(i + 750) * 2.6;
    const rotation = terrainQuaternion(x, z, seededRandom(i + 760) * Math.PI * 2);

    matrix.compose(
      new THREE.Vector3(x, y, z),
      rotation,
      new THREE.Vector3(scale * 1.6, scale * 0.45, scale)
    );
    stones.setMatrixAt(i, matrix);
  }

  stones.castShadow = true;
  stones.receiveShadow = true;
  group.add(stones);
  return group;
}

function createFieldPatches() {
  const group = new THREE.Group();
  const patchSets = [
    { count: 190, color: "#a5945f", seed: 1320 },
    { count: 170, color: "#6f7c48", seed: 1520 },
    { count: 130, color: "#8a6c45", seed: 1720 }
  ];

  for (const patchSet of patchSets) {
    const material = new THREE.MeshBasicMaterial({
      color: patchSet.color,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    const fields = new THREE.InstancedMesh(geometry, material, patchSet.count);
    const matrix = new THREE.Matrix4();

    for (let i = 0; i < patchSet.count; i += 1) {
      const region = REGIONS[Math.floor(seededRandom(i + patchSet.seed) * REGIONS.length)];
      const [baseX, baseZ] = region.center;
      const angle = seededRandom(i + patchSet.seed + 10) * Math.PI * 2;
      const distance = 260 + seededRandom(i + patchSet.seed + 20) * 860;
      const x = baseX * THEATER_SCALE + Math.cos(angle) * distance;
      const z = baseZ * THEATER_SCALE + Math.sin(angle) * distance;
      if (isNearRiver(x, z, 80)) {
        matrix.compose(
          new THREE.Vector3(0, -10000, 0),
          new THREE.Quaternion(),
          new THREE.Vector3(0, 0, 0)
        );
        fields.setMatrixAt(i, matrix);
        continue;
      }

      const height = terrainHeight(x, z);
      const slope = Math.abs(terrainHeight(x + 18, z) - terrainHeight(x, z + 18));
      const yaw = seededRandom(i + patchSet.seed + 30) * Math.PI;
      const flatScale = clamp(1.2 - slope * 0.04, 0.28, 1);
      const width = (80 + seededRandom(i + patchSet.seed + 40) * 180) * flatScale;
      const depth = (26 + seededRandom(i + patchSet.seed + 50) * 95) * flatScale;

      matrix.compose(
        new THREE.Vector3(x, height + 3.2, z),
        terrainTiltQuaternion(x, z, yaw, 0.38),
        new THREE.Vector3(width, 1, depth)
      );
      fields.setMatrixAt(i, matrix);
    }

    fields.renderOrder = 1;
    group.add(fields);
  }

  return group;
}

function createScrubClusters() {
  const group = new THREE.Group();
  const count = 2600;
  const scrubMaterial = new THREE.MeshStandardMaterial({ color: "#31432c", roughness: 0.92 });
  const dryMaterial = new THREE.MeshStandardMaterial({ color: "#6d6040", roughness: 0.94 });
  const scrub = new THREE.InstancedMesh(new THREE.ConeGeometry(1.4, 5, 5), scrubMaterial, count);
  const dryTufts = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), dryMaterial, count);
  const matrix = new THREE.Matrix4();

  for (let i = 0; i < count; i += 1) {
    let x = -7600 + seededRandom(i + 1820) * 15200;
    let z = -7700 + seededRandom(i + 1830) * 15400;
    if (isNearRiver(x, z, 58)) {
      x += x < 0 ? -95 : 95;
      z += z < 0 ? -55 : 55;
    }

    const height = terrainHeight(x, z);
    const yaw = seededRandom(i + 1840) * Math.PI * 2;
    const scale = 1.2 + seededRandom(i + 1850) * 5.4;
    const rotation = terrainTiltQuaternion(x, z, yaw, 0.5);

    matrix.compose(
      new THREE.Vector3(x, height + 2.6 * scale, z),
      rotation,
      new THREE.Vector3(scale, scale, scale)
    );
    scrub.setMatrixAt(i, matrix);

    matrix.compose(
      new THREE.Vector3(x + seededRandom(i + 1860) * 16 - 8, height + 1.1, z + seededRandom(i + 1870) * 16 - 8),
      rotation,
      new THREE.Vector3(scale * 1.5, scale * 0.22, scale)
    );
    dryTufts.setMatrixAt(i, matrix);
  }

  scrub.castShadow = true;
  dryTufts.receiveShadow = true;
  group.add(scrub);
  group.add(dryTufts);
  return group;
}

function createDenseForestPatches() {
  const group = new THREE.Group();
  const count = 4200;
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#30271f", roughness: 0.84 });
  const crownMaterial = new THREE.MeshStandardMaterial({ color: "#173224", roughness: 0.88 });
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.9, 1.2, 10, 5), trunkMaterial, count);
  const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(5.2, 22, 6), crownMaterial, count);
  const matrix = new THREE.Matrix4();
  const patchCenters = [
    [-2520, 910], [-1840, 1850], [-1160, -1460], [-520, 720],
    [260, -1480], [920, 1840], [1420, -320], [1960, 900],
    [2500, -980], [-2960, -900]
  ].map(([x, z]) => [x * THEATER_SCALE, z * THEATER_SCALE]);

  for (let i = 0; i < count; i += 1) {
    const [centerX, centerZ] = patchCenters[Math.floor(seededRandom(i + 2260) * patchCenters.length)];
    const angle = seededRandom(i + 2270) * Math.PI * 2;
    const radius = Math.sqrt(seededRandom(i + 2280)) * (180 + seededRandom(i + 2290) * 340);
    let x = centerX + Math.cos(angle) * radius;
    let z = centerZ + Math.sin(angle) * radius * (0.65 + seededRandom(i + 2300) * 0.45);
    if (isNearRiver(x, z, 72)) {
      x += x < centerX ? -110 : 110;
    }

    const y = terrainHeight(x, z);
    const yaw = seededRandom(i + 2310) * Math.PI * 2;
    const rotation = fixedTreeQuaternion(i + 2320, yaw);
    const scale = 0.72 + seededRandom(i + 2330) * 0.74;

    matrix.compose(new THREE.Vector3(x, y + 5 * scale, z), rotation, new THREE.Vector3(scale, scale, scale));
    trunk.setMatrixAt(i, matrix);

    matrix.compose(
      new THREE.Vector3(x, y + 19 * scale, z),
      rotation,
      new THREE.Vector3(scale, scale * (0.9 + seededRandom(i + 2340) * 0.32), scale)
    );
    crown.setMatrixAt(i, matrix);
  }

  trunk.castShadow = true;
  crown.castShadow = true;
  group.add(trunk);
  group.add(crown);
  return group;
}

function createPrimeLandmarks() {
  const group = new THREE.Group();
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: "#8c8068", roughness: 0.9 });
  const darkStoneMaterial = new THREE.MeshStandardMaterial({ color: "#4e5047", roughness: 0.94 });
  const goldMaterial = new THREE.MeshStandardMaterial({ color: "#c69a45", metalness: 0.14, roughness: 0.42 });
  const landmarks = [
    { type: "stoneCircle", at: [-2100, 420], scale: 1.15 },
    { type: "obelisk", at: [2080, 1540], scale: 2.05 },
    { type: "watchBeacon", at: [720, -1680], scale: 0.95 },
    { type: "ruinArch", at: [-520, -2220], scale: 1.35 },
    { type: "stoneCircle", at: [1580, -1820], scale: 0.82 },
    { type: "watchBeacon", at: [-2700, 1880], scale: 1.8 },
    { type: "aqueduct", at: [-1320, 1060], scale: 1.7 },
    { type: "colossus", at: [2720, 820], scale: 2.2 },
    { type: "ruinArch", at: [310, 2250], scale: 0.75 },
    { type: "obelisk", at: [-3160, -980], scale: 1.35 },
    { type: "aqueduct", at: [1260, -420], scale: 1.05 },
    { type: "stoneCircle", at: [2480, -2420], scale: 1.5 },
    { type: "colossus", at: [-2360, -1780], scale: 1.65 },
    { type: "watchBeacon", at: [420, 620], scale: 0.72 }
  ];

  for (let i = 0; i < landmarks.length; i += 1) {
    const landmark = landmarks[i];
    const x = landmark.at[0] * THEATER_SCALE;
    const z = landmark.at[1] * THEATER_SCALE;
    const yaw = seededRandom(i + 2400) * Math.PI * 2;
    const feature = new THREE.Group();

    if (landmark.type === "stoneCircle") {
      for (let pylonIndex = 0; pylonIndex < 10; pylonIndex += 1) {
        const angle = (pylonIndex / 10) * Math.PI * 2;
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(12, 44, 10), darkStoneMaterial);
        pylon.position.set(Math.cos(angle) * 72, 24, Math.sin(angle) * 72);
        pylon.rotation.y = -angle;
        pylon.castShadow = true;
        feature.add(pylon);
      }
    } else if (landmark.type === "obelisk") {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(32, 42, 18, 6), stoneMaterial);
      base.position.y = 9;
      base.castShadow = true;
      feature.add(base);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(12, 18, 118, 5), goldMaterial);
      shaft.position.y = 76;
      shaft.castShadow = true;
      feature.add(shaft);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(20, 42, 5), goldMaterial);
      cap.position.y = 156;
      cap.castShadow = true;
      feature.add(cap);
    } else if (landmark.type === "watchBeacon") {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(14, 20, 82, 7), darkStoneMaterial);
      tower.position.y = 42;
      tower.castShadow = true;
      feature.add(tower);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(18, 42, 7), goldMaterial);
      flame.position.y = 104;
      flame.castShadow = true;
      feature.add(flame);
    } else if (landmark.type === "aqueduct") {
      for (let archIndex = 0; archIndex < 5; archIndex += 1) {
        const offset = (archIndex - 2) * 46;
        for (const side of [-1, 1]) {
          const pillar = new THREE.Mesh(new THREE.BoxGeometry(10, 58, 12), stoneMaterial);
          pillar.position.set(offset + side * 13, 29, 0);
          pillar.castShadow = true;
          feature.add(pillar);
        }
        const span = new THREE.Mesh(new THREE.BoxGeometry(44, 10, 12), stoneMaterial);
        span.position.set(offset, 61, 0);
        span.castShadow = true;
        feature.add(span);
      }
    } else if (landmark.type === "colossus") {
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(72, 22, 72), stoneMaterial);
      plinth.position.y = 11;
      plinth.castShadow = true;
      feature.add(plinth);
      const legs = new THREE.Mesh(new THREE.BoxGeometry(26, 72, 24), darkStoneMaterial);
      legs.position.y = 58;
      legs.castShadow = true;
      feature.add(legs);
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(20, 25, 78, 7), goldMaterial);
      torso.position.y = 132;
      torso.castShadow = true;
      feature.add(torso);
      const head = new THREE.Mesh(new THREE.DodecahedronGeometry(20, 0), goldMaterial);
      head.position.y = 186;
      head.castShadow = true;
      feature.add(head);
      const raisedArm = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 90, 6), goldMaterial);
      raisedArm.position.set(32, 172, 0);
      raisedArm.rotation.z = -0.45;
      raisedArm.castShadow = true;
      feature.add(raisedArm);
    } else {
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(18, 76, 18), stoneMaterial);
        pillar.position.set(side * 32, 38, 0);
        pillar.castShadow = true;
        feature.add(pillar);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(88, 18, 18), stoneMaterial);
      lintel.position.y = 82;
      lintel.castShadow = true;
      feature.add(lintel);
    }

    const flatSpot = findFlatSpot(x, z, 460, 22);
    feature.scale.setScalar(landmark.scale * (0.94 + seededRandom(i + 2410) * 0.12));
    placeUprightOnTerrain(feature, flatSpot.x, flatSpot.z, yaw, 9);
    group.add(feature);
  }

  return group;
}

function createEnvironmentDressing() {
  const group = new THREE.Group();
  group.add(createFieldPatches());
  group.add(createScrubClusters());
  group.add(createDenseForestPatches());
  group.add(createRiverDressing());
  group.add(createPathDressing());
  return group;
}

function seededRandom(seed) {
  return Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
}

function distanceToCurve2D(curve, x, z, samples = 80) {
  let best = Infinity;

  for (let i = 0; i <= samples; i += 1) {
    const point = curve.getPoint(i / samples);
    const dx = point.x - x;
    const dz = point.z - z;
    best = Math.min(best, Math.sqrt(dx * dx + dz * dz));
  }

  return best;
}

function isNearRiver(x, z, clearance = 86) {
  const mainCurve = createCurve(MAIN_RIVER_POINTS);
  const branchCurve = createCurve(BRANCH_RIVER_POINTS);
  if (distanceToCurve2D(mainCurve, x, z) < clearance || distanceToCurve2D(branchCurve, x, z) < clearance * 0.65) {
    return true;
  }

  for (const riverSystem of ADDITIONAL_RIVER_SYSTEMS) {
    if (distanceToCurve2D(createCurve(riverSystem.points), x, z) < clearance * 0.74) return true;
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
    const lakeDistance = (localX * localX) / ((lake.radiusX * THEATER_SCALE) ** 2) + (localZ * localZ) / ((lake.radiusZ * THEATER_SCALE) ** 2);
    if (lakeDistance < 1.18) return true;
  }

  return false;
}

function createTreeLines() {
  const count = 1800;
  const group = new THREE.Group();
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#3f3428", roughness: 0.78 });
  const crownMaterial = new THREE.MeshStandardMaterial({ color: "#1e3f32", roughness: 0.82 });
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.95, 1.35, 14, 5), trunkMaterial, count);
  const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(5.8, 30, 7), crownMaterial, count);
  const matrix = new THREE.Matrix4();

  for (let i = 0; i < count; i += 1) {
    const side = seededRandom(i + 4) > 0.5 ? 1 : -1;
    const ridgeBand = seededRandom(i + 63) > 0.64 ? 1.34 : 1;
    let x = side * (420 + seededRandom(i + 12) * 5200 * ridgeBand);
    const z = -6500 + seededRandom(i + 21) * 13000;
    if (isNearRiver(x, z, 58)) x += side * (115 + seededRandom(i + 62) * 140);

    const y = terrainHeight(x, z);
    const yaw = seededRandom(i + 41) * Math.PI * 2;
    const rotation = fixedTreeQuaternion(i + 52, yaw);
    const scale = REGIONAL_OBJECT_SCALE * (0.7 + seededRandom(i + 33) * 0.72);
    const trunkPosition = new THREE.Vector3(x, y + 7 * scale, z);
    const crownPosition = new THREE.Vector3(x, y + 24 * scale, z);

    matrix.compose(
      trunkPosition,
      rotation,
      new THREE.Vector3(scale, scale, scale)
    );
    trunk.setMatrixAt(i, matrix);

    matrix.compose(
      crownPosition,
      rotation,
      new THREE.Vector3(scale, scale * (0.9 + seededRandom(i + 7) * 0.35), scale)
    );
    crown.setMatrixAt(i, matrix);
  }

  trunk.castShadow = true;
  crown.castShadow = true;
  group.add(trunk);
  group.add(crown);
  return group;
}

function createRockOutcrops() {
  const count = 380;
  const material = new THREE.MeshStandardMaterial({
    color: "#5c5a4e",
    roughness: 0.93,
    metalness: 0.0
  });
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), material, count);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();

  for (let i = 0; i < count; i += 1) {
    let x = -6100 + seededRandom(i + 80) * 12200;
    const z = -6900 + seededRandom(i + 90) * 13800;
    if (isNearRiver(x, z, 52)) x += x < 0 ? -120 : 120;

    const y = terrainHeight(x, z) + 2.4;
    const scale = 3.6 + seededRandom(i + 100) * 13;
    euler.set(seededRandom(i + 120) * 0.4, seededRandom(i + 130) * Math.PI, seededRandom(i + 140) * 0.4);
    rotation.copy(terrainQuaternion(x, z, seededRandom(i + 130) * Math.PI)).multiply(new THREE.Quaternion().setFromEuler(euler));

    matrix.compose(
      new THREE.Vector3(x, y, z),
      rotation,
      new THREE.Vector3(scale * 1.5, scale * 0.62, scale)
    );
    rocks.setMatrixAt(i, matrix);
  }

  rocks.castShadow = true;
  rocks.receiveShadow = true;
  return rocks;
}

function placeOnTerrain(object, x, z, yaw = 0, offset = 0) {
  const normal = terrainNormal(x, z);
  object.position.copy(new THREE.Vector3(x, terrainHeight(x, z), z).addScaledVector(normal, offset));
  object.quaternion.copy(terrainQuaternion(x, z, yaw));
}

function placeUprightOnTerrain(object, x, z, yaw = 0, offset = 0) {
  const normal = terrainNormal(x, z);
  object.position.copy(new THREE.Vector3(x, terrainHeight(x, z), z).addScaledVector(normal, offset));
  object.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}

function createSoldier({ armorMaterial, accentMaterial, skinMaterial, darkMaterial, weapon = "spear" }) {
  const group = new THREE.Group();

  const legs = [
    [-2.4, 4, 0],
    [2.4, 4, 0]
  ];
  for (const [x, y, z] of legs) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(2.2, 8, 2.2), darkMaterial);
    leg.position.set(x, y, z);
    leg.castShadow = true;
    group.add(leg);
  }

  const torso = new THREE.Mesh(new THREE.BoxGeometry(7.5, 10, 4.2), armorMaterial);
  torso.position.y = 13;
  torso.castShadow = true;
  group.add(torso);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(8.4, 5.5, 4.7), accentMaterial);
  chest.position.y = 14.5;
  chest.castShadow = true;
  group.add(chest);

  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 6.2, 5.2, 6), armorMaterial);
  skirt.position.y = 8.4;
  skirt.rotation.y = Math.PI / 6;
  skirt.castShadow = true;
  group.add(skirt);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 1.2, 8), darkMaterial);
  belt.position.y = 10.2;
  group.add(belt);

  for (const x of [-5.4, 5.4]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 2), armorMaterial);
    arm.position.set(x, 13, 0);
    arm.rotation.z = x < 0 ? 0.28 : -0.28;
    arm.castShadow = true;
    group.add(arm);

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(2.2, 7, 5), accentMaterial);
    shoulder.scale.set(1.2, 0.62, 1);
    shoulder.position.set(x, 17, 0);
    shoulder.castShadow = true;
    group.add(shoulder);
  }

  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(2.8, 0), skinMaterial);
  head.position.y = 21.2;
  head.castShadow = true;
  group.add(head);

  const helmet = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.4, 2.2, 7), armorMaterial);
  helmet.position.y = 23.5;
  helmet.castShadow = true;
  group.add(helmet);

  const crest = new THREE.Mesh(new THREE.BoxGeometry(1.3, 4, 5.8), accentMaterial);
  crest.position.y = 26.5;
  crest.castShadow = true;
  group.add(crest);

  const faceGuard = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.6, 5.2), armorMaterial);
  faceGuard.position.set(-1.6, 21.4, 0);
  faceGuard.castShadow = true;
  group.add(faceGuard);

  const shield = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8.8, 5.5), accentMaterial);
  shield.position.set(-6.8, 13, -1.2);
  shield.rotation.z = 0.08;
  shield.castShadow = true;
  group.add(shield);

  const spearLength = weapon === "javelin" ? 18 : 28;
  const spearRadius = weapon === "javelin" ? 0.38 : 0.45;
  const spear = new THREE.Mesh(new THREE.CylinderGeometry(spearRadius, spearRadius + 0.1, spearLength, 5), darkMaterial);
  spear.position.set(weapon === "javelin" ? 5.8 : 6.8, weapon === "javelin" ? 16.8 : 18, 1);
  spear.rotation.z = weapon === "javelin" ? -0.52 : -0.18;
  spear.castShadow = true;
  group.add(spear);

  return group;
}

function createRider(material, accentMaterial, horseColor = "#45382c") {
  const group = new THREE.Group();
  const horseMaterial = new THREE.MeshStandardMaterial({ color: horseColor, roughness: 0.72 });
  const maneMaterial = new THREE.MeshStandardMaterial({ color: "#201a17", roughness: 0.9 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: "#b8865f", roughness: 0.68 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 8), horseMaterial);
  body.position.y = 7;
  body.castShadow = true;
  group.add(body);

  const horseHead = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), horseMaterial);
  horseHead.position.set(9, 9, 0);
  horseHead.castShadow = true;
  group.add(horseHead);

  const neck = new THREE.Mesh(new THREE.BoxGeometry(7.5, 7, 5.8), horseMaterial);
  neck.position.set(6.2, 10.2, 0);
  neck.rotation.z = -0.45;
  neck.castShadow = true;
  group.add(neck);

  const mane = new THREE.Mesh(new THREE.BoxGeometry(8, 5.5, 0.9), maneMaterial);
  mane.position.set(5.2, 13.2, 0);
  mane.rotation.z = -0.45;
  group.add(mane);

  for (const z of [-1.5, 1.5]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.3, 5), horseMaterial);
    ear.position.set(9.8, 13, z);
    ear.castShadow = true;
    group.add(ear);
  }

  const tail = new THREE.Mesh(new THREE.ConeGeometry(1.5, 9, 6), maneMaterial);
  tail.position.set(-9.5, 6.2, 0);
  tail.rotation.z = Math.PI / 2.7;
  group.add(tail);

  for (const x of [-5, 4]) {
    for (const z of [-3, 3]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 2), horseMaterial);
      leg.position.set(x, 1.5, z);
      leg.castShadow = true;
      group.add(leg);
    }
  }

  const rider = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 9, 7), material);
  rider.position.y = 15;
  rider.castShadow = true;
  group.add(rider);

  const riderHead = new THREE.Mesh(new THREE.DodecahedronGeometry(2.3, 0), skinMaterial);
  riderHead.position.y = 21.8;
  riderHead.castShadow = true;
  group.add(riderHead);

  const helmet = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.7, 1.8, 7), accentMaterial);
  helmet.position.y = 23.6;
  helmet.castShadow = true;
  group.add(helmet);

  for (const x of [-3.8, 3.8]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6.5, 1.5), material);
    arm.position.set(x, 16.5, 0);
    arm.rotation.z = x < 0 ? 0.3 : -0.3;
    arm.castShadow = true;
    group.add(arm);
  }

  for (const z of [-3.1, 3.1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 7, 1.6), material);
    leg.position.set(-1.2, 12, z);
    leg.rotation.z = 0.18;
    leg.castShadow = true;
    group.add(leg);
  }

  const shield = new THREE.Mesh(new THREE.BoxGeometry(1.4, 8, 5), accentMaterial);
  shield.position.set(1, 12, -5);
  shield.castShadow = true;
  group.add(shield);

  const lance = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 30, 6), maneMaterial);
  lance.position.set(4.5, 19, 2.8);
  lance.rotation.z = -Math.PI / 2.25;
  lance.castShadow = true;
  group.add(lance);

  return group;
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    for (const material of materials) material.dispose?.();
  });
}

function terrainPoint(x, z, offset = 0) {
  const y = terrainHeight(x, z);
  return new THREE.Vector3(x, y + offset, z);
}

const ENCOUNTER_UNIT_COLORS = {
  light: "#4f9b49",
  medium: "#2d6ecf",
  heavy: "#b7332a"
};

const ENCOUNTER_SIDE_COLORS = {
  attacker: { banner: "#f3d36b", border: "#ffe7a4", pole: "#4a2c19", label: "gold" },
  defender: { banner: "#151923", border: "#f2f2f2", pole: "#2b2f38", label: "black" }
};

const ENCOUNTER_FEATURES = {
  river: { color: "#68cff2", blocksLineOfSight: false, obstacle: true, movement: "impassable" },
  road: { color: "#9c7245", blocksLineOfSight: false, obstacle: false, movement: "open" },
  settlement: { color: "#c59558", blocksLineOfSight: true, obstacle: true, movement: "impassable" },
  landmark: { color: "#d0b463", blocksLineOfSight: true, obstacle: true, movement: "impassable" },
  woods: { color: "#49663a", blocksLineOfSight: true, obstacle: true, movement: "impassable" }
};

function encounterPalette(unitType = "medium", side = "attacker") {
  const armorColor = new THREE.Color(ENCOUNTER_UNIT_COLORS[unitType] ?? ENCOUNTER_UNIT_COLORS.medium);
  if (side === "defender") armorColor.offsetHSL(0.025, -0.08, -0.18);
  const accentColor = side === "attacker" ? "#f0d079" : "#d8dde0";
  return {
    armorMaterial: new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.56 }),
    accentMaterial: new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.42, metalness: 0.08 }),
    skinMaterial: new THREE.MeshStandardMaterial({ color: side === "attacker" ? "#b07b58" : "#9f7860", roughness: 0.7 }),
    darkMaterial: new THREE.MeshStandardMaterial({ color: side === "attacker" ? "#30251f" : "#171b20", roughness: 0.84 }),
    horseColor: side === "attacker" ? "#7b4c2d" : "#252d35"
  };
}

function encounterAxes(encounter) {
  const bearing = Number(encounter.bearing ?? 0);
  const forward = new THREE.Vector3(Math.cos(bearing), 0, Math.sin(bearing)).normalize();
  const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
  return { forward, right };
}

function hexAxialToWorld(encounter, q, r, size) {
  const { forward, right } = encounterAxes(encounter);
  const localX = Math.sqrt(3) * size * (q + r / 2);
  const localZ = 1.5 * size * r;
  return {
    x: encounter.center.x + right.x * localX + forward.x * localZ,
    z: encounter.center.z + right.z * localX + forward.z * localZ
  };
}

function hexCornerPoint(encounter, center, size, side, yOffset = 8) {
  const { forward, right } = encounterAxes(encounter);
  const angle = (Math.PI / 6) + side * (Math.PI / 3);
  const localX = Math.cos(angle) * size;
  const localZ = Math.sin(angle) * size;
  const x = center.x + right.x * localX + forward.x * localZ;
  const z = center.z + right.z * localX + forward.z * localZ;
  return terrainPoint(x, z, yOffset);
}

function terrainHexLocalPoint(axes, center, localX, localZ, yOffset) {
  const x = center.x + axes.right.x * localX + axes.forward.x * localZ;
  const z = center.z + axes.right.z * localX + axes.forward.z * localZ;
  return terrainPoint(x, z, yOffset);
}

function createTerrainHexTile(encounter, q, r, size, color, opacity, yOffset = 6, renderOrder = 48, fillScale = 0.92) {
  const center = hexAxialToWorld(encounter, q, r, size);
  const axes = encounterAxes(encounter);
  const vertices = [];
  const outlinePoints = [];
  const subdivisions = fillScale >= 0.85 ? 5 : 4;

  function cornerLocal(side, scale = fillScale) {
    const angle = (Math.PI / 6) + side * (Math.PI / 3);
    return {
      x: Math.cos(angle) * size * scale,
      z: Math.sin(angle) * size * scale
    };
  }

  function pushPoint(localX, localZ, offset = yOffset) {
    const point = terrainHexLocalPoint(axes, center, localX, localZ, offset);
    vertices.push(point.x, point.y, point.z);
  }

  function pushTriangle(a, b, c) {
    pushPoint(a.x, a.z);
    pushPoint(b.x, b.z);
    pushPoint(c.x, c.z);
  }

  function interpolate(a, b, u, v) {
    return {
      x: a.x * u + b.x * v,
      z: a.z * u + b.z * v
    };
  }

  for (let side = 0; side < 6; side += 1) {
    const a = cornerLocal(side);
    const b = cornerLocal((side + 1) % 6);
    for (let i = 0; i < subdivisions; i += 1) {
      for (let j = 0; j < subdivisions - i; j += 1) {
        const p0 = interpolate(a, b, i / subdivisions, j / subdivisions);
        const p1 = interpolate(a, b, (i + 1) / subdivisions, j / subdivisions);
        const p2 = interpolate(a, b, i / subdivisions, (j + 1) / subdivisions);
        pushTriangle(p0, p1, p2);

        if (j < subdivisions - i - 1) {
          const p3 = interpolate(a, b, (i + 1) / subdivisions, (j + 1) / subdivisions);
          pushTriangle(p1, p3, p2);
        }
      }
    }
  }

  const outlineSegments = 4;
  for (let side = 0; side < 6; side += 1) {
    const a = cornerLocal(side, 1);
    const b = cornerLocal((side + 1) % 6, 1);
    for (let step = 0; step < outlineSegments; step += 1) {
      const t = step / outlineSegments;
      outlinePoints.push(terrainHexLocalPoint(
        axes,
        center,
        a.x * (1 - t) + b.x * t,
        a.z * (1 - t) + b.z * t,
        yOffset + 0.55
      ));
    }
  }
  outlinePoints.push(outlinePoints[0].clone());

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();

  const tile = new THREE.Group();
  if (opacity > 0) {
    const fill = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4
    }));
    fill.renderOrder = renderOrder;
    tile.add(fill);
  } else {
    geometry.dispose();
  }

  const outline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(outlinePoints),
    new THREE.LineBasicMaterial({ color: "#f4e7b6", transparent: true, opacity: 0.48, depthWrite: false, depthTest: false })
  );
  outline.renderOrder = renderOrder + 1;
  tile.add(outline);
  return tile;
}

function isNearStronghold(x, z, clearance = 190) {
  return REGIONAL_STRONGHOLDS.some(([baseX, baseZ]) => {
    const dx = baseX * THEATER_SCALE - x;
    const dz = baseZ * THEATER_SCALE - z;
    return Math.hypot(dx, dz) < clearance;
  });
}

function isNearSettlement(x, z, clearance = 120) {
  for (let i = 0; i < REGIONAL_STRONGHOLDS.length; i += 1) {
    const [baseX, baseZ] = REGIONAL_STRONGHOLDS[i];
    const centerX = baseX * THEATER_SCALE;
    const centerZ = baseZ * THEATER_SCALE;
    if (Math.hypot(centerX - x, centerZ - z) < clearance * 1.8) return true;
    for (let j = 0; j < 5; j += 1) {
      const ring = 110 + seededRandom(i * 20 + j + 1040) * 260;
      const angle = seededRandom(i * 20 + j + 1050) * Math.PI * 2;
      const roadBias = seededRandom(i * 20 + j + 1060) > 0.55 ? 1.45 : 0.72;
      const hx = centerX + Math.cos(angle) * ring * roadBias;
      const hz = centerZ + Math.sin(angle) * ring;
      if (Math.hypot(hx - x, hz - z) < clearance) return true;
    }
  }
  return false;
}

function classifyEncounterHex(encounter, q, r, size) {
  return classifyEncounterTerrainCell(encounter, q, r, size);
}

function createTerrainFeatureRibbon(world, size, direction, width, color, yOffset = 10, opacity = 1) {
  const tangent = { x: Math.cos(direction), z: Math.sin(direction) };
  const side = { x: -tangent.z, z: tangent.x };
  const vertices = [];
  const indices = [];
  const segments = 10;
  const halfLength = size * 0.72;

  for (let step = 0; step <= segments; step += 1) {
    const along = -halfLength + (halfLength * 2 * step) / segments;
    for (const lateral of [-width * 0.5, width * 0.5]) {
      const x = world.x + tangent.x * along + side.x * lateral;
      const z = world.z + tangent.z * along + side.z * lateral;
      vertices.push(x, terrainHeight(x, z) + yOffset, z);
    }
    if (step < segments) {
      const a = step * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const ribbon = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color,
    roughness: 0.86,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -5
  }));
  ribbon.receiveShadow = true;
  ribbon.renderOrder = 57;
  return ribbon;
}

function createWaterWaveMarks(encounter, q, r, size) {
  const group = new THREE.Group();
  const center = hexAxialToWorld(encounter, q, r, size);
  const axes = encounterAxes(encounter);
  const material = new THREE.LineBasicMaterial({
    color: "#d9f6ff",
    transparent: true,
    opacity: 0.74,
    depthTest: false,
    depthWrite: false
  });

  for (const row of [-0.34, 0, 0.34]) {
    const points = [];
    for (let step = 0; step <= 16; step += 1) {
      const progress = step / 16;
      const localX = (progress - 0.5) * size * 1.05;
      const localZ = row * size + Math.sin(progress * Math.PI * 3 + row * 4) * size * 0.045;
      points.push(terrainHexLocalPoint(axes, center, localX, localZ, 12));
    }
    const wave = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
    wave.renderOrder = 93;
    group.add(wave);
  }
  group.name = "encounter-water-waves";
  return group;
}

function createEncounterHouse(size) {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: "#d4b078", roughness: 0.92 });
  const timber = new THREE.MeshStandardMaterial({ color: "#4d3020", roughness: 0.88 });
  const tile = new THREE.MeshStandardMaterial({ color: "#a7432d", roughness: 0.8 });
  const plaster = new THREE.MeshStandardMaterial({ color: "#ead6ac", roughness: 0.94 });

  const foundation = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.38, size * 0.4, 4, 6), stone);
  foundation.position.y = 2;
  foundation.receiveShadow = true;
  group.add(foundation);

  const walls = new THREE.Mesh(new THREE.BoxGeometry(size * 0.58, size * 0.34, size * 0.42), plaster);
  walls.position.y = size * 0.2;
  walls.castShadow = true;
  group.add(walls);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(size * 0.45, size * 0.25, 4), tile);
  roof.position.y = size * 0.49;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  const door = new THREE.Mesh(new THREE.BoxGeometry(2.5, size * 0.18, size * 0.12), timber);
  door.position.set(size * 0.295, size * 0.13, 0);
  group.add(door);
  for (const z of [-size * 0.13, size * 0.13]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.7, size * 0.31, 1.7), timber);
    beam.position.set(size * 0.298, size * 0.21, z);
    group.add(beam);
  }

  const chimney = new THREE.Mesh(new THREE.BoxGeometry(4, size * 0.24, 4), stone);
  chimney.position.set(-size * 0.14, size * 0.56, size * 0.1);
  chimney.castShadow = true;
  group.add(chimney);
  return group;
}

function createEncounterWoods(size) {
  const group = new THREE.Group();
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#493421", roughness: 0.96 });
  const crownMaterial = new THREE.MeshStandardMaterial({ color: "#31512d", roughness: 0.9 });
  for (const [x, z, scale] of [[-0.2, -0.08, 1], [0.18, -0.16, 0.82], [0.04, 0.2, 0.72]]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.7, size * 0.28 * scale, 6), trunkMaterial);
    trunk.position.set(size * x, size * 0.14 * scale, size * z);
    trunk.castShadow = true;
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(size * 0.13 * scale, size * 0.42 * scale, 7), crownMaterial);
    crown.position.set(size * x, size * 0.43 * scale, size * z);
    crown.castShadow = true;
    group.add(crown);
  }
  return group;
}

function createFeatureMarker(encounter, q, r, size, featureCell) {
  const featureType = featureCell.type;
  const feature = ENCOUNTER_FEATURES[featureType];
  if (!feature) return null;
  const world = hexAxialToWorld(encounter, q, r, size);
  const group = new THREE.Group();
  group.name = `encounter-feature-${featureType}`;
  group.userData.featureType = featureType;
  group.userData.obstacle = feature.obstacle;
  group.userData.blocksLineOfSight = feature.blocksLineOfSight;
  group.userData.movement = feature.movement;
  group.userData.direction = featureCell.direction;

  if (featureType === "river") {
    group.add(createTerrainHexTile(encounter, q, r, size, feature.color, 1, 10, 90, 0.92));
    group.add(createWaterWaveMarks(encounter, q, r, size));
  } else if (featureType === "road") {
    group.add(createTerrainFeatureRibbon(world, size, featureCell.direction, size * 0.3, "#75502f", 8));
    group.add(createTerrainFeatureRibbon(world, size, featureCell.direction, size * 0.19, "#b58a55", 9));
  } else if (featureType === "settlement") {
    const house = createEncounterHouse(size);
    placeUprightOnTerrain(house, world.x, world.z, -featureCell.direction, 8);
    group.add(house);
  } else if (featureType === "landmark") {
    const monument = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: "#cfb77f", roughness: 0.86 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.27, size * 0.34, 7, 6), stone);
    base.position.y = 3.5;
    monument.add(base);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.1, size * 0.14, size * 0.58, 8), stone);
    column.position.y = size * 0.34;
    column.castShadow = true;
    monument.add(column);
    placeUprightOnTerrain(monument, world.x, world.z, 0, 7);
    group.add(monument);
  } else if (featureType === "woods") {
    const woods = createEncounterWoods(size);
    placeUprightOnTerrain(woods, world.x, world.z, 0, 6);
    group.add(woods);
  }

  return group;
}

function createEncounterHexGrid(encounter) {
  const group = new THREE.Group();
  const radius = encounter.hex?.radius ?? 6;
  const size = encounter.hex?.cellSize ?? 72;
  group.userData.featureCells = [];

  for (let q = -radius; q <= radius; q += 1) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);

    for (let r = rMin; r <= rMax; r += 1) {
      const feature = classifyEncounterHex(encounter, q, r, size);
      group.add(createTerrainHexTile(encounter, q, r, size, "#e9dca6", 0, 6, 48, 0.9));
      if (feature) group.userData.featureCells.push({ q, r, ...feature });
    }
  }

  return group;
}

function createOccupiedHexPlate(encounter, cell) {
  const size = encounter.board?.cellSize ?? encounter.hex?.cellSize ?? 72;
  const color = ENCOUNTER_UNIT_COLORS[cell.unitType] ?? ENCOUNTER_UNIT_COLORS.medium;
  const plate = createTerrainHexTile(encounter, cell.q, cell.r, size, color, 0.5, 9, 54, 0.84);
  plate.userData.unitType = cell.unitType;
  plate.userData.side = cell.side;
  return plate;
}

function createArmyStandard(side) {
  const sideColors = ENCOUNTER_SIDE_COLORS[side] ?? ENCOUNTER_SIDE_COLORS.defender;
  const group = new THREE.Group();
  group.name = `encounter-${side}-army-standard`;
  group.userData.side = side;

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 1.05, 42, 7),
    new THREE.MeshStandardMaterial({ color: sideColors.pole, roughness: 0.7 })
  );
  pole.position.set(0, 21, 0);
  pole.castShadow = true;
  group.add(pole);

  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(20, 12, 1.2),
    new THREE.MeshStandardMaterial({ color: sideColors.banner, roughness: 0.48, metalness: side === "attacker" ? 0.1 : 0.03 })
  );
  flag.position.set(10, 34, 0);
  flag.castShadow = true;
  group.add(flag);

  const emblem = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 1.5, 8),
    new THREE.MeshStandardMaterial({ color: sideColors.border, roughness: 0.4, metalness: 0.16 })
  );
  emblem.position.set(10, 34, -1);
  emblem.rotation.x = Math.PI / 2;
  group.add(emblem);

  return group;
}

function createEncounterCenterLine(encounter) {
  const radius = encounter.hex?.radius ?? 6;
  const size = encounter.hex?.cellSize ?? 72;
  const axes = encounterAxes(encounter);
  const halfWidth = Math.sqrt(3) * size * (radius + 0.5);
  const points = [];

  for (let step = 0; step <= 48; step += 1) {
    const lateral = -halfWidth + (halfWidth * 2 * step) / 48;
    points.push(terrainHexLocalPoint(axes, encounter.center, lateral, 0, 12));
  }

  const line = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 96, 3.2, 6, false),
    new THREE.MeshBasicMaterial({
      color: "#711722",
      transparent: true,
      opacity: 0.96,
      depthTest: false,
      depthWrite: false
    })
  );
  line.name = "encounter-center-line";
  line.renderOrder = 72;
  line.userData.axis = encounter.board?.centerLine?.axis ?? "r";
  line.userData.coordinate = encounter.board?.centerLine?.coordinate ?? 0;
  return line;
}

function createEncounterUnitModel(unitGroup, side) {
  const palette = encounterPalette(unitGroup.unitType, side);
  const isHeavy = unitGroup.unitType === "heavy";
  const isLight = unitGroup.unitType === "light";
  const model = isHeavy
    ? createRider(palette.armorMaterial, palette.accentMaterial, palette.horseColor)
    : createSoldier({
        armorMaterial: palette.armorMaterial,
        accentMaterial: palette.accentMaterial,
        skinMaterial: palette.skinMaterial,
        darkMaterial: palette.darkMaterial,
        weapon: isLight ? "javelin" : "spear"
      });

  model.scale.setScalar(isHeavy ? 0.72 : isLight ? 0.84 : 0.9);
  model.userData.unitType = unitGroup.unitType;
  model.userData.side = side;
  return model;
}

function createEncounterSquadModel(unitGroup, side) {
  const source = createEncounterUnitModel(unitGroup, side);
  const squad = new THREE.Group();
  const slots = [
    [-11, -18], [-11, 0], [-11, 18],
    [11, -18], [11, 0], [11, 18]
  ];
  source.updateMatrixWorld(true);

  source.traverse((child) => {
    if (!child.isMesh) return;
    const instances = new THREE.InstancedMesh(child.geometry, child.material, slots.length);
    const slotMatrix = new THREE.Matrix4();
    const instanceMatrix = new THREE.Matrix4();
    for (let index = 0; index < slots.length; index += 1) {
      const [x, z] = slots[index];
      slotMatrix.makeTranslation(x, 0, z);
      instanceMatrix.multiplyMatrices(slotMatrix, child.matrixWorld);
      instances.setMatrixAt(index, instanceMatrix);
    }
    instances.instanceMatrix.needsUpdate = true;
    instances.castShadow = true;
    instances.receiveShadow = true;
    instances.userData.soldierCount = slots.length;
    squad.add(instances);
  });

  squad.name = `encounter-${side}-${unitGroup.unitType}-squad`;
  squad.userData.soldierCount = slots.length;
  squad.userData.unitType = unitGroup.unitType;
  squad.userData.side = side;
  return squad;
}

function encounterFacingYaw(encounter, side) {
  const bearing = Number(encounter.bearing ?? 0);
  return side === "attacker" ? -bearing : -(bearing + Math.PI);
}

function createEncounterLayer() {
  const group = new THREE.Group();
  group.name = "encounter-layer";
  group.visible = false;
  group.userData.lastEncounterKey = "";
  return group;
}

function encounterPlacement(encounter, side, index, total) {
  const bearing = Number(encounter.bearing ?? 0);
  const forward = new THREE.Vector3(Math.cos(bearing), 0, Math.sin(bearing)).normalize();
  const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
  const forwardDistance = side === "attacker"
    ? -((encounter.hex?.cellSize ?? 72) * 2.65)
    : ((encounter.hex?.cellSize ?? 72) * 2.65);
  const lateral = (index - (Math.max(1, total) - 1) / 2) * (encounter.hex?.cellSize ?? 72) * 0.9;
  const x = encounter.center.x + forward.x * forwardDistance + right.x * lateral;
  const z = encounter.center.z + forward.z * forwardDistance + right.z * lateral;
  return terrainPoint(x, z, 8);
}

function clearEncounterLayer(layer) {
  for (const child of layer.children) disposeObject(child);
  layer.clear();
  layer.userData.tacticalSummary = null;
}

function rebuildEncounterLayer(layer, encounter) {
  if (!encounter) {
    clearEncounterLayer(layer);
    layer.visible = false;
    layer.userData.lastEncounterKey = "";
    return;
  }

  const key = JSON.stringify({
    kind: encounter.kind,
    center: encounter.center,
    bearing: encounter.bearing,
    participants: encounter.participants?.map((participant) => ({
      id: participant.id,
      side: participant.side,
      owner: participant.owner,
      unitCount: participant.unitCount,
      unitTypes: participant.unitGroups?.map((unit) => unit.unitType)
    })),
    engagement: encounter.engagement,
    centerLine: encounter.board?.centerLine,
    board: encounter.board?.cells?.map((cell) => [cell.unitId, cell.side, cell.unitType, cell.q, cell.r])
  });

  if (key === layer.userData.lastEncounterKey) {
    layer.visible = true;
    return;
  }

  clearEncounterLayer(layer);
  const hexGrid = createEncounterHexGrid(encounter);
  hexGrid.name = "encounter-hex-grid";
  layer.add(hexGrid);
  layer.add(createEncounterCenterLine(encounter));

  const featureGroup = new THREE.Group();
  featureGroup.name = "encounter-feature-cells";
  for (const featureCell of hexGrid.userData.featureCells ?? []) {
    const marker = createFeatureMarker(encounter, featureCell.q, featureCell.r, encounter.hex?.cellSize ?? 72, featureCell);
    if (marker) featureGroup.add(marker);
  }
  layer.add(featureGroup);

  const cellGroup = new THREE.Group();
  cellGroup.name = "encounter-hex-occupants";
  const cellsBySide = { attacker: [], defender: [] };
  for (const cell of encounter.board?.cells ?? []) {
    cellsBySide[cell.side]?.push(cell);
    const world = hexAxialToWorld(encounter, cell.q, cell.r, encounter.board?.cellSize ?? encounter.hex?.cellSize ?? 72);
    const plate = createOccupiedHexPlate(encounter, cell);
    cellGroup.add(plate);

    const troop = new THREE.Group();
    const facing = encounterFacingYaw(encounter, cell.side);
    placeUprightOnTerrain(troop, world.x, world.z, facing, cell.unitType === "heavy" ? 12 : 8);
    const squad = createEncounterSquadModel(cell, cell.side);
    squad.traverse((child) => {
      child.userData.unitId = cell.unitId;
      child.userData.owner = cell.owner;
      child.userData.side = cell.side;
      child.userData.unitType = cell.unitType ?? "medium";
      child.userData.hexQ = cell.q;
      child.userData.hexR = cell.r;
    });
    troop.add(squad);
    cellGroup.add(troop);
  }

  for (const side of ["attacker", "defender"]) {
    const sideCells = cellsBySide[side];
    if (sideCells.length === 0) continue;
    const standardCell = [...sideCells].sort((a, b) => Math.abs(a.q) - Math.abs(b.q) || Math.abs(a.r) - Math.abs(b.r))[0];
    const standardWorld = hexAxialToWorld(encounter, standardCell.q, standardCell.r, encounter.board?.cellSize ?? encounter.hex?.cellSize ?? 72);
    const standardOffset = (encounter.board?.cellSize ?? encounter.hex?.cellSize ?? 72) * 0.48 * (side === "attacker" ? -1 : 1);
    const { right } = encounterAxes(encounter);
    const standard = createArmyStandard(side);
    placeUprightOnTerrain(
      standard,
      standardWorld.x + right.x * standardOffset,
      standardWorld.z + right.z * standardOffset,
      encounterFacingYaw(encounter, side),
      10
    );
    cellGroup.add(standard);
  }
  layer.add(cellGroup);

  const centerMarker = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 9, 18, 6),
    new THREE.MeshStandardMaterial({
      color: encounter.kind === "arrival" ? "#d6b95f" : "#8cb7cf",
      roughness: 0.72,
      metalness: 0.05,
      transparent: true,
      opacity: 0.82
    })
  );
  centerMarker.position.copy(terrainPoint(encounter.center.x, encounter.center.z, 14));
  centerMarker.renderOrder = 60;
  centerMarker.castShadow = true;
  layer.add(centerMarker);

  layer.visible = true;
  layer.userData.lastEncounterKey = key;
  layer.userData.tacticalSummary = {
    squadCount: encounter.board?.cells?.length ?? 0,
    soldiersPerSquad: 6,
    renderedSoldierCount: (encounter.board?.cells?.length ?? 0) * 6,
    standardCount: ["attacker", "defender"].filter((side) => cellsBySide[side].length > 0).length,
    featureCounts: (hexGrid.userData.featureCells ?? []).reduce((counts, cell) => {
      counts[cell.type] = (counts[cell.type] ?? 0) + 1;
      return counts;
    }, {}),
    grassFillOpacity: 0,
    worldSceneryHidden: true,
    uprightSquads: true
  };
}

function createBattleMarkers() {
  const group = new THREE.Group();
  const romanMaterial = new THREE.MeshStandardMaterial({ color: "#b93125", roughness: 0.58 });
  const romanShield = new THREE.MeshStandardMaterial({ color: "#d3a64e", metalness: 0.1, roughness: 0.42 });
  const enemyMaterial = new THREE.MeshStandardMaterial({ color: "#273331", roughness: 0.76 });
  const goldMaterial = new THREE.MeshStandardMaterial({ color: "#d0a34c", metalness: 0.1, roughness: 0.42 });
  const skinMaterial = new THREE.MeshStandardMaterial({ color: "#a47556", roughness: 0.72 });
  const leatherMaterial = new THREE.MeshStandardMaterial({ color: "#31291f", roughness: 0.86 });

  for (const [id, position] of Object.entries(LANE_POSITIONS)) {
    const enemy = new THREE.Group();
    enemy.name = `lane-${id}`;
    enemy.userData.laneId = id;

    for (let i = 0; i < 18; i += 1) {
      const soldier = createSoldier({
        armorMaterial: enemyMaterial,
        accentMaterial: leatherMaterial,
        skinMaterial,
        darkMaterial: leatherMaterial
      });
      const x = position.x + (i % 6) * 10 - 25;
      const z = position.z + Math.floor(i / 6) * 11 - 12;
      soldier.scale.setScalar(REGIONAL_OBJECT_SCALE);
      placeOnTerrain(soldier, x, z, Math.PI + (i % 2) * 0.05, 0.3);
      enemy.add(soldier);
    }

    const banner = new THREE.Mesh(new THREE.BoxGeometry(3, 42, 3), goldMaterial);
    placeOnTerrain(banner, position.x - 38, position.z - 9, 0.1, 21);
    banner.castShadow = true;
    enemy.add(banner);

    group.add(enemy);
  }

  const romans = new THREE.Group();
  romans.name = "roman-wing";

  for (let i = 0; i < 26; i += 1) {
    const rider = createRider(romanMaterial, romanShield);
    const x = 40 + (i % 9) * 10 - 44;
    const z = 420 + Math.floor(i / 9) * 12 - 18;
    rider.scale.setScalar(REGIONAL_OBJECT_SCALE);
    placeOnTerrain(rider, x, z, -Math.PI / 2 + (i % 2) * 0.08, 2.4);
    romans.add(rider);
  }

  group.add(romans);
  return group;
}

function createSkyDome() {
  const geometry = new THREE.SphereGeometry(14000, 48, 24);
  const texture = createSkyTexture();
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false
  });
  const sky = new THREE.Mesh(geometry, material);
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  return sky;
}

function createSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#31435f");
  gradient.addColorStop(0.32, "#6f8f96");
  gradient.addColorStop(0.68, "#d7c097");
  gradient.addColorStop(1, "#82654f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createSunDisc() {
  const material = new THREE.MeshBasicMaterial({
    color: "#ffd18a",
    transparent: true,
    opacity: 0.58,
    blending: THREE.AdditiveBlending
  });
  const sun = new THREE.Mesh(new THREE.CircleGeometry(56, 48), material);
  sun.position.set(-1040, 760, -1550);
  sun.rotation.set(0, 0.58, 0);
  return sun;
}

function createHud() {
  const hud = document.createElement("div");
  hud.className = "hud";
  hud.innerHTML = `
    <div class="hud__left">
      <div class="hud__title">Cavalry of Rome</div>
      <div class="hud__line" data-mode></div>
      <div class="hud__meters">
        <span data-morale></span>
        <span data-cohesion></span>
        <span data-renderer></span>
      </div>
      <div class="hud__region" data-region></div>
    </div>
    <div class="hud__right" data-lane></div>
  `;
  document.body.append(hud);
  return {
    root: hud,
    mode: hud.querySelector("[data-mode]"),
    morale: hud.querySelector("[data-morale]"),
    cohesion: hud.querySelector("[data-cohesion]"),
    lane: hud.querySelector("[data-lane]"),
    renderer: hud.querySelector("[data-renderer]"),
    region: hud.querySelector("[data-region]")
  };
}

function updateHud(hud, state, rendererLabel, selectedRegion, encounter = null) {
  const selected = state.lanes[state.selectedLane];
  if (encounter?.active) {
    hud.mode.textContent = `${encounter.kind.toUpperCase()} / ${encounter.title.toUpperCase()}`;
    hud.morale.textContent = encounter.engagement
      ? `Opening ${encounter.engagement.openingStrength}`
      : `Groups ${encounter.participantCount ?? 0}`;
    hud.cohesion.textContent = encounter.engagement
      ? `Defenders ${encounter.engagement.defenderTroopsCommitted}`
      : `Hex ${encounter.hex?.radius ?? 0}`;
    hud.renderer.textContent = `Fixed battle view`;
    hud.lane.textContent = `Battlefield anchored at ${Math.round(encounter.center.x)}, ${Math.round(encounter.center.z)}`;
    hud.region.textContent = `Hex troops ${encounter.board?.cells?.length ?? 0}`;
    return;
  }

  hud.mode.textContent = `${state.mode.toUpperCase()} / ${state.formation.toUpperCase()}`;
  hud.morale.textContent = `Morale ${Math.round(state.player.morale)}`;
  hud.cohesion.textContent = `Cohesion ${Math.round(state.player.cohesion)}`;
  hud.renderer.textContent = rendererLabel;
  hud.lane.textContent = selected ? `${selected.label} / ${selected.enemyLabel}` : "";
  hud.region.textContent = selectedRegion
    ? `Selected Region: ${selectedRegion.label} / ${OWNER_LABELS[selectedRegion.owner] ?? selectedRegion.owner}`
    : "Select a region";
}

function createCameraControls(camera, canvas) {
  const state = {
    rightMouse: false,
    yaw: -0.08,
    pitch: -0.72,
    velocity: new THREE.Vector3(),
    keys: new Set()
  };

  camera.position.set(620, 2100, 4700);
  canvas.tabIndex = 0;

  function isLooking() {
    return state.rightMouse || document.pointerLockElement === canvas;
  }

  function normalizeKey(key) {
    return key.toLowerCase();
  }

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 2) return;
    event.preventDefault();
    state.rightMouse = true;
    canvas.focus();
    canvas.requestPointerLock?.().catch?.(() => {});
  });

  globalThis.addEventListener("pointerup", (event) => {
    if (event.button === 2) {
      state.rightMouse = false;
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock?.();
      }
    }
  });

  globalThis.addEventListener("mousemove", (event) => {
    if (!isLooking()) return;
    state.yaw += event.movementX * 0.0022;
    state.pitch += event.movementY * 0.0018;
    state.pitch = clamp(state.pitch, -1.18, 0.42);
  });

  globalThis.addEventListener("keydown", (event) => {
    const key = normalizeKey(event.key);
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "pageup", "pagedown"].includes(key) || (isLooking() && ["w", "a", "s", "d", "q", "e"].includes(key))) {
      event.preventDefault();
    }
    state.keys.add(key);
  });
  globalThis.addEventListener("keyup", (event) => state.keys.delete(normalizeKey(event.key)));
  globalThis.addEventListener("blur", () => state.keys.clear());

  function update(delta) {
    const direction = new THREE.Vector3(
      Math.sin(state.yaw) * Math.cos(state.pitch),
      Math.sin(state.pitch),
      -Math.cos(state.yaw) * Math.cos(state.pitch)
    ).normalize();
    const flatForward = new THREE.Vector3(direction.x, 0, direction.z).normalize();
    const right = new THREE.Vector3().crossVectors(flatForward, camera.up).normalize();
    const movement = new THREE.Vector3();
    const flightKeysActive = isLooking();

    if (state.keys.has("arrowup") || (flightKeysActive && state.keys.has("w"))) movement.add(flatForward);
    if (state.keys.has("arrowdown") || (flightKeysActive && state.keys.has("s"))) movement.sub(flatForward);
    if (state.keys.has("arrowright") || (flightKeysActive && state.keys.has("d"))) movement.add(right);
    if (state.keys.has("arrowleft") || (flightKeysActive && state.keys.has("a"))) movement.sub(right);
    if (flightKeysActive && (state.keys.has("e") || state.keys.has("pageup"))) movement.y += 1;
    if (flightKeysActive && (state.keys.has("q") || state.keys.has("pagedown"))) movement.y -= 1;

    if (movement.lengthSq() > 0) movement.normalize();

    const speed = state.keys.has("shift") ? 1850 : 840;
    state.velocity.lerp(movement.multiplyScalar(speed), clamp(delta * 7, 0, 1));
    camera.position.addScaledVector(state.velocity, delta);
    camera.position.x = clamp(camera.position.x, -7600, 7600);
    camera.position.z = clamp(camera.position.z, -7800, 7800);
    camera.position.y = clamp(camera.position.y, terrainHeight(camera.position.x, camera.position.z) + 150, 3400);
    camera.lookAt(camera.position.clone().add(direction));
  }

  return { update, isLooking };
}

function updateWater(riverSystem, elapsed) {
  for (const material of riverSystem.userData.waterMaterials ?? []) {
    if (material.uniforms?.iTime) {
      material.uniforms.iTime.value = elapsed;
    }
  }

  for (const river of riverSystem.userData.rivers ?? []) {
    const positions = river.geometry.attributes.position;
    const baseY = river.userData.baseY;

    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const wave = Math.sin(z * 0.038 + elapsed * 2.6) * 0.72 + Math.cos(x * 0.047 + elapsed * 3.1) * 0.46;
      positions.setY(i, baseY[i] + wave);
    }

    positions.needsUpdate = true;
    river.geometry.computeVertexNormals();
  }

  for (const lake of riverSystem.userData.lakes ?? []) {
    const positions = lake.geometry.attributes.position;
    const baseY = lake.userData.baseY;

    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const wave = Math.sin(x * 0.019 + elapsed * 1.6) * 0.28 + Math.cos(z * 0.023 + elapsed * 1.2) * 0.24;
      positions.setY(i, baseY[i] + wave);
    }

    positions.needsUpdate = true;
    lake.geometry.computeVertexNormals();
  }

  for (const ribbon of riverSystem.userData.flowRibbons ?? []) {
    const positions = ribbon.geometry.attributes.position;
    const baseY = ribbon.userData.baseY;
    const phase = ribbon.userData.phase ?? 0;

    for (let i = 0; i < positions.count; i += 1) {
      const z = positions.getZ(i);
      const pulse = Math.sin(z * 0.08 + elapsed * 5.5 + phase) * 0.28;
      positions.setY(i, baseY[i] + 0.4 + pulse);
    }

    ribbon.material.opacity = 0.08 + (Math.sin(elapsed * 2.2 + phase) + 1) * 0.035;
    positions.needsUpdate = true;
  }
}

function updateMist(group, camera, elapsed, delta) {
  for (const cloud of group.children) {
    cloud.position.x += cloud.userData.drift * delta;
    cloud.position.y += Math.sin(elapsed * 0.4 + cloud.userData.phase) * delta * 1.7;
    cloud.lookAt(camera.position);

    if (!cloud.userData.noWrap && cloud.position.x > 7000) {
      cloud.position.x = -7000;
    }
  }
}

function updateBattleMarkers(group, state, elapsed) {
  for (const lane of Object.values(state.lanes)) {
    const marker = group.getObjectByName(`lane-${lane.id}`);
    if (!marker) continue;

    marker.visible = lane.status !== "routed";
    marker.scale.setScalar(1);
  }

  const romanWing = group.getObjectByName("roman-wing");
  if (romanWing) {
    romanWing.position.z = -state.diagnostics.impacts * 12;
  }
}

function updateEncounterCamera(camera, encounter, delta, zoom = 1) {
  if (!encounter?.active) return;

  const bearing = Number(encounter.bearing ?? 0);
  const forward = new THREE.Vector3(Math.cos(bearing), 0, Math.sin(bearing)).normalize();
  const baseDistance = encounter.camera?.distance ?? 420;
  const baseHeight = encounter.camera?.height ?? 230;
  const baseFov = encounter.camera?.fov ?? 40;
  const zoomedDistance = baseDistance * zoom;
  const zoomedHeight = baseHeight * zoom;
  const focus = terrainPoint(encounter.center.x, encounter.center.z, encounter.camera?.focusLift ?? 24);
  const targetPosition = focus.clone()
    .addScaledVector(forward, -zoomedDistance)
    .add(new THREE.Vector3(0, zoomedHeight, 0));

  camera.position.lerp(targetPosition, clamp(delta * 2.2, 0, 1));
  camera.lookAt(focus);
  camera.fov = THREE.MathUtils.lerp(camera.fov, clamp(baseFov + Math.log2(zoom) * 3.5, 30, 56), clamp(delta * 2.8, 0, 1));
  camera.updateProjectionMatrix();
}

function updateRegionSelection(regionSelection, selectedRegionId) {
  const regionObjects = [
    ...(regionSelection.userData.regionSurfaces ?? []),
    ...(regionSelection.userData.regionFog ?? []),
    ...(regionSelection.userData.regionDiscs ?? [])
  ];

  for (const regionObject of regionObjects) {
    const selected = regionObject.userData.regionId === selectedRegionId;
    regionObject.material.opacity = selected
      ? regionObject.userData.selectedOpacity ?? 0.36
      : regionObject.userData.baseOpacity;
    regionObject.scale.setScalar(selected ? regionObject.userData.selectedScale ?? 1 : 1);
    regionObject.renderOrder = selected ? 8 : regionObject.userData.baseRenderOrder ?? regionObject.renderOrder;
  }
}

function updateSkyDome(sky, camera) {
  sky.position.copy(camera.position);
}

function updateTerrain(terrain, elapsed) {
  if (terrain.material?.uniforms?.iTime) {
    terrain.material.uniforms.iTime.value = elapsed;
  }
}

async function createGpuRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance"
  });

  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.setClearColor("#6d8c93", 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.rendererLabel = "WebGL2 Terrain Shader";

  return renderer;
}

export async function createRenderer(canvas) {
  const renderer = await createGpuRenderer(canvas);
  const rendererLabel = renderer.rendererLabel ?? "WebGL2";
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 22000);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hud = createHud();
  const controls = createCameraControls(camera, canvas);
  let lastSnapshot = null;
  let selectedRegionId = null;
  let encounterZoom = 1;
  let lastEncounterZoomKey = "";

  scene.fog = new THREE.FogExp2("#9ba99d", 0.00017);
  const sky = createSkyDome();
  const terrain = createTerrain();
  scene.add(sky);
  scene.add(createSunDisc());
  scene.add(terrain);

  const water = createRiverSystem();
  const mist = createMistBand({
    count: 76,
    radius: 14200,
    y: 70,
    z: -620,
    scale: 520,
    color: "#d4ded6",
    opacity: 0.095
  });
  const highMist = createMistBand({
    count: 42,
    radius: 15000,
    y: 650,
    z: -2300,
    scale: 780,
    color: "#f4ead8",
    opacity: 0.048
  });
  const endpointFog = createEndpointFog();
  const battleMarkers = createBattleMarkers();
  const regionSelection = createRegionSelectionLayer();
  const regionalStrongholds = createRegionalStrongholds();
  const provinceForceMarkers = createProvinceForceMarkers();
  const encounterLayer = createEncounterLayer();
  const roads = createRoad();
  const travelPaths = createDenseTravelPaths();
  const villageClusters = createVillageClusters();
  const farmsteads = createOutlyingFarmsteads();
  const primeLandmarks = createPrimeLandmarks();
  const environmentDressing = createEnvironmentDressing();
  const treeLines = createTreeLines();
  const rockOutcrops = createRockOutcrops();
  const worldEncounterReplaceables = [
    water,
    roads,
    travelPaths,
    regionalStrongholds,
    villageClusters,
    farmsteads,
    primeLandmarks,
    environmentDressing,
    treeLines,
    rockOutcrops
  ];
  scene.userData.worldEncounterReplaceables = worldEncounterReplaceables;

  scene.add(water);
  scene.add(mist);
  scene.add(highMist);
  scene.add(endpointFog);
  scene.add(roads);
  scene.add(travelPaths);
  scene.add(regionSelection);
  scene.add(createRegionalBorders());
  scene.add(regionalStrongholds);
  scene.add(villageClusters);
  scene.add(farmsteads);
  scene.add(primeLandmarks);
  scene.add(provinceForceMarkers);
  scene.add(environmentDressing);
  scene.add(treeLines);
  scene.add(rockOutcrops);
  scene.add(battleMarkers);
  scene.add(encounterLayer);

  const sun = new THREE.DirectionalLight("#ffbf76", 5.6);
  sun.position.set(-2400, 3200, 1300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = 9800;
  sun.shadow.camera.left = -7600;
  sun.shadow.camera.right = 7600;
  sun.shadow.camera.top = 7600;
  sun.shadow.camera.bottom = -7600;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight("#9bb7c7", "#2f3b29", 1.65));

  function resize() {
    const width = Math.max(640, Math.floor(globalThis.innerWidth || canvas.clientWidth || 960));
    const height = Math.max(480, Math.floor(globalThis.innerHeight || canvas.clientHeight || 640));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    return { width, height };
  }

  function draw(snapshot) {
    lastSnapshot = snapshot;
    const delta = Math.min(CLOCK.getDelta(), 1 / 20);
    const elapsed = CLOCK.elapsedTime;
    const encounter = snapshot?.campaign?.encounter ?? null;
    const encounterActive = Boolean(encounter?.active);

    if (!encounterActive) {
      lastEncounterZoomKey = "";
      controls.update(delta);
    } else {
      const encounterZoomKey = `${encounter.kind ?? "encounter"}:${Math.round(encounter.center?.x ?? 0)}:${Math.round(encounter.center?.z ?? 0)}:${encounter.startedAt ?? 0}`;
      if (encounterZoomKey !== lastEncounterZoomKey) {
        encounterZoom = 1;
        lastEncounterZoomKey = encounterZoomKey;
      }
      updateEncounterCamera(camera, encounter, delta, encounterZoom);
    }
    updateSkyDome(sky, camera);
    updateTerrain(terrain, elapsed);
    updateWater(water, elapsed);
    updateMist(mist, camera, elapsed, delta);
    updateMist(highMist, camera, elapsed * 0.6, delta * 0.6);
    battleMarkers.visible = !encounterActive;
    regionSelection.visible = !encounterActive;
    regionalStrongholds.visible = !encounterActive;
    provinceForceMarkers.visible = !encounterActive;
    endpointFog.visible = !encounterActive;
    for (const object of scene.userData.worldEncounterReplaceables ?? []) object.visible = !encounterActive;
    updateBattleMarkers(battleMarkers, snapshot, elapsed);
    updateRegionSelection(regionSelection, selectedRegionId);
    rebuildEncounterLayer(encounterLayer, encounter);
    updateHud(hud, snapshot, rendererLabel, getSelectedRegion(), encounter);
    renderer.render(scene, camera);
  }

  function pick(event) {
    if (!lastSnapshot) return null;
    if (lastSnapshot?.campaign?.encounter?.active) return null;
    if (controls.isLooking()) return null;

    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const regionHits = raycaster.intersectObjects([
      ...(regionSelection.userData.regionPickSurfaces ?? []),
      ...regionalStrongholds.children,
      ...provinceForceMarkers.children
    ], true);
    for (const hit of regionHits) {
      let node = hit.object;
      while (node) {
        if (node.userData?.regionId) {
          return {
            type: "region",
            regionId: node.userData.regionId,
            regionLabel: node.userData.regionLabel,
            owner: node.userData.owner,
            ownerLabel: node.userData.ownerLabel
          };
        }
        node = node.parent;
      }
    }

    const hits = raycaster.intersectObjects(battleMarkers.children, true);
    for (const hit of hits) {
      let node = hit.object;
      while (node) {
        if (node.userData?.laneId) return { type: "lane", laneId: node.userData.laneId };
        node = node.parent;
      }
    }

    let best = null;
    let bestDistance = Infinity;
    for (const [laneId, position] of Object.entries(LANE_POSITIONS)) {
      const screen = position.clone().project(camera);
      const dx = screen.x - pointer.x;
      const dy = screen.y - pointer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < bestDistance) {
        best = laneId;
        bestDistance = distance;
      }
    }

    return bestDistance < 0.18 ? { type: "lane", laneId: best } : null;
  }

  function selectRegion(regionId) {
    if (lastSnapshot?.campaign?.encounter?.active) return null;
    if (!REGIONS.some((region) => region.id === regionId)) return null;
    selectedRegionId = regionId;
    updateRegionSelection(regionSelection, selectedRegionId);
    return getSelectedRegion();
  }

  function getSelectedRegion() {
    return REGIONS.find((region) => region.id === selectedRegionId) ?? null;
  }

  function handleEncounterWheel(event) {
    if (!lastSnapshot?.campaign?.encounter?.active) return;
    event.preventDefault();
    event.stopPropagation();
    const wheelDirection = event.deltaY > 0 ? 1 : -1;
    encounterZoom = clamp(encounterZoom * Math.exp(wheelDirection * 0.16), 0.45, 2.4);
  }

  globalThis.addEventListener?.("resize", resize);
  globalThis.addEventListener?.("wheel", handleEncounterWheel, { passive: false, capture: true });
  resize();

  return {
    draw,
    pick,
    selectRegion,
    getSelectedRegion,
    isEncounterActive: () => Boolean(lastSnapshot?.campaign?.encounter?.active),
    isFlyMode: () => controls.isLooking(),
    resize,
    getEncounterZoom: () => encounterZoom,
    getEncounterRenderSummary: () => encounterLayer.userData.tacticalSummary ?? null,
    getLastSnapshot: () => lastSnapshot,
    renderer,
    scene,
    camera
  };
}
