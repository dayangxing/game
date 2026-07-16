import { calculateBreakthroughChance, canAttemptBreakthrough } from '../progression.js';
import { BREAKTHROUGH_EVENT, EVENT_CATALOG } from './eventCatalog.js';
import { canAffordEffects } from './effectResolver.js';
import { hasResolvedEvent } from './eventHistory.js';
import { isEventEligible } from './triggerMatcher.js';

const FEATURED_EVENT_PRIORITY_BOOSTS = {
  realm: {
    mist_lantern_path: 95
  }
};
const RECENT_EVENT_TURN_WINDOW = 2;
const RISK_LABELS = {
  low: '低风险',
  medium: '中等风险',
  high: '高风险'
};

export function selectEventActions({ game, viewId, now, sequenceStart = 0 }) {
  const eligible = EVENT_CATALOG
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => isEventEligible(event, game, viewId))
    .filter(({ event }) => !isEventCompleted(event, game))
    .filter(({ event }) => !isEventOnCooldown(event, game))
    .filter(({ event }) => !isEventRecentlyResolved(event, game))
    .sort((left, right) => compareEvents(left, right, viewId, game))
    .map(({ event }) => event);

  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  const actions = pickDiverseEvents(eligible)
    .flatMap((event, eventIndex) => event.choices
      .filter((choice) => canAffordEffects(game, choice.success.effects))
      .map((choice, choiceIndex) => ({
      id: `act_${game.turn}_${viewId}_${sequenceStart + eventIndex}_${choiceIndex}`,
      title: choice.label,
      icon: event.category.slice(0, 1),
      command: choice.command,
      meta: `${event.title} / ${RISK_LABELS[choice.risk] ?? '未知风险'}`,
      category: event.category,
      source: 'event',
      risk: choice.risk,
      cadence: event.cadence,
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
    meta: `突破至${preview.targetRealm} / 成功率 ${preview.chance}% / ${RISK_LABELS.high}`,
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

function isEventCompleted(event, game) {
  return event.oneShot === true && hasResolvedEvent(game, event.id);
}

function isEventRecentlyResolved(event, game) {
  const cooldownTurn = game.cooldowns?.[event.id];
  const lastResolvedTurn = game.eventHistory?.lastResolvedTurn?.[event.id];
  if (typeof lastResolvedTurn === 'number') {
    return game.turn - lastResolvedTurn <= RECENT_EVENT_TURN_WINDOW;
  }
  if (typeof cooldownTurn !== 'number') return false;
  return game.turn - cooldownTurn <= RECENT_EVENT_TURN_WINDOW;
}

function pickDiverseEvents(events) {
  const selected = [];
  const seen = new Set();
  const categoryQueues = new Map();

  for (const event of events) {
    const queue = categoryQueues.get(event.category) ?? [];
    queue.push(event);
    categoryQueues.set(event.category, queue);
  }

  for (const queue of categoryQueues.values()) {
    addSelectedEvent(selected, seen, queue[0]);
  }

  for (const event of events) {
    addSelectedEvent(selected, seen, event);
    if (selected.length >= 6) break;
  }

  return selected.slice(0, 6);
}

function addSelectedEvent(selected, seen, event) {
  if (!event || seen.has(event.id)) return;
  seen.add(event.id);
  selected.push(event);
}
