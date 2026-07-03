export const REALM_COSTS = {
  炼气: 1,
  筑基: 2,
  金丹: 4,
  元婴: 8,
  化神: 12
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
