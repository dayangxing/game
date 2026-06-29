import test from 'node:test';
import assert from 'node:assert/strict';

import { getLayoutMode, layoutModes } from '../frontend/src/ui/layoutModes.js';

test('frontend currently enables desktop web layout only', () => {
  assert.deepEqual(layoutModes.enabled, ['desktop']);
});

test('layout interface keeps future tablet and mobile hooks declared', () => {
  assert.deepEqual(layoutModes.planned, ['tablet', 'mobile']);
});

test('getLayoutMode always returns desktop until mobile adaptation is enabled', () => {
  assert.equal(getLayoutMode({ width: 390 }).id, 'desktop');
  assert.equal(getLayoutMode({ width: 1440 }).id, 'desktop');
  assert.equal(getLayoutMode().minWidth, 1180);
});
