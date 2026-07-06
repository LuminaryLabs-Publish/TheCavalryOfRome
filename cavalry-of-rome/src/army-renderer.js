import * as THREE from "three";
import { createRenderer as createPropSafeRenderer } from "./prop-safe-renderer.js";

const THEATER_SCALE = 2.55;
const UNIT_TYPES = {
  light: { label: "Light", color: "#cfe7a4", radius: 16, maxPips: 6 },
  medium: { label: "Medium", color: "#e1c16a", radius: 19, maxPips: 7 },
  heavy: { label: "Heavy", color: "#d98a58", radius: 22, maxPips: 8 }
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
  return { x: region.center[0] * THEATER_SCALE, z: region.center[1] * THEATER_SCALE };
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
  panel.style.maxWidth = "480px";
  panel.style.padding = "10px 12px";
  panel.style.borderTop = "1px solid rgba(246,234,214,0.5)";
  panel.style.color = "rgba(246,234,214,0.84)";
  panel.style.font = "12px Trebuchet MS, Verdana, sans-serif";
  panel.style.textTransform = "uppercase";
  panel.style.letterSpacing = "0.04em";
  panel.style.textShadow = "0 2px 10px rgba(0,0,0,0.6)";
  panel.style.pointerEvents = "none";
  panel.textContent = "Unit Groups Ready";
  document.body.append(panel);
  return panel;
}

function tagUnitObject(object, info) {
  Object.assign(object.userData, info, { type: "unit" });
  object.traverse((child) => {
    Object.assign(child.userData, info, { type: "unit" });
  });
}

function createUnitRing(info, hoveredUnitId, selectedIds) {
  const type = UNIT_TYPES[info.unitType] ?? UNIT_TYPES.light;
  const group = new THREE.Group();
  const selected = selectedIds.has(info.unitId);
  const hovered = info.unitId === hoveredUnitId;
  const scale = selected ? 1.42 : hovered ? 1.22 : 1;
  const opacity = selected ? 0.98 : hovered ? 0.9 : 0.68;

  const ringGeometry = new THREE.TorusGeometry(type.radius, selected ? 3.8 : 2.5, 8, 48);
  ringGeometry.rotateX(Math.PI / 2);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: type.color, transparent: true, opacity, depthWrite: false, depthTest: false });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.renderOrder = 55;
  group.add(ring);

  const soldierPips = clamp(Math.round(info.soldiers / 10), 2, type.maxPips);
  const pipMaterial = new THREE.MeshBasicMaterial({ color: type.color, transparent: true, opacity: selected ? 0.98 : 0.72, depthWrite: false, depthTest: false });
  for (let i = 0; i < soldierPips; i += 1) {
    const angle = (i / soldierPips) * Math.PI * 2;
    const pip = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 4, 7), pipMaterial);
    pip.position.set(Math.cos(angle) * type.radius * 0.72, 3, Math.sin(angle) * type.radius * 0.72);
    pip.renderOrder = 56;
    group.add(pip);
  }

  group.scale.setScalar(scale);
  tagUnitObject(group, info);
  return group;
}

function unitOffset(index, total) {
  const ring = Math.floor(index / 8);
  const slot = index % 8;
  const angle = (slot / 8) * Math.PI * 2 + ring * 0.38;
  const radius = 52 + ring * 44 + (total > 16 ? 16 : 0);
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function garrisonUnitsByRegion(campaign) {
  const byRegion = new Map();
  for (const unit of campaign?.units ?? []) {
    if (unit.status !== "garrison" || !unit.regionId) continue;
    if (!byRegion.has(unit.regionId)) byRegion.set(unit.regionId, []);
    byRegion.get(unit.regionId).push(unit);
  }
  for (const units of byRegion.values()) {
    units.sort((a, b) => a.unitType.localeCompare(b.unitType) || a.serial - b.serial);
  }
  return byRegion;
}

function createMarchMarker(march, campaign) {
  const from = campaign.regions[march.fromRegionId];
  const to = campaign.regions[march.toRegionId];
  if (!from || !to) return null;
  const fromWorld = regionWorld(from);
  const toWorld = regionWorld(to);
  const x = fromWorld.x + (toWorld.x - fromWorld.x) * march.progress;
  const z = fromWorld.z + (toWorld.z - fromWorld.z) * march.progress;
  const primaryType = march.units?.[0]?.unitType ?? "light";
  const type = UNIT_TYPES[primaryType] ?? UNIT_TYPES.light;

  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z) + 96, z);
  const geometry = new THREE.TorusGeometry(type.radius + Math.min(24, march.count * 2), 3.8, 8, 60);
  geometry.rotateX(Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: type.color, transparent: true, opacity: 0.86, depthWrite: false, depthTest: false });
  const ring = new THREE.Mesh(geometry, material);
  ring.renderOrder = 58;
  group.add(ring);

  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(fromWorld.x, terrainHeight(fromWorld.x, fromWorld.z) + 70, fromWorld.z),
    new THREE.Vector3(toWorld.x, terrainHeight(toWorld.x, toWorld.z) + 70, toWorld.z)
  ]);
  const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: type.color, transparent: true, opacity: 0.26, depthWrite: false, depthTest: false }));
  line.renderOrder = 49;
  group.add(line);
  group.userData.marchId = march.id;
  return group;
}

function buildUnitLayer(layer, snapshot, hoveredUnitId, localSelectedIds) {
  for (const child of layer.children) disposeObject(child);
  layer.clear();
  const campaign = snapshot?.campaign;
  if (!campaign?.units) return;

  const selectedIds = new Set([...(campaign.selectedUnitIds ?? []), ...localSelectedIds]);
  const byRegion = garrisonUnitsByRegion(campaign);

  for (const region of Object.values(campaign.regions ?? {})) {
    const world = regionWorld(region);
    const units = byRegion.get(region.id) ?? [];
    for (let i = 0; i < units.length; i += 1) {
      const unit = units[i];
      const [offsetX, offsetZ] = unitOffset(i, units.length);
      const x = world.x + offsetX;
      const z = world.z + offsetZ;
      const info = {
        unitId: unit.id,
        armyId: unit.id,
        regionId: region.id,
        regionLabel: region.label,
        unitType: unit.unitType,
        unitLabel: UNIT_TYPES[unit.unitType]?.label ?? unit.unitType,
        soldiers: unit.soldiers,
        owner: unit.owner,
        label: unit.label
      };
      const ring = createUnitRing(info, hoveredUnitId, selectedIds);
      ring.position.set(x, terrainHeight(x, z) + 68, z);
      layer.add(ring);
    }
  }

  for (const march of campaign.marches ?? []) {
    const marker = createMarchMarker(march, campaign);
    if (marker) layer.add(marker);
  }
}

function summary(snapshot, localSelectedIds) {
  const campaign = snapshot?.campaign;
  if (!campaign) return "Unit groups unavailable";
  const selected = new Set([...(campaign.selectedUnitIds ?? []), ...localSelectedIds]);
  const moving = campaign.marches?.length ?? 0;
  const gold = campaign.gold ?? 0;
  if (selected.size > 0) return `Gold ${gold} / Selected ${selected.size} unit groups / Shift-click adds / click destination province`;
  return `Gold ${gold} / Unit groups: each ring contains soldiers / Shift-click multi-select / Marches ${moving}`;
}

export async function createRenderer(canvas) {
  const base = await createPropSafeRenderer(canvas);
  const unitLayer = new THREE.Group();
  unitLayer.name = "province-unit-group-ring-layer";
  base.scene.add(unitLayer);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hudPanel = createHudPanel();
  const originalDraw = base.draw;
  const originalPick = base.pick;
  const originalSelectRegion = base.selectRegion;
  let hoveredUnitId = null;
  let localSelectedIds = new Set();
  let lastSnapshot = null;
  let lastLayerKey = "";

  function pointerFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickUnit(event) {
    if (base.isFlyMode?.()) return null;
    pointerFromEvent(event);
    raycaster.setFromCamera(pointer, base.camera);
    const hits = raycaster.intersectObjects(unitLayer.children, true);
    for (const hit of hits) {
      let node = hit.object;
      while (node) {
        if (node.userData?.unitId) {
          return {
            type: "unit",
            armyId: node.userData.unitId,
            unitId: node.userData.unitId,
            regionId: node.userData.regionId,
            regionLabel: node.userData.regionLabel,
            unitType: node.userData.unitType,
            unitLabel: node.userData.unitLabel,
            soldiers: node.userData.soldiers,
            owner: node.userData.owner,
            label: node.userData.label
          };
        }
        node = node.parent;
      }
    }
    return null;
  }

  canvas.addEventListener("mousemove", (event) => {
    const hit = pickUnit(event);
    hoveredUnitId = hit?.unitId ?? null;
  });

  function layerKey(snapshot) {
    const campaign = snapshot?.campaign;
    return JSON.stringify({ units: campaign?.units, marches: campaign?.marches, selected: [...(campaign?.selectedUnitIds ?? []), ...localSelectedIds], hoveredUnitId });
  }

  function draw(snapshot) {
    lastSnapshot = snapshot;
    const key = layerKey(snapshot);
    if (key !== lastLayerKey) {
      buildUnitLayer(unitLayer, snapshot, hoveredUnitId, localSelectedIds);
      lastLayerKey = key;
    }
    hudPanel.textContent = summary(snapshot, localSelectedIds);
    originalDraw(snapshot);
  }

  function pick(event) {
    const unitHit = pickUnit(event);
    if (unitHit) return unitHit;
    return originalPick(event);
  }

  function selectUnit(unitHit, append = false) {
    if (!unitHit?.unitId) return null;
    if (!append) localSelectedIds = new Set([unitHit.unitId]);
    else if (localSelectedIds.has(unitHit.unitId)) localSelectedIds.delete(unitHit.unitId);
    else localSelectedIds.add(unitHit.unitId);
    hoveredUnitId = unitHit.unitId;
    buildUnitLayer(unitLayer, lastSnapshot, hoveredUnitId, localSelectedIds);
    hudPanel.textContent = summary(lastSnapshot, localSelectedIds);
    return { selectedUnitIds: [...localSelectedIds] };
  }

  function clearSelectedUnits() {
    localSelectedIds = new Set();
    buildUnitLayer(unitLayer, lastSnapshot, hoveredUnitId, localSelectedIds);
    hudPanel.textContent = summary(lastSnapshot, localSelectedIds);
  }

  function selectRegion(regionId) {
    return originalSelectRegion(regionId);
  }

  return {
    ...base,
    draw,
    pick,
    selectUnit,
    selectArmy: (hit, append = false) => selectUnit(hit, append),
    clearSelectedUnits,
    clearSelectedArmy: clearSelectedUnits,
    getSelectedUnitIds: () => [...localSelectedIds],
    getSelectedArmy: () => ({ selectedUnitIds: [...localSelectedIds] }),
    selectRegion
  };
}
