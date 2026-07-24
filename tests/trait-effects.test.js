import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame } from '../src/engine.js';
import { deriveMaxHealth, deriveMaxLifespan } from '../backend/src/domain/attributes.js';
import { applyCharacterToGame, rollCharacter } from '../backend/src/domain/characterCreation.js';
import { applyEffects } from '../backend/src/domain/events/effectResolver.js';
import { calculateLifespanCost } from '../backend/src/domain/realmRules.js';
import { calculateBreakthroughChance } from '../backend/src/domain/progression.js';
import { calculateDerivedBonuses } from '../backend/src/domain/rewards.js';
import { TRAIT_EFFECTS } from '../backend/src/domain/traitRules.js';

function gameWithTraits(traits) {
  const base = createGame(31);
  return {
    ...base,
    onboarding: { completed: true },
    character: {
      attributes: {
        rootBone: 5,
        comprehension: 5,
        fortune: 5,
        willpower: 5,
        lifeSeed: 1
      },
      traits,
      initialLifespan: 100
    },
    player: {
      ...base.player,
      realm: '筑基初期',
      health: 100,
      maxHealth: 100,
      lifespan: 80,
      maxLifespan: 100,
      cultivationProgress: 100
    }
  };
}

test('every generated trait has one bounded base effect', () => {
  assert.equal(Object.keys(TRAIT_EFFECTS).length, 24);
  assert.ok(Object.values(TRAIT_EFFECTS).every((effect) => Object.keys(effect).length === 1));
});

test('trait effects aggregate into the existing derived bonus system', () => {
  const bonuses = calculateDerivedBonuses(gameWithTraits([
    '早慧', '命火绵长', '经脉坚韧', '福缘深厚', '灵根不稳', '丹道亲和'
  ]));

  assert.equal(bonuses.breakthroughChance, 3);
  assert.equal(bonuses.maxLifespan, 8);
  assert.equal(bonuses.healthDamageTakenPercent, -10);
  assert.equal(bonuses.startingSpiritStones, 12);
  assert.equal(bonuses.cultivationGain, -1);
  assert.equal(bonuses.medicineLongevityGain, 1);
});

test('negative and positive injury traits change health damage without removing all damage', () => {
  const resilient = applyEffects(gameWithTraits(['经脉坚韧']), [{ type: 'vitality', delta: -10 }]);
  const vulnerable = applyEffects(gameWithTraits(['神魂易伤']), [{ type: 'vitality', delta: -10 }]);

  assert.equal(resilient.player.health, 91);
  assert.equal(vulnerable.player.health, 89);
});

test('traits affect lifespan cost and breakthrough preview', () => {
  const base = gameWithTraits([]);
  const calm = gameWithTraits(['静水心境']);
  const debt = gameWithTraits(['因果缠身']);
  const early = gameWithTraits(['早慧']);

  assert.equal(calculateLifespanCost(base), 2);
  assert.equal(calculateLifespanCost(calm), 1);
  assert.equal(calculateLifespanCost(debt), 3);
  assert.equal(calculateBreakthroughChance(early).chance, calculateBreakthroughChance(base).chance + 3);
});

test('formal character creation applies starting trait bonuses to player state', () => {
  const attributes = {
    rootBone: 7,
    comprehension: 6,
    fortune: 4,
    willpower: 4,
    lifeSeed: 4
  };
  const rolled = rollCharacter({ seed: 52, name: '顾清河', attributes });
  const character = {
    ...rolled,
    traits: ['血脉隐秘', '命火绵长', '福缘深厚', '旧缘未断', '贪念难消']
  };
  const game = applyCharacterToGame(createGame(52), character, 52);

  assert.equal(game.player.maxHealth, deriveMaxHealth(attributes) + 4);
  assert.equal(game.player.maxLifespan, deriveMaxLifespan(character.initialLifespan, attributes) + 8);
  assert.equal(game.player.spiritStones, character.startingResources.spiritStones + 12);
  assert.equal(game.player.mood, 45);
  assert.equal(game.player.sectRelation, 5);
});
