import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getView, viewList } from '../frontend/src/ui/views.js';

test('top navigation exposes five playable game views', () => {
  assert.deepEqual(viewList.map((view) => view.id), ['home', 'cultivation', 'skills', 'realm', 'bag']);
  assert.deepEqual(viewList.map((view) => view.label), ['洞府', '修炼', '功法', '秘境', '行囊']);
});

test('each view has a title, description, and cards', () => {
  for (const view of viewList) {
    assert.ok(view.title.length > 0);
    assert.ok(view.description.length > 0);
    assert.ok(view.cards.length >= 3);
  }
});

test('getView returns home for unknown ids', () => {
  assert.equal(getView('missing').id, 'home');
});

test('cultivation and realm views include playable commands', () => {
  const cultivation = getView('cultivation');
  const realm = getView('realm');

  assert.ok(cultivation.cards.some((card) => card.command.includes('闭关')));
  assert.ok(realm.cards.some((card) => card.command.includes('秘境') || card.command.includes('后山')));
});

test('bag and skills views have player-facing focus copy for obtained rewards instead of raw ids', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const renderViewFocus = extractFunction(source, 'renderViewFocus');
  const renderCollectionCards = extractFunction(source, 'renderCollectionCards');

  assert.ok(renderViewFocus, 'renderViewFocus should exist');
  assert.ok(renderCollectionCards, 'renderCollectionCards should exist');
  assert.match(renderViewFocus, /if \(activeViewId === 'bag'\)/);
  assert.match(renderViewFocus, /if \(activeViewId === 'skills'\)/);
  assert.match(renderViewFocus, /renderCollectionCards\(game\.treasures/);
  assert.match(renderViewFocus, /renderCollectionCards\(game\.techniques/);
  assert.match(renderCollectionCards, /\$\{item\.name\}/);
  assert.match(renderCollectionCards, /\$\{item\.description\}/);
  assert.doesNotMatch(renderCollectionCards, /\$\{item\.id\}/);
});

function extractFunction(source, name) {
  const start = source.indexOf(`async function ${name}`) !== -1
    ? source.indexOf(`async function ${name}`)
    : source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;

  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }

  assert.fail(`${name} should have a complete function body`);
}
