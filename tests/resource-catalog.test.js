import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RESOURCE_BONUS_KEYS,
  RESOURCE_POOL_CATALOG,
  RESONANCE_CATALOG,
  TECHNIQUE_CATALOG,
  TREASURE_CATALOG,
  getResourceById,
  validateResourceCatalog
} from '../backend/src/domain/resources/resourceCatalog.js';

test('catalog contains eight techniques and eight treasures with stable ids', () => {
  assert.equal(Object.keys(TECHNIQUE_CATALOG).length, 8);
  assert.equal(Object.keys(TREASURE_CATALOG).length, 8);
  assert.equal(TECHNIQUE_CATALOG.qingmu_jue.name, '青木诀');
  assert.equal(TREASURE_CATALOG.calm_lotus_incense.name, '静心莲香');
  assert.equal(getResourceById('technique', 'qingmu_jue'), TECHNIQUE_CATALOG.qingmu_jue);
  assert.equal(getResourceById('treasure', 'calm_lotus_incense'), TREASURE_CATALOG.calm_lotus_incense);
  assert.equal(getResourceById('technique', 'missing_id'), undefined);
  assert.equal(getResourceById('unknown_kind', 'qingmu_jue'), undefined);
  assert.doesNotThrow(() => validateResourceCatalog());
});

test('every catalog entry exposes the public resource shape and whitelisted bonus keys', () => {
  for (const entry of [...Object.values(TECHNIQUE_CATALOG), ...Object.values(TREASURE_CATALOG)]) {
    assert.ok(entry.id);
    assert.ok(entry.name);
    assert.ok(entry.grade);
    assert.ok(entry.type);
    assert.ok(entry.realmAtLeast);
    assert.ok(Array.isArray(entry.tags));
    assert.ok(entry.tags.length >= 2);
    assert.ok(entry.description);
    assert.ok(entry.detail);
    assert.ok(entry.bonuses && typeof entry.bonuses === 'object');
    assert.ok(Object.keys(entry.bonuses).every((key) => RESOURCE_BONUS_KEYS.includes(key)));
  }
});

test('every pool has four or more valid resources and every resonance has two distinct thresholds', () => {
  for (const pool of Object.values(RESOURCE_POOL_CATALOG)) {
    assert.ok(pool.resourceIds.length >= 4);
    assert.ok(pool.narrativeReason.length > 0);
  }

  for (const resonance of Object.values(RESONANCE_CATALOG)) {
    assert.equal(resonance.thresholds[2] !== undefined, true);
    assert.equal(resonance.thresholds[3] !== undefined, true);
    assert.notDeepEqual(resonance.thresholds[2], resonance.thresholds[3]);
  }
});
