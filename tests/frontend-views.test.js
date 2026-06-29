import test from 'node:test';
import assert from 'node:assert/strict';

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
