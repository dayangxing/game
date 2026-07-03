import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyLongevityState,
  calculateBreakthroughLongevityReward,
  calculateLongevityChange
} from '../backend/src/domain/time/longevity.js';
import { createGame } from '../src/engine.js';

function gameWithPlayer(overrides = {}) {
  const base = createGame(31);
  return {
    ...base,
    onboarding: { completed: true },
    character: {
      ...base.character,
      attributes: { rootBone: 5, comprehension: 5, fortune: 5, willpower: 5, lifeSeed: 5 }
    },
    player: {
      ...base.player,
      lifespan: 80,
      maxLifespan: 120,
      realm: '炼气七层',
      ...overrides.player
    },
    longevity: overrides.longevity ?? {}
  };
}

test('lifespan up hints restore current lifespan but not max lifespan by default', () => {
  const game = gameWithPlayer();
  const result = calculateLongevityChange({
    game,
    category: 'cultivation',
    effectHints: [{ target: 'lifespan', direction: 'up', intensity: 'small' }]
  });

  assert.equal(result.longevityGain > 0, true);
  assert.equal(result.maxLifespanDelta, 0);
  assert.equal(result.recoverySource, 'rest');
});

test('repeated rest triggers recovery fatigue and lowers gains', () => {
  const first = calculateLongevityChange({
    game: gameWithPlayer(),
    category: 'cultivation',
    effectHints: [{ target: 'lifespan', direction: 'up', intensity: 'medium' }]
  });
  const afterFirst = applyLongevityState(gameWithPlayer(), first);
  const second = calculateLongevityChange({
    game: afterFirst,
    category: 'cultivation',
    effectHints: [{ target: 'lifespan', direction: 'up', intensity: 'medium' }]
  });

  assert.equal(second.recoveryFatigue, first.recoveryFatigue + 1);
  assert.equal(second.longevityGain < first.longevityGain, true);
  assert.match(second.note, /收益降低|久守洞府/);
});

test('medicine resistance lowers repeated pill longevity gains', () => {
  const game = gameWithPlayer({ longevity: { medicineResistance: { longevity_pill: 2 } } });
  const result = calculateLongevityChange({
    game,
    category: 'craft',
    source: 'medicine',
    effectHints: [{ target: 'lifespan', direction: 'up', intensity: 'high', id: 'longevity_pill' }]
  });

  assert.equal(result.longevityGain > 0, true);
  assert.equal(result.recoverySource, 'medicine');
  assert.equal(result.longevityGain < 11, true);
});

test('major breakthrough rewards restore lifespan and raise max lifespan', () => {
  assert.deepEqual(calculateBreakthroughLongevityReward({
    fromRealm: '炼气九层',
    targetRealm: '筑基初期',
    success: true
  }), {
    longevityGain: 25,
    maxLifespanDelta: 40
  });
  assert.deepEqual(calculateBreakthroughLongevityReward({
    fromRealm: '炼气七层',
    targetRealm: '炼气八层',
    success: true
  }), {
    longevityGain: 2,
    maxLifespanDelta: 1
  });
  assert.deepEqual(calculateBreakthroughLongevityReward({
    fromRealm: '炼气七层',
    targetRealm: '炼气八层',
    success: false
  }), {
    longevityGain: 0,
    maxLifespanDelta: 0
  });
});
