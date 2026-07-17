import { calculateBreakthroughLongevityReward } from './time/longevity.js';
import { calculateActionTimeCost } from './time/timeCost.js';
import { applyTimePressure } from './time/timePressure.js';
import { calculateLifespanCost, getRealmTier } from './realmRules.js';
import { calculateDerivedBonuses } from './rewards.js';

export { calculateLifespanCost, getRealmTier };

const BREAKTHROUGH_BASE_CHANCE = {
  炼气: 55,
  筑基: 40,
  金丹: 28,
  元婴: 18,
  化神: 10
};

const BREAKTHROUGH_FAILURE_COSTS = {
  炼气: { health: 18, lifespan: 1, progressLoss: 40 },
  筑基: { health: 24, lifespan: 2, progressLoss: 45 },
  金丹: { health: 32, lifespan: 4, progressLoss: 50 },
  元婴: { health: 40, lifespan: 8, progressLoss: 60 },
  化神: { health: 52, lifespan: 12, progressLoss: 65 }
};

export const REALM_ORDER = [
  '炼气一层', '炼气二层', '炼气三层', '炼气四层', '炼气五层',
  '炼气六层', '炼气七层', '炼气八层', '炼气九层',
  '筑基初期', '筑基中期', '筑基后期',
  '金丹初期', '金丹中期', '金丹后期',
  '元婴初期', '元婴中期', '元婴后期',
  '化神初期', '化神中期', '化神后期'
];

export function compareRealms(left = '', right = '') {
  return REALM_ORDER.indexOf(left) - REALM_ORDER.indexOf(right);
}

const breakthroughRealmOrder = REALM_ORDER.slice(0, REALM_ORDER.indexOf('化神初期') + 1);
const REALM_ADVANCEMENT = Object.fromEntries(
  breakthroughRealmOrder.slice(0, -1).map((realm, index) => [realm, breakthroughRealmOrder[index + 1]])
);

export function applyActionCost(game) {
  const cost = calculateLifespanCost(game);

  return {
    ...game,
    player: {
      ...game.player,
      lifespan: Math.max(0, (game.player?.lifespan ?? 0) - cost)
    },
    lastActionCost: {
      lifespan: cost
    }
  };
}

export function canAttemptBreakthrough(game) {
  return (game.player?.cultivationProgress ?? 0) >= 100 && nextRealm(game.player?.realm) !== game.player?.realm;
}

export function calculateBreakthroughChance(game) {
  const attributes = game.character?.attributes ?? {};
  const bonuses = calculateDerivedBonuses(game);
  const base = realmBaseChance(game.player?.realm);
  const targetRealm = nextRealm(game.player?.realm);
  const attributeBonus = (attributes.comprehension ?? 0) * 2
    + (attributes.rootBone ?? 0)
    + (attributes.willpower ?? 0)
    + Math.floor((attributes.fortune ?? 0) / 2);
  const stateBonus = Math.floor((game.player?.mood ?? 0) / 20)
    + Math.floor((game.player?.qi ?? 0) / 25);
  const penalty = breakthroughPenalty(game);
  const chance = clamp(base + attributeBonus + stateBonus + (bonuses.breakthroughChance ?? 0) - penalty, 5, 95);
  const expectedTime = calculateActionTimeCost({ game, category: 'breakthrough', command: '尝试突破' });
  const successReward = calculateBreakthroughLongevityReward({
    fromRealm: game.player?.realm,
    targetRealm,
    success: true
  });

  return {
    targetRealm,
    chance,
    failureCost: describeFailureCost(game),
    expectedTimeLabel: expectedTime.label,
    successLongevity: successReward.longevityGain,
    successMaxLifespan: successReward.maxLifespanDelta
  };
}

export function resolveBreakthrough(game, now) {
  if (!canAttemptBreakthrough(game)) {
    throw new Error('BREAKTHROUGH_NOT_READY');
  }

  const preview = calculateBreakthroughChance(game);
  const roll = breakthroughRoll(game);
  const success = roll < preview.chance;
  const fromRealm = game.player?.realm;
  const playerAfterBreakthrough = success
    ? {
      ...game.player,
      realm: preview.targetRealm,
      cultivationProgress: 0
    }
    : applyBreakthroughFailure(game.player, preview.failureCost);
  const pressure = applyTimePressure({
    game: { ...game, player: playerAfterBreakthrough },
    timeGame: game,
    action: { title: '尝试突破', command: '尝试突破', source: 'breakthrough' },
    command: '尝试突破',
    category: 'breakthrough',
    source: 'breakthrough',
    extraLifespanDamage: success ? 0 : preview.failureCost.lifespan,
    breakthrough: {
      fromRealm,
      targetRealm: preview.targetRealm,
      success
    }
  });
  const lastActionCost = {
    lifespan: Math.max(0, -(pressure.timeResult?.netLifespanDelta ?? 0)),
    time: pressure.timeResult?.deltaMonths ?? 0,
    timeLabel: pressure.timeResult?.label ?? ''
  };
  const failureTier = getRealmTier(game.player?.realm);
  const previousStats = {
    breakthroughFailures: game.progressionStats?.breakthroughFailures ?? 0,
    breakthroughFailuresByTier: { ...(game.progressionStats?.breakthroughFailuresByTier ?? {}) }
  };
  const progressionStats = success ? previousStats : {
    breakthroughFailures: previousStats.breakthroughFailures + 1,
    breakthroughFailuresByTier: {
      ...previousStats.breakthroughFailuresByTier,
      [failureTier]: (previousStats.breakthroughFailuresByTier[failureTier] ?? 0) + 1
    }
  };
  const turn = game.turn + 1;
  const title = success ? '突破成功' : '突破受挫';
  const body = success
    ? `你抓住气机，一举踏入${preview.targetRealm}。`
    : `气机在经脉间反噬，你未能踏入${preview.targetRealm}。`;
  const entry = {
    id: `turn-${turn}`,
    title,
    command: '尝试突破',
    body,
    npcLine: '',
    worldEvent: title
  };

  return {
    game: {
      ...pressure.game,
      turn,
      version: turn,
      progressionStats,
      lastActionCost,
      log: [...pressure.game.log, entry],
      timeline: [...pressure.game.timeline, { type: 'cultivation', title, detail: body }],
      worldEvents: [...pressure.game.worldEvents, { title, detail: body, turn }],
      cooldowns: { ...pressure.game.cooldowns, breakthrough_attempt: turn }
    },
    entry,
    outcome: {
      text: body
    },
    ruleResult: {
      success,
      source: 'breakthrough',
      eventId: 'breakthrough_attempt',
      choiceId: 'attempt',
      resolvedAt: now.toISOString(),
      chance: preview.chance,
      roll,
      targetRealm: preview.targetRealm,
      lifespanCost: lastActionCost.lifespan,
      timeResult: pressure.timeResult
    }
  };
}

function realmBaseChance(realm = '') {
  return BREAKTHROUGH_BASE_CHANCE[getRealmTier(realm)] ?? BREAKTHROUGH_BASE_CHANCE.炼气;
}

function breakthroughPenalty(game) {
  const maxHealth = game.player?.maxHealth ?? game.player?.health ?? 0;
  const missingHealth = Math.max(0, maxHealth - (game.player?.health ?? maxHealth));
  const maxLifespan = game.player?.maxLifespan ?? game.player?.lifespan ?? 0;
  const missingLifespan = Math.max(0, maxLifespan - (game.player?.lifespan ?? maxLifespan));

  return Math.floor((missingHealth / Math.max(1, maxHealth)) * 20)
    + Math.floor((missingLifespan / Math.max(1, maxLifespan)) * 15);
}

function describeFailureCost(game) {
  const failureCost = BREAKTHROUGH_FAILURE_COSTS[getRealmTier(game.player?.realm)];
  const mitigation = Math.floor((calculateDerivedBonuses(game).damageReduction ?? 0) / 2);

  return {
    ...failureCost,
    health: Math.max(1, failureCost.health - mitigation)
  };
}

function nextRealm(realm = '') {
  return REALM_ADVANCEMENT[realm] ?? realm;
}

function breakthroughRoll(game) {
  const baseSeed = numericSeed(game.characterSeed ?? game.seed ?? 1);
  const turnSalt = numericSeed(game.turn ?? 0) * 37;
  const previousAttemptSalt = numericSeed(game.cooldowns?.breakthrough_attempt ?? 0) * 17;

  return Math.abs(baseSeed + turnSalt + previousAttemptSalt) % 100;
}

function applyBreakthroughFailure(player, failureCost) {
  const maxHealth = player?.maxHealth ?? player?.health ?? 0;

  return {
    ...player,
    health: clamp((player?.health ?? maxHealth) - failureCost.health, 0, maxHealth),
    cultivationProgress: clamp((player?.cultivationProgress ?? 0) - failureCost.progressLoss, 0, 100)
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function numericSeed(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number) : 1;
}
