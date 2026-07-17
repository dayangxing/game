import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame } from '../src/engine.js';
import {
  TECHNIQUE_CATALOG,
  TREASURE_CATALOG
} from '../backend/src/domain/resources/resourceCatalog.js';
import {
  createResourceDraft,
  getPublicResourceDraft,
  resolveResourceDraft
} from '../backend/src/domain/resources/resourceDraft.js';

function createDraft(overrides = {}) {
  return createResourceDraft({
    game: createGame(73),
    poolId: 'mistRelics',
    sourceEventId: 'mist_relic_cache',
    sourceEventTitle: '雾中遗物',
    reason: '雾灯下的遗物',
    turn: 6,
    ...overrides
  });
}

test('same seed, event and turn produce the same three candidates', () => {
  const first = createDraft();
  const second = createDraft();

  assert.deepEqual(first.resourceRun.pendingDraft.candidates, second.resourceRun.pendingDraft.candidates);
  assert.deepEqual(first.resourceRun.pendingDraft.actions, second.resourceRun.pendingDraft.actions);
  assert.equal(first.resourceRun.pendingDraft.candidates.length, 3);
  assert.equal(first.resourceRun.pendingDraft.actions.length, 3);
});

test('owned resources are filtered before filling the draft', () => {
  const game = {
    ...createGame(73),
    techniques: [{ id: 'mist_step' }],
    treasures: [{ id: 'calm_lotus_incense' }]
  };
  const next = createDraft({ game });
  const ids = next.resourceRun.pendingDraft.candidates.map((entry) => entry.id).filter(Boolean);

  assert.equal(ids.includes('mist_step'), false);
  assert.equal(ids.includes('calm_lotus_incense'), false);
  assert.equal(new Set(ids).size, ids.length);
});

test('realm filtering excludes resources above the current realm', () => {
  const game = {
    ...createGame(73),
    player: { ...createGame(73).player, realm: '炼气一层' }
  };
  const next = createResourceDraft({
    game,
    poolId: 'scriptureArchive',
    sourceEventId: 'scripture_archive_cache',
    sourceEventTitle: '藏经阁残卷',
    reason: '残卷中的旧法门',
    turn: 2
  });

  assert.equal(next.resourceRun.pendingDraft.candidates.length, 3);
  assert.equal(next.resourceRun.pendingDraft.candidates.some((entry) => entry.id === 'thunder_pulse_manual'), false);
  assert.equal(next.resourceRun.pendingDraft.candidates.some((entry) => entry.id === 'taixu_heart_mirror'), false);
});

test('candidate shortage backfills by pool tags and then uses explicit spirit-stone compensation', () => {
  const allOwned = {
    ...createGame(73),
    techniques: Object.values(TECHNIQUE_CATALOG).map((entry) => ({ id: entry.id })),
    treasures: Object.values(TREASURE_CATALOG).map((entry) => ({ id: entry.id }))
  };

  const next = createResourceDraft({ game: allOwned, poolId: 'mistRelics', sourceEventId: 'mist_relic_cache', turn: 6 });
  const { candidates, actions } = next.resourceRun.pendingDraft;

  assert.equal(candidates.length, 3);
  assert.equal(actions.length, 3);
  assert.equal(candidates.every((entry) => entry.kind === 'compensation'), true);
  assert.equal(actions.every((action) => action.resourceId === undefined), true);
  assert.equal(candidates.every((entry) => entry.name === '灵石补偿'), true);
});

test('public draft contains player-facing cards without server-only fields', () => {
  const game = createDraft();
  const draft = game.resourceRun.pendingDraft;
  const publicDraft = getPublicResourceDraft(draft);
  const serialized = JSON.stringify(publicDraft);

  assert.equal(publicDraft.reason, '雾灯下的遗物');
  assert.equal(publicDraft.sourceEventTitle, '雾中遗物');
  assert.equal(publicDraft.options.length, 3);
  assert.ok(publicDraft.options.every((option) => option.actionId));
  assert.equal(serialized.includes('poolId'), false);
  assert.equal(serialized.includes('seed'), false);
  assert.equal(serialized.includes('resourceId'), false);
  assert.equal(serialized.includes('bonuses'), false);
  assert.equal(serialized.includes('realmAtLeast'), false);
});

test('resolving a resource draft records the acquisition without advancing time or lifespan', () => {
  const game = createDraft();
  const draft = game.resourceRun.pendingDraft;
  const selected = resolveResourceDraft({
    game,
    draftActionId: draft.actions[0].id,
    turn: 6
  });

  assert.equal(selected.game.turn, game.turn);
  assert.equal(selected.game.player.lifespan, game.player.lifespan);
  assert.equal(selected.game.resourceRun.pendingDraft, null);
  assert.equal(selected.game.resourceRun.acquisitionLog.length, 1);
  assert.equal(selected.game.resourceRun.acquisitionLog[0].eventId, 'mist_relic_cache');
  assert.equal(selected.entry.id, selected.game.resourceRun.acquisitionLog[0].resourceId);
  assert.equal(
    [...selected.game.techniques, ...selected.game.treasures].some((entry) => entry.id === selected.entry.id),
    true
  );
});

test('invalid or already-resolved actions are rejected without mutating the game', () => {
  const game = createDraft();
  const before = JSON.stringify(game);

  assert.throws(
    () => resolveResourceDraft({ game, draftActionId: 'not-an-action', turn: 6 }),
    /RESOURCE_DRAFT_INVALID_ACTION/
  );
  assert.equal(JSON.stringify(game), before);

  const resolved = resolveResourceDraft({ game, draftActionId: game.resourceRun.pendingDraft.actions[0].id, turn: 6 });
  assert.throws(
    () => resolveResourceDraft({ game: resolved.game, draftActionId: game.resourceRun.pendingDraft.actions[0].id, turn: 6 }),
    /RESOURCE_DRAFT_NO_PENDING/
  );
});
