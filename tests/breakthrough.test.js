import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame } from '../src/engine.js';
import { applyCharacterToGame, rollCharacter } from '../backend/src/domain/characterCreation.js';
import {
  calculateBreakthroughChance,
  canAttemptBreakthrough,
  resolveBreakthrough
} from '../backend/src/domain/progression.js';
import { grantTechnique, grantTreasure } from '../backend/src/domain/rewards.js';

function createFormalGame({
  seed = 41,
  progress = 100,
  qi = 50,
  mood = 50,
  realm = '炼气一层',
  attributes
} = {}) {
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
      realm,
      qi,
      mood,
      cultivationProgress: progress
    }
  };
}

test('progress below 100 cannot attempt breakthrough', () => {
  const game = createFormalGame({ progress: 99 });

  assert.equal(canAttemptBreakthrough(game), false);
});

test('at 100 progress the breakthrough preview includes target realm chance and failure cost', () => {
  const game = createFormalGame();
  const preview = calculateBreakthroughChance(game);

  assert.equal(canAttemptBreakthrough(game), true);
  assert.deepEqual(preview, {
    targetRealm: '炼气二层',
    chance: 82,
    failureCost: {
      health: 18,
      lifespan: 1,
      progressLoss: 40
    },
    expectedTimeLabel: '半年',
    successLongevity: 2,
    successMaxLifespan: 1
  });
});

test('higher comprehension rootBone and willpower increase breakthrough chance', () => {
  const low = createFormalGame({
    attributes: {
      rootBone: 2,
      comprehension: 2,
      fortune: 9,
      willpower: 2,
      lifeSeed: 10
    }
  });
  const high = createFormalGame({
    attributes: {
      rootBone: 7,
      comprehension: 7,
      fortune: 3,
      willpower: 7,
      lifeSeed: 1
    }
  });

  assert.ok(calculateBreakthroughChance(high).chance > calculateBreakthroughChance(low).chance);
});

test('treasure and technique bonuses increase breakthrough chance', () => {
  const base = createFormalGame();
  const withTreasure = grantTreasure(base, 'calm_lotus_incense');
  const withRewards = grantTechnique(withTreasure, 'mist_step');

  assert.equal(calculateBreakthroughChance(withRewards).chance, calculateBreakthroughChance(base).chance + 5);
});

test('deterministic breakthrough seeds can produce both success and failure', () => {
  const success = resolveBreakthrough(createFormalGame({ seed: 52 }), new Date('2026-07-01T08:00:00.000Z'));
  const failure = resolveBreakthrough(createFormalGame({ seed: 98 }), new Date('2026-07-01T08:00:00.000Z'));

  assert.equal(success.ruleResult.success, true);
  assert.equal(success.game.player.realm, '炼气二层');
  assert.equal(success.game.player.cultivationProgress, 0);

  assert.equal(failure.ruleResult.success, false);
  assert.equal(failure.game.player.realm, '炼气一层');
});

test('later breakthrough attempts vary the deterministic roll for the same character', () => {
  const base = createFormalGame({ seed: 52 });
  const first = resolveBreakthrough(base, new Date('2026-07-01T08:00:00.000Z'));
  const laterAttempt = {
    ...base,
    turn: 7,
    cooldowns: {
      ...base.cooldowns,
      breakthrough_attempt: first.game.turn
    }
  };
  const second = resolveBreakthrough(laterAttempt, new Date('2026-07-08T08:00:00.000Z'));

  assert.notEqual(second.ruleResult.roll, first.ruleResult.roll);
});

test('failed breakthroughs cost health and lifespan and roll cultivation progress back', () => {
  const base = createFormalGame({ seed: 98 });
  const result = resolveBreakthrough(base, new Date('2026-07-01T08:00:00.000Z'));

  assert.equal(result.ruleResult.success, false);
  assert.equal(result.entry.npcLine, '');
  assert.equal(result.game.player.health, base.player.health - 18);
  assert.equal(result.game.player.lifespan, base.player.lifespan - 3);
  assert.equal(result.game.player.cultivationProgress, 60);
});

test('successful breakthroughs spend time and restore lifespan', () => {
  const baseGame = createFormalGame({ seed: 52, realm: '炼气九层' });
  const base = {
    ...baseGame,
    time: { elapsedMonths: 24 },
    player: {
      ...baseGame.player,
      realm: '炼气九层',
      lifespan: 40,
      maxLifespan: 100,
      cultivationProgress: 100
    }
  };
  const result = resolveBreakthrough(base, new Date('2026-07-01T08:00:00.000Z'));

  assert.equal(result.ruleResult.success, true);
  assert.equal(result.game.player.realm, '筑基初期');
  assert.equal(result.game.player.maxLifespan, 140);
  assert.equal(result.game.player.lifespan > 40, true);
  assert.equal(result.ruleResult.timeResult.label, '半年');
  assert.equal(result.ruleResult.timeResult.maxLifespanDelta, 40);
});

test('breakthrough preview includes expected time and success lifespan rewards', () => {
  const preview = calculateBreakthroughChance(createFormalGame({ realm: '炼气九层' }));

  assert.equal(preview.expectedTimeLabel, '半年');
  assert.equal(preview.successLongevity, 25);
  assert.equal(preview.successMaxLifespan, 40);
});
