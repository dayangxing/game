import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('frontend source renders event state panels through the existing hud resources node', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(source, /function renderKarmaState/);
  assert.match(source, /function renderInventoryState/);
  assert.match(source, /function renderSectState/);
  assert.match(source, /nodes\.hudResources\.innerHTML/);
  assert.match(source, /<h3>寿元压力<\/h3>/);
  assert.match(source, /<h3>因果<\/h3>/);
  assert.match(source, /<h3>门派<\/h3>/);
  assert.match(source, /<h3>丹药\/材料<\/h3>/);
});

test('sect state falls back to the current player sect relation field', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(source, /const sect = game\.sect \?\? \{/);
  assert.match(source, /contribution:\s*game\.player\.sectRelation\s*\?\?\s*0/);
  assert.match(source, /<span>宗门<\/span><strong>\$\{sect\.name\}<\/strong>/);
  assert.match(source, /<span>身份<\/span><strong>\$\{sect\.rank\}<\/strong>/);
});

test('action cards show backend event metadata when an action is event-backed', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(source, /action\.eventId\s*\?\s*`<div class="event-meta">\$\{action\.eventId\} \/ \$\{action\.choiceId\}<\/div>`\s*:\s*''/);
});

test('frontend styles include compact event state rows and metadata styling', () => {
  const css = fs.readFileSync('frontend/src/styles.css', 'utf8');

  assert.match(css, /\.state-row\s*\{/);
  assert.match(css, /justify-content:\s*space-between/);
  assert.match(css, /\.event-meta\s*\{/);
  assert.match(css, /font-size:\s*12px/);
});
