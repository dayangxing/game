import { compareRealms } from '../progression.js';
import { hasResolvedEvent } from './eventHistory.js';

export function isEventEligible(event, game, viewId) {
  const trigger = event.trigger ?? {};
  if (game.onboarding && !game.onboarding.completed) return false;
  if (trigger.viewIds && !trigger.viewIds.includes(viewId)) return false;
  if (trigger.chapterIds && !trigger.chapterIds.includes(game.storyProgress?.chapterId)) return false;
  if (trigger.realmAtLeast && compareRealms(game.player?.realm, trigger.realmAtLeast) < 0) return false;
  if (trigger.requiresFlags?.some((flag) => !game.flags?.[flag])) return false;
  if (trigger.forbidFlags?.some((flag) => game.flags?.[flag])) return false;
  if (trigger.requiresFutureEvent && !game.karma?.futureEventFlags?.includes(trigger.requiresFutureEvent)) return false;
  if (trigger.sectRelationMin && (game.player?.sectRelation ?? 0) < trigger.sectRelationMin) return false;
  if (trigger.npcAffinityMin) {
    const { npcId, value } = trigger.npcAffinityMin;
    if (!(game.npcs ?? []).some((npc) => isTargetNpc(npc, npcId) && (npc.affinity ?? 0) >= value)) return false;
  }
  if (trigger.requiresSectPath && game.storyProgress?.sectPath !== trigger.requiresSectPath) return false;
  if (trigger.lifespanRatioMax !== undefined && getLifespanRatio(game) > trigger.lifespanRatioMax) return false;
  if (trigger.requiresBreakthroughFailure) {
    const { tier, atLeast } = trigger.requiresBreakthroughFailure;
    const failures = tier
      ? (game.progressionStats?.breakthroughFailuresByTier?.[tier] ?? 0)
      : (game.progressionStats?.breakthroughFailures ?? 0);
    if (failures < atLeast) return false;
  }
  if (trigger.requiresEventResolved && !hasResolvedEvent(game, trigger.requiresEventResolved)) return false;
  if (trigger.forbidEventResolved && hasResolvedEvent(game, trigger.forbidEventResolved)) return false;
  if (trigger.karmaMax !== undefined && (game.karma?.karma ?? 0) > trigger.karmaMax) return false;
  return true;
}

function getLifespanRatio(game) {
  const maxLifespan = game.player?.maxLifespan ?? game.player?.lifespan ?? 0;
  return maxLifespan > 0 ? (game.player?.lifespan ?? 0) / maxLifespan : 0;
}

function isTargetNpc(npc, npcId) {
  const aliases = {
    lin_shijie: '林师姐',
    xuanheng: '玄衡长老'
  };
  return npc?.name === aliases[npcId];
}
