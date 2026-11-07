export const RUNTIME_VERSION = "0.1.0";

function tokenName(token) {
  return typeof token === "string" ? token : token?.name;
}

export function defineResource(name) {
  if (!name || typeof name !== "string") {
    throw new TypeError("defineResource(name) requires a non-empty string");
  }

  return Object.freeze({ kind: "resource", name });
}

export function defineEvent(name) {
  if (!name || typeof name !== "string") {
    throw new TypeError("defineEvent(name) requires a non-empty string");
  }

  return Object.freeze({ kind: "event", name });
}

export function defineRuntimeKit(kit) {
  if (!kit || typeof kit !== "object") {
    throw new TypeError("defineRuntimeKit(kit) requires an object");
  }

  if (!kit.id) {
    throw new Error("Runtime kit requires an id");
  }

  return Object.freeze({
    resources: {},
    events: {},
    components: {},
    systems: [],
    requires: [],
    provides: [],
    metadata: {},
    ...kit
  });
}

export function createWorld() {
  const resources = new Map();
  const eventQueues = new Map();
  const trace = [];

  const world = {
    __nexusClock: {
      frame: 0,
      delta: 0,
      elapsed: 0
    },

    getResource(resource) {
      const name = tokenName(resource);
      return resources.get(name);
    },

    setResource(resource, value) {
      const name = tokenName(resource);
      if (!name) throw new Error("setResource requires a resource token or name");
      resources.set(name, value);
      return value;
    },

    hasResource(resource) {
      return resources.has(tokenName(resource));
    },

    emit(event, payload = {}) {
      const name = tokenName(event);
      if (!name) throw new Error("emit requires an event token or name");
      const item = {
        ...payload,
        type: name,
        frame: world.__nexusClock.frame,
        at: world.__nexusClock.elapsed
      };
      const queue = eventQueues.get(name) ?? [];
      queue.push(item);
      eventQueues.set(name, queue);
      trace.push(item);
      if (trace.length > 120) trace.shift();
      return item;
    },

    readEvents(event) {
      return [...(eventQueues.get(tokenName(event)) ?? [])];
    },

    readAllEvents() {
      return [...trace];
    },

    clearTickEvents() {
      eventQueues.clear();
    },

    snapshotResources() {
      return Object.fromEntries(resources.entries());
    }
  };

  return world;
}

export function createRealtimeGame({ kits = [], phases = ["input", "simulate", "resolve", "post"] } = {}) {
  const world = createWorld();
  const engine = {
    version: RUNTIME_VERSION,
    world,
    kits: [],
    phases,
    tick,
    getFrame: () => world.__nexusClock.frame,
    getClock: () => ({ ...world.__nexusClock })
  };

  const provided = new Set();

  for (const kit of kits) {
    for (const requirement of kit.requires ?? []) {
      if (!provided.has(requirement)) {
        throw new Error(`Kit ${kit.id} requires missing capability: ${requirement}`);
      }
    }

    kit.initWorld?.({ engine, world });
    kit.install?.({ engine, world });
    engine.kits.push(kit);

    for (const capability of kit.provides ?? []) {
      provided.add(capability);
    }
  }

  function tick(dt = 1 / 60) {
    const numericDt = Number.isFinite(dt) ? Number(dt) : 1 / 60;
    const clampedDt = Math.max(0, Math.min(1 / 15, numericDt));

    world.__nexusClock.frame += 1;
    world.__nexusClock.delta = clampedDt;
    world.__nexusClock.elapsed += clampedDt;

    for (const phase of phases) {
      for (const kit of engine.kits) {
        for (const entry of kit.systems ?? []) {
          if ((entry.phase ?? "simulate") !== phase) continue;
          entry.system(world, { engine, phase, name: entry.name ?? kit.id });
        }
      }
    }

    world.clearTickEvents();
    return engine;
  }

  return engine;
}

export const NexusRuntime = Object.freeze({
  defineResource,
  defineEvent,
  defineRuntimeKit,
  createRealtimeGame
});
