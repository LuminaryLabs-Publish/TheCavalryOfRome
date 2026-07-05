export function createInputAdapter({ canvas, renderer, engine }) {
  const keysDown = new Set();
  const pending = [];

  function enqueue(action) {
    pending.push(action);
  }

  canvas.addEventListener("click", (event) => {
    const laneId = renderer.pick(event);
    if (laneId) enqueue({ type: "selectLane", laneId });
  });

  globalThis.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (keysDown.has(key) && ![" "].includes(key)) return;
    keysDown.add(key);

    if (["1", "2", "3", " ", "r", "n", "a", "s", "d"].includes(key)) {
      event.preventDefault();
    }

    if (key === "1") enqueue({ type: "formation", formation: "line" });
    if (key === "2") enqueue({ type: "formation", formation: "wedge" });
    if (key === "3") enqueue({ type: "formation", formation: "screen" });
    if (key === "a") enqueue({ type: "selectLane", laneId: "left" });
    if (key === "s") enqueue({ type: "selectLane", laneId: "center" });
    if (key === "d") enqueue({ type: "selectLane", laneId: "right" });
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
