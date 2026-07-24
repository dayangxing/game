import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createBackendApp } from '../backend/src/app.js';
import { createGameApi } from '../frontend/src/api/gameApi.js';
import {
  createDefaultAllocation,
  formatAttributeCards,
  formatCharacterAttributeRows,
  randomizeAllocation
} from '../frontend/src/ui/characterCreation.js';

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

test('frontend api forwards manual attribute allocation through backend formal creation', async () => {
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

  const game = await api.createFormalGame({
    name: '顾清河',
    rerollSeed: 52,
    attributes: {
      rootBone: 7,
      comprehension: 6,
      fortune: 4,
      willpower: 4,
      lifeSeed: 4
    }
  });

  assert.deepEqual(game.character.attributes, {
    rootBone: 7,
    comprehension: 6,
    fortune: 4,
    willpower: 4,
    lifeSeed: 4
  });
  assert.equal(game.player.maxHealth, 144);
  assert.equal(game.player.maxLifespan, game.character.initialLifespan + 32);
});

test('frontend api previews the same background that formal creation will use', async () => {
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
  const input = {
    name: '顾清河',
    rerollSeed: 52,
    attributes: {
      rootBone: 7,
      comprehension: 6,
      fortune: 4,
      willpower: 4,
      lifeSeed: 4
    }
  };

  const preview = await api.getCharacterPreview(input);
  const formal = await api.createFormalGame(input);

  assert.equal(typeof preview.origin, 'string');
  assert.equal(typeof preview.spiritualRoot, 'string');
  assert.ok(Array.isArray(preview.traits));
  assert.deepEqual({
    origin: preview.origin,
    spiritualRoot: preview.spiritualRoot,
    traits: preview.traits
  }, {
    origin: formal.character.origin,
    spiritualRoot: formal.character.spiritualRoot,
    traits: formal.character.traits
  });
});

test('mock frontend api exposes a deterministic character background preview', async () => {
  const api = createGameApi({ seed: 21, preferredMode: 'mock' });

  const preview = await api.getCharacterPreview({ name: '陆青玄', rerollSeed: 77 });

  assert.equal(typeof preview.origin, 'string');
  assert.equal(typeof preview.spiritualRoot, 'string');
  assert.ok(Array.isArray(preview.traits));
});

test('mock formal characters draw from the expanded background pools', async () => {
  const api = createGameApi({ seed: 21, preferredMode: 'mock' });
  const characters = await Promise.all(Array.from({ length: 24 }, (_, index) => (
    api.createFormalGame({ name: `角色${index}`, rerollSeed: index })
  )));

  assert.equal(new Set(characters.map((game) => game.character.origin)).size, 18);
  assert.equal(new Set(characters.map((game) => game.character.spiritualRoot)).size, 18);
  assert.equal(new Set(characters.flatMap((game) => game.character.traits)).size, 24);
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

test('attribute allocation helpers expose balanced defaults deterministic randomization and player-facing cards', () => {
  const defaults = createDefaultAllocation();
  const randomized = randomizeAllocation(52);
  const cards = formatAttributeCards(randomized);

  assert.deepEqual(defaults, {
    rootBone: 5,
    comprehension: 5,
    fortune: 5,
    willpower: 5,
    lifeSeed: 5
  });
  assert.deepEqual(randomized, {
    rootBone: 3,
    comprehension: 6,
    fortune: 6,
    willpower: 5,
    lifeSeed: 5
  });
  assert.equal(Object.values(randomized).reduce((total, value) => total + value, 0), 25);
  assert.deepEqual(cards.map((card) => card.label), ['根骨', '悟性', '气运', '心志', '命元']);
  assert.ok(cards.every((card) => typeof card.note === 'string' && card.note.length > 0));
});

test('frontend page exposes onboarding and character creation shells', () => {
  const html = fs.readFileSync('frontend/index.html', 'utf8');

  assert.match(html, /id="onboardingPanel"/);
  assert.match(html, /id="characterPanel"/);
  assert.ok(html.indexOf('id="onboardingPanel"') > html.indexOf('class="main-stage"'));
  assert.ok(html.indexOf('id="characterPanel"') > html.indexOf('class="main-stage"'));
  assert.match(html, /id="dashboardContent"/);
  assert.match(html, /id="characterNameInput"/);
  assert.match(html, /id="attributeAllocation"/);
  assert.match(html, /id="remainingAttributePoints"/);
  assert.match(html, /id="rerollCharacterBtn"/);
  assert.match(html, /id="startFormalGameBtn"/);
  assert.match(html, />随机分配</);
});

test('first-run panels keep the hidden attribute authoritative in css', () => {
  const css = fs.readFileSync('frontend/src/styles.css', 'utf8');

  assert.match(css, /\.onboarding-panel\[hidden\],\s*\.character-panel\[hidden\]\s*\{/);
  assert.match(css, /\.onboarding-panel\[hidden\],\s*\.character-panel\[hidden\]\s*\{[\s\S]*?display:\s*none;/);
});

test('frontend app wires onboarding and character creation actions', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(source, /nodes\.onboardingActionBtn\.addEventListener/);
  assert.match(source, /nodes\.rerollCharacterBtn\.addEventListener/);
  assert.match(source, /nodes\.startFormalGameBtn\.addEventListener/);
  assert.match(source, /let pendingAttributes = createDefaultAllocation\(\);/);
  assert.match(source, /randomizeAllocation/);
  assert.match(source, /api\.createFormalGame/);
});

test('random allocation updates the pending stats preview and start action submits attributes', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const [, rerollHandler] = source.match(/nodes\.rerollCharacterBtn\.addEventListener\('click', async \(\) => \{([\s\S]*?)\n\}\);/) ?? [];
  const [, startHandler] = source.match(/nodes\.startFormalGameBtn\.addEventListener\('click', async \(\) => \{([\s\S]*?)\n\}\);/) ?? [];
  const renderFirstRunStage = extractFunction(source, 'renderFirstRunStage');
  const renderPendingCharacterStatus = extractFunction(source, 'renderPendingCharacterStatus');

  assert.ok(rerollHandler, 'reroll handler should exist');
  assert.ok(startHandler, 'start handler should exist');
  assert.ok(renderFirstRunStage, 'renderFirstRunStage helper should exist');
  assert.ok(renderPendingCharacterStatus, 'renderPendingCharacterStatus helper should exist');

  assert.match(source, /function renderPendingCharacterStatus\(\) \{/);
  assert.match(renderPendingCharacterStatus, /remainingAttributePoints/);
  assert.match(renderPendingCharacterStatus, /formatAttributeCards/);
  assert.match(rerollHandler, /pendingAttributes = randomizeAllocation\(pendingCharacterSeed\);/);
  assert.match(rerollHandler, /renderPendingCharacterStatus\(\);/);
  assert.match(renderFirstRunStage, /renderPendingCharacterStatus\(\);/);
  assert.match(startHandler, /game = await api\.createFormalGame\(\{/);
  assert.match(startHandler, /attributes:\s*pendingAttributes/);
});

test('Svelte character creation locks the start action while the game is being created', () => {
  const source = fs.readFileSync('frontend/src/components/CharacterCreation.svelte', 'utf8');

  assert.match(source, /getCharacterCreationPending/);
  assert.match(source, /disabled=\{!canStart \|\| characterCreationPending\}/);
});

test('Svelte character creation renders the generated character background preview', () => {
  const source = fs.readFileSync('frontend/src/components/CharacterCreation.svelte', 'utf8');

  assert.match(source, /getPendingCharacterPreview/);
  assert.match(source, /preview\?\.origin/);
  assert.match(source, /preview\?\.spiritualRoot/);
  assert.match(source, /preview\?\.traits/);
  assert.match(source, /入山门后揭晓/);
  assert.match(source, /命格尚未落定/);
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
