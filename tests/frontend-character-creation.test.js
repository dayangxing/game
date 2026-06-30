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
