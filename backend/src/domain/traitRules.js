export const TRAIT_EFFECTS = Object.freeze({
  早慧: Object.freeze({ breakthroughChance: 3 }),
  命火绵长: Object.freeze({ maxLifespan: 8 }),
  经脉坚韧: Object.freeze({ healthDamageTakenPercent: -10 }),
  福缘深厚: Object.freeze({ startingSpiritStones: 12 }),
  灵根不稳: Object.freeze({ cultivationGain: -1 }),
  心魔易感: Object.freeze({ breakthroughChance: -5 }),
  丹道亲和: Object.freeze({ medicineLongevityGain: 1 }),
  剑心微明: Object.freeze({ breakthroughChance: 2 }),
  听风识气: Object.freeze({ cultivationGain: 1 }),
  静水心境: Object.freeze({ lifespanCostReduction: 1 }),
  百折不屈: Object.freeze({ healthDamageTakenPercent: -5 }),
  旧缘未断: Object.freeze({ startingSectRelation: 5 }),
  梦中观星: Object.freeze({ breakthroughChance: 2 }),
  血脉隐秘: Object.freeze({ maxHealth: 4 }),
  孤煞随身: Object.freeze({ healthDamageTakenPercent: 5 }),
  因果缠身: Object.freeze({ lifespanCostReduction: -1 }),
  贪念难消: Object.freeze({ startingMood: -5 }),
  兵刃亲和: Object.freeze({ healthDamageTakenPercent: -4 }),
  符箓悟性: Object.freeze({ cultivationGain: 1 }),
  阵道敏锐: Object.freeze({ breakthroughChance: 2 }),
  灵兽亲和: Object.freeze({ startingMood: 4 }),
  天生长息: Object.freeze({ maxLifespan: 5 }),
  命宫有缺: Object.freeze({ maxLifespan: -6 }),
  神魂易伤: Object.freeze({ healthDamageTakenPercent: 10 })
});

export function calculateTraitBonuses(gameOrCharacter = {}) {
  const character = gameOrCharacter?.character ?? gameOrCharacter;
  const traits = Array.isArray(character?.traits) ? character.traits : [];
  const bonuses = {};

  for (const trait of traits) {
    const effect = TRAIT_EFFECTS[trait];
    if (!effect) continue;
    for (const [key, value] of Object.entries(effect)) {
      bonuses[key] = (bonuses[key] ?? 0) + value;
    }
  }

  return bonuses;
}
