export function stripInternalActionFields(action) {
  const publicAction = {
    id: action.id,
    title: action.title,
    icon: action.icon,
    command: action.command,
    meta: action.meta,
    storyHook: action.storyHook,
    expiresAt: action.expiresAt
  };

  if (action.source === 'event' || action.source === 'director') {
    publicAction.category = action.category;
    publicAction.risk = action.risk;
    publicAction.cadence = action.cadence;
  }

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
