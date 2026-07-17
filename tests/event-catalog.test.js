import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_CATALOG } from '../backend/src/domain/events/eventCatalog.js';
import { validateEventCatalog } from '../backend/src/domain/events/eventCatalogValidator.js';

test('formal catalog has the required chapter distribution and metadata', () => {
  const result = validateEventCatalog(EVENT_CATALOG);
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('validator reports duplicate ids, wrong choice count and dangling references', () => {
  const result = validateEventCatalog([
    { id: 'duplicate', chapterIds: ['unknown'], cadence: 'mainline', oneShot: true, choices: [] },
    { id: 'duplicate', chapterIds: ['prologue'], cadence: 'bad', oneShot: false, choices: [] }
  ]);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /duplicate|unknown|cadence|choices/);
});

test('early chapters contain recovery and sect stance routes', () => {
  const byId = Object.fromEntries(EVENT_CATALOG.map((event) => [event.id, event]));

  assert.equal(byId.qi_failed_breakthrough_recovery.trigger.requiresBreakthroughFailure.tier, '炼气');
  assert.equal(
    byId.foundation_trial_verdict.choices.some((choice) => choice.success.effects.some(
      (effect) => effect.type === 'storyProgress' && effect.path === 'sectPath'
    )),
    true
  );
  assert.equal(byId.foundation_heart_demon.trigger.chapterIds[0], 'foundation');
});

test('golden core and mist events provide access, cost and truth convergence', () => {
  const byId = Object.fromEntries(EVENT_CATALOG.map((event) => [event.id, event]));

  assert.equal(byId.mist_entry_authorization.trigger.requiresFlags.includes('sect_elder_split'), true);
  assert.equal(byId.mist_white_mist_price.trigger.lifespanRatioMax, 0.6);
  assert.equal(byId.mist_bell_keeper.choices.length, 2);
  assert.equal(
    byId.mist_archive_countermark.choices.some((choice) => choice.success.effects.some((effect) => effect.type === 'flag')),
    true
  );
});

test('ascension events expose all contract stances and finale choices mark completion', () => {
  const stancePaths = EVENT_CATALOG
    .filter((event) => event.chapterIds?.[0] === 'ascension_scam')
    .flatMap((event) => event.choices)
    .flatMap((choice) => choice.success.effects)
    .filter((effect) => effect.type === 'storyProgress' && effect.path === 'contractStance')
    .map((effect) => effect.value);

  for (const stance of ['reject', 'accept', 'guard', 'sacrifice']) assert.ok(stancePaths.includes(stance), stance);

  const finalChoices = EVENT_CATALOG
    .filter((event) => event.chapterIds?.[0] === 'finale')
    .flatMap((event) => event.choices)
    .flatMap((choice) => choice.success.effects);
  assert.ok(finalChoices.some((effect) => effect.type === 'storyProgress' && effect.path === 'finalChoiceMade' && effect.value === true));
});
