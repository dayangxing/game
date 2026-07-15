import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame } from '../src/engine.js';
import {
  applyEnding,
  createLifespanEnding,
  resolveEnding
} from '../backend/src/domain/endings/endingResolver.js';

function finaleGame(overrides = {}) {
  const baseGame = createGame(31);
  const base = {
    ...baseGame,
    onboarding: { completed: true },
    storyProgress: {
      chapterId: 'finale', chapterIndex: 6, status: 'active',
      completedObjectiveIds: ['finale_stance'],
      truthFlags: ['lifespan_mark', 'mist_archive', 'bronze_bell', 'heaven_gate_key'],
      sectPath: 'truth', contractStance: 'reject', finalChoiceMade: true, endingId: null
    },
    flags: { heaven_gate_key: true },
    player: { ...baseGame.player, realm: '金丹后期' }
  };
  return {
    ...base,
    ...overrides,
    storyProgress: { ...base.storyProgress, ...(overrides.storyProgress ?? {}) },
    flags: { ...base.flags, ...(overrides.flags ?? {}) },
    player: { ...base.player, ...(overrides.player ?? {}) }
  };
}

test('ending resolver selects each deterministic active branch', () => {
  assert.equal(resolveEnding(finaleGame()).id, 'break_contract');
  assert.equal(resolveEnding(finaleGame({
    storyProgress: { contractStance: 'sacrifice', truthFlags: ['lifespan_mark', 'mist_archive', 'bronze_bell'] },
    flags: { heaven_gate_key: false }
  })).id, 'sacrifice_to_break');
  assert.equal(resolveEnding(finaleGame({
    storyProgress: { contractStance: 'accept', truthFlags: [] },
    flags: { heaven_gate_key: false }
  })).id, 'false_ascension');
  assert.equal(resolveEnding(finaleGame({
    storyProgress: { contractStance: 'guard', truthFlags: [] },
    flags: { heaven_gate_key: false }
  })).id, 'mist_guardian');
  assert.equal(resolveEnding(finaleGame({
    storyProgress: { contractStance: null, truthFlags: [] },
    flags: { heaven_gate_key: false }
  })).id, 'unfinished_truth');
});

test('ending resolver waits for the final choice flag', () => {
  assert.equal(resolveEnding(finaleGame({ storyProgress: { finalChoiceMade: false } })), null);
  assert.equal(resolveEnding({ ...finaleGame(), storyProgress: { ...finaleGame().storyProgress, chapterId: 'ascension_scam' } }), null);
});

test('lifespan ending includes terminal summary', () => {
  const ending = createLifespanEnding(finaleGame({ turn: 72 }));

  assert.equal(ending.type, 'lifespan_exhausted');
  assert.equal(ending.status, 'ended');
  assert.equal(ending.resolvedTurn, 72);
  assert.equal(ending.summary.finalRealm, '金丹后期');
  assert.equal(ending.summary.truthFlags, 4);
});

test('applyEnding is idempotent after the game is terminal', () => {
  const game = finaleGame();
  const candidate = resolveEnding(game);
  const terminal = applyEnding(game, candidate, 72);

  assert.equal(terminal.storyProgress.status, 'ended');
  assert.equal(terminal.ending.status, 'ended');
  assert.deepEqual(applyEnding(terminal, candidate, 72), terminal);
});
