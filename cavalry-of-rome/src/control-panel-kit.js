import {
  consumeControlButtonEvent,
  getControlButtonCommand
} from "./control-button-kit.js";

export const CONTROL_PANEL_KIT_VERSION = "0.1.0";

export function injectControlPanelStyles() {
  if (document.querySelector("#control-panel-kit-style")) return;
  const style = document.createElement("style");
  style.id = "control-panel-kit-style";
  style.textContent = `
    .strategic-command-panel {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 2147483647;
      width: 360px;
      min-height: 318px;
      box-sizing: border-box;
      background: linear-gradient(180deg, rgba(34, 25, 17, 0.96), rgba(17, 14, 11, 0.98));
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
      touch-action: manipulation;
      pointer-events: auto;
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

export function createControlPanel({ className = "strategic-command-panel", onCommand } = {}) {
  injectControlPanelStyles();
  const panel = document.createElement("div");
  panel.className = className;
  panel.dataset.controlPanel = "true";

  panel.addEventListener("pointerdown", (event) => {
    const command = getControlButtonCommand(event, panel);
    if (!command) return;
    consumeControlButtonEvent(event);
    if (!command.button.disabled) onCommand?.(command, event);
  }, true);

  for (const eventName of ["mousedown", "mouseup", "click", "dblclick", "wheel"]) {
    panel.addEventListener(eventName, consumeControlButtonEvent, true);
  }

  return {
    element: panel,
    show() {
      panel.classList.add("visible");
    },
    hide() {
      panel.classList.remove("visible");
    },
    isVisible() {
      return panel.classList.contains("visible");
    },
    setChildren(...children) {
      panel.replaceChildren(...children);
    }
  };
}
