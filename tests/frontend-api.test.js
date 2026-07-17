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
              chapter: {
                id: 'qi',
                index: 1,
                title: '炼气：命火有痕',
                progress: 50,
                objectives: [{ text: '将炼气修至圆满', completed: false, required: true }]
              },
              log: [{ id: 'turn-4', title: '命途分岔', command: '继续', body: '第一段雾声压近，第二段命火回应' }]
            },
            turnResult: {
              mode: 'choice',
              chapterTransition: {
                fromChapterId: 'qi',
                toChapterId: 'foundation',
                fromTitle: '炼气：命火有痕',
                toTitle: '筑基：道基与宗门'
              },
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
  assert.deepEqual(result.game.chapter, {
    id: 'qi',
    index: 1,
    title: '炼气：命火有痕',
    progress: 50,
    objectives: [{ text: '将炼气修至圆满', completed: false, required: true }]
  });
  assert.deepEqual(result.turnResult.chapterTransition, {
    fromChapterId: 'qi',
    toChapterId: 'foundation',
    fromTitle: '炼气：命火有痕',
    toTitle: '筑基：道基与宗门'
  });
  assert.deepEqual(result.turnResult.choices, [{ id: 'choice_1', text: '追入雾中' }]);
  assert.equal('effectHints' in result.turnResult.choices[0], false);
});

test('frontend api stops story preview once the scene text is complete', async () => {
  const api = createGameApi({
    baseUrl: 'http://backend.test',
    preferredMode: 'api',
    fetchImpl: async () => sseResponse([
      ['story_delta', { text: '{"scene":"雾声贴近' }],
      ['story_delta', { text: '，命火回应"' }],
      ['story_delta', { text: ',"mode":"continue","npcLines":[{"speaker":"林师姐","line":"稳住"}]' }],
      ['story_delta', { text: ',"effectHints":[{"target":"lifespan","direction":"down"}],"choices":[]}' }],
      ['done', {
        ok: true,
        data: {
          game: {
            mode: 'api',
            turn: 4,
            version: 4,
            player: { name: '顾清河' },
            log: [{ id: 'turn-4', title: '命途续写', command: '继续', body: '雾声贴近，命火回应' }]
          },
          turnResult: { mode: 'continue', choices: [] }
        },
        error: null,
        requestId: 'req_story_complete'
      }]
    ])
  });
  const previews = [];

  await api.continueStoryStream({ mode: 'api', turn: 3, version: 3 }, {
    onStoryPreview: (preview) => previews.push(preview)
  });

  assert.deepEqual(previews, [
    '雾声贴近',
    '雾声贴近，命火回应'
  ]);
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

test('frontend api preserves public time result without raw backend fields', async () => {
  const api = createGameApi({
    baseUrl: 'http://backend.test',
    preferredMode: 'api',
    fetchImpl: async () => sseResponse([
      ['done', {
        ok: true,
        data: {
          game: {
            mode: 'api',
            turn: 4,
            version: 4,
            player: { name: '顾清河', lifespan: 42, maxLifespan: 116 },
            timePressure: { lastDeltaTime: '半年', warningLevel: 'strained' },
            lastTimeResult: { deltaMonths: 6 },
            log: [{ id: 'turn-4', title: '调息养命', command: '继续', body: '命火回稳。' }]
          },
          turnResult: {
            ruleResult: {
              eventId: 'story_director',
              choiceId: 'continue',
              timeResult: {
                label: '半年',
                netLifespanDelta: 2,
                maxLifespanDelta: 0,
                warningLevel: 'strained',
                note: '命火回稳。',
                deltaMonths: 6
              }
            },
            choices: []
          }
        },
        error: null,
        requestId: 'req_time'
      }]
    ])
  });

  const result = await api.continueStoryStream({ mode: 'api', turn: 3, version: 3 });

  assert.equal(result.turnResult.ruleResult.timeResult.label, '半年');
  assert.equal(result.turnResult.ruleResult.timeResult.netLifespanDelta, 2);
  assert.equal('deltaMonths' in result.turnResult.ruleResult.timeResult, false);
  assert.equal('eventId' in result.turnResult.ruleResult, false);
  assert.equal('choiceId' in result.turnResult.ruleResult, false);
  assert.equal('lastTimeResult' in result.game, false);
});

test('frontend api stops narration preview once the generated body text is complete', async () => {
  const api = createGameApi({
    baseUrl: 'http://backend.test',
    preferredMode: 'api',
    fetchImpl: async () => sseResponse([
      ['narration_delta', { text: '{"title":"闭关","body":"洞府雨声入帘' }],
      ['narration_delta', { text: '，命火渐稳"' }],
      ['narration_delta', { text: ',"npcLine":"林师姐道：\\"稳住。\\""' }],
      ['narration_delta', { text: ',"foreshadow":"雾隐余响","continuityNotes":[],"safetyFlags":[]}' }],
      ['done', {
        ok: true,
        data: {
          game: {
            mode: 'api',
            turn: 1,
            version: 1,
            player: { name: '顾清河' },
            log: [{ id: 'turn-1', title: '闭关', command: '闭关', body: '洞府雨声入帘，命火渐稳' }]
          }
        },
        error: null,
        requestId: 'req_narration_complete'
      }]
    ])
  });
  const previews = [];

  await api.submitDailyActionStream(
    { mode: 'api', turn: 0, version: 0 },
    { id: 'act_1', source: 'event', command: '闭关' },
    { onNarrationPreview: (preview) => previews.push(preview) }
  );

  assert.deepEqual(previews, [
    '洞府雨声入帘',
    '洞府雨声入帘，命火渐稳'
  ]);
});

test('frontend api resets an api game to the character creation shell', async () => {
  const fetchCalls = [];
  const api = createGameApi({
    baseUrl: 'http://backend.test',
    preferredMode: 'api',
    fetchImpl: async (input, init) => {
      fetchCalls.push({ input, body: JSON.parse(init.body) });
      return jsonResponse({
        game: {
          mode: 'api',
          turn: 0,
          version: 0,
          player: { name: '陆青玄' },
          onboarding: { completed: true, unlockedCharacterCreation: true },
          character: { traits: ['新手序章'] },
          log: [{ id: 'opening', title: '山门初醒' }]
        }
      });
    }
  });

  const game = await api.resetForCharacterCreation('api', { rerollSeed: 91 });

  assert.equal(fetchCalls[0].input, 'http://backend.test/api/v1/game/reset');
  assert.deepEqual(fetchCalls[0].body, { rerollSeed: 91 });
  assert.equal(game.mode, 'api');
  assert.equal(game.turn, 0);
  assert.equal(game.onboarding.completed, true);
  assert.equal(game.character.traits.includes('新手序章'), true);
});

test('frontend mock api reset returns a fresh character creation shell', async () => {
  const api = createGameApi({ seed: 21 });
  const game = await api.resetForCharacterCreation('mock', { rerollSeed: 91 });

  assert.equal(game.mode, 'mock');
  assert.equal(game.turn, 0);
  assert.equal(game.onboarding.completed, true);
  assert.equal(game.onboarding.unlockedCharacterCreation, true);
  assert.equal(game.characterSeed, undefined);
  assert.equal(game.character.traits.includes('新手序章'), true);
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

function jsonResponse(data) {
  return new Response(JSON.stringify({
    ok: true,
    data,
    error: null,
    requestId: 'req_reset'
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}
