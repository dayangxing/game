import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createBackendApp } from '../backend/src/app.js';
import { createGameApi } from '../frontend/src/api/gameApi.js';
import { formatCharacterAttributeRows } from '../frontend/src/ui/characterCreation.js';

test('frontend api can create a formal random character through backend', async () => {
  const backend = createBackendApp({ seed: 31, now: () => new Date('2026-06-29T08:00:00.000Z') });
  backend.getState().game.onboarding = {
    completed: true,
    stepId: 'formal_life',
    completedStepIds: [],
    unlockedCharacterCreation: true
  };
  const api = createGameApi({
    baseUrl: 'http://backend.test',
    preferredMode: 'api',
    fetchImpl: (input, init) => backend.handle(new Request(input, init))
  });

  const game = await api.createFormalGame({ name: '顾清河', rerollSeed: 52 });

  assert.equal(game.mode, 'api');
  assert.equal(game.player.name, '顾清河');
  assert.notEqual(game.player.name, '陆青玄');
  assert.equal(game.characterSeed, 52);
});

test('mock formal game exposes a usable character object', async () => {
  const api = createGameApi({ seed: 21, preferredMode: 'mock' });

  const game = await api.createFormalGame({ name: '陆青玄', rerollSeed: 77 });

  assert.equal(game.mode, 'mock');
  assert.equal(game.player.name, '陆青玄');
  assert.equal(game.characterSeed, 77);
  assert.equal(game.character.name, '陆青玄');
  assert.ok(Array.isArray(game.character.traits));
  assert.equal(typeof game.character.origin, 'string');
  assert.equal(typeof game.character.spiritualRoot, 'string');
  assert.equal(typeof game.character.initialLifespan, 'number');
  assert.equal(typeof game.character.startingResources.spiritStones, 'number');
});

test('character rows expose readable random attributes', () => {
  const rows = formatCharacterAttributeRows({
    origin: '山野孤子',
    spiritualRoot: '雷木双灵根',
    traits: ['早慧', '灵根不稳'],
    comprehension: 72,
    physique: 48,
    luck: 66,
    karmaAffinity: -4,
    initialLifespan: 93,
    startingResources: { spiritStones: 88, materials: { 凝露草: 2 }, pills: {} }
  });

  assert.deepEqual(rows.map((row) => row.label), ['出身', '灵根', '命格', '悟性', '体魄', '气运', '因果亲和', '寿元', '初始资源']);
  assert.match(rows.at(-1).value, /灵石 88/);
});

test('frontend page exposes onboarding and character creation shells', () => {
  const html = fs.readFileSync('frontend/index.html', 'utf8');

  assert.match(html, /id="onboardingPanel"/);
  assert.match(html, /id="characterPanel"/);
  assert.match(html, /id="characterNameInput"/);
  assert.match(html, /id="rerollCharacterBtn"/);
  assert.match(html, /id="startFormalGameBtn"/);
});

test('frontend app wires onboarding and character creation actions', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(source, /nodes\.onboardingActionBtn\.addEventListener/);
  assert.match(source, /nodes\.rerollCharacterBtn\.addEventListener/);
  assert.match(source, /nodes\.startFormalGameBtn\.addEventListener/);
  assert.match(source, /api\.createFormalGame/);
});

test('reroll only updates local seed preview and start action performs the formal game creation', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const [, rerollHandler] = source.match(/nodes\.rerollCharacterBtn\.addEventListener\('click', async \(\) => \{([\s\S]*?)\n\}\);/) ?? [];
  const [, startHandler] = source.match(/nodes\.startFormalGameBtn\.addEventListener\('click', async \(\) => \{([\s\S]*?)\n\}\);/) ?? [];
  const renderFirstRunStage = extractFunction(source, 'renderFirstRunStage');

  assert.ok(rerollHandler, 'reroll handler should exist');
  assert.ok(startHandler, 'start handler should exist');
  assert.ok(renderFirstRunStage, 'renderFirstRunStage helper should exist');

  assert.doesNotMatch(source, /function buildPendingCharacterPreview\(\) \{/);
  assert.match(source, /function renderPendingCharacterStatus\(\) \{/);
  assert.doesNotMatch(source, /formatCharacterAttributeRows/);
  assert.doesNotMatch(rerollHandler, /api\.createFormalGame/);
  assert.match(rerollHandler, /renderPendingCharacterStatus\(\);/);
  assert.match(renderFirstRunStage, /renderPendingCharacterStatus\(\);/);
  assert.doesNotMatch(renderFirstRunStage, /renderCharacterRoll\(/);
  assert.match(startHandler, /game = await api\.createFormalGame\(\{/);
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
