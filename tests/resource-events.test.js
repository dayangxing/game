import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_CATALOG } from '../backend/src/domain/events/eventCatalog.js';
import { resolveChoice } from '../backend/src/domain/events/effectResolver.js';
import { createGame } from '../src/engine.js';

const RESOURCE_EVENT_IDS = [
  'mist_relic_cache',
  'scripture_archive_cache',
  'alchemy_hidden_fire',
  'beast_bone_reliquary',
  'ancient_ruins_starfall'
];

test('each resource discovery event references a valid resource pool', () => {
  for (const id of RESOURCE_EVENT_IDS) {
    const event = EVENT_CATALOG.find((entry) => entry.id === id);
    assert.ok(event, `missing event: ${id}`);
    assert.ok(event.choices.some((choice) => choice.success.effects.some((effect) => effect.type === 'resourceDraft')));
  }
});

test('an event resource draft is pending after the event but breakthrough has no draft', () => {
  const event = EVENT_CATALOG.find((entry) => entry.id === 'mist_relic_cache');
  const resolved = resolveChoice({
    game: createGame(73),
    event,
    choice: event.choices[0],
    now: new Date('2026-07-17T00:00:00.000Z')
  });

  assert.equal(resolved.game.resourceRun.pendingDraft.poolId, 'mistRelics');
  assert.equal(resolved.game.resourceRun.pendingDraft.sourceEventId, 'mist_relic_cache');
  assert.equal(resolved.game.resourceRun.pendingDraft.createdTurn, 1);
});

test('ordinary cultivation events do not create a resource draft', () => {
  const event = EVENT_CATALOG.find((entry) => entry.id === 'cultivation_breathing');
  const resolved = resolveChoice({
    game: createGame(73),
    event,
    choice: event.choices[0],
    now: new Date('2026-07-17T00:00:00.000Z')
  });

  assert.equal(resolved.game.resourceRun?.pendingDraft, undefined);
});

test('a resource event that exhausts lifespan does not leave an unclaimable draft', () => {
  const event = EVENT_CATALOG.find((entry) => entry.id === 'mist_relic_cache');
  const base = createGame(73);
  const resolved = resolveChoice({
    game: {
      ...base,
      onboarding: { completed: true },
      player: { ...base.player, lifespan: 1, maxLifespan: 100 }
    },
    event,
    choice: event.choices[0],
    now: new Date('2026-07-17T00:00:00.000Z')
  });

  assert.equal(resolved.game.ending.type, 'lifespan_exhausted');
  assert.equal(resolved.game.resourceRun?.pendingDraft ?? null, null);
});
