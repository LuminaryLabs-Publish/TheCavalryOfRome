import * as THREE from "three";
import { createRenderer as createPropSafeRenderer } from "./prop-safe-renderer.js";

const THEATER_SCALE = 2.55;
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

const UNIT_TYPES = {
  light: { label: "Light", color: "#cfe7a4", radius: 28, offset: [-78, 0], maxPips: 10 },
  medium: { label: "Medium", color: "#e1c16a", radius: 35, offset: [0, 0], maxPips: 8 },
  heavy: { label: "Heavy", color: "#d98a58", radius: 43, offset: [84, 0], maxPips: 8 }
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

function regionWorld(region) {
  return {
    x: region.center[0] * THEATER_SCALE,
    z: region.center[1] * THEATER_SCALE
  };
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    for (const material of materials) material.dispose?.();
  });
}

function createHudPanel() {
  const panel = document.createElement("div");
  panel.style.position = "fixed";
  panel.style.left = "18px";
  panel.style.bottom = "18px";
  panel.style.zIndex = "6";
  panel.style.maxWidth = "390px";
  panel.style.padding = "10px 12px";
  panel.style.borderTop = "1px solid rgba(246,234,214,0.5)";
  panel.style.color = "rgba(246,234,214,0.84)";
  panel.style.font = "12px Trebuchet MS, Verdana, sans-serif";
  panel.style.textTransform = "uppercase";
  panel.style.letterSpacing = "0.04em";
  panel.style.textShadow = "0 2px 10px rgba(0,0,0,0.6)";
  panel.style.pointerEvents = "none";
  panel.textContent = "Army Groups Ready";
  document.body.append(panel);
  return panel;
}

function tagArmyObject(object, info) {
  object.userData.armyId = info.armyId;
  object.userData.regionId = info.regionId;
  object.userData.regionLabel = info.regionLabel;
  object.userData.unitType = info.unitType;
  object.userData.unitLabel = info.unitLabel;
  object.userData.count = info.count;
  object.userData.owner = info.owner;
  object.traverse((child) => {
    child.userData.armyId = info.armyId;
    child.userData.regionId = info.regionId;
    child.userData.regionLabel = info.regionLabel;
    child.userData.unitType = info.unitType;
    child.userData.unitLabel = info.unitLabel;
    child.userData.count = info.count;
    child.userData.owner = info.owner;
  });
}

function createArmyRing(info, hoveredArmyId, selectedArmyId) {
  const type = UNIT_TYPES[info.unitType];
  const group = new THREE.Group();
  const selected = info.armyId === selectedArmyId;
  const hovered = info.armyId === hoveredArmyId;
  const scale = selected ? 1.35 : hovered ? 1.18 : 1;
  const opacity = selected ? 0.98 : hovered ? 0.9 : 0.7;

  const ringGeometry = new THREE.TorusGeometry(type.radius, selected ? 4.4 : 3.1, 8, 72);
  ringGeometry.rotateX(Math.PI / 2);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: type.color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: false
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.renderOrder = 50;
  group.add(ring);

  const pipCount = Math.max(1, Math.min(type.maxPips, info.count));
  const pipMaterial = new THREE.MeshBasicMaterial({
    color: type.color,
    transparent: true,
    opacity: selected ? 0.95 : 0.74,
    depthWrite: false,
    depthTest: false
  });
  for (let i = 0; i < pipCount; i += 1) {
    const angle = (i / pipCount) * Math.PI * 2;
    const pip = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 5, 8), pipMaterial);
    pip.position.set(Math.cos(angle) * type.radius, 3, Math.sin(angle) * type.radius);
    pip.renderOrder = 51;
    group.add(pip);
  }

  group.scale.setScalar(scale);
  tagArmyObject(group, info);
  return group;
}

function createMarchMarker(march, campaign) {
  const from = campaign.regions[march.fromRegionId];
  const to = campaign.regions[march.toRegionId];
  if (!from || !to) return null;
  const fromWorld = regionWorld(from);
  const toWorld = regionWorld(to);
  const x = fromWorld.x + (toWorld.x - fromWorld.x) * march.progress;
  const z = fromWorld.z + (toWorld.z - fromWorld.z) * march.progress;
  const type = UNIT_TYPES[march.unitType];

  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z) + 92, z);
  const geometry = new THREE.TorusGeometry(type.radius * 0.72, 3.4, 8, 60);
  geometry.rotateX(Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: type.color,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    depthTest: false
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.renderOrder = 52;
  group.add(ring);

  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(fromWorld.x, terrainHeight(fromWorld.x, fromWorld.z) + 70, fromWorld.z),
    new THREE.Vector3(toWorld.x, terrainHeight(toWorld.x, toWorld.z) + 70, toWorld.z)
  ]);
  const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({
    color: type.color,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    depthTest: false
  }));
  line.renderOrder = 49;
  group.add(line);
  group.userData.marchId = march.id;
  return group;
}

function buildArmyLayer(layer, snapshot, hoveredArmyId) {
  for (const child of layer.children) disposeObject(child);
  layer.clear();

  const campaign = snapshot?.campaign;
  if (!campaign?.armies) return;
  const selectedArmyId = campaign.selectedArmy?.armyId ?? null;

  for (const region of Object.values(campaign.regions ?? {})) {
    const world = regionWorld(region);
    const stack = campaign.armies[region.id];
    if (!stack) continue;

    for (const [unitType, type] of Object.entries(UNIT_TYPES)) {
      const count = Number(stack.units?.[unitType] ?? 0);
      if (count <= 0) continue;
      const [offsetX, offsetZ] = type.offset;
      const x = world.x + offsetX;
      const z = world.z + offsetZ;
      const info = {
        armyId: `${region.id}:${unitType}`,
        regionId: region.id,
        regionLabel: region.label,
        unitType,
        unitLabel: type.label,
        count,
        owner: stack.owner
      };
      const ring = createArmyRing(info, hoveredArmyId, selectedArmyId);
      ring.position.set(x, terrainHeight(x, z) + 64, z);
      layer.add(ring);
    }
  }

  for (const march of campaign.marches ?? []) {
    const marker = createMarchMarker(march, campaign);
    if (marker) layer.add(marker);
  }
}

function armySummary(snapshot, localSelectedArmy) {
  const campaign = snapshot?.campaign;
  if (!campaign) return "Army groups unavailable";
  const selected = campaign.selectedArmy ?? localSelectedArmy;
  const moving = campaign.marches?.length ?? 0;
  const gold = campaign.gold ?? 0;
  if (selected) {
    const region = campaign.regions?.[selected.regionId];
    const type = UNIT_TYPES[selected.unitType];
    return `Gold ${gold} / Selected ${selected.count ?? ""} ${type?.label ?? selected.unitType} / ${region?.label ?? selected.regionId} / click destination province`;
  }
  return `Gold ${gold} / Army rings: Light 10, Medium 5, Heavy 5 / Marches ${moving}`;
}

export async function createRenderer(canvas) {
  const base = await createPropSafeRenderer(canvas);
  const armyLayer = new THREE.Group();
  armyLayer.name = "province-army-ring-layer";
  base.scene.add(armyLayer);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hudPanel = createHudPanel();
  const originalDraw = base.draw;
  const originalPick = base.pick;
  const originalSelectRegion = base.selectRegion;
  let hoveredArmyId = null;
  let localSelectedArmy = null;
  let lastSnapshot = null;
  let lastLayerKey = "";

  function pointerFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickArmy(event) {
    if (base.isFlyMode?.()) return null;
    pointerFromEvent(event);
    raycaster.setFromCamera(pointer, base.camera);
    const hits = raycaster.intersectObjects(armyLayer.children, true);
    for (const hit of hits) {
      let node = hit.object;
      while (node) {
        if (node.userData?.armyId) {
          return {
            type: "army",
            armyId: node.userData.armyId,
            regionId: node.userData.regionId,
            regionLabel: node.userData.regionLabel,
            unitType: node.userData.unitType,
            unitLabel: node.userData.unitLabel,
            count: node.userData.count,
            owner: node.userData.owner
          };
        }
        node = node.parent;
      }
    }
    return null;
  }

  canvas.addEventListener("mousemove", (event) => {
    const hit = pickArmy(event);
    hoveredArmyId = hit?.armyId ?? null;
  });

  function layerKey(snapshot) {
    const campaign = snapshot?.campaign;
    return JSON.stringify({
      armies: campaign?.armies,
      marches: campaign?.marches,
      selected: campaign?.selectedArmy?.armyId ?? localSelectedArmy?.armyId ?? null,
      hoveredArmyId
    });
  }

  function draw(snapshot) {
    lastSnapshot = snapshot;
    const key = layerKey(snapshot);
    if (key !== lastLayerKey) {
      buildArmyLayer(armyLayer, snapshot, hoveredArmyId);
      lastLayerKey = key;
    }
    hudPanel.textContent = armySummary(snapshot, localSelectedArmy);
    originalDraw(snapshot);
  }

  function pick(event) {
    const armyHit = pickArmy(event);
    if (armyHit) return armyHit;
    return originalPick(event);
  }

  function selectArmy(armyHit) {
    localSelectedArmy = armyHit;
    hoveredArmyId = armyHit?.armyId ?? hoveredArmyId;
    buildArmyLayer(armyLayer, lastSnapshot, hoveredArmyId);
    hudPanel.textContent = armySummary(lastSnapshot, localSelectedArmy);
    return localSelectedArmy;
  }

  function clearSelectedArmy() {
    localSelectedArmy = null;
    buildArmyLayer(armyLayer, lastSnapshot, hoveredArmyId);
    hudPanel.textContent = armySummary(lastSnapshot, localSelectedArmy);
  }

  function selectRegion(regionId) {
    return originalSelectRegion(regionId);
  }

  return {
    ...base,
    draw,
    pick,
    selectArmy,
    clearSelectedArmy,
    getSelectedArmy: () => lastSnapshot?.campaign?.selectedArmy ?? localSelectedArmy,
    selectRegion
  };
}
