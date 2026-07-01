import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_TOTAL,
  deriveMaxHealth,
  deriveMaxLifespan,
  rollAttributeAllocation,
  validateAttributeAllocation
} from '../backend/src/domain/attributes.js';

test('attribute allocation constants and validation accept a legal five-stat build', () => {
  assert.deepEqual(ATTRIBUTE_KEYS, ['rootBone', 'comprehension', 'fortune', 'willpower', 'lifeSeed']);
  assert.equal(ATTRIBUTE_TOTAL, 25);
  assert.deepEqual(validateAttributeAllocation({
    rootBone: 7,
    comprehension: 6,
    fortune: 4,
    willpower: 4,
    lifeSeed: 4
  }), {
    rootBone: 7,
    comprehension: 6,
    fortune: 4,
    willpower: 4,
    lifeSeed: 4
  });
});

test('attribute allocation validation rejects totals outside 25 and invalid point values', () => {
  assert.throws(() => validateAttributeAllocation({
    rootBone: 8,
    comprehension: 6,
    fortune: 4,
    willpower: 4,
    lifeSeed: 4
  }), /ATTRIBUTE_ALLOCATION_INVALID:total/);
  assert.throws(() => validateAttributeAllocation({
    rootBone: 0,
    comprehension: 8,
    fortune: 6,
    willpower: 6,
    lifeSeed: 5
  }), /ATTRIBUTE_ALLOCATION_INVALID:rootBone/);
  assert.throws(() => validateAttributeAllocation({
    rootBone: 11,
    comprehension: 5,
    fortune: 3,
    willpower: 3,
    lifeSeed: 3
  }), /ATTRIBUTE_ALLOCATION_INVALID:rootBone/);
  assert.throws(() => validateAttributeAllocation({
    rootBone: 7.5,
    comprehension: 6,
    fortune: 4,
    willpower: 4,
    lifeSeed: 3.5
  }), /ATTRIBUTE_ALLOCATION_INVALID:rootBone/);
});

test('seeded attribute rolls are deterministic and derive formal health state', () => {
  assert.deepEqual(rollAttributeAllocation(52), {
    rootBone: 3,
    comprehension: 6,
    fortune: 6,
    willpower: 5,
    lifeSeed: 5
  });
  assert.deepEqual(rollAttributeAllocation(52), rollAttributeAllocation(52));
  assert.notDeepEqual(rollAttributeAllocation(52), rollAttributeAllocation(53));
  assert.equal(deriveMaxHealth({
    rootBone: 7,
    comprehension: 6,
    fortune: 4,
    willpower: 4,
    lifeSeed: 4
  }), 144);
  assert.equal(deriveMaxLifespan(96, {
    rootBone: 7,
    comprehension: 6,
    fortune: 4,
    willpower: 4,
    lifeSeed: 4
  }), 128);
});
