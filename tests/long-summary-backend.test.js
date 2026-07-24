import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '../backend/src/app.js';
import { createGame } from '../src/engine.js';

function makeRequest(method, path, body = {}) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body)
  });
}

function makeApiGame() {
  const game = createGame(77);
  game.mode = 'api';
  game.onboarding = {
    completed: true,
    unlockedCharacterCreation: true,
    completedStepIds: []
  };
  game.turn = 4;
  game.version = 4;
  game.log = Array.from({ length: 4 }, (_, index) => ({
    id: `turn-${index + 1}`,
    title: `回合${index + 1}`,
    command: `行动${index + 1}`,
    body: `结果${index + 1}`
  }));
  game.storyMemory = {
    ...game.storyMemory,
    summaryThroughTurn: 0,
    summaryRevision: 0,
    longSummary: '旧摘要'
  };
  return game;
}

test('successful POST triggers long summary in the background and persists it later', async () => {
  let resolveSummary;
  let summaryStarted;
  const summaryStartedPromise = new Promise((resolve) => { summaryStarted = resolve; });
  const summaryPromise = new Promise((resolve) => { resolveSummary = resolve; });
  const persisted = [];
  let calls = 0;
  const llm = {
    generateLongSummary({ game }) {
      calls += 1;
      summaryStarted(game.version);
      return summaryPromise;
    }
  };
  const app = createBackendApp({
    initialGame: makeApiGame(),
    llm,
    persistGame: async (game) => persisted.push(game)
  });

  const response = await app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'home',
    gameVersion: 4
  }));
  assert.equal(response.status, 200);
  assert.ok(app.getState().longSummaryScheduler);

  const startedVersion = await summaryStartedPromise;
  assert.equal(startedVersion, 4);
  assert.equal(calls, 1);

  resolveSummary({ summary: '后台生成的新摘要', coveredThroughTurn: 4 });
  await app.getState().longSummaryScheduler.flush();

  assert.ok(persisted.some((game) => game.storyMemory?.longSummary === '后台生成的新摘要'));
  assert.equal(app.getState().game.storyMemory.summaryThroughTurn, 4);
  assert.equal(app.getState().game.storyMemory.summaryRevision, 1);
  app.getState().longSummaryScheduler.dispose();
});

test('mock mode does not invoke long summary generation', async () => {
  let calls = 0;
  const game = createGame(78);
  const app = createBackendApp({
    initialGame: game,
    llm: {
      generateLongSummary() {
        calls += 1;
        return Promise.resolve({ summary: '不应生成', coveredThroughTurn: 4 });
      }
    }
  });

  await app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'home',
    gameVersion: 0
  }));
  await app.getState().longSummaryScheduler.flush();

  assert.equal(calls, 0);
  app.getState().longSummaryScheduler.dispose();
});
