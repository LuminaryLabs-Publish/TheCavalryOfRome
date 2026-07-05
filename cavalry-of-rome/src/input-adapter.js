export function createInputAdapter({ canvas, renderer, engine }) {
  const keysDown = new Set();
  const pending = [];

  function enqueue(action) {
    pending.push(action);
  }

  canvas.addEventListener("click", (event) => {
    if (event.button !== 0 || renderer.isFlyMode?.()) return;

    const hit = renderer.pick(event);
    if (hit?.type === "region") renderer.selectRegion(hit.regionId);
    if (hit?.type === "lane") enqueue({ type: "selectLane", laneId: hit.laneId });
  });

  globalThis.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    const cameraFlightActive = document.pointerLockElement === canvas || (event.buttons & 2) === 2;

    if (["1", "2", "3", " ", "r", "n", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "pageup", "pagedown"].includes(key)) {
      event.preventDefault();
    }

    if (keysDown.has(key) && ![" "].includes(key)) return;
    keysDown.add(key);

    if (key === "1") enqueue({ type: "formation", formation: "line" });
    if (key === "2") enqueue({ type: "formation", formation: "wedge" });
    if (key === "3") enqueue({ type: "formation", formation: "screen" });
    if (!cameraFlightActive && key === "a") enqueue({ type: "selectLane", laneId: "left" });
    if (!cameraFlightActive && key === "s") enqueue({ type: "selectLane", laneId: "center" });
    if (!cameraFlightActive && key === "d") enqueue({ type: "selectLane", laneId: "right" });
    if (key === " ") enqueue({ type: "charge" });
    if (key === "r") enqueue({ type: "rally" });
    if (key === "n") enqueue({ type: "restart" });
  });

  globalThis.addEventListener("keyup", (event) => {
    keysDown.delete(event.key.toLowerCase());
  });

  globalThis.addEventListener("blur", () => {
    keysDown.clear();
  });

  function flush() {
    while (pending.length > 0) {
      const action = pending.shift();
      if (action.type === "formation") engine.cavalry.setFormation(action.formation);
      if (action.type === "selectLane") engine.cavalry.selectLane(action.laneId);
      if (action.type === "charge") engine.cavalry.charge();
      if (action.type === "rally") engine.cavalry.rally();
      if (action.type === "restart") engine.cavalry.restart();
    }
  }

  return {
    flush,
    enqueue,
    getPendingCount: () => pending.length
  };
}
