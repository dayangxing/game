import { calculateBreakthroughChance, canAttemptBreakthrough } from '../progression.js';
import { BREAKTHROUGH_EVENT, EVENT_CATALOG } from './eventCatalog.js';
import { canAffordEffects } from './effectResolver.js';
import { isEventEligible } from './triggerMatcher.js';

const FEATURED_EVENT_PRIORITY_BOOSTS = {
  realm: {
    mist_lantern_path: 95
  }
};
const RISK_LABELS = {
  low: '低风险',
  medium: '中等风险',
  high: '高风险'
};

export function selectEventActions({ game, viewId, now, sequenceStart = 0 }) {
  const eligible = EVENT_CATALOG
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => isEventEligible(event, game, viewId))
    .filter(({ event }) => !isEventOnCooldown(event, game))
    .sort((left, right) => compareEvents(left, right, viewId, game))
    .map(({ event }) => event)
    .slice(0, 6);

  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  const actions = eligible
    .flatMap((event, eventIndex) => event.choices
      .filter((choice) => canAffordEffects(game, choice.success.effects))
      .map((choice, choiceIndex) => ({
      id: `act_${game.turn}_${viewId}_${sequenceStart + eventIndex}_${choiceIndex}`,
      title: choice.label,
      icon: event.category.slice(0, 1),
      command: choice.command,
      meta: `${event.title} / ${RISK_LABELS[choice.risk] ?? '未知风险'}`,
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

  if (viewId !== 'cultivation' || !canAttemptBreakthrough(game)) {
    return actions;
  }

  const preview = calculateBreakthroughChance(game);
  const breakthroughAction = {
    id: `act_${game.turn}_${viewId}_${sequenceStart}_bt`,
    title: '尝试突破',
    icon: BREAKTHROUGH_EVENT.category.slice(0, 1),
    command: '尝试突破',
    meta: `突破至${preview.targetRealm} / ${RISK_LABELS.high}`,
    source: 'breakthrough',
    risk: 'high',
    eventId: BREAKTHROUGH_EVENT.id,
    choiceId: BREAKTHROUGH_EVENT.choices[0].id,
    storyHook: [
      `事件：${BREAKTHROUGH_EVENT.title}`,
      `目标境界：${preview.targetRealm}`,
      `成功率：${preview.chance}%`,
      '规则边界：只能描述已解析效果。'
    ].join('\n'),
    expiresAt,
    breakthroughPreview: preview
  };

  return [breakthroughAction, ...actions].slice(0, 4);
}

function compareEvents(left, right, viewId, game) {
  const priorityDelta = scoreEvent(right.event, viewId, game) - scoreEvent(left.event, viewId, game);
  if (priorityDelta !== 0) return priorityDelta;
  return left.index - right.index;
}

function scoreEvent(event, viewId, game) {
  return event.priority + (FEATURED_EVENT_PRIORITY_BOOSTS[viewId]?.[event.id] ?? 0);
}

function isEventOnCooldown(event, game) {
  const cooldownTurn = game.cooldowns?.[event.id];
  return typeof cooldownTurn === 'number' && cooldownTurn >= game.turn;
}
