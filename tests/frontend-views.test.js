import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getView, viewList } from '../frontend/src/ui/views.js';

test('top navigation exposes five playable game views', () => {
  assert.deepEqual(viewList.map((view) => view.id), ['home', 'cultivation', 'skills', 'realm', 'bag']);
  assert.deepEqual(viewList.map((view) => view.label), ['洞府', '修炼', '命簿', '秘境', '行囊']);
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

test('bag and 命簿 views have player-facing copy for obtained rewards and character status', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const renderSkillsView = extractFunction(source, 'renderSkillsView');
  const characterProfilePanel = extractFunction(source, 'renderCharacterProfilePanel');
  const resourcePanel = extractFunction(source, 'renderResourceLedgerPanel');
  const relationshipPanel = extractFunction(source, 'renderRelationshipPanel');
  const renderCollectionCards = extractFunction(source, 'renderCollectionCards');
  const skillsView = getView('skills');

  assert.equal(skillsView.label, '命簿');
  assert.match(skillsView.title, /命簿/);
  assert.match(skillsView.description, /角色|状态|功法|资源|牵绊/);
  assert.ok(renderSkillsView, 'renderSkillsView should exist');
  assert.ok(characterProfilePanel, 'renderCharacterProfilePanel should exist');
  assert.ok(resourcePanel, 'renderResourceLedgerPanel should exist');
  assert.ok(relationshipPanel, 'renderRelationshipPanel should exist');
  assert.ok(renderCollectionCards, 'renderCollectionCards should exist');
  assert.match(renderSkillsView, /renderTechniqueCollectionPanel\(\)/);
  assert.match(renderSkillsView, /renderRelationshipPanel\(\)/);
  assert.match(renderSkillsView, /renderResourceLedgerPanel\(\)/);
  assert.match(characterProfilePanel, /角色总览/);
  assert.match(resourcePanel, /气血与寿元/);
  assert.match(relationshipPanel, /game\.npcs\.map/);
  assert.match(source, /renderCollectionCards\(game\.treasures/);
  assert.match(source, /renderCollectionCards\(game\.techniques/);
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
