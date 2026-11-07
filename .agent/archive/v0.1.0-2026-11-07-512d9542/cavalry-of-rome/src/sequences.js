export const CAVALRY_SEQUENCE_VERSION = "0.1.0";

export function createSequenceState(sequenceConfig = {}) {
  const nodes = sequenceConfig.nodes ?? [];
  const first = nodes[0] ?? { id: "ready", hint: "Awaiting orders." };

  return {
    version: CAVALRY_SEQUENCE_VERSION,
    nodeId: first.id,
    hint: first.hint,
    completedNodeIds: [],
    seenEvents: []
  };
}

export function advanceCavalrySequence(previous, sequenceConfig = {}, events = []) {
  const nodes = sequenceConfig.nodes ?? [];
  const state = {
    ...previous,
    completedNodeIds: [...(previous.completedNodeIds ?? [])],
    seenEvents: [...(previous.seenEvents ?? [])]
  };

  for (const event of events) {
    if (!event?.type) continue;
    state.seenEvents.push(event.type);
  }

  const currentIndex = Math.max(0, nodes.findIndex((node) => node.id === state.nodeId));
  const remaining = nodes.slice(currentIndex + 1);

  for (const candidate of remaining) {
    if (!candidate.afterEvent) continue;
    if (!events.some((event) => event.type === candidate.afterEvent)) continue;

    if (!state.completedNodeIds.includes(state.nodeId)) {
      state.completedNodeIds.push(state.nodeId);
    }

    state.nodeId = candidate.id;
    state.hint = candidate.hint;
    break;
  }

  return state;
}
