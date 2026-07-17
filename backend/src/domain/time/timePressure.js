import { advanceCalendarByMonths, formatCalendarLabel } from './calendar.js';
import { calculateActionTimeCost } from './timeCost.js';
import { applyLongevityState, calculateLongevityChange } from './longevity.js';
import { calculateLifespanCost } from '../realmRules.js';
import { createLifespanEnding } from '../endings/endingResolver.js';

export function applyTimePressure({
  game = {},
  timeGame,
  action = {},
  command = '',
  category,
  effectHints = [],
  source = '',
  extraLifespanDamage = 0,
  breakthrough
} = {}) {
  if (game.onboarding?.completed === false) {
    return { game, timeResult: emptyTimeResult(game) };
  }

  const costContext = timeGame ?? game;
  const timeCost = calculateActionTimeCost({ game: costContext, action, command, category, effectHints });
  const calendarResult = advanceCalendarByMonths(game, timeCost.deltaMonths);
  const baseLifespanCost = Math.max(1, Math.ceil(timeCost.deltaMonths / 12) + calculateLifespanCost(costContext));
  const longevity = calculateLongevityChange({
    game,
    category: timeCost.category,
    effectHints,
    source,
    breakthrough
  });
  const maxLifespan = Math.max(0, (game.player?.maxLifespan ?? game.player?.lifespan ?? 0) + longevity.maxLifespanDelta);
  const netLifespanDelta = longevity.longevityGain - baseLifespanCost - Math.max(0, extraLifespanDamage);
  const lifespan = clamp((game.player?.lifespan ?? 0) + netLifespanDelta, 0, maxLifespan);
  const warningLevel = buildWarningLevel({ lifespan, maxLifespan });
  const timeResult = {
    category: timeCost.category,
    deltaMonths: timeCost.deltaMonths,
    label: timeCost.label,
    baseLifespanCost,
    longevityGain: longevity.longevityGain,
    netLifespanDelta,
    maxLifespanDelta: longevity.maxLifespanDelta,
    warningLevel,
    recoveryFatigue: longevity.recoveryFatigue,
    note: longevity.note
  };
  const withLongevityState = applyLongevityState(game, longevity);
  const nextGame = {
    ...withLongevityState,
    calendar: calendarResult.calendar,
    time: {
      ...(withLongevityState.time ?? {}),
      elapsedMonths: calendarResult.elapsedMonths,
      lastDeltaMonths: timeCost.deltaMonths
    },
    player: {
      ...withLongevityState.player,
      maxLifespan,
      lifespan
    },
    timePressure: {
      calendarLabel: formatCalendarLabel(calendarResult.calendar),
      elapsedYears: Math.floor(calendarResult.elapsedMonths / 12),
      remainingLifespan: lifespan,
      maxLifespan,
      lifespanRatio: maxLifespan > 0 ? lifespan / maxLifespan : 0,
      warningLevel,
      lastDeltaTime: timeCost.label,
      lastLifespanCost: baseLifespanCost,
      lastLongevityGain: longevity.longevityGain,
      lastNetLifespanDelta: netLifespanDelta,
      recentRecoveryFatigue: longevity.recoveryFatigue
    },
    lastActionCost: {
      ...(withLongevityState.lastActionCost ?? {}),
      lifespan: Math.max(0, -netLifespanDelta),
      time: timeCost.deltaMonths,
      timeLabel: timeCost.label
    },
    lastTimeResult: timeResult
  };

  return {
    game: warningLevel === 'ended' ? withLifespanEnding(nextGame) : nextGame,
    timeResult
  };
}

export function buildWarningLevel(player = {}) {
  const lifespan = player.lifespan ?? 0;
  const maxLifespan = Math.max(1, player.maxLifespan ?? lifespan);
  const ratio = lifespan / maxLifespan;

  if (lifespan <= 0) return 'ended';
  if (ratio <= 0.15) return 'critical';
  if (ratio <= 0.45) return 'danger';
  if (ratio <= 0.60) return 'strained';
  return 'steady';
}

function emptyTimeResult(game) {
  return {
    category: 'tutorial',
    deltaMonths: 0,
    label: '片刻',
    baseLifespanCost: 0,
    longevityGain: 0,
    netLifespanDelta: 0,
    maxLifespanDelta: 0,
    warningLevel: buildWarningLevel(game.player),
    recoveryFatigue: 0,
    note: ''
  };
}

function withLifespanEnding(game) {
  const ending = createLifespanEnding(game);
  return {
    ...game,
    ending,
    storyProgress: game.storyProgress
      ? { ...game.storyProgress, status: 'ended', endingId: ending.type }
      : game.storyProgress
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
