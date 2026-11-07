export const CONTROL_BUTTON_KIT_VERSION = "0.1.0";

export function createControlButton({
  label,
  action,
  unitType = null,
  delta = null,
  mode = null,
  className = "strategic-command-button",
  disabled = false
} = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label ?? "Button";
  button.dataset.controlButton = "true";
  button.dataset.commandAction = action ?? "noop";
  if (unitType) button.dataset.unitType = unitType;
  if (delta !== null) button.dataset.delta = String(delta);
  if (mode) button.dataset.mode = mode;
  button.disabled = Boolean(disabled);
  return button;
}

export function getControlButtonCommand(event, root) {
  const button = event.target?.closest?.("button[data-control-button='true']");
  if (!button || !root?.contains(button)) return null;
  return {
    button,
    action: button.dataset.commandAction,
    unitType: button.dataset.unitType,
    delta: Number(button.dataset.delta ?? 0),
    mode: button.dataset.mode
  };
}

export function consumeControlButtonEvent(event) {
  event.preventDefault();
  event.stopPropagation();
}
