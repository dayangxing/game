import test from 'node:test';
import assert from 'node:assert/strict';

import { createGameApi } from '../frontend/src/api/gameApi.js';

test('frontend game api creates an initial game state', async () => {
  const api = createGameApi({ seed: 21 });
  const game = await api.createGame();

  assert.equal(game.player.name, '陆青玄');
  assert.equal(game.turn, 0);
  assert.ok(game.suggestions.length >= 3);
  assert.match(game.storyMemory.longSummary, /青云宗|雾隐秘境/);
});

test('frontend game api advances a command without exposing engine details', async () => {
  const api = createGameApi({ seed: 21 });
  const game = await api.createGame();
  const next = await api.submitCommand(game, '找林师姐打听雾隐秘境的消息');

  assert.equal(next.turn, 1);
  assert.match(next.log.at(-1).npcLine, /林师姐/);
});

test('frontend mock api leaves npcLine empty for actions without npc involvement', async () => {
  const api = createGameApi({ seed: 21 });
  const game = await api.createGame();
  const next = await api.submitCommand(game, '闭关修炼一日，稳固丹田灵气');

  assert.equal(next.turn, 1);
  assert.equal(next.log.at(-1).npcLine, '');
  assert.equal(next.storyMemory.lastUpdatedTurn, 1);
  assert.equal(next.storyMemory.recentTurns.at(-1).action, '闭关修炼一日，稳固丹田灵气');
});

test('frontend api streams continuous story scene previews and public choices', async () => {
  const fetchCalls = [];
  const api = createGameApi({
    baseUrl: 'http://backend.test',
    preferredMode: 'api',
    fetchImpl: async (input, init) => {
      fetchCalls.push({ input, body: JSON.parse(init.body) });
      return sseResponse([
        ['story_delta', { text: '{"scene":"第一段雾声压近' }],
        ['story_delta', { text: '，第二段命火回应","mode":"choice"}' }],
        ['choices_ready', { choices: [{ id: 'choice_1', text: '追入雾中' }] }],
        ['done', {
          ok: true,
          data: {
            game: {
              mode: 'api',
              turn: 4,
              version: 4,
              player: { name: '顾清河' },
              log: [{ id: 'turn-4', title: '命途分岔', command: '继续', body: '第一段雾声压近，第二段命火回应' }]
            },
            turnResult: {
              mode: 'choice',
              choices: [{ id: 'choice_1', text: '追入雾中' }]
            }
          },
          error: null,
          requestId: 'req_story'
        }]
      ]);
    }
  });
  const previews = [];
  const choices = [];
  const game = { mode: 'api', turn: 3, version: 3 };

  const result = await api.continueStoryStream(game, {
    onStoryPreview: (preview) => previews.push(preview),
    onChoicesReady: (nextChoices) => choices.push(nextChoices)
  });

  assert.equal(fetchCalls[0].input, 'http://backend.test/api/v1/turns/stream');
  assert.deepEqual(fetchCalls[0].body, { type: 'continue', clientTurn: 3 });
  assert.ok(previews.some((preview) => preview.includes('第一段雾声压近')));
  assert.ok(previews.some((preview) => preview.includes('第二段命火回应')));
  assert.deepEqual(choices.at(-1), [{ id: 'choice_1', text: '追入雾中' }]);
  assert.equal(result.game.mode, 'api');
  assert.equal(result.game.turn, 4);
  assert.deepEqual(result.turnResult.choices, [{ id: 'choice_1', text: '追入雾中' }]);
  assert.equal('effectHints' in result.turnResult.choices[0], false);
});

test('frontend api submits a generated story choice by id without exposing hints', async () => {
  const fetchCalls = [];
  const api = createGameApi({
    baseUrl: 'http://backend.test',
    preferredMode: 'api',
    fetchImpl: async (input, init) => {
      fetchCalls.push({ input, body: JSON.parse(init.body) });
      return sseResponse([
        ['done', {
          ok: true,
          data: {
            game: {
              mode: 'api',
              turn: 6,
              version: 6,
              player: { name: '顾清河' },
              log: [{ id: 'turn-6', title: '雾隐余响', command: '追入雾中', body: '残符在雾里亮了一瞬。' }]
            },
            turnResult: { mode: 'continue', choices: [] }
          },
          error: null,
          requestId: 'req_choice'
        }]
      ]);
    }
  });

  const result = await api.chooseStoryStream(
    { mode: 'api', turn: 5, version: 5 },
    { id: 'choice_5_0_follow', text: '追入雾中', effectHints: [{ target: 'lifespan' }] }
  );

  assert.deepEqual(fetchCalls[0].body, {
    type: 'choice',
    choiceId: 'choice_5_0_follow',
    clientTurn: 5
  });
  assert.equal(result.game.turn, 6);
  assert.deepEqual(result.turnResult.choices, []);
});

test('frontend game api updates mode and exports story text', async () => {
  const api = createGameApi({ seed: 21 });
  const game = await api.setMode(await api.createGame(), 'api');
  const text = await api.exportStory(game);

  assert.equal(game.mode, 'api');
  assert.match(text, /问道浮生/);
});

function sseResponse(events) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const [name, data] of events) {
        controller.enqueue(encoder.encode(`event: ${name}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }
      controller.close();
    }
  }), {
    status: 200,
    headers: { 'content-type': 'text/event-stream; charset=utf-8' }
  });
}
