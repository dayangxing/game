import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveMaxHealth } from '../backend/src/domain/attributes.js';
import { createGame } from '../src/engine.js';
import { applyCharacterToGame, rollCharacter } from '../backend/src/domain/characterCreation.js';
import { applyEffects } from '../backend/src/domain/events/effectResolver.js';
import {
  TECHNIQUE_CATALOG,
  TREASURE_CATALOG,
  calculateDerivedBonuses,
  grantTechnique,
  grantTreasure
} from '../backend/src/domain/rewards.js';

function createFormalGame({ seed = 57, attributes } = {}) {
  const character = rollCharacter({
    seed,
    name: '顾清河',
    attributes: attributes ?? {
      rootBone: 4,
      comprehension: 5,
      fortune: 6,
      willpower: 6,
      lifeSeed: 4
    }
  });
  const game = applyCharacterToGame(createGame(seed), character, seed);

  return {
    ...game,
    onboarding: { completed: true }
  };
}

test('grantTreasure adds the seeded treasure and updates derived breakthrough chance', () => {
  const base = createFormalGame();
  const next = grantTreasure(base, 'calm_lotus_incense');

  assert.deepEqual(next.treasures, [TREASURE_CATALOG.calm_lotus_incense]);
  assert.equal(next.treasures[0].name, '静心莲香');
  assert.equal(next.derivedBonuses.breakthroughChance, 3);
});

test('grantTreasure does not duplicate the same treasure twice', () => {
  const base = createFormalGame();
  const once = grantTreasure(base, 'calm_lotus_incense');
  const twice = grantTreasure(once, 'calm_lotus_incense');

  assert.equal(twice.treasures.length, 1);
  assert.deepEqual(twice.treasures, once.treasures);
});

test('grantTechnique adds the seeded technique and updates cultivation gain bonuses', () => {
  const base = createFormalGame();
  const next = grantTechnique(base, 'qingmu_jue');

  assert.deepEqual(next.techniques, [TECHNIQUE_CATALOG.qingmu_jue]);
  assert.equal(next.techniques[0].name, '青木诀');
  assert.equal(next.derivedBonuses.cultivationGain, 6);
  assert.equal(next.player.maxHealth, base.player.maxHealth + 6);
});

test('calculateDerivedBonuses sums resource and resonance bonuses together', () => {
  const game = {
    ...createFormalGame(),
    treasures: [TREASURE_CATALOG.calm_lotus_incense, TREASURE_CATALOG.tiger_bone_guard],
    techniques: [TECHNIQUE_CATALOG.qingmu_jue, TECHNIQUE_CATALOG.mist_step]
  };

  assert.deepEqual(calculateDerivedBonuses(game), {
    breakthroughChance: 7,
    cultivationGain: 6,
    damageReduction: 13,
    maxHealth: 14,
    maxLifespan: 4
  });
});

test('attribute recalculations preserve reward-derived max health bonuses', () => {
  const base = grantTechnique(createFormalGame(), 'qingmu_jue');
  const next = applyEffects(base, [{ type: 'attribute', key: 'rootBone', delta: 1 }]);

  assert.equal(next.derivedBonuses.maxHealth, 6);
  assert.equal(next.player.maxHealth, deriveMaxHealth(next.character.attributes) + 6);
});

test('legacy max-stat saves add reward bonuses only once when attributes are absent', () => {
  const base = {
    ...createGame(91),
    onboarding: { completed: true },
    player: {
      ...createGame(91).player,
      maxHealth: 100,
      health: 100,
      maxLifespan: 80,
      lifespan: 80
    },
    character: {
      ...createGame(91).character,
      initialLifespan: 80
    }
  };

  const afterTechnique = grantTechnique(base, 'qingmu_jue');
  const afterTreasure = grantTreasure(afterTechnique, 'tiger_bone_guard');

  assert.equal(afterTechnique.player.maxHealth, 106);
  assert.equal(afterTreasure.derivedBonuses.maxHealth, 14);
  assert.equal(afterTreasure.player.maxHealth, 114);
  assert.equal(afterTreasure.player.maxLifespan, 80);
});
