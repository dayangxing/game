import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame } from '../src/engine.js';
import {
  createFormalStoryProgress,
  getPublicChapterSnapshot,
  normalizeStoryProgress
} from '../backend/src/domain/chapters/storyProgress.js';

test('formal progress starts at prologue', () => {
  assert.deepEqual(createFormalStoryProgress(), {
    chapterId: 'prologue', chapterIndex: 0, status: 'active', completedObjectiveIds: [],
    truthFlags: [], sectPath: null, contractStance: null, finalChoiceMade: false, endingId: null
  });
});

test('tutorial state has no formal chapter', () => {
  assert.equal(normalizeStoryProgress({ ...createGame(31), onboarding: { completed: false } }), null);
});

test('legacy formal state derives known truth flags once', () => {
  const progress = normalizeStoryProgress({
    ...createGame(31),
    onboarding: { completed: true },
    flags: { lifespan_mark: true, bronze_bell: true, unrelated_boolean: true }
  });
  assert.equal(progress.chapterId, 'prologue');
  assert.deepEqual(progress.truthFlags, ['lifespan_mark', 'bronze_bell']);
  assert.deepEqual(progress.completedObjectiveIds, []);
});

test('public snapshot hides objective ids and flag names', () => {
  const game = {
    ...createGame(31),
    onboarding: { completed: true },
    storyProgress: createFormalStoryProgress()
  };
  const serialized = JSON.stringify(getPublicChapterSnapshot(game));
  assert.match(serialized, /序章：命簿初开/);
  assert.doesNotMatch(serialized, /prologue_first_clue|lifespan_mark/);
});
