import { EVENT_CATALOG } from './eventCatalog.js';
import { canAffordEffects } from './effectResolver.js';
import { isEventEligible } from './triggerMatcher.js';

const FEATURED_EVENT_PRIORITY_BOOSTS = {
  realm: {
    mist_bronze_bell: 100
  }
};

export function selectEventActions({ game, viewId, now, sequenceStart = 0 }) {
  const eligible = EVENT_CATALOG
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => isEventEligible(event, game, viewId))
    .filter(({ event }) => !isEventOnCooldown(event, game))
    .sort((left, right) => compareEvents(left, right, viewId))
    .map(({ event }) => event)
    .slice(0, 6);

  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  return eligible
    .flatMap((event, eventIndex) => event.choices
      .filter((choice) => canAffordEffects(game, choice.success.effects))
      .map((choice, choiceIndex) => ({
      id: `act_${game.turn}_${viewId}_${sequenceStart + eventIndex}_${choiceIndex}`,
      title: choice.label,
      icon: event.category.slice(0, 1),
      command: choice.command,
      meta: `${event.title} / ${choice.risk}`,
      source: 'event',
      risk: choice.risk,
      eventId: event.id,
      choiceId: choice.id,
      storyHook: [
        `事件：${event.title}`,
        `选择：${choice.label}`,
        '规则边界：只能描述已解析效果。'
      ].join('\n'),
      expiresAt,
      event,
      choice
    })))
    .slice(0, 4);
}

function compareEvents(left, right, viewId) {
  const priorityDelta = scoreEvent(right.event, viewId) - scoreEvent(left.event, viewId);
  if (priorityDelta !== 0) return priorityDelta;
  return left.index - right.index;
}

function scoreEvent(event, viewId) {
  return event.priority + (FEATURED_EVENT_PRIORITY_BOOSTS[viewId]?.[event.id] ?? 0);
}

function isEventOnCooldown(event, game) {
  const cooldownTurn = game.cooldowns?.[event.id];
  return typeof cooldownTurn === 'number' && cooldownTurn >= game.turn;
}
