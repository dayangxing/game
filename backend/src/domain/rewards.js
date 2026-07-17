import { deriveMaxHealth, deriveMaxLifespan } from './attributes.js';
import {
  RESONANCE_CATALOG,
  TECHNIQUE_CATALOG,
  TREASURE_CATALOG
} from './resources/resourceCatalog.js';

export { RESONANCE_CATALOG, TECHNIQUE_CATALOG, TREASURE_CATALOG };

export function grantTreasure(game, id) {
  const treasure = TREASURE_CATALOG[id];
  if (!treasure) {
    throw new Error(`RULE_EFFECT_INVALID:treasure:${id}`);
  }

  const treasures = normalizeRewards(game.treasures, TREASURE_CATALOG, { rejectUnknown: false });
  const techniques = normalizeRewards(game.techniques, TECHNIQUE_CATALOG, { rejectUnknown: false });
  const previousDerivedBonuses = calculateDerivedBonuses({ treasures, techniques });
  if (treasures.some((entry) => entry.id === id)) {
    return syncRewardState({ ...game, treasures, techniques }, previousDerivedBonuses);
  }

  return syncRewardState({
    ...game,
    treasures: [...treasures, treasure],
    techniques
  }, previousDerivedBonuses);
}

export function grantTechnique(game, id) {
  const technique = TECHNIQUE_CATALOG[id];
  if (!technique) {
    throw new Error(`RULE_EFFECT_INVALID:technique:${id}`);
  }

  const treasures = normalizeRewards(game.treasures, TREASURE_CATALOG, { rejectUnknown: false });
  const techniques = normalizeRewards(game.techniques, TECHNIQUE_CATALOG, { rejectUnknown: false });
  const previousDerivedBonuses = calculateDerivedBonuses({ treasures, techniques });
  if (techniques.some((entry) => entry.id === id)) {
    return syncRewardState({ ...game, treasures, techniques }, previousDerivedBonuses);
  }

  return syncRewardState({
    ...game,
    treasures,
    techniques: [...techniques, technique]
  }, previousDerivedBonuses);
}

export function calculateDerivedBonuses(game) {
  const derivedBonuses = {};

  for (const reward of resourceEntries(game, { knownOnly: true })) {
    for (const [key, value] of Object.entries(reward.bonuses ?? {})) {
      derivedBonuses[key] = (derivedBonuses[key] ?? 0) + value;
    }
  }

  mergeBonuses(derivedBonuses, calculateResonances(game).bonuses);
  return derivedBonuses;
}

export function calculateResonances(game = {}) {
  const tagCounts = new Map();

  for (const resource of resourceEntries(game, { knownOnly: true })) {
    for (const tag of resource.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const activeResonances = [];
  const bonuses = {};

  for (const resonance of Object.values(RESONANCE_CATALOG)) {
    const count = tagCounts.get(resonance.tag) ?? 0;
    const threshold = Object.values(resonance.thresholds)
      .filter((entry) => count >= entry.count)
      .sort((left, right) => right.count - left.count)[0];
    if (!threshold) continue;

    const active = {
      id: resonance.id,
      name: resonance.name,
      tag: resonance.tag,
      count,
      threshold: threshold.count,
      label: threshold.label,
      effectText: threshold.effectText,
      bonuses: { ...threshold.bonuses }
    };
    activeResonances.push(active);
    mergeBonuses(bonuses, threshold.bonuses);
  }

  return { activeResonances, bonuses };
}

function normalizeRewards(entries, catalog, { rejectUnknown = true } = {}) {
  return (entries ?? []).map((entry) => {
    if (typeof entry === 'string') {
      const reward = catalog[entry];
      if (!reward) {
        if (rejectUnknown) {
          throw new Error(`RULE_EFFECT_INVALID:reward:${entry}`);
        }
        return entry;
      }
      return reward;
    }

    return catalog[entry?.id] ?? entry;
  });
}

function syncRewardState(game, previousDerivedBonuses = game.derivedBonuses ?? {}) {
  const treasures = normalizeRewards(game.treasures, TREASURE_CATALOG, { rejectUnknown: false });
  const techniques = normalizeRewards(game.techniques, TECHNIQUE_CATALOG, { rejectUnknown: false });
  const rewardState = { ...game, treasures, techniques };
  const derivedBonuses = calculateDerivedBonuses(rewardState);
  const activeResonances = calculateResonances(rewardState).activeResonances;
  const resourceRun = {
    ...(game.resourceRun ?? {}),
    activeResonances
  };

  if (!game.player) {
    return { ...game, treasures, techniques, derivedBonuses, resourceRun };
  }

  const attributeState = game.character?.attributes;
  const player = { ...game.player };

  if (attributeState || game.player.maxHealth !== undefined) {
    const baseMaxHealth = attributeState
      ? deriveMaxHealth(attributeState)
      : game.player.maxHealth - (previousDerivedBonuses.maxHealth ?? 0);
    const maxHealth = baseMaxHealth + (derivedBonuses.maxHealth ?? 0);
    player.maxHealth = maxHealth;
    player.health = clamp(game.player.health ?? 0, 0, maxHealth);
  }

  if (attributeState || game.player.maxLifespan !== undefined) {
    const baseMaxLifespan = attributeState
      ? deriveMaxLifespan(game.character?.initialLifespan ?? game.player.maxLifespan, attributeState)
      : game.player.maxLifespan - (previousDerivedBonuses.maxLifespan ?? 0);
    const maxLifespan = baseMaxLifespan + (derivedBonuses.maxLifespan ?? 0);
    player.maxLifespan = maxLifespan;
    player.lifespan = clamp(game.player.lifespan ?? 0, 0, maxLifespan);
  }

  return {
    ...game,
    treasures,
    techniques,
    derivedBonuses,
    resourceRun,
    player
  };
}

function resourceEntries(game = {}, { knownOnly = false } = {}) {
  const entries = [
    ...normalizeRewards(game.treasures, TREASURE_CATALOG, { rejectUnknown: false }),
    ...normalizeRewards(game.techniques, TECHNIQUE_CATALOG, { rejectUnknown: false })
  ];
  const seenKnownIds = new Set();
  const uniqueEntries = entries.filter((entry) => {
    if (!isKnownResource(entry)) return true;
    if (seenKnownIds.has(entry.id)) return false;
    seenKnownIds.add(entry.id);
    return true;
  });

  return knownOnly ? uniqueEntries.filter(isKnownResource) : uniqueEntries;
}

function isKnownResource(resource) {
  return Boolean(resource && (TREASURE_CATALOG[resource.id] || TECHNIQUE_CATALOG[resource.id]));
}

function mergeBonuses(target, source = {}) {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
