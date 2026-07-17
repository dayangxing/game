import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getLayoutMode, layoutModes } from '../frontend/src/ui/layoutModes.js';

test('frontend enables desktop, tablet, and mobile layout modes', () => {
  assert.deepEqual(layoutModes.enabled, ['desktop', 'tablet', 'mobile']);
  assert.deepEqual(layoutModes.planned, []);
});

test('getLayoutMode selects the mode from common viewport widths', () => {
  assert.equal(getLayoutMode({ width: 1440 }).id, 'desktop');
  assert.equal(getLayoutMode({ width: 1024 }).id, 'tablet');
  assert.equal(getLayoutMode({ width: 768 }).id, 'tablet');
  assert.equal(getLayoutMode({ width: 767 }).id, 'mobile');
  assert.equal(getLayoutMode({ width: 390 }).id, 'mobile');
});

test('layout modes expose the responsive minimum width contract', () => {
  assert.equal(layoutModes.desktop.minWidth, 1200);
  assert.equal(layoutModes.tablet.minWidth, 768);
  assert.equal(layoutModes.mobile.minWidth, 0);
});

test('responsive stylesheet removes fixed page minimums and defines common breakpoints', () => {
  const css = fs.readFileSync('frontend/src/styles.css', 'utf8');

  assert.match(css, /body\s*\{[\s\S]*?min-width:\s*0;/);
  assert.match(css, /\.app\s*\{[\s\S]*?min-width:\s*0;/);
  assert.match(css, /@media\s*\(max-width:\s*1199px\)/);
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /@media\s*\(max-width:\s*767px\)/);
  assert.match(css, /\.utility-menu\.is-open\s+\.utility-menu-panel/);
  assert.match(css, /\.topbar\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*5;/);
});
