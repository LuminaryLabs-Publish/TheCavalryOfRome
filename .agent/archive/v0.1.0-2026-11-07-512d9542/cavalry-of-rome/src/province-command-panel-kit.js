import { createControlPanel } from "./control-panel-kit.js";

export const PROVINCE_COMMAND_PANEL_KIT_VERSION = "0.2.0";

const UNIT_ORDER = ["light", "medium", "heavy"];
const UNIT_LABELS = { light: "Light", medium: "Medium", heavy: "Heavy" };
const NUMBER_TO_UNIT = {
  "1": "light",
  "2": "medium",
  "3": "heavy",
  Digit1: "light",
  Digit2: "medium",
  Digit3: "heavy",
  Numpad1: "light",
  Numpad2: "medium",
  Numpad3: "heavy"
};

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

function isTextInputTarget(target) {
  const tagName = target?.tagName?.toLowerCase?.();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || Boolean(target?.isContentEditable);
}

export function createProvinceCommandPanelKit({ canvas, renderer, engine }) {
  let selectedRegion = null;
  let mode = "march";
  let draft = emptyDraft();
  let lastRenderKey = "";
  let statusMessage = "Select a red province, then use keyboard commands.";

  const title = el("div", "strategic-command-title", "Province Command");
  const meta = el("div", "strategic-command-meta");
  const section = el("div", "strategic-command-section");
  const note = el("div", "strategic-command-note");

  const controlPanel = createControlPanel({ onCommand: null });
  controlPanel.setChildren(title, meta, section, note);
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
  function availableFor(unitType) {
    if (mode !== "march") return 99;
    return countUnits(campaignState(), selectedRegion?.regionId)[unitType] ?? 0;
  }
  function setMode(nextMode) {
    mode = nextMode;
    clearDraft();
    statusMessage = mode === "march"
      ? "March mode. Press 1/2/3 to add groups, Enter to prepare."
      : "Craft mode. Press 1/2/3 to order groups, Enter to craft.";
    lastRenderKey = "";
    render(true);
  }
  function setCount(unitType, value) {
    const available = availableFor(unitType);
    draft = { ...draft, [unitType]: Math.max(0, Math.min(available, value)) };
    statusMessage = `${UNIT_LABELS[unitType]} ${draft[unitType]} selected.`;
    lastRenderKey = "";
    render(true);
  }
  function addCount(unitType, delta) {
    setCount(unitType, Number(draft[unitType] ?? 0) + Number(delta ?? 0));
  }
  function renderKey(state, counts) {
    return JSON.stringify({
      regionId: selectedRegion?.regionId,
      mode,
      draft,
      counts,
      statusMessage,
      turn: state?.turn,
      phase: state?.phase,
      gold: state?.gold,
      actions: state?.worldActionsRemaining,
      maxActions: state?.maxWorldActions
    });
  }

  function showForRegion(regionHit) {
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
    statusMessage = "M March · C Craft · 1/2/3 add · Shift+1/2/3 subtract.";
    controlPanel.show();
    lastRenderKey = "";
    render(true);
  }

  function renderRows(counts) {
    section.replaceChildren();
    const costs = engine.strategy?.getUnitCosts?.() ?? {};

    const modeLine = el("div", "strategic-command-meta");
    modeLine.innerHTML = `Mode: <strong>${mode.toUpperCase()}</strong> · Draft total ${selectedTotal()}`;
    section.append(modeLine);

    for (const unitType of UNIT_ORDER) {
      const row = el("div", "strategic-unit-row");
      const label = el("div", "strategic-unit-name", `${unitType === "light" ? "1" : unitType === "medium" ? "2" : "3"} ${UNIT_LABELS[unitType]}`);
      const info = mode === "march"
        ? `Available ${counts[unitType] ?? 0}`
        : `${costs[unitType]?.cost ?? 0} gold each`;
      const availableNode = el("div", "strategic-unit-count", info);
      const count = el("div", "strategic-count-box", String(draft[unitType] ?? 0));
      const hint = el("div", "strategic-unit-count", "Shift removes");
      row.append(label, availableNode, count, hint);
      section.append(row);
    }

    const controls = el("div", "strategic-command-meta");
    controls.innerHTML = [
      "<strong>Keyboard</strong>",
      "M March · C Craft",
      "1 Light · 2 Medium · 3 Heavy",
      "Shift + number subtracts",
      "Enter confirms · Esc cancels"
    ].join("<br>");
    section.append(controls);
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
    const cost = draftCost();
    title.textContent = `${region?.label ?? selectedRegion.regionLabel ?? selectedRegion.regionId} Command`;
    meta.innerHTML = [
      `Red province · Turn ${state.turn} · ${state.phase}`,
      `Gold ${state.gold} · World actions ${state.worldActionsRemaining}/${state.maxWorldActions}`,
      mode === "recruit" && cost > 0 ? `Draft cost ${cost} gold` : ""
    ].filter(Boolean).join("<br>");
    renderRows(counts);
    note.textContent = statusMessage;
  }

  function prepareMarch() {
    const state = strategyState();
    if (!selectedRegion || !state) return;
    if (state.worldActionsRemaining <= 0) {
      statusMessage = "No world actions remain this turn.";
      return render(true);
    }
    if (selectedTotal() <= 0) {
      statusMessage = "Choose at least one troop group with 1/2/3.";
      return render(true);
    }

    const campaign = campaignState();
    const units = [];
    for (const unitType of UNIT_ORDER) units.push(...unitsFor(campaign, selectedRegion.regionId, unitType, draft[unitType]));
    if (units.length <= 0) {
      statusMessage = "No matching unit groups are available in this province.";
      return render(true);
    }

    engine.strategy.spendWorldAction("march", { regionId: selectedRegion.regionId, counts: { ...draft } });
    units.forEach((unit, index) => {
      const hit = {
        unitId: unit.id,
        armyId: unit.id,
        regionId: unit.regionId,
        regionLabel: selectedRegion.label,
        unitType: unit.unitType,
        unitLabel: UNIT_LABELS[unit.unitType],
        soldiers: unit.soldiers,
        owner: unit.owner,
        label: unit.label
      };
      renderer.selectUnit?.(hit, index > 0);
      engine.cavalry.selectUnit(unit.id, index > 0);
    });
    clearDraft();
    statusMessage = "March prepared. Click a destination province.";
    lastRenderKey = "";
    render(true);
  }

  function craftTroops() {
    const state = strategyState();
    if (!selectedRegion || !state) return;
    const cost = draftCost();
    if (state.worldActionsRemaining <= 0) {
      statusMessage = "No world actions remain this turn.";
      return render(true);
    }
    if (selectedTotal() <= 0) {
      statusMessage = "Choose at least one troop group with 1/2/3.";
      return render(true);
    }
    if (cost > state.gold) {
      statusMessage = `Not enough gold. Need ${cost}, have ${state.gold}.`;
      return render(true);
    }

    if (engine.strategy.recruitUnits) engine.strategy.recruitUnits(selectedRegion.regionId, { ...draft });
    else {
      const firstType = UNIT_ORDER.find((unitType) => draft[unitType] > 0);
      if (firstType) engine.strategy.recruitUnit(selectedRegion.regionId, firstType, draft[firstType]);
    }
    clearDraft();
    statusMessage = "Craft order queued. New troops appear after the next tick.";
    lastRenderKey = "";
    render(true);
  }

  function cancelCommand() {
    clearDraft();
    statusMessage = "Command cancelled.";
    selectedRegion = null;
    controlPanel.hide();
    lastRenderKey = "";
  }

  function handleKeyDown(event) {
    if (!selectedRegion || !controlPanel.isVisible()) return;
    if (isTextInputTarget(event.target)) return;

    const lowerKey = String(event.key ?? "").toLowerCase();
    const unitType = NUMBER_TO_UNIT[event.key] ?? NUMBER_TO_UNIT[event.code];
    let handled = false;

    if (lowerKey === "m") {
      setMode("march");
      handled = true;
    } else if (lowerKey === "c") {
      setMode("recruit");
      handled = true;
    } else if (unitType) {
      addCount(unitType, event.shiftKey ? -1 : 1);
      handled = true;
    } else if (event.key === "Enter") {
      if (mode === "march") prepareMarch();
      else craftTroops();
      handled = true;
    } else if (event.key === "Escape") {
      cancelCommand();
      handled = true;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  document.addEventListener("keydown", handleKeyDown, true);

  canvas.addEventListener("click", (event) => {
    if (event.button !== 0 || renderer.isFlyMode?.()) return;
    setTimeout(() => {
      const region = renderer.getSelectedRegion?.();
      if (region) showForRegion({ regionId: region.id, regionLabel: region.label, owner: region.owner, ownerLabel: region.ownerLabel });
      else render();
    }, 0);
  });

  function update() {
    if (controlPanel.isVisible()) render(false);
  }

  return {
    showForRegion,
    update,
    hide() {
      selectedRegion = null;
      controlPanel.hide();
      lastRenderKey = "";
    }
  };
}
