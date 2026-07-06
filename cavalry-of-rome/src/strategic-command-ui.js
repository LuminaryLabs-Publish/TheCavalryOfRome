const UNIT_ORDER = ["light", "medium", "heavy"];
const UNIT_LABELS = { light: "Light", medium: "Medium", heavy: "Heavy" };

function el(tag, className, text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  if (tag === "button") node.type = "button";
  return node;
}

function consumeUiEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}

function bindButton(button, handler) {
  button.addEventListener("pointerdown", consumeUiEvent);
  button.addEventListener("mousedown", consumeUiEvent);
  button.addEventListener("click", (event) => {
    consumeUiEvent(event);
    if (!button.disabled) handler(event);
  });
}

function injectStyles() {
  if (document.querySelector("#strategic-command-ui-style")) return;
  const style = document.createElement("style");
  style.id = "strategic-command-ui-style";
  style.textContent = `
    .strategic-command-panel {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 30;
      width: 360px;
      min-height: 318px;
      box-sizing: border-box;
      background: linear-gradient(180deg, rgba(34, 25, 17, 0.95), rgba(17, 14, 11, 0.97));
      border: 1px solid rgba(214, 181, 117, 0.72);
      border-radius: 0;
      box-shadow: 0 18px 42px rgba(0,0,0,0.52), inset 0 0 0 1px rgba(255,240,196,0.08);
      color: #f1dfbd;
      font-family: Trebuchet MS, Verdana, sans-serif;
      letter-spacing: 0.03em;
      padding: 13px;
      display: none;
      pointer-events: auto;
      user-select: none;
    }
    .strategic-command-panel.visible { display: block; }
    .strategic-command-title {
      font-size: 14px;
      text-transform: uppercase;
      color: #ffe3aa;
      border-bottom: 1px solid rgba(214, 181, 117, 0.35);
      padding-bottom: 7px;
      margin-bottom: 8px;
      padding-right: 30px;
    }
    .strategic-command-meta {
      font-size: 11px;
      line-height: 1.45;
      color: rgba(241,223,189,0.78);
      margin-bottom: 8px;
    }
    .strategic-command-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 9px; }
    .strategic-command-button {
      background: rgba(119, 81, 42, 0.42);
      color: #f3dfb7;
      border: 1px solid rgba(214, 181, 117, 0.42);
      border-radius: 0;
      padding: 7px 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      cursor: pointer;
    }
    .strategic-command-button:hover { background: rgba(154, 107, 54, 0.62); }
    .strategic-command-button.active { background: rgba(151, 36, 30, 0.66); border-color: rgba(255, 207, 132, 0.7); }
    .strategic-command-button:disabled { opacity: 0.43; cursor: not-allowed; }
    .strategic-command-section { border-top: 1px solid rgba(214, 181, 117, 0.22); padding-top: 8px; }
    .strategic-unit-row { display: grid; grid-template-columns: 72px 1fr 32px 34px 34px; align-items: center; gap: 6px; margin: 6px 0; font-size: 11px; }
    .strategic-unit-name { color: #ffe0a4; text-transform: uppercase; }
    .strategic-unit-count { color: rgba(241,223,189,0.72); }
    .strategic-count-box { text-align: center; color: #fff1ca; border: 1px solid rgba(214, 181, 117, 0.32); padding: 5px 0; background: rgba(0,0,0,0.22); }
    .strategic-command-footer { margin-top: 10px; display: grid; grid-template-columns: 1fr; gap: 6px; }
    .strategic-command-note { min-height: 34px; font-size: 11px; line-height: 1.35; color: rgba(241,223,189,0.72); }
    .strategic-command-close { position: absolute; right: 8px; top: 7px; width: 25px; height: 24px; padding: 0; }
  `;
  document.head.append(style);
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

export function createStrategicCommandUi({ canvas, renderer, engine }) {
  injectStyles();

  const panel = el("div", "strategic-command-panel");
  const close = el("button", "strategic-command-button strategic-command-close", "×");
  const title = el("div", "strategic-command-title", "Province Command");
  const meta = el("div", "strategic-command-meta");
  const tabs = el("div", "strategic-command-tabs");
  const marchTab = el("button", "strategic-command-button active", "March");
  const recruitTab = el("button", "strategic-command-button", "Craft Troops");
  const section = el("div", "strategic-command-section");
  const note = el("div", "strategic-command-note");
  const footer = el("div", "strategic-command-footer");
  const actionButton = el("button", "strategic-command-button", "Prepare March");

  tabs.append(marchTab, recruitTab);
  footer.append(actionButton, note);
  panel.append(close, title, meta, tabs, section, footer);
  document.body.append(panel);

  for (const eventName of ["pointerdown", "mousedown", "mouseup", "click", "dblclick", "wheel"]) {
    panel.addEventListener(eventName, (event) => event.stopPropagation());
  }

  let selectedRegion = null;
  let mode = "march";
  let draft = emptyDraft();

  function strategyState() {
    return engine.strategy?.getState?.();
  }

  function campaignState() {
    return engine.cavalry?.getState?.()?.campaign;
  }

  function currentRegionState() {
    const state = strategyState();
    return selectedRegion ? state?.regions?.[selectedRegion.regionId] : null;
  }

  function clearDraft() {
    draft = emptyDraft();
  }

  function setMode(nextMode) {
    mode = nextMode;
    clearDraft();
    marchTab.classList.toggle("active", mode === "march");
    recruitTab.classList.toggle("active", mode === "recruit");
    render();
  }

  function showForRegion(regionHit) {
    const state = strategyState();
    const region = state?.regions?.[regionHit.regionId];
    if (!region || region.owner !== state.activeFaction) {
      selectedRegion = null;
      panel.classList.remove("visible");
      return;
    }
    selectedRegion = { ...regionHit, ...region, regionId: regionHit.regionId ?? region.id };
    clearDraft();
    panel.classList.add("visible");
    render();
  }

  function setCount(unitType, value, available) {
    draft = {
      ...draft,
      [unitType]: Math.max(0, Math.min(available, value))
    };
    render();
  }

  function addCount(unitType, delta, available) {
    setCount(unitType, Number(draft[unitType] ?? 0) + delta, available);
  }

  function selectedTotal() {
    return UNIT_ORDER.reduce((sum, unitType) => sum + Number(draft[unitType] ?? 0), 0);
  }

  function draftCost() {
    const costs = engine.strategy?.getUnitCosts?.() ?? {};
    return UNIT_ORDER.reduce((sum, unitType) => sum + Number(draft[unitType] ?? 0) * Number(costs[unitType]?.cost ?? 0), 0);
  }

  function renderRows() {
    section.replaceChildren();
    const campaign = campaignState();
    const counts = countUnits(campaign, selectedRegion?.regionId);
    const costs = engine.strategy?.getUnitCosts?.() ?? {};

    for (const unitType of UNIT_ORDER) {
      const row = el("div", "strategic-unit-row");
      const label = el("div", "strategic-unit-name", UNIT_LABELS[unitType]);
      const availableText = mode === "march"
        ? `Available ${counts[unitType] ?? 0}`
        : `${costs[unitType]?.cost ?? 0} gold each`;
      const available = mode === "march" ? counts[unitType] ?? 0 : 99;
      const availableNode = el("div", "strategic-unit-count", availableText);
      const count = el("div", "strategic-count-box", String(draft[unitType] ?? 0));
      const minus = el("button", "strategic-command-button", "−");
      const plus = el("button", "strategic-command-button", "+");
      minus.disabled = Number(draft[unitType] ?? 0) <= 0;
      plus.disabled = mode === "march" && Number(draft[unitType] ?? 0) >= available;
      bindButton(minus, () => addCount(unitType, -1, available));
      bindButton(plus, () => addCount(unitType, 1, available));
      row.append(label, availableNode, count, minus, plus);
      section.append(row);
    }
  }

  function render() {
    const state = strategyState();
    if (!selectedRegion || !state) return;
    const region = currentRegionState();
    const total = selectedTotal();
    const cost = draftCost();
    title.textContent = `${region?.label ?? selectedRegion.regionLabel ?? selectedRegion.regionId} Command`;
    meta.innerHTML = [
      `Red province · Turn ${state.turn} · ${state.phase}`,
      `Gold ${state.gold} · World actions ${state.worldActionsRemaining}/${state.maxWorldActions}`
    ].join("<br>");
    renderRows();
    actionButton.textContent = mode === "march" ? "Prepare March" : `Craft Troops${cost > 0 ? ` · ${cost} Gold` : ""}`;
    actionButton.disabled = total <= 0 || state.worldActionsRemaining <= 0 || (mode === "recruit" && cost > state.gold);
    note.textContent = mode === "march"
      ? "Use + / − to choose groups, then prepare the march and click a destination province."
      : "Use + / − to craft unit groups. Crafting spends gold and one world action.";
  }

  function prepareMarch() {
    const state = strategyState();
    if (!selectedRegion || !state || state.worldActionsRemaining <= 0 || selectedTotal() <= 0) return;
    const campaign = campaignState();
    const units = [];
    for (const unitType of UNIT_ORDER) units.push(...unitsFor(campaign, selectedRegion.regionId, unitType, draft[unitType]));
    if (units.length <= 0) return;

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
    note.textContent = "March prepared. Click a destination province to send the selected groups.";
    render();
  }

  function craftTroops() {
    const state = strategyState();
    if (!selectedRegion || !state || state.worldActionsRemaining <= 0 || selectedTotal() <= 0) return;
    for (const unitType of UNIT_ORDER) {
      const count = Number(draft[unitType] ?? 0);
      if (count <= 0) continue;
      engine.strategy.recruitUnit(selectedRegion.regionId, unitType, count);
      break;
    }
    clearDraft();
    note.textContent = "Recruitment ordered. The new unit groups will appear after the next tick.";
    render();
  }

  bindButton(actionButton, () => {
    if (mode === "march") prepareMarch();
    else craftTroops();
  });
  bindButton(close, () => {
    selectedRegion = null;
    panel.classList.remove("visible");
  });
  bindButton(marchTab, () => setMode("march"));
  bindButton(recruitTab, () => setMode("recruit"));

  canvas.addEventListener("click", (event) => {
    if (event.button !== 0 || renderer.isFlyMode?.()) return;
    setTimeout(() => {
      const region = renderer.getSelectedRegion?.();
      if (region) showForRegion({
        regionId: region.id,
        regionLabel: region.label,
        owner: region.owner,
        ownerLabel: region.ownerLabel
      });
      else render();
    }, 0);
  });

  function update() {
    if (panel.classList.contains("visible")) render();
  }

  return {
    showForRegion,
    update,
    hide() {
      selectedRegion = null;
      panel.classList.remove("visible");
    }
  };
}
