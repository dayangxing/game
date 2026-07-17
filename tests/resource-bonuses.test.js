import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame } from '../src/engine.js';
import { calculateDerivedBonuses, calculateResonances } from '../backend/src/domain/rewards.js';
import { applyEffects } from '../backend/src/domain/events/effectResolver.js';
import { resolveBreakthrough } from '../backend/src/domain/progression.js';

test('two matching tags activate the small resonance without mutating catalog entries', () => {
  const game = {
    ...createGame(31),
    techniques: [{ id: 'thunder_pulse_manual' }],
    treasures: [{ id: 'bronze_bell_fragment' }]
  };
  const result = calculateResonances(game);

  assert.deepEqual(result.activeResonances.map((entry) => entry.id), ['thunder_resonance']);
  assert.equal(result.bonuses.breakthroughChance, 2);
  assert.deepEqual(game.techniques, [{ id: 'thunder_pulse_manual' }]);
  assert.deepEqual(game.treasures, [{ id: 'bronze_bell_fragment' }]);
});

test('cultivation gain applies only to positive cultivation progress effects', () => {
  const base = createGame(31);
  const game = {
    ...base,
    techniques: [{ id: 'thunder_pulse_manual' }],
    player: { ...base.player, cultivationProgress: 10 }
  };
  const gained = applyEffects(game, [{ type: 'stat', path: 'player.cultivationProgress', delta: 8 }]);
  const lost = applyEffects(gained, [{ type: 'stat', path: 'player.cultivationProgress', delta: -8 }]);

  assert.equal(gained.player.cultivationProgress, 22);
  assert.equal(lost.player.cultivationProgress, 14);
});

test('damage reduction lowers breakthrough failure health cost but never removes it', () => {
  const base = createGame(98);
  const game = {
    ...base,
    techniques: [{ id: 'earth_veil_body' }],
    player: {
      ...base.player,
      realm: '炼气一层',
      cultivationProgress: 100,
      health: 100,
      maxHealth: 100
    }
  };
  const result = resolveBreakthrough(game, new Date('2026-07-17T00:00:00.000Z'));

  assert.equal(result.ruleResult.success, false);
  assert.equal(result.game.player.health, 83);
  assert.ok(result.game.player.health < 100);
});

test('derived bonuses include resource bonuses and the highest active resonance tier', () => {
  const game = {
    ...createGame(31),
    techniques: [{ id: 'thunder_pulse_manual' }],
    treasures: [
      { id: 'bronze_bell_fragment' },
      { id: 'taixu_star_disk' }
    ]
  };

  assert.deepEqual(calculateDerivedBonuses(game), {
    cultivationGain: 4,
    breakthroughChance: 13,
    damageReduction: 2
  });
});

test('unknown legacy resources do not create new bonuses or resonances', () => {
  const game = {
    ...createGame(31),
    techniques: [{ id: 'legacy_manual', tags: ['雷法'], bonuses: { breakthroughChance: 99 } }],
    treasures: [{ id: 'bronze_bell_fragment' }]
  };

  assert.deepEqual(calculateResonances(game).activeResonances, []);
  assert.deepEqual(calculateDerivedBonuses(game), {
    breakthroughChance: 2,
    damageReduction: 2
  });
});
