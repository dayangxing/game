import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeEffectHints,
  resolveDirectorEffectHints
} from '../backend/src/domain/director/effectHints.js';
import { createGame } from '../src/engine.js';

function formalGame(overrides = {}) {
  const base = createGame(31);
  return {
    ...base,
    onboarding: { completed: true, stepId: 'formal_life', completedStepIds: [], unlockedCharacterCreation: true },
    character: {
      name: '顾清河',
      origin: '山野孤子',
      spiritualRoot: '雷木双灵根',
      traits: ['早慧', '命火绵长'],
      initialLifespan: 96,
      attributes: {
        rootBone: 6,
        comprehension: 7,
        fortune: 4,
        willpower: 5,
        lifeSeed: 3
      }
    },
    inventory: { materials: { 凝露草: 2 }, pills: {} },
    karma: { karma: 0, evil: 0, fate: 0, debts: [], vendettas: [], futureEventFlags: [] },
    flags: {},
    cooldowns: {},
    ...overrides
  };
}

test('normalizes allowed story director effect hints and rejects unknown internal fields', () => {
  const game = formalGame();
  const result = normalizeEffectHints([
    { target: 'lifespan', direction: 'down', intensity: 'medium', amount: 999 },
    { target: 'comprehension', direction: 'up', intensity: 'critical' },
    { target: 'debugSecret', direction: 'up', intensity: 'high' },
    { target: 'health', direction: 'sideways', intensity: 'strange' }
  ], game);

  assert.deepEqual(result.accepted, [
    { target: 'lifespan', direction: 'down', intensity: 'medium' },
    { target: 'comprehension', direction: 'up', intensity: 'small' },
    { target: 'health', direction: 'stable', intensity: 'small' }
  ]);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].target, 'debugSecret');
  assert.doesNotMatch(JSON.stringify(result), /999/);
});

test('resolves vague hints into bounded backend state changes', () => {
  const base = createGame(31);
  const game = formalGame({
    player: {
      ...base.player,
      lifespan: 93,
      maxLifespan: 120,
      health: 136,
      maxHealth: 136,
      qi: 60,
      mood: 50,
      cultivationProgress: 40,
      sectRelation: 20
    }
  });

  const result = resolveDirectorEffectHints({
    game,
    effectHints: [
      { target: 'lifespan', direction: 'down', intensity: 'medium' },
      { target: 'cultivation', direction: 'up', intensity: 'small' },
      { target: 'npc_affinity', npcId: 'lin_shijie', direction: 'up', intensity: 'small' }
    ],
    now: new Date('2026-07-03T08:00:00.000Z')
  });

  assert.equal(result.game.player.lifespan, 93);
  assert.equal(result.game.player.cultivationProgress, 44);
  assert.equal(result.game.npcs.find((npc) => npc.name === '林师姐').affinity, 37);
  assert.match(result.summary, /寿元|修行|林师姐/);
  assert.deepEqual(result.appliedEffects.map((effect) => effect.type), ['stat', 'relation']);
});

test('does not allow model hints to grant unauthorized item or technique rewards', () => {
  const game = formalGame();
  const result = resolveDirectorEffectHints({
    game,
    effectHints: [
      { target: 'item', direction: 'gain', intensity: 'critical', id: 'immortal_sword' },
      { target: 'technique', direction: 'gain', intensity: 'critical', id: 'heaven_gate_secret' }
    ],
    now: new Date('2026-07-03T08:00:00.000Z')
  });

  assert.equal(result.appliedEffects.length, 0);
  assert.deepEqual(result.game.inventory, game.inventory);
  assert.equal(result.game.techniques, game.techniques);
});

test('accepts time and lifespan hints without converting them into direct stat effects', () => {
  const game = formalGame();
  const result = resolveDirectorEffectHints({
    game,
    effectHints: [
      { target: 'time', direction: 'up', intensity: 'small' },
      { target: 'lifespan', direction: 'up', intensity: 'small' }
    ],
    now: new Date('2026-07-01T08:00:00.000Z')
  });

  assert.deepEqual(result.accepted.map((hint) => hint.target), ['time', 'lifespan']);
  assert.equal(result.appliedEffects.some((effect) => effect.type === 'lifespan'), false);
});
