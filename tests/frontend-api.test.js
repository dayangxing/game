import test from 'node:test';
import assert from 'node:assert/strict';

import { createGameApi } from '../frontend/src/api/gameApi.js';

test('frontend game api creates an initial game state', async () => {
  const api = createGameApi({ seed: 21 });
  const game = await api.createGame();

  assert.equal(game.player.name, '陆青玄');
  assert.equal(game.turn, 0);
  assert.ok(game.suggestions.length >= 3);
});

test('frontend game api advances a command without exposing engine details', async () => {
  const api = createGameApi({ seed: 21 });
  const game = await api.createGame();
  const next = await api.submitCommand(game, '找林师姐打听雾隐秘境的消息');

  assert.equal(next.turn, 1);
  assert.match(next.log.at(-1).npcLine, /林师姐/);
});

test('frontend game api updates mode and exports story text', async () => {
  const api = createGameApi({ seed: 21 });
  const game = await api.setMode(await api.createGame(), 'api');
  const text = await api.exportStory(game);

  assert.equal(game.mode, 'api');
  assert.match(text, /问道浮生/);
});
