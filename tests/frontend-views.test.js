import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getView, viewList } from '../frontend/src/ui/views.js';

test('top navigation exposes five playable game views', () => {
  assert.deepEqual(viewList.map((view) => view.id), ['home', 'cultivation', 'skills', 'realm', 'bag']);
  assert.deepEqual(viewList.map((view) => view.label), ['洞府', '修炼', '个人', '秘境', '行囊']);
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

test('bag and personal views separate inventory collections from detailed character status', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const renderSkillsView = extractFunction(source, 'renderSkillsView');
  const personalPanel = extractFunction(source, 'renderPersonalPanel');
  const profileSection = extractFunction(source, 'renderPersonalProfileSection');
  const attributeSection = extractFunction(source, 'renderPersonalAttributeSection');
  const statusSection = extractFunction(source, 'renderPersonalStatusSection');
  const relationshipSection = extractFunction(source, 'renderPersonalRelationshipSection');
  const renderCollectionCards = extractFunction(source, 'renderCollectionCards');
  const skillsView = getView('skills');

  assert.equal(skillsView.label, '个人');
  assert.match(skillsView.title, /个人面板/);
  assert.match(skillsView.description, /属性|境界|功法|牵绊/);
  assert.ok(renderSkillsView, 'renderSkillsView should exist');
  assert.ok(personalPanel, 'renderPersonalPanel should exist');
  assert.ok(profileSection, 'renderPersonalProfileSection should exist');
  assert.ok(attributeSection, 'renderPersonalAttributeSection should exist');
  assert.ok(statusSection, 'renderPersonalStatusSection should exist');
  assert.ok(relationshipSection, 'renderPersonalRelationshipSection should exist');
  assert.ok(renderCollectionCards, 'renderCollectionCards should exist');
  assert.match(renderSkillsView, /renderPersonalPanel\(\)/);
  assert.doesNotMatch(renderSkillsView, /renderTreasureCollectionPanel\(\)/);
  assert.doesNotMatch(renderSkillsView, /renderInventoryCollectionPanel\(\)/);
  assert.match(personalPanel, /个人面板/);
  assert.match(profileSection, /人物/);
  assert.match(attributeSection, /五维/);
  assert.match(statusSection, /气血与寿元/);
  assert.match(relationshipSection, /game\.npcs\.map/);
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
