import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame } from '../src/engine.js';
import { applyCharacterToGame, rollCharacter } from '../backend/src/domain/characterCreation.js';
import { applyEffects } from '../backend/src/domain/events/effectResolver.js';
import { buildTurnResult } from '../backend/src/domain/turnResult.js';
import { applyActionCost, calculateLifespanCost, getRealmTier } from '../backend/src/domain/progression.js';

function createFormalGame({ seed = 41, attributes, realm = '炼气一层' } = {}) {
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
    onboarding: { completed: true },
    player: {
      ...game.player,
      realm
    }
  };
}

test('lifespan costs scale by realm and never drop below one turn', () => {
  const qiRefining = createFormalGame({
    attributes: {
      rootBone: 6,
      comprehension: 6,
      fortune: 6,
      willpower: 6,
      lifeSeed: 1
    },
    realm: '炼气九层'
  });
  const foundation = {
    ...qiRefining,
    player: {
      ...qiRefining.player,
      realm: '筑基初期'
    }
  };
  const longLived = createFormalGame({
    attributes: {
      rootBone: 5,
      comprehension: 5,
      fortune: 5,
      willpower: 2,
      lifeSeed: 8
    },
    realm: '筑基中期'
  });

  assert.equal(getRealmTier('筑基中期'), '筑基');
  assert.equal(calculateLifespanCost(qiRefining), 1);
  assert.equal(calculateLifespanCost(foundation), 2);
  assert.equal(calculateLifespanCost(longLived), 1);
  assert.equal(calculateLifespanCost({
    ...longLived,
    derivedBonuses: { lifespanCostReduction: 99 }
  }), 1);
});

test('applyActionCost reduces player lifespan and records the deterministic cost', () => {
  const game = createFormalGame({
    attributes: {
      rootBone: 6,
      comprehension: 6,
      fortune: 6,
      willpower: 6,
      lifeSeed: 1
    },
    realm: '筑基初期'
  });
  const next = applyActionCost(game);

  assert.equal(next.player.lifespan, game.player.lifespan - 2);
  assert.deepEqual(next.lastActionCost, { lifespan: 2 });
});

test('vitality effects clamp health within the current max health', () => {
  const base = createFormalGame();
  const injured = {
    ...base,
    player: {
      ...base.player,
      health: base.player.maxHealth - 5
    }
  };
  const healed = applyEffects(injured, [{ type: 'vitality', delta: 999 }]);
  const broken = applyEffects(injured, [{ type: 'vitality', delta: -999 }]);

  assert.equal(healed.player.health, injured.player.maxHealth);
  assert.equal(broken.player.health, 0);
});

test('attribute effects clamp allocations and recalculate derived max stats', () => {
  const base = createFormalGame();
  const next = applyEffects(base, [
    { type: 'attribute', key: 'rootBone', delta: 2 },
    { type: 'attribute', key: 'lifeSeed', delta: 3 },
    { type: 'attribute', key: 'fortune', delta: -10 }
  ]);

  assert.deepEqual(next.character.attributes, {
    rootBone: 6,
    comprehension: 5,
    fortune: 1,
    willpower: 6,
    lifeSeed: 7
  });
  assert.equal(next.character.comprehension, 45);
  assert.equal(next.character.physique, 54);
  assert.equal(next.character.luck, 9);
  assert.equal(next.player.maxHealth, 142);
  assert.equal(next.player.maxLifespan, base.character.initialLifespan + 56);
});

test('turn results include health and lifespan stat deltas after progression effects', () => {
  const before = createFormalGame();
  const after = applyEffects(before, [
    { type: 'vitality', delta: -18 },
    { type: 'maxHealth', delta: -12 },
    { type: 'lifespan', delta: -4 },
    { type: 'maxLifespan', delta: -7 }
  ]);
  const turnResult = buildTurnResult({
    before,
    after,
    actionId: 'test-action',
    narration: {
      title: '命火试炼',
      body: '体魄与寿元一并波动。',
      npcLine: '玄衡长老道：“先看结果。”',
      foreshadow: ''
    }
  });

  assert.deepEqual(turnResult.ruleResult.statChanges, {
    health: -18,
    maxHealth: -12,
    lifespan: -4,
    maxLifespan: -7
  });
});
