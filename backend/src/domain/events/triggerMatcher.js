export function isEventEligible(event, game, viewId) {
  const trigger = event.trigger ?? {};
  if (game.onboarding && !game.onboarding.completed) return false;
  if (trigger.viewIds && !trigger.viewIds.includes(viewId)) return false;
  if (trigger.requiresFlags?.some((flag) => !game.flags?.[flag])) return false;
  if (trigger.forbidFlags?.some((flag) => game.flags?.[flag])) return false;
  if (trigger.requiresFutureEvent && !game.karma?.futureEventFlags?.includes(trigger.requiresFutureEvent)) return false;
  if (trigger.sectRelationMin && (game.player?.sectRelation ?? 0) < trigger.sectRelationMin) return false;
  if (trigger.karmaMax !== undefined && (game.karma?.karma ?? 0) > trigger.karmaMax) return false;
  return true;
}
