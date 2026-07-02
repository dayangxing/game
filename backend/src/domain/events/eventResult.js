export function stripInternalActionFields(action) {
  return {
    id: action.id,
    title: action.title,
    icon: action.icon,
    command: action.command,
    meta: action.meta,
    storyHook: action.storyHook,
    expiresAt: action.expiresAt
  };
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
