import test from 'node:test';
import assert from 'node:assert/strict';

import { isEventEligible } from '../backend/src/domain/events/triggerMatcher.js';

const game = {
  onboarding: { completed: true },
  storyProgress: { chapterId: 'mist', sectPath: 'truth' },
  player: { realm: '金丹初期', lifespan: 20, maxLifespan: 100, sectRelation: 36 },
  npcs: [{ name: '林师姐', affinity: 18 }],
  eventHistory: {
    resolved: ['mist_archive_fragment'],
    repeatCounts: { mist_archive_fragment: 1 },
    lastResolvedTurn: { mist_archive_fragment: 4 }
  },
  progressionStats: { breakthroughFailures: 1, breakthroughFailuresByTier: { 筑基: 1 } },
  flags: {}
};

test('trigger matcher checks all new state predicates with AND semantics', () => {
  const event = {
    trigger: {
      viewIds: ['realm'],
      chapterIds: ['mist'],
      realmAtLeast: '筑基初期',
      npcAffinityMin: { npcId: 'lin_shijie', value: 12 },
      requiresSectPath: 'truth',
      lifespanRatioMax: 0.25,
      requiresBreakthroughFailure: { tier: '筑基', atLeast: 1 },
      requiresEventResolved: 'mist_archive_fragment',
      forbidEventResolved: 'other_event'
    }
  };

  assert.equal(isEventEligible(event, game, 'realm'), true);
  assert.equal(isEventEligible(event, game, 'home'), false);
  assert.equal(isEventEligible({ ...event, trigger: { ...event.trigger, chapterIds: ['qi'] } }, game, 'realm'), false);
  assert.equal(isEventEligible({ ...event, trigger: { ...event.trigger, lifespanRatioMax: 0.1 } }, game, 'realm'), false);
});
