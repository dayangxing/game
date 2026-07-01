const REALM_COSTS = {
  炼气: 1,
  筑基: 2,
  金丹: 4,
  元婴: 8
};

const BREAKTHROUGH_BASE_CHANCE = {
  炼气: 55,
  筑基: 40,
  金丹: 28,
  元婴: 18
};

const BREAKTHROUGH_FAILURE_COSTS = {
  炼气: { health: 18, lifespan: 1, progressLoss: 40 },
  筑基: { health: 24, lifespan: 2, progressLoss: 45 },
  金丹: { health: 32, lifespan: 4, progressLoss: 50 },
  元婴: { health: 40, lifespan: 8, progressLoss: 60 }
};

const REALM_ADVANCEMENT = {
  '炼气一层': '炼气二层',
  '炼气二层': '炼气三层',
  '炼气三层': '炼气四层',
  '炼气四层': '炼气五层',
  '炼气五层': '炼气六层',
  '炼气六层': '炼气七层',
  '炼气七层': '炼气八层',
  '炼气八层': '炼气九层',
  '炼气九层': '筑基初期',
  '筑基初期': '筑基中期',
  '筑基中期': '筑基后期',
  '筑基后期': '金丹初期',
  '金丹初期': '金丹中期',
  '金丹中期': '金丹后期',
  '金丹后期': '元婴初期',
  '元婴初期': '元婴中期',
  '元婴中期': '元婴后期',
  '元婴后期': '化神初期'
};

export function getRealmTier(realm = '') {
  return Object.keys(REALM_COSTS).find((tier) => realm.includes(tier)) ?? '炼气';
}

export function calculateLifespanCost(game) {
  const tier = getRealmTier(game.player?.realm);
  const base = REALM_COSTS[tier];
  const lifeSeed = game.character?.attributes?.lifeSeed ?? 1;
  const reduction = Math.floor(lifeSeed / 4) + (game.derivedBonuses?.lifespanCostReduction ?? 0);

  return Math.max(1, base - reduction);
}

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
  const bonuses = game.derivedBonuses ?? {};
  const base = realmBaseChance(game.player?.realm);
  const attributeBonus = (attributes.comprehension ?? 0) * 2
    + (attributes.rootBone ?? 0)
    + (attributes.willpower ?? 0)
    + Math.floor((attributes.fortune ?? 0) / 2);
  const stateBonus = Math.floor((game.player?.mood ?? 0) / 20)
    + Math.floor((game.player?.qi ?? 0) / 25);
  const penalty = breakthroughPenalty(game);
  const chance = clamp(base + attributeBonus + stateBonus + (bonuses.breakthroughChance ?? 0) - penalty, 5, 95);

  return {
    targetRealm: nextRealm(game.player?.realm),
    chance,
    failureCost: describeFailureCost(game)
  };
}

export function resolveBreakthrough(game, now) {
  if (!canAttemptBreakthrough(game)) {
    throw new Error('BREAKTHROUGH_NOT_READY');
  }

  const preview = calculateBreakthroughChance(game);
  const afterActionCost = applyActionCost(game);
  const roll = breakthroughRoll(game);
  const success = roll < preview.chance;
  const player = success
    ? {
      ...afterActionCost.player,
      realm: preview.targetRealm,
      cultivationProgress: 0
    }
    : applyBreakthroughFailure(afterActionCost.player, preview.failureCost);
  const lastActionCost = success
    ? afterActionCost.lastActionCost
    : {
      lifespan: (afterActionCost.lastActionCost?.lifespan ?? 0) + preview.failureCost.lifespan
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
    npcLine: success
      ? '玄衡长老微微颔首：“既已破境，更要守住心火。”'
      : '玄衡长老沉声道：“先稳住命火，再谈下一次冲关。”',
    worldEvent: title
  };

  return {
    game: {
      ...afterActionCost,
      player,
      turn,
      version: turn,
      lastActionCost,
      log: [...afterActionCost.log, entry],
      timeline: [...afterActionCost.timeline, { type: 'cultivation', title, detail: body }],
      worldEvents: [...afterActionCost.worldEvents, { title, detail: body, turn }],
      cooldowns: { ...afterActionCost.cooldowns, breakthrough_attempt: turn }
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
      lifespanCost: lastActionCost.lifespan
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
  return { ...BREAKTHROUGH_FAILURE_COSTS[getRealmTier(game.player?.realm)] };
}

function nextRealm(realm = '') {
  return REALM_ADVANCEMENT[realm] ?? realm;
}

function breakthroughRoll(game) {
  return Math.abs(Math.floor(game.characterSeed ?? game.seed ?? 1)) % 100;
}

function applyBreakthroughFailure(player, failureCost) {
  const maxHealth = player?.maxHealth ?? player?.health ?? 0;
  const maxLifespan = player?.maxLifespan ?? player?.lifespan ?? 0;

  return {
    ...player,
    health: clamp((player?.health ?? maxHealth) - failureCost.health, 0, maxHealth),
    lifespan: clamp((player?.lifespan ?? maxLifespan) - failureCost.lifespan, 0, maxLifespan),
    cultivationProgress: clamp((player?.cultivationProgress ?? 0) - failureCost.progressLoss, 0, 100)
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
