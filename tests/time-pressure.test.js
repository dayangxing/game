import test from 'node:test';
import assert from 'node:assert/strict';

import { applyTimePressure, buildWarningLevel } from '../backend/src/domain/time/timePressure.js';
import { createGame } from '../src/engine.js';

function formalGame(overrides = {}) {
  const base = createGame(31);
  return {
    ...base,
    onboarding: { completed: true },
    time: { elapsedMonths: 24 },
    character: {
      ...base.character,
      attributes: { rootBone: 5, comprehension: 5, fortune: 5, willpower: 5, lifeSeed: 1 }
    },
    player: {
      ...base.player,
      realm: '筑基初期',
      lifespan: 40,
      maxLifespan: 100,
      ...overrides.player
    },
    ...overrides
  };
}

test('time pressure advances calendar and applies net lifespan cost', () => {
  const result = applyTimePressure({
    game: formalGame(),
    command: '继续',
    category: 'story'
  });

  assert.equal(result.timeResult.deltaMonths, 3);
  assert.equal(result.timeResult.label, '三月');
  assert.equal(result.timeResult.baseLifespanCost, 3);
  assert.equal(result.timeResult.netLifespanDelta, -3);
  assert.equal(result.game.player.lifespan, 37);
  assert.equal(result.game.time.elapsedMonths, 27);
  assert.deepEqual(result.game.calendar, { year: 3, season: '夏', month: 4 });
  assert.equal(result.game.timePressure.warningLevel, 'danger');
});

test('positive longevity can produce a net lifespan increase without raising max lifespan', () => {
  const result = applyTimePressure({
    game: formalGame({ player: { lifespan: 40, maxLifespan: 100, realm: '炼气七层' } }),
    command: '静坐调息',
    category: 'cultivation',
    effectHints: [{ target: 'lifespan', direction: 'up', intensity: 'high' }]
  });

  assert.equal(result.timeResult.longevityGain > result.timeResult.baseLifespanCost, true);
  assert.equal(result.timeResult.maxLifespanDelta, 0);
  assert.equal(result.game.player.lifespan > 40, true);
  assert.equal(result.game.player.maxLifespan, 100);
});

test('lifespan exhaustion creates ending and blocks further play state', () => {
  const result = applyTimePressure({
    game: formalGame({ player: { lifespan: 2, maxLifespan: 100, realm: '金丹初期' } }),
    command: '强闯雾隐秘境',
    category: 'explore',
    extraLifespanDamage: 10
  });

  assert.equal(result.game.player.lifespan, 0);
  assert.equal(result.game.timePressure.warningLevel, 'ended');
  assert.equal(result.game.ending.type, 'lifespan_exhausted');
  assert.match(result.game.ending.title, /命簿终章/);
});

test('warning levels follow lifespan ratio', () => {
  assert.equal(buildWarningLevel({ lifespan: 80, maxLifespan: 100 }), 'steady');
  assert.equal(buildWarningLevel({ lifespan: 50, maxLifespan: 100 }), 'strained');
  assert.equal(buildWarningLevel({ lifespan: 25, maxLifespan: 100 }), 'danger');
  assert.equal(buildWarningLevel({ lifespan: 10, maxLifespan: 100 }), 'critical');
  assert.equal(buildWarningLevel({ lifespan: 0, maxLifespan: 100 }), 'ended');
});
