import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine.js';
import {
  finalizeRun,
  normalizeResourceState,
  recordResourceAcquisition,
  resetRunResources
} from '../backend/src/domain/resources/resourceProgress.js';
import { grantTechnique, grantTreasure } from '../backend/src/domain/rewards.js';

test('legacy games receive empty resource run and meta progress state', () => {
  const normalized = normalizeResourceState({ ...createGame(17), techniques: undefined, treasures: undefined });
  assert.deepEqual(normalized.techniques, []);
  assert.deepEqual(normalized.treasures, []);
  assert.deepEqual(normalized.resourceRun.pendingDraft, null);
  assert.deepEqual(normalized.metaProgress.discoveredTechniques, []);
});

test('first acquisition is logged and discovered once', () => {
  const game = normalizeResourceState(createGame(17));
  const next = recordResourceAcquisition(game, {
    kind: 'technique',
    resourceId: 'qingmu_jue',
    eventId: 'master_guidance',
    eventTitle: '长老指点',
    turn: 4
  });
  const twice = recordResourceAcquisition(next, {
    kind: 'technique',
    resourceId: 'qingmu_jue',
    eventId: 'master_guidance',
    eventTitle: '长老指点',
    turn: 5
  });
  assert.equal(twice.resourceRun.acquisitionLog.length, 2);
  assert.deepEqual(twice.metaProgress.discoveredTechniques, ['qingmu_jue']);
  assert.deepEqual(twice.metaProgress.unlockedTechniques, ['qingmu_jue']);
});

test('finalizing and resetting a run preserves meta progress but clears active resources', () => {
  const game = normalizeResourceState({ ...createGame(17), techniques: [{ id: 'qingmu_jue' }], treasures: [] });
  const finalized = finalizeRun(game, { chapterId: 'foundation' });
  assert.deepEqual(finalized.techniques, []);
  assert.deepEqual(finalized.treasures, []);
  assert.deepEqual(finalized.metaProgress.discoveredTechniques, ['qingmu_jue']);
  assert.equal(finalized.metaProgress.runCount, 1);
  assert.equal(finalized.metaProgress.bestChapter, 'foundation');
  assert.equal(resetRunResources(finalized).metaProgress.runCount, 1);
});

test('normalizing a reward state preserves active resonance display data', () => {
  const base = normalizeResourceState(createGame(17));
  const withTechnique = grantTechnique(base, 'thunder_pulse_manual');
  const withResonance = grantTreasure(withTechnique, 'bronze_bell_fragment');
  const normalized = normalizeResourceState(withResonance);

  assert.deepEqual(normalized.resourceRun.activeResonances.map((entry) => entry.id), ['thunder_resonance']);
  assert.equal(normalized.resourceRun.activeResonances[0].effectText, '突破 +2');
});

test('finalizing a run is idempotent and preserves discovered resources after the active build is cleared', () => {
  const game = normalizeResourceState({
    ...createGame(41),
    techniques: [{ id: 'taixu_heart_mirror' }]
  });
  const once = finalizeRun(game, { chapterId: 'finale' });
  const twice = finalizeRun(once, { chapterId: 'finale' });

  assert.equal(once.metaProgress.runCount, 1);
  assert.equal(twice.metaProgress.runCount, 1);
  assert.deepEqual(twice.metaProgress.unlockedTechniques, ['taixu_heart_mirror']);
  assert.deepEqual(twice.techniques, []);
});

test('finalizing a run preserves a public snapshot of the build that just ended', () => {
  const game = normalizeResourceState({
    ...createGame(43),
    techniques: [{ id: 'taixu_heart_mirror' }],
    treasures: [{ id: 'mist_veil' }]
  });

  const finalized = finalizeRun(game, { chapterId: 'mist_realm' });

  assert.equal(finalized.resourceRun.lastRunSummary.runCount, 1);
  assert.deepEqual(
    finalized.resourceRun.lastRunSummary.techniques.map((entry) => entry.id),
    ['taixu_heart_mirror']
  );
  assert.deepEqual(
    finalized.resourceRun.lastRunSummary.treasures.map((entry) => entry.id),
    ['mist_veil']
  );
});
