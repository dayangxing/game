import test from 'node:test';
import assert from 'node:assert/strict';

import { createLongSummaryScheduler } from '../backend/src/memory/longSummaryScheduler.js';

function deferredPromise() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function makeGame({ version = 4, summaryThroughTurn = 0, summaryRevision = 0, mode = 'api' } = {}) {
  return {
    id: 'game-1',
    mode,
    turn: version,
    version,
    storyMemory: {
      longSummary: '旧摘要',
      summaryThroughTurn,
      summaryRevision
    },
    log: Array.from({ length: version }, (_, index) => ({
      id: `turn-${index + 1}`,
      title: `回合${index + 1}`,
      command: `行动${index + 1}`,
      body: `结果${index + 1}`
    }))
  };
}

function makeScheduler(overrides = {}) {
  let game = overrides.game ?? makeGame();
  const commits = [];
  const scheduler = createLongSummaryScheduler({
    getGame: () => game,
    commitGame: (nextGame) => {
      commits.push(nextGame);
      game = nextGame;
    },
    summarize: async () => ({ summary: '新摘要', coveredThroughTurn: 4 }),
    thresholdTurns: 4,
    ...overrides,
    ...(overrides.getGame ? {} : { getGame: () => game }),
    ...(overrides.commitGame ? {} : {
      commitGame: (nextGame) => {
        commits.push(nextGame);
        game = nextGame;
      }
    })
  });
  return { scheduler, commits, getGame: () => game };
}

test('consider returns without waiting for the summary promise', async () => {
  const pending = deferredPromise();
  const { scheduler } = makeScheduler({ summarize: () => pending.promise });

  const start = Date.now();
  scheduler.consider({ reason: 'threshold' });
  assert.ok(Date.now() - start < 100);

  pending.resolve({ summary: '新摘要', coveredThroughTurn: 4 });
  await scheduler.flush();
  scheduler.dispose();
});

test('a stale summary cannot overwrite a newer game version', async () => {
  const pending = deferredPromise();
  let game = makeGame({ version: 4 });
  const commits = [];
  const scheduler = createLongSummaryScheduler({
    getGame: () => game,
    commitGame: (nextGame) => commits.push(nextGame),
    summarize: () => pending.promise,
    thresholdTurns: 4
  });

  scheduler.consider({ reason: 'threshold' });
  game = makeGame({ version: 5, summaryThroughTurn: 2 });
  pending.resolve({ summary: '过期摘要', coveredThroughTurn: 4 });
  await scheduler.flush();

  assert.equal(commits.length, 0);
  scheduler.dispose();
});

test('multiple updates coalesce to one latest follow-up task', async () => {
  let game = makeGame({ version: 4 });
  const calls = [];
  const deferreds = [];
  const scheduler = createLongSummaryScheduler({
    getGame: () => game,
    commitGame: (nextGame) => { game = nextGame; },
    summarize: ({ game: snapshot }) => {
      calls.push(snapshot.version);
      const pending = deferredPromise();
      deferreds.push(pending);
      return pending.promise;
    },
    thresholdTurns: 4
  });

  scheduler.consider({ reason: 'threshold' });
  game = makeGame({ version: 5 });
  scheduler.consider({ reason: 'threshold' });
  game = makeGame({ version: 6 });
  scheduler.consider({ reason: 'threshold' });

  while (deferreds.length < 1) await new Promise((resolve) => setImmediate(resolve));
  deferreds[0].resolve({ summary: '过期摘要', coveredThroughTurn: 4 });
  while (deferreds.length < 2) await new Promise((resolve) => setImmediate(resolve));
  deferreds[1].resolve({ summary: '最新摘要', coveredThroughTurn: 6 });
  await scheduler.flush();

  assert.deepEqual(calls, [4, 6]);
  scheduler.dispose();
});

test('accepted summary advances the checkpoint and persists the new revision', async () => {
  const persisted = [];
  const { scheduler, commits } = makeScheduler({
    persistGame: async (game) => persisted.push(game),
    summarize: async () => ({ summary: '压缩后的摘要', coveredThroughTurn: 4 })
  });

  scheduler.consider({ reason: 'threshold' });
  await scheduler.flush();

  assert.equal(commits.length, 1);
  assert.equal(commits[0].storyMemory.longSummary, '压缩后的摘要');
  assert.equal(commits[0].storyMemory.summaryThroughTurn, 4);
  assert.equal(commits[0].storyMemory.summaryRevision, 1);
  assert.equal(persisted.length, 1);
  scheduler.dispose();
});

test('failure and timeout keep the old summary and checkpoint', async () => {
  const committed = [];
  const scheduler = createLongSummaryScheduler({
    getGame: () => makeGame(),
    commitGame: (nextGame) => committed.push(nextGame),
    timeoutMs: 1,
    summarize: () => new Promise(() => {})
  });

  scheduler.consider({ reason: 'threshold' });
  await scheduler.flush();

  assert.deepEqual(committed, []);
  scheduler.dispose();
});

test('mock games never call the summary provider', async () => {
  let calls = 0;
  const { scheduler } = makeScheduler({
    game: makeGame({ mode: 'mock' }),
    summarize: async () => {
      calls += 1;
      return { summary: '不应调用', coveredThroughTurn: 4 };
    }
  });

  scheduler.consider({ reason: 'threshold' });
  await scheduler.flush();

  assert.equal(calls, 0);
  scheduler.dispose();
});

test('scheduler rebases long summary when the 50-turn window advances', async () => {
  let game = makeGame({ version: 55, summaryThroughTurn: 54, summaryRevision: 3 });
  game.storyMemory.summaryWindowStartTurn = 0;
  const calls = [];
  const commits = [];
  const scheduler = createLongSummaryScheduler({
    getGame: () => game,
    commitGame: (nextGame) => {
      commits.push(nextGame);
      game = nextGame;
    },
    summarize: (input) => {
      calls.push(input);
      return Promise.resolve({ summary: '最近五十回合摘要', coveredThroughTurn: 55 });
    }
  });

  scheduler.consider({ reason: 'threshold' });
  await scheduler.flush();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].rebase, true);
  assert.equal(calls[0].previousSummary, '');
  assert.equal(calls[0].sourceTurns.length, 50);
  assert.equal(calls[0].sourceTurns[0].turn, 6);
  assert.equal(calls[0].sourceTurns.at(-1).turn, 55);
  assert.equal(commits[0].storyMemory.summaryWindowStartTurn, 6);
  assert.equal(commits[0].storyMemory.summaryThroughTurn, 55);
  assert.equal(commits[0].storyMemory.summaryRevision, 4);
  scheduler.dispose();
});

test('failed rolling rebase preserves the previous summary window metadata', async () => {
  let game = makeGame({ version: 55, summaryThroughTurn: 54, summaryRevision: 3 });
  game.storyMemory.summaryWindowStartTurn = 0;
  const commits = [];
  const scheduler = createLongSummaryScheduler({
    getGame: () => game,
    commitGame: (nextGame) => commits.push(nextGame),
    summarize: async () => {
      throw new Error('rolling summary unavailable');
    }
  });

  scheduler.consider({ reason: 'threshold' });
  await scheduler.flush();

  assert.equal(commits.length, 0);
  assert.equal(game.storyMemory.summaryWindowStartTurn, 0);
  assert.equal(game.storyMemory.summaryThroughTurn, 54);
  assert.equal(game.storyMemory.summaryRevision, 3);
  scheduler.dispose();
});
