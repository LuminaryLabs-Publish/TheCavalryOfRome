import { createRealtimeGame } from "./runtime.js";
import { createCavalryOfRomeKit } from "./cavalry-of-rome-kit.js";
import { createStrategicBoardGameLoopKit } from "./strategic-board-game-loop-kit.js";
import { cavalryOfRomeLevel01 } from "./level-01.js";
import { createInputAdapter } from "./input-adapter.js";
import { createRenderer } from "./visual-upgrade-renderer.js";
import { createProvinceCommandPanelKit } from "./province-command-panel-kit.js";
import { createTacticalOverlay } from "./tactical-overlay.js";

const canvas = document.querySelector("#game");
const errorPanel = document.querySelector("#errorPanel");

function showFatal(error) {
  console.error(error);
  errorPanel.hidden = false;
  errorPanel.textContent = String(error?.stack ?? error?.message ?? error);
}

async function boot() {
  if (!canvas) throw new Error("Missing #game canvas");

  const engine = createRealtimeGame({
    kits: [
      createCavalryOfRomeKit({ level: cavalryOfRomeLevel01 }),
      createStrategicBoardGameLoopKit({
        activeFaction: "rome",
        startingGold: 120,
        maxWorldActions: 2
      })
    ]
  });

  const renderer = await createRenderer(canvas);
  const input = createInputAdapter({ canvas, renderer, engine });
  const provinceCommandPanel = createProvinceCommandPanelKit({ canvas, renderer, engine });
  const tacticalOverlay = createTacticalOverlay({ engine, onError: showFatal });

  let running = true;
  let last = performance.now();

  function tick(dt) {
    input.flush();
    engine.tick(dt);
    provinceCommandPanel.update();
    const snapshot = engine.cavalry.getState();
    tacticalOverlay.update(snapshot?.campaign?.encounter ?? null);
    // Do not spend GPU cycles drawing the world behind the full-screen battle.
    if (!snapshot?.campaign?.encounter?.active) renderer.draw(snapshot);
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(1 / 30, (now - last) / 1000 || 1 / 60);
    last = now;
    tick(dt);
    requestAnimationFrame(frame);
  }

  window.GameHost = {
    engine,
    renderer,
    input,
    provinceCommandPanel,
    tacticalOverlay,
    tick,
    stop() {
      running = false;
    },
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    },
    getState() {
      return engine.cavalry.getState();
    },
    getStrategicState() {
      return engine.strategy.getState();
    },
    endTurn() {
      engine.strategy.endTurn();
      tick(1 / 60);
      return engine.strategy.getState();
    }
  };

  renderer.draw(engine.cavalry.getState());
  requestAnimationFrame(frame);
}

boot().catch(showFatal);
