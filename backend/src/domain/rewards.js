import { deriveMaxHealth, deriveMaxLifespan } from './attributes.js';

export const TREASURE_CATALOG = {
  calm_lotus_incense: {
    id: 'calm_lotus_incense',
    name: '静心莲香',
    rarity: '良品',
    description: '点燃后可令识海宁静，突破时更易定神。',
    bonuses: { breakthroughChance: 3 }
  },
  tiger_bone_guard: {
    id: 'tiger_bone_guard',
    name: '虎骨护腕',
    rarity: '良品',
    description: '赤焰虎骨制成，大幅增强体魄。',
    bonuses: { damageReduction: 8, maxHealth: 8 }
  }
};

export const TECHNIQUE_CATALOG = {
  qingmu_jue: {
    id: 'qingmu_jue',
    name: '青木诀',
    grade: '凡品',
    type: '心法',
    level: 1,
    description: '以木息滋养经脉。',
    bonuses: { cultivationGain: 6, maxHealth: 6 }
  },
  mist_step: {
    id: 'mist_step',
    name: '雾隐步',
    grade: '良品',
    type: '身法',
    level: 1,
    description: '借雾线藏身，秘境中更易避开杀机。',
    bonuses: { damageReduction: 5, breakthroughChance: 2 }
  }
};

export function grantTreasure(game, id) {
  const treasure = TREASURE_CATALOG[id];
  if (!treasure) {
    throw new Error(`RULE_EFFECT_INVALID:treasure:${id}`);
  }

  const treasures = normalizeRewards(game.treasures, TREASURE_CATALOG);
  if (treasures.some((entry) => entry.id === id)) {
    return syncRewardState({ ...game, treasures });
  }

  return syncRewardState({
    ...game,
    treasures: [...treasures, treasure]
  });
}

export function grantTechnique(game, id) {
  const technique = TECHNIQUE_CATALOG[id];
  if (!technique) {
    throw new Error(`RULE_EFFECT_INVALID:technique:${id}`);
  }

  const techniques = normalizeRewards(game.techniques, TECHNIQUE_CATALOG);
  if (techniques.some((entry) => entry.id === id)) {
    return syncRewardState({ ...game, techniques });
  }

  return syncRewardState({
    ...game,
    techniques: [...techniques, technique]
  });
}

export function calculateDerivedBonuses(game) {
  const derivedBonuses = {};

  for (const reward of [
    ...normalizeRewards(game.treasures, TREASURE_CATALOG),
    ...normalizeRewards(game.techniques, TECHNIQUE_CATALOG)
  ]) {
    for (const [key, value] of Object.entries(reward.bonuses ?? {})) {
      derivedBonuses[key] = (derivedBonuses[key] ?? 0) + value;
    }
  }

  return derivedBonuses;
}

function normalizeRewards(entries, catalog) {
  return (entries ?? []).map((entry) => {
    if (typeof entry === 'string') {
      const reward = catalog[entry];
      if (!reward) {
        throw new Error(`RULE_EFFECT_INVALID:reward:${entry}`);
      }
      return reward;
    }

    return catalog[entry?.id] ?? entry;
  });
}

function syncRewardState(game) {
  const treasures = normalizeRewards(game.treasures, TREASURE_CATALOG);
  const techniques = normalizeRewards(game.techniques, TECHNIQUE_CATALOG);
  const derivedBonuses = calculateDerivedBonuses({ ...game, treasures, techniques });

  if (!game.player) {
    return { ...game, treasures, techniques, derivedBonuses };
  }

  const attributeState = game.character?.attributes;
  const player = { ...game.player };

  if (attributeState || game.player.maxHealth !== undefined) {
    const baseMaxHealth = attributeState
      ? deriveMaxHealth(attributeState)
      : game.player.maxHealth;
    const maxHealth = baseMaxHealth + (derivedBonuses.maxHealth ?? 0);
    player.maxHealth = maxHealth;
    player.health = clamp(game.player.health ?? 0, 0, maxHealth);
  }

  if (attributeState || game.player.maxLifespan !== undefined) {
    const baseMaxLifespan = attributeState
      ? deriveMaxLifespan(game.character?.initialLifespan ?? game.player.maxLifespan, attributeState)
      : game.player.maxLifespan;
    const maxLifespan = baseMaxLifespan + (derivedBonuses.maxLifespan ?? 0);
    player.maxLifespan = maxLifespan;
    player.lifespan = clamp(game.player.lifespan ?? 0, 0, maxLifespan);
  }

  return {
    ...game,
    treasures,
    techniques,
    derivedBonuses,
    player
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
