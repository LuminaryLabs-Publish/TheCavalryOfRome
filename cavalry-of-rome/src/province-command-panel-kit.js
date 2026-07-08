import { createControlButton } from "./control-button-kit.js";
import { createControlPanel } from "./control-panel-kit.js";

export const PROVINCE_COMMAND_PANEL_KIT_VERSION = "0.1.0";

const UNIT_ORDER = ["light", "medium", "heavy"];
const UNIT_LABELS = { light: "Light", medium: "Medium", heavy: "Heavy" };

function el(tag, className, text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function countUnits(campaign, regionId) {
  const counts = { light: 0, medium: 0, heavy: 0 };
  for (const unit of campaign?.units ?? []) {
    if (unit.status !== "garrison" || unit.regionId !== regionId) continue;
    counts[unit.unitType] = (counts[unit.unitType] ?? 0) + 1;
  }
  return counts;
}

function unitsFor(campaign, regionId, unitType, count) {
  return (campaign?.units ?? [])
    .filter((unit) => unit.status === "garrison" && unit.regionId === regionId && unit.unitType === unitType)
    .slice(0, Math.max(0, count));
}

function emptyDraft() {
  return { light: 0, medium: 0, heavy: 0 };
}

export function createProvinceCommandPanelKit({ canvas, renderer, engine }) {
  let selectedRegion = null;
  let mode = "march";
  let draft = emptyDraft();
  let lastRenderKey = "";

  const title = el("div", "strategic-command-title", "Province Command");
  const meta = el("div", "strategic-command-meta");
  const tabs = el("div", "strategic-command-tabs");
  const section = el("div", "strategic-command-section");
  const note = el("div", "strategic-command-note");
  const footer = el("div", "strategic-command-footer");

  const close = createControlButton({ label: "×", action: "close", className: "strategic-command-button strategic-command-close" });
  const marchTab = createControlButton({ label: "March", action: "mode", mode: "march" });
  const recruitTab = createControlButton({ label: "Craft Troops", action: "mode", mode: "recruit" });
  const actionButton = createControlButton({ label: "Prepare March", action: "commit" });

  const controlPanel = createControlPanel({ onCommand: handleCommand });
  tabs.append(marchTab, recruitTab);
  footer.append(actionButton, note);
  controlPanel.setChildren(close, title, meta, tabs, section, footer);
  document.body.append(controlPanel.element);

  function strategyState() { return engine.strategy?.getState?.(); }
  function campaignState() { return engine.cavalry?.getState?.()?.campaign; }
  function currentRegionState() {
    const state = strategyState();
    return selectedRegion ? state?.regions?.[selectedRegion.regionId] : null;
  }
  function clearDraft() { draft = emptyDraft(); }
  function selectedTotal() { return UNIT_ORDER.reduce((sum, unitType) => sum + Number(draft[unitType] ?? 0), 0); }
  function draftCost() {
    const costs = engine.strategy?.getUnitCosts?.() ?? {};
    return UNIT_ORDER.reduce((sum, unitType) => sum + Number(draft[unitType] ?? 0) * Number(costs[unitType]?.cost ?? 0), 0);
  }
  function setMode(nextMode) {
    mode = nextMode;
    clearDraft();
    lastRenderKey = "";
    render(true);
  }
  function setCount(unitType, value, available) {
    draft = { ...draft, [unitType]: Math.max(0, Math.min(available, value)) };
    lastRenderKey = "";
    render(true);
  }
  function addCount(unitType, delta, available) {
    setCount(unitType, Number(draft[unitType] ?? 0) + Number(delta ?? 0), available);
  }
  function renderKey(state, counts) {
    return JSON.stringify({ regionId: selectedRegion?.regionId, mode, draft, counts, turn: state?.turn, phase: state?.phase, gold: state?.gold, actions: state?.worldActionsRemaining, maxActions: state?.maxWorldActions });
  }

  function showForRegion(regionHit) {
    if (renderer.isEncounterActive?.()) return;
    const state = strategyState();
    const region = state?.regions?.[regionHit.regionId];
    if (!region || region.owner !== state.activeFaction) {
      selectedRegion = null;
      controlPanel.hide();
      lastRenderKey = "";
      return;
    }
    selectedRegion = { ...regionHit, ...region, regionId: regionHit.regionId ?? region.id };
    clearDraft();
    controlPanel.show();
    lastRenderKey = "";
    render(true);
  }

  function renderRows(counts) {
    section.replaceChildren();
    const costs = engine.strategy?.getUnitCosts?.() ?? {};
    for (const unitType of UNIT_ORDER) {
      const row = el("div", "strategic-unit-row");
      const label = el("div", "strategic-unit-name", UNIT_LABELS[unitType]);
      const available = mode === "march" ? counts[unitType] ?? 0 : 99;
      const availableText = mode === "march" ? `Available ${available}` : `${costs[unitType]?.cost ?? 0} gold each`;
      const availableNode = el("div", "strategic-unit-count", availableText);
      const count = el("div", "strategic-count-box", String(draft[unitType] ?? 0));
      const minus = createControlButton({ label: "−", action: "count", unitType, delta: -1, disabled: Number(draft[unitType] ?? 0) <= 0 });
      const plus = createControlButton({ label: "+", action: "count", unitType, delta: 1, disabled: mode === "march" && Number(draft[unitType] ?? 0) >= available });
      minus.dataset.available = String(available);
      plus.dataset.available = String(available);
      row.append(label, availableNode, count, minus, plus);
      section.append(row);
    }
  }

  function render(force = false) {
    const state = strategyState();
    if (!selectedRegion || !state) return;
    const campaign = campaignState();
    const counts = countUnits(campaign, selectedRegion?.regionId);
    const key = renderKey(state, counts);
    if (!force && key === lastRenderKey) return;
    lastRenderKey = key;

    const region = currentRegionState();
    const total = selectedTotal();
    const cost = draftCost();
    title.textContent = `${region?.label ?? selectedRegion.regionLabel ?? selectedRegion.regionId} Command`;
    meta.innerHTML = [`Red province · Turn ${state.turn} · ${state.phase}`, `Gold ${state.gold} · World actions ${state.worldActionsRemaining}/${state.maxWorldActions}`].join("<br>");
    marchTab.classList.toggle("active", mode === "march");
    recruitTab.classList.toggle("active", mode === "recruit");
    renderRows(counts);
    actionButton.textContent = mode === "march" ? "Prepare March" : `Craft Troops${cost > 0 ? ` · ${cost} Gold` : ""}`;
    actionButton.disabled = total <= 0 || state.worldActionsRemaining <= 0 || (mode === "recruit" && cost > state.gold);
    note.textContent = mode === "march" ? "Use + / − to choose groups, then prepare the march and click a destination province." : "Use + / − to craft unit groups. Crafting spends gold and one world action.";
  }

  function prepareMarch() {
    const state = strategyState();
    if (renderer.isEncounterActive?.() || !selectedRegion || !state || state.worldActionsRemaining <= 0 || selectedTotal() <= 0) return;
    const campaign = campaignState();
    const units = [];
    for (const unitType of UNIT_ORDER) units.push(...unitsFor(campaign, selectedRegion.regionId, unitType, draft[unitType]));
    if (units.length <= 0) return;
    engine.strategy.spendWorldAction("march", { regionId: selectedRegion.regionId, counts: { ...draft } });
    units.forEach((unit, index) => {
      const hit = { unitId: unit.id, armyId: unit.id, regionId: unit.regionId, regionLabel: selectedRegion.label, unitType: unit.unitType, unitLabel: UNIT_LABELS[unit.unitType], soldiers: unit.soldiers, owner: unit.owner, label: unit.label };
      renderer.selectUnit?.(hit, index > 0);
      engine.cavalry.selectUnit(unit.id, index > 0);
    });
    clearDraft();
    lastRenderKey = "";
    note.textContent = "March prepared. Click a destination province to send the selected groups.";
    render(true);
  }

  function craftTroops() {
    const state = strategyState();
    if (renderer.isEncounterActive?.() || !selectedRegion || !state || state.worldActionsRemaining <= 0 || selectedTotal() <= 0) return;
    if (engine.strategy.recruitUnits) engine.strategy.recruitUnits(selectedRegion.regionId, { ...draft });
    else {
      const firstType = UNIT_ORDER.find((unitType) => draft[unitType] > 0);
      if (firstType) engine.strategy.recruitUnit(selectedRegion.regionId, firstType, draft[firstType]);
    }
    clearDraft();
    lastRenderKey = "";
    note.textContent = "Recruitment ordered. The new unit groups will appear after the next tick.";
    render(true);
  }

  function handleCommand(command) {
    if (command.action === "count") {
      addCount(command.unitType, command.delta, Number(command.button.dataset.available ?? 0));
    } else if (command.action === "mode") {
      setMode(command.mode);
    } else if (command.action === "commit") {
      if (mode === "march") prepareMarch();
      else craftTroops();
    } else if (command.action === "close") {
      selectedRegion = null;
      controlPanel.hide();
      lastRenderKey = "";
    }
  }

  canvas.addEventListener("click", (event) => {
    if (event.button !== 0 || renderer.isFlyMode?.()) return;
    if (renderer.isEncounterActive?.()) return;
    setTimeout(() => {
      if (renderer.isEncounterActive?.()) return;
      const region = renderer.getSelectedRegion?.();
      if (region) showForRegion({ regionId: region.id, regionLabel: region.label, owner: region.owner, ownerLabel: region.ownerLabel });
      else render();
    }, 0);
  });

  function hide() {
    selectedRegion = null;
    controlPanel.hide();
    lastRenderKey = "";
  }

  function update() {
    if (renderer.isEncounterActive?.()) {
      hide();
      return;
    }
    if (controlPanel.isVisible()) render(false);
  }

  return {
    showForRegion,
    update,
    hide
  };
}
