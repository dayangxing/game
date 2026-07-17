import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame } from '../src/engine.js';
import { resolveChapterProgress } from '../backend/src/domain/chapters/chapterProgression.js';
import { buildTurnResult } from '../backend/src/domain/turnResult.js';

function createQiGame({ includeClue = true } = {}) {
  const base = createGame(31);
  return {
    ...base,
    onboarding: { completed: true },
    chapterHistory: [],
    time: { elapsedMonths: 12 },
    player: {
      ...base.player,
      realm: '炼气九层'
    },
    npcs: base.npcs.map((npc) => npc.name === '林师姐' ? { ...npc, affinity: 14 } : npc),
    flags: includeClue ? { lifespan_mark: true } : {},
    storyProgress: {
      chapterId: 'qi',
      chapterIndex: 1,
      status: 'active',
      completedObjectiveIds: [],
      truthFlags: includeClue ? ['lifespan_mark'] : [],
      sectPath: null,
      contractStance: null,
      finalChoiceMade: false,
      endingId: null
    }
  };
}

test('chapter completion advances one chapter and records history', () => {
  const game = createQiGame();
  const result = resolveChapterProgress({ before: game, after: game, turn: 19 });

  assert.equal(result.game.storyProgress.chapterId, 'foundation');
  assert.equal(result.transition.fromChapterId, 'qi');
  assert.equal(result.transition.toChapterId, 'foundation');
  assert.equal(result.game.chapterHistory.length, 1);
});

test('repeating the same resolved game is idempotent', () => {
  const game = createQiGame();
  const result = resolveChapterProgress({ before: game, after: game, turn: 19 });
  const repeated = resolveChapterProgress({ before: result.game, after: result.game, turn: 19 });

  assert.equal(repeated.transition, null);
  assert.equal(repeated.game.storyProgress.chapterId, 'foundation');
  assert.equal(repeated.game.chapterHistory.length, 1);
});

test('missing required clue keeps the current chapter', () => {
  const game = createQiGame({ includeClue: false });
  const result = resolveChapterProgress({ before: game, after: game, turn: 19 });

  assert.equal(result.game.storyProgress.chapterId, 'qi');
  assert.equal(result.transition, null);
});

test('one turn cannot skip from qi to golden core', () => {
  const game = createQiGame();
  const result = resolveChapterProgress({ before: game, after: game, turn: 19 });

  assert.equal(result.game.storyProgress.chapterId, 'foundation');
  assert.notEqual(result.game.storyProgress.chapterId, 'golden_core');
});

test('turn result exposes public chapter transition fields', () => {
  const before = createQiGame();
  const resolution = resolveChapterProgress({ before, after: before, turn: 19 });
  const result = buildTurnResult({
    before,
    after: resolution.game,
    actionId: 'test-action',
    chapterTransition: resolution.transition,
    narration: { title: '章节推进', body: '新的篇章展开。', npcLine: '', foreshadow: '' }
  });

  assert.equal(result.chapter.id, 'foundation');
  assert.equal(result.chapterTransition.toChapterId, 'foundation');
});
