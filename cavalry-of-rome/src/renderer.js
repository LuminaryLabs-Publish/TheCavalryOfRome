const PALETTE = {
  sky: "#0e1922",
  field: "#3a3222",
  fieldLine: "rgba(255, 221, 150, 0.16)",
  roman: "#d8c38b",
  romanDark: "#7b1f16",
  enemy: "#c26b45",
  enemyDark: "#5d281d",
  text: "#f5ead5",
  muted: "rgba(245, 234, 213, 0.72)",
  accent: "#e6b85c",
  success: "#a8e37f",
  warning: "#ef9c52",
  danger: "#e76855"
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function laneScreenX(width, lane) {
  return Math.round(width * (lane.x ?? 0.5));
}

function laneY(height, distance) {
  const normalized = clamp(distance / 640, 0, 1);
  return Math.round(height * (0.78 - normalized * 0.48));
}

function drawText(ctx, text, x, y, options = {}) {
  const {
    size = 14,
    align = "left",
    color = PALETTE.text,
    weight = "600"
  } = options;
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

function drawMeter(ctx, x, y, width, value, label) {
  const normalized = clamp(value / 100, 0, 1);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(x, y, width, 7);
  ctx.fillStyle = value < 25 ? PALETTE.danger : value < 50 ? PALETTE.warning : PALETTE.success;
  ctx.fillRect(x, y, width * normalized, 7);
  drawText(ctx, `${label} ${Math.round(value)}`, x, y - 3, { size: 11, color: PALETTE.muted, weight: "500" });
}

function drawHorse(ctx, x, y, scale, facing = -1, color = PALETTE.roman) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * facing, scale);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(-15, -7, 6, 5, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillRect(-9, -17, 5, 12);
  ctx.fillRect(-4, -18, 8, 4);
  ctx.fillRect(-10, 5, 4, 12);
  ctx.fillRect(6, 5, 4, 12);
  ctx.fillRect(-2, 4, 3, 11);
  ctx.fillRect(13, -1, 12, 3);

  ctx.restore();
}

function drawBanner(ctx, x, y, label, active) {
  ctx.strokeStyle = active ? PALETTE.accent : "rgba(255,255,255,0.35)";
  ctx.lineWidth = active ? 2 : 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 32);
  ctx.lineTo(x, y - 18);
  ctx.stroke();

  ctx.fillStyle = active ? PALETTE.romanDark : "rgba(120,40,30,0.75)";
  ctx.beginPath();
  ctx.moveTo(x, y - 18);
  ctx.lineTo(x + 35, y - 10);
  ctx.lineTo(x, y - 2);
  ctx.closePath();
  ctx.fill();

  drawText(ctx, label, x, y - 24, { size: 11, align: "center", color: PALETTE.muted, weight: "500" });
}

function drawLanes(ctx, state, width, height) {
  for (const lane of Object.values(state.lanes)) {
    const x = laneScreenX(width, lane);
    const y = laneY(height, lane.distance);
    const selected = lane.id === state.selectedLane;
    const target = lane.id === state.targetLane;

    ctx.strokeStyle = selected ? "rgba(230,184,92,0.65)" : PALETTE.fieldLine;
    ctx.lineWidth = selected ? 3 : 1;
    ctx.beginPath();
    ctx.moveTo(x, height * 0.18);
    ctx.lineTo(x, height * 0.88);
    ctx.stroke();

    ctx.fillStyle = selected ? "rgba(230,184,92,0.16)" : "rgba(255,255,255,0.04)";
    ctx.beginPath();
    ctx.roundRect(x - 70, height * 0.13, 140, height * 0.75, 18);
    ctx.fill();

    if (lane.status === "routed") {
      ctx.globalAlpha = 0.35;
    }

    drawBanner(ctx, x - 28, y - 16, lane.label, selected);
    drawHorse(ctx, x + 18, y, 0.9, 1, target ? PALETTE.danger : PALETTE.enemy);
    drawHorse(ctx, x + 45, y + 12, 0.75, 1, PALETTE.enemyDark);

    drawText(ctx, lane.enemyLabel, x, y + 42, { size: 13, align: "center", color: selected ? PALETTE.text : PALETTE.muted });
    drawText(ctx, `${Math.round(lane.distance)}m | STR ${lane.strength} | MOR ${Math.round(lane.morale)}`, x, y + 60, {
      size: 11,
      align: "center",
      color: lane.status === "routed" ? PALETTE.success : PALETTE.muted,
      weight: "500"
    });

    if (lane.status === "routed") {
      drawText(ctx, "ROUTED", x, y - 44, { size: 15, align: "center", color: PALETTE.success });
      ctx.globalAlpha = 1;
    }
  }
}

function drawRomans(ctx, state, width, height) {
  const selected = state.lanes[state.selectedLane];
  const target = state.lanes[state.targetLane] ?? selected;
  const x = target ? laneScreenX(width, target) : width / 2;
  const y = state.mode === "charging" && target
    ? laneY(height, target.distance + 150)
    : height * 0.84;

  const formation = state.formations[state.formation];
  const offsets = state.formation === "wedge"
    ? [[0, -22], [-26, 4], [26, 4], [-50, 28], [50, 28]]
    : state.formation === "screen"
      ? [[-64, 0], [-32, -8], [0, 0], [32, -8], [64, 0]]
      : [[-48, 0], [-24, -8], [0, -10], [24, -8], [48, 0]];

  for (const [dx, dy] of offsets) {
    drawHorse(ctx, x + dx, y + dy, 0.9, -1, PALETTE.roman);
  }

  drawBanner(ctx, x - 75, y - 15, formation?.label ?? "Line", true);

  if (state.mode === "charging") {
    ctx.strokeStyle = "rgba(230,184,92,0.42)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 50);
    ctx.lineTo(x, laneY(height, target.distance));
    ctx.stroke();
  }
}

function drawTerrain(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, PALETTE.sky);
  gradient.addColorStop(0.46, "#202d28");
  gradient.addColorStop(0.47, PALETTE.field);
  gradient.addColorStop(1, "#17130e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255,221,150,0.10)";
  for (let i = 0; i < 16; i += 1) {
    const y = height * (0.48 + i * 0.035);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(width * 0.25, y + 20, width * 0.7, y - 24, width, y + 8);
    ctx.stroke();
  }
}

function drawHud(ctx, state, width, height) {
  const pad = 18;
  ctx.fillStyle = "rgba(0,0,0,0.36)";
  ctx.beginPath();
  ctx.roundRect(pad, pad, 355, 112, 16);
  ctx.fill();

  drawText(ctx, state.title, pad + 16, pad + 28, { size: 20, color: PALETTE.text });
  drawText(ctx, state.objective, pad + 16, pad + 51, { size: 12, color: PALETTE.muted, weight: "500" });
  drawMeter(ctx, pad + 16, pad + 75, 145, state.player.morale, "Morale");
  drawMeter(ctx, pad + 178, pad + 75, 145, state.player.cohesion, "Cohesion");
  drawText(ctx, `Mode ${state.mode} | Troopers ${state.player.troopers} | Fatigue ${Math.round(state.player.fatigue)} | Score ${state.score}`, pad + 16, pad + 103, {
    size: 12,
    color: PALETTE.muted,
    weight: "500"
  });

  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.beginPath();
  ctx.roundRect(18, height - 62, Math.min(width - 36, 760), 42, 14);
  ctx.fill();
  const controls = "1 Line  2 Wedge  3 Screen  |  Click lane  |  Space Charge  |  R Rally  |  N Restart";
  drawText(ctx, controls, 34, height - 36, { size: 13, color: PALETTE.muted, weight: "500" });

  if (state.sequence?.hint) {
    drawText(ctx, state.sequence.hint, width / 2, 40, {
      size: 15,
      align: "center",
      color: PALETTE.accent
    });
  }

  if (state.lastRejection) {
    drawText(ctx, state.lastRejection, width / 2, height - 88, {
      size: 14,
      align: "center",
      color: PALETTE.warning
    });
  }

  if (["victory", "defeat"].includes(state.mode)) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, width, height);
    drawText(ctx, state.mode === "victory" ? "VICTORY" : "DEFEAT", width / 2, height / 2 - 14, {
      size: 46,
      align: "center",
      color: state.mode === "victory" ? PALETTE.success : PALETTE.danger,
      weight: "800"
    });
    drawText(ctx, `Score ${state.score} — press N to restart`, width / 2, height / 2 + 28, {
      size: 18,
      align: "center",
      color: PALETTE.text,
      weight: "500"
    });
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let lastSnapshot = null;

  if (!ctx) {
    throw new Error("Canvas 2D context is unavailable");
  }

  function resize() {
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
    const width = Math.max(640, Math.floor(globalThis.innerWidth || canvas.clientWidth || 960));
    const height = Math.max(480, Math.floor(globalThis.innerHeight || canvas.clientHeight || 640));
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width, height };
  }

  function draw(snapshot) {
    lastSnapshot = snapshot;
    const { width, height } = resize();
    drawTerrain(ctx, width, height);
    drawLanes(ctx, snapshot, width, height);
    drawRomans(ctx, snapshot, width, height);
    drawHud(ctx, snapshot, width, height);
  }

  function pick(event) {
    if (!lastSnapshot) return null;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const width = rect.width || canvas.clientWidth;
    let best = null;
    let bestDistance = Infinity;

    for (const lane of Object.values(lastSnapshot.lanes)) {
      const screenX = laneScreenX(width, lane);
      const distance = Math.abs(screenX - x);
      if (distance < bestDistance) {
        best = lane;
        bestDistance = distance;
      }
    }

    return bestDistance < width * 0.17 ? best?.id ?? null : null;
  }

  globalThis.addEventListener?.("resize", resize);
  resize();

  return {
    draw,
    pick,
    resize,
    getLastSnapshot: () => lastSnapshot
  };
}
