import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '../backend/src/app.js';
import { createGame } from '../src/engine.js';
import { closeBackendServer, startBackendServer, waitForServerListening } from '../backend/src/server.js';

async function requestJson(baseUrl, route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: { 'content-type': 'application/json' },
    ...options
  });
  return { response, body: await response.json() };
}

test('backend starts on an available random port and closes idempotently', async () => {
  const server = startBackendServer({ host: '127.0.0.1', port: 0 });
  try {
    const address = await waitForServerListening(server);
    const result = await fetch(`http://127.0.0.1:${address.port}/api/v1/game/state`);

    assert.equal(result.status, 200);
  } finally {
    await closeBackendServer(server);
    await closeBackendServer(server);
  }
});

test('backend restores initial state and persists a successful reset', async () => {
  const persisted = [];
  const initialGame = createGame(7);
  initialGame.turn = 12;
  initialGame.player.name = '旧存档';
  const app = createBackendApp({
    initialGame,
    persistGame: async (game) => persisted.push(game)
  });
  const server = startBackendServer({ host: '127.0.0.1', port: 0, app });

  try {
    const address = await waitForServerListening(server);
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const initial = await requestJson(baseUrl, '/api/v1/game/state');
    assert.equal(initial.response.status, 200);
    assert.equal(initial.body.data.game.turn, 12);

    const reset = await requestJson(baseUrl, '/api/v1/game/reset', {
      method: 'POST',
      body: JSON.stringify({ rerollSeed: 9 })
    });
    assert.equal(reset.response.status, 200);
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].turn, 0);
  } finally {
    await closeBackendServer(server);
  }
});
