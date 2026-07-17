import test from 'node:test';
import assert from 'node:assert/strict';

import { getChapterDefinition, listChapterDefinitions } from '../backend/src/domain/chapters/chapterCatalog.js';
import { evaluateObjective, getChapterProgress } from '../backend/src/domain/chapters/objectiveEvaluator.js';

const game = {
  player: { realm: '筑基初期' },
  flags: { lifespan_mark: true, bronze_bell: true },
  npcs: [{ name: '林师姐', affinity: 12 }],
  storyProgress: {
    truthFlags: ['lifespan_mark', 'bronze_bell', 'mist_archive'],
    sectPath: 'truth',
    contractStance: 'reject'
  }
};

test('catalog has seven ordered chapters', () => {
  assert.deepEqual(listChapterDefinitions().map((item) => item.id), [
    'prologue', 'qi', 'foundation', 'golden_core', 'mist', 'ascension_scam', 'finale'
  ]);
  assert.deepEqual(listChapterDefinitions().map((item) => item.index), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(getChapterDefinition('missing'), null);
});

test('objective evaluator handles realm, flag, NPC, truth and contract predicates', () => {
  assert.equal(evaluateObjective({ predicate: { type: 'realmAtLeast', realm: '筑基初期' } }, game), true);
  assert.equal(evaluateObjective({ predicate: { type: 'anyFlag', flags: ['lifespan_mark'] } }, game), true);
  assert.equal(evaluateObjective({ predicate: { type: 'npcAffinityAtLeast', npcName: '林师姐', value: 10 } }, game), true);
  assert.equal(evaluateObjective({ predicate: { type: 'truthFlagCountAtLeast', value: 3 } }, game), true);
  assert.equal(evaluateObjective({ predicate: { type: 'contractStanceSelected' } }, game), true);
  assert.equal(evaluateObjective({ predicate: { type: 'finalChoiceMade' } }, {
    storyProgress: { finalChoiceMade: true }
  }), true);
});

test('chapter progress reports required completion and percentage', () => {
  const chapter = getChapterDefinition('qi');
  const result = getChapterProgress(chapter, {
    ...game,
    player: { realm: '炼气九层' },
    flags: { lifespan_mark: true }
  });
  assert.equal(result.requiredCompleted, true);
  assert.equal(result.progress, 100);
});
