export function stripInternalActionFields(action) {
  const { event, choice, ...publicAction } = action;
  return publicAction;
}

export function eventNarrationFallback(resolution) {
  return {
    status: 'fallback',
    title: resolution.entry.title,
    body: resolution.entry.body,
    npcLine: resolution.entry.npcLine,
    foreshadow: resolution.game.foreshadows.at(-1) ?? ''
  };
}
