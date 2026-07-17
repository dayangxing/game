export function normalizeEventHistory(history = {}) {
  return {
    resolved: Array.isArray(history.resolved) ? [...new Set(history.resolved)] : [],
    repeatCounts: { ...(history.repeatCounts ?? {}) },
    lastResolvedTurn: { ...(history.lastResolvedTurn ?? {}) }
  };
}

export function hasResolvedEvent(game = {}, eventId) {
  return normalizeEventHistory(game.eventHistory).resolved.includes(eventId);
}

export function getEventRepeatCount(game = {}, eventId) {
  return Math.max(0, Number(normalizeEventHistory(game.eventHistory).repeatCounts[eventId] ?? 0));
}

export function getRepeatRewardMultiplier(repeatCount) {
  if (repeatCount <= 0) return 1;
  if (repeatCount === 1) return 0.5;
  return 0.25;
}

export function recordEventResolution(history = {}, eventId, turn) {
  const normalized = normalizeEventHistory(history);
  return {
    ...normalized,
    resolved: [...new Set([...normalized.resolved, eventId])],
    repeatCounts: {
      ...normalized.repeatCounts,
      [eventId]: (normalized.repeatCounts[eventId] ?? 0) + 1
    },
    lastResolvedTurn: { ...normalized.lastResolvedTurn, [eventId]: turn }
  };
}
