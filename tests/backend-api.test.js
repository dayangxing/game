import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '../backend/src/app.js';
import { EVENT_CATALOG } from '../backend/src/domain/events/eventCatalog.js';
import { ONBOARDING_STEPS } from '../backend/src/domain/onboarding.js';
import { getModelSelection } from '../backend/src/llm/modelSelection.js';
import { createResourceDraft } from '../backend/src/domain/resources/resourceDraft.js';

test('model selection defaults to Bailian qwen3.7-plus without exposing an API key', () => {
  const selection = getModelSelection({});

  assert.equal(selection.provider, 'bailian');
  assert.equal(selection.chatModel, 'qwen3.7-plus');
  assert.equal(selection.fastModel, 'qwen3.6-flash');
  assert.equal(selection.premiumModel, 'qwen3.7-max');
  assert.equal(selection.apiKey, null);
  assert.match(selection.baseUrl, /dashscope/);
});

test('GET /api/v1/game/state returns the authoritative game state envelope', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  const response = await app.handle(makeRequest('GET', '/api/v1/game/state'));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.error, null);
  assert.match(payload.requestId, /^req_/);
  assert.equal(payload.data.game.player.name, '陆青玄');
  assert.equal(payload.data.game.turn, 0);
});

test('pending resource draft blocks ordinary actions and exposes three public choices', async () => {
  const app = createBackendApp({ seed: 73, now: fixedNow });
  const state = app.getState();
  state.game = createResourceDraft({
    game: state.game,
    poolId: 'mistRelics',
    sourceEventId: 'mist_relic_cache',
    sourceEventTitle: '雾中遗物',
    reason: '雾灯下的遗物',
    turn: state.game.turn
  });

  const response = await app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'home',
    gameVersion: state.game.version
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.actions.length, 3);
  assert.equal(payload.data.actions.every((action) => action.category === 'resource'), true);
  assert.equal(payload.data.actions.every((action) => action.preview?.name), true);
  assert.equal(JSON.stringify(payload).includes('poolId'), false);
  assert.equal(JSON.stringify(payload).includes('resourceId'), false);
  assert.equal(JSON.stringify(payload).includes('bonuses'), false);
});

test('game state sanitizes pending resource draft internals', async () => {
  const app = createBackendApp({ seed: 73, now: fixedNow });
  app.getState().game = createResourceDraft({
    game: app.getState().game,
    poolId: 'mistRelics',
    sourceEventId: 'mist_relic_cache',
    sourceEventTitle: '雾中遗物',
    reason: '雾灯下的遗物',
    turn: 0
  });

  const payload = await jsonResponse(app.handle(makeRequest('GET', '/api/v1/game/state')));
  const pendingDraft = payload.data.game.resourceRun.pendingDraft;
  const serialized = JSON.stringify(pendingDraft);

  assert.equal(pendingDraft.poolId, undefined);
  assert.equal(serialized.includes('resourceId'), false);
  assert.equal(serialized.includes('bonuses'), false);
  assert.equal(serialized.includes('realmAtLeast'), false);
});

test('selecting a resource draft changes the collection without spending a turn', async () => {
  const app = createBackendApp({ seed: 73, now: fixedNow });
  const state = app.getState();
  state.game = createResourceDraft({
    game: state.game,
    poolId: 'mistRelics',
    sourceEventId: 'mist_relic_cache',
    sourceEventTitle: '雾中遗物',
    reason: '雾灯下的遗物',
    turn: state.game.turn
  });
  const before = state.game;
  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'home',
    gameVersion: before.version
  })));
  const selectedResponse = await app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: actionsPayload.data.actions[0].id,
    clientTurn: before.turn
  }));
  const selected = await selectedResponse.json();

  assert.equal(selectedResponse.status, 200);
  assert.equal(selected.data.game.turn, before.turn);
  assert.equal(selected.data.game.player.lifespan, before.player.lifespan);
  assert.equal(selected.data.game.resourceRun.pendingDraft, null);
  assert.equal(selected.data.game.techniques.length + selected.data.game.treasures.length, 1);
  assert.equal(selected.data.turnResult.ruleResult.eventId, 'resource_draft');
});

test('pending resource draft blocks continuous story stream without spending time', async () => {
  const app = createBackendApp({ seed: 73, now: fixedNow });
  const state = app.getState();
  state.game = createResourceDraft({
    game: state.game,
    poolId: 'mistRelics',
    sourceEventId: 'mist_relic_cache',
    sourceEventTitle: '雾中遗物',
    reason: '雾灯下的遗物',
    turn: state.game.turn
  });

  const response = await app.handle(makeRequest('POST', '/api/v1/turns/stream', {
    type: 'continue',
    clientTurn: state.game.turn
  }));
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error.code, 'RESOURCE_DRAFT_PENDING');
  assert.equal(state.game.turn, 0);
  assert.equal(state.game.resourceRun.pendingDraft !== null, true);
});

test('resource draft actions resolve through the streaming turn endpoint without advancing time', async () => {
  const app = createBackendApp({ seed: 73, now: fixedNow });
  const state = app.getState();
  state.game = createResourceDraft({
    game: state.game,
    poolId: 'mistRelics',
    sourceEventId: 'mist_relic_cache',
    sourceEventTitle: '雾中遗物',
    reason: '雾灯下的遗物',
    turn: state.game.turn
  });
  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'home',
    gameVersion: state.game.version
  })));

  const response = await app.handle(makeRequest('POST', '/api/v1/turns/stream', {
    actionId: actionsPayload.data.actions[0].id,
    clientTurn: state.game.turn
  }));
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /resource_draft/);
  assert.equal(state.game.turn, 0);
  assert.equal(state.game.resourceRun.pendingDraft, null);
});

test('GET /api/v1/game/state starts in tutorial onboarding mode', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  const payload = await jsonResponse(app.handle(makeRequest('GET', '/api/v1/game/state')));

  assert.equal(payload.data.game.player.name, '陆青玄');
  assert.equal(payload.data.game.onboarding.completed, false);
  assert.equal(payload.data.game.onboarding.stepId, 'awakening');
  assert.equal(payload.data.game.character.name, '陆青玄');
  assert.equal(payload.data.game.inventory.materials.凝露草 >= 0, true);
  assert.deepEqual(payload.data.game.flags, {});
});

test('POST /api/v1/game/new is locked until onboarding is complete', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  const response = await app.handle(makeRequest('POST', '/api/v1/game/new', {
    name: '顾清河',
    rerollSeed: 52
  }));
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, 'ONBOARDING_REQUIRED');
});

test('POST /api/v1/game/character-preview matches formal creation without mutating the game', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  const state = app.getState();
  state.game.onboarding = completedOnboardingState();
  const attributes = {
    rootBone: 7,
    comprehension: 6,
    fortune: 4,
    willpower: 4,
    lifeSeed: 4
  };
  const before = {
    turn: state.game.turn,
    version: state.game.version,
    character: structuredClone(state.game.character),
    pendingActions: state.pendingActions.size
  };

  const previewPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/game/character-preview', {
    name: '顾清河',
    rerollSeed: 52,
    attributes
  })));

  assert.equal(previewPayload.ok, true);
  assert.equal(previewPayload.data.character.name, '顾清河');
  assert.equal(typeof previewPayload.data.character.origin, 'string');
  assert.equal(typeof previewPayload.data.character.spiritualRoot, 'string');
  assert.ok(Array.isArray(previewPayload.data.character.traits));
  assert.deepEqual(previewPayload.data.character.attributes, attributes);
  assert.equal(state.game.turn, before.turn);
  assert.equal(state.game.version, before.version);
  assert.deepEqual(state.game.character, before.character);
  assert.equal(state.pendingActions.size, before.pendingActions);

  const formalPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/game/new', {
    name: '顾清河',
    rerollSeed: 52,
    attributes
  })));

  assert.deepEqual(
    {
      origin: previewPayload.data.character.origin,
      spiritualRoot: previewPayload.data.character.spiritualRoot,
      traits: previewPayload.data.character.traits
    },
    {
      origin: formalPayload.data.character.origin,
      spiritualRoot: formalPayload.data.character.spiritualRoot,
      traits: formalPayload.data.character.traits
    }
  );
});

test('POST /api/v1/game/character-preview validates manual attributes', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();

  const response = await app.handle(makeRequest('POST', '/api/v1/game/character-preview', {
    name: '顾清河',
    rerollSeed: 52,
    attributes: {
      rootBone: 7,
      comprehension: 6,
      fortune: 4,
      willpower: 4,
      lifeSeed: 5
    }
  }));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.error.code, 'CHARACTER_ATTRIBUTES_INVALID');
});

test('POST /api/v1/game/new creates a seeded formal character after onboarding', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();

  const payload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/game/new', {
    name: '顾清河',
    rerollSeed: 52
  })));

  assert.equal(payload.ok, true);
  assert.equal(payload.data.character.name, '顾清河');
  assert.equal(payload.data.game.player.name, '顾清河');
  assert.notEqual(payload.data.game.player.name, '陆青玄');
  assert.equal(payload.data.game.characterSeed, 52);
  assert.deepEqual(payload.data.character.attributes, {
    rootBone: 3,
    comprehension: 6,
    fortune: 6,
    willpower: 5,
    lifeSeed: 5
  });
  assert.equal(payload.data.character.comprehension, 54);
  assert.equal(payload.data.character.physique, 27);
  assert.equal(payload.data.character.luck, 54);
  assert.equal(payload.data.game.player.maxHealth, 114);
  assert.equal(payload.data.game.player.health, 114);
  assert.equal(payload.data.game.player.maxLifespan, payload.data.character.initialLifespan + 40);
  assert.equal(payload.data.game.player.lifespan, payload.data.character.initialLifespan + 40);
  assert.equal(payload.data.game.mode, 'api');
  assert.equal(payload.data.game.onboarding.completed, true);
  assert.equal(payload.data.game.onboarding.stepId, 'formal_life');
  assert.equal(payload.data.game.onboarding.unlockedCharacterCreation, true);
  assert.deepEqual(payload.data.game.onboarding.completedStepIds, completedOnboardingState().completedStepIds);
});

test('POST /api/v1/game/new uses the story director to write the formal turn-zero opening', async () => {
  let directorCalls = 0;
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async generateStoryDirector({ game, input }) {
        directorCalls += 1;
        assert.equal(game.turn, 0);
        assert.equal(input.type, 'continue');
        return {
          scene: 'LLM 开篇：命簿上的墨迹尚未干透，山门晨雾便沿着你的土灵根气息缓缓聚拢。',
          mode: 'choice',
          npcLines: [{ npcId: 'xuanheng', speaker: '玄衡长老', line: '命簿只记来处，不替你决定去处。' }],
          effectHints: [],
          choices: [
            { id: 'enter_gate', title: '入山门', text: '沿着青云石阶走入外门', tone: 'cautious', effectHints: [] },
            { id: 'ask_elder', title: '问长老', text: '先向玄衡长老询问命簿异样', tone: 'sect', effectHints: [] }
          ],
          memoryHints: ['土灵根入山后的命簿异样。']
        };
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();

  const payload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/game/new', {
    name: '顾清河',
    rerollSeed: 52
  })));

  assert.equal(payload.ok, true);
  assert.equal(directorCalls, 0);
  assert.equal(payload.data.game.turn, 0);

  const actions = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'home',
    gameVersion: 0
  })));
  assert.equal(directorCalls, 1);
  assert.match(actions.data.game.log[0].body, /^LLM 开篇/);
  assert.match(actions.data.game.log[0].npcLine, /命簿只记来处/);
  assert.deepEqual(actions.data.actions.map((action) => action.command), [
    '沿着青云石阶走入外门',
    '先向玄衡长老询问命簿异样'
  ]);
});

test('POST /api/v1/game/new does not wait for director generation', async () => {
  let directorCalls = 0;
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async generateStoryDirector() {
        directorCalls += 1;
        return {
          scene: '延后抵达的开场',
          mode: 'choice',
          npcLines: [],
          effectHints: [],
          choices: [
            { id: 'one', text: '沿山道前行', tone: 'mystery', effectHints: [] },
            { id: 'two', text: '回山门求助', tone: 'sect', effectHints: [] }
          ],
          memoryHints: []
        };
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();

  const responsePromise = app.handle(makeRequest('POST', '/api/v1/game/new', {
    name: '顾清河',
    rerollSeed: 52
  }));
  const returnedQuickly = await Promise.race([
    responsePromise.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 25))
  ]);

  assert.equal(returnedQuickly, true);
  assert.equal(directorCalls, 0);
  await responsePromise;
});

test('POST /api/v1/daily-actions/stream streams the formal turn-zero scene before returning choices', async () => {
  const streamedChunks = [
    '{"scene":"第0回合流式开篇：山门晨雾沿着命簿上的墨痕缓缓聚拢，',
    '你尚未迈步，便听见远处传来一声沉钟。","mode":"choice",',
    '"npcLines":[],"effectHints":[],"choices":[',
    '{"id":"enter","title":"入山门","text":"沿山道走入青云外门","tone":"cautious","effectHints":[]},',
    '{"id":"ask","title":"问长老","text":"先向玄衡长老询问命簿异样","tone":"sect","effectHints":[]}],',
    '"memoryHints":[]}'
  ];
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async *streamStoryDirector() {
        for (const chunk of streamedChunks) yield chunk;
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();
  await jsonResponse(app.handle(makeRequest('POST', '/api/v1/game/new', {
    name: '顾清河',
    rerollSeed: 52
  })));

  const response = await app.handle(makeRequest('POST', '/api/v1/daily-actions/stream', {
    viewId: 'home',
    gameVersion: 0
  }));
  const body = await response.text();
  const done = parseSseEvent(body, 'done');

  assert.equal(response.status, 200);
  assert.ok(body.indexOf('event: story_delta') > -1);
  assert.ok(body.indexOf('event: story_delta') < body.indexOf('event: done'));
  assert.equal(done.ok, true);
  assert.equal(done.data.game.turn, 0);
  assert.match(done.data.game.log[0].body, /第0回合流式开篇/);
  assert.deepEqual(done.data.actions.map((action) => action.command), [
    '沿山道走入青云外门',
    '先向玄衡长老询问命簿异样'
  ]);
});

test('daily action story stream forwards an LLM retry reset before the next attempt', async () => {
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async *streamStoryDirector({ onRetry }) {
        onRetry?.({ attempt: 1, maxRetries: 3 });
        yield JSON.stringify({
          scene: '重试后的开局场景',
          mode: 'choice',
          npcLines: [],
          effectHints: [],
          choices: [
            { id: 'one', text: '沿山道前行', tone: 'mystery', effectHints: [] },
            { id: 'two', text: '回山门求助', tone: 'sect', effectHints: [] }
          ],
          memoryHints: []
        });
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();
  await jsonResponse(app.handle(makeRequest('POST', '/api/v1/game/new', {
    name: '顾清河',
    rerollSeed: 52
  })));

  const response = await app.handle(makeRequest('POST', '/api/v1/daily-actions/stream', {
    viewId: 'home',
    gameVersion: 0
  }));
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.ok(body.includes('event: story_reset'));
  assert.ok(body.indexOf('event: story_reset') < body.indexOf('event: story_delta'));
  assert.match(body, /"attempt":1/);
});

test('turn narration stream forwards an LLM retry reset before the next attempt', async () => {
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async *streamNarration({ onRetry }) {
        onRetry?.({ attempt: 1, maxRetries: 3 });
        yield JSON.stringify({
          title: '重试后的叙事',
          body: '山门雨声重新落定，规则结算已经保存，模型只负责把这一回合写成连贯而清晰的修行见闻。',
          npcLine: '',
          foreshadow: '',
          continuityNotes: [],
          safetyFlags: []
        });
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();
  const actions = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'home',
    gameVersion: 0
  })));
  const action = actions.data.actions[0];

  const response = await app.handle(makeRequest('POST', '/api/v1/turns/stream', {
    actionId: action.id,
    clientTurn: 0
  }));
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.ok(body.includes('event: narration_reset'));
  assert.ok(body.includes('event: done'));
});

test('concurrent daily-action refreshes share one director generation and action set', async () => {
  let directorCalls = 0;
  let releaseGeneration;
  let markGenerationStarted;
  const generationStarted = new Promise((resolve) => { markGenerationStarted = resolve; });
  const generationGate = new Promise((resolve) => { releaseGeneration = resolve; });
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async generateStoryDirector() {
        directorCalls += 1;
        markGenerationStarted();
        await generationGate;
        return {
          scene: '同一批导演选项场景',
          mode: 'choice',
          npcLines: [],
          effectHints: [],
          choices: [
            { id: 'one', text: '沿山道前行', tone: 'mystery', effectHints: [] },
            { id: 'two', text: '回山门求助', tone: 'sect', effectHints: [] }
          ],
          memoryHints: []
        };
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();
  const request = () => app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'home',
    gameVersion: 0
  }));

  const firstResponsePromise = request();
  const secondResponsePromise = request();
  await generationStarted;
  releaseGeneration();
  const [first, second] = await Promise.all([
    jsonResponse(firstResponsePromise),
    jsonResponse(secondResponsePromise)
  ]);

  assert.equal(directorCalls, 1);
  assert.deepEqual(first.data.actions.map((action) => action.id), second.data.actions.map((action) => action.id));
  assert.equal(app.getState().pendingActions.size, 2);
});

test('the same director choice cannot open two concurrent turn settlements', async () => {
  let streamCalls = 0;
  let releaseStream;
  let streamStarted;
  const started = new Promise((resolve) => { streamStarted = resolve; });
  const gate = new Promise((resolve) => { releaseStream = resolve; });
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async generateStoryDirector() {
        return {
          scene: '开局场景',
          mode: 'choice',
          npcLines: [],
          effectHints: [],
          choices: [
            { id: 'first', title: '先行', text: '先沿山道观察', tone: 'mystery', effectHints: [] },
            { id: 'second', title: '求助', text: '先向宗门求助', tone: 'sect', effectHints: [] }
          ],
          memoryHints: []
        };
      },
      async *streamStoryDirector() {
        streamCalls += 1;
        if (streamCalls === 1) streamStarted();
        await gate;
        yield JSON.stringify({
          scene: '结算后的连续剧情',
          mode: 'continue',
          npcLines: [],
          effectHints: [],
          choices: [],
          memoryHints: []
        });
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();
  const actions = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'home',
    gameVersion: 0
  })));
  const choiceId = actions.data.actions[0].id;
  const request = () => app.handle(makeRequest('POST', '/api/v1/turns/stream', {
    type: 'choice',
    choiceId,
    clientTurn: 0
  }));

  const firstResponsePromise = request();
  const secondResponsePromise = request();
  const [firstResponse, secondResponse] = await Promise.all([firstResponsePromise, secondResponsePromise]);
  await started;
  releaseStream();
  const [firstBody, secondBody] = await Promise.all([firstResponse.text(), secondResponse.text()]);

  assert.equal(streamCalls, 1);
  assert.equal(app.getState().game.turn, 1);
  assert.equal([firstResponse.status, secondResponse.status].filter((status) => status === 409 || status === 404).length, 1);
  assert.ok(firstBody.includes('event: done') || secondBody.includes('event: done'));
});

test('POST /api/v1/game/new accepts a manual attribute allocation after onboarding', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();

  const payload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/game/new', {
    name: '顾清河',
    rerollSeed: 52,
    attributes: {
      rootBone: 7,
      comprehension: 6,
      fortune: 4,
      willpower: 4,
      lifeSeed: 4
    }
  })));

  assert.equal(payload.ok, true);
  assert.deepEqual(payload.data.character.attributes, {
    rootBone: 7,
    comprehension: 6,
    fortune: 4,
    willpower: 4,
    lifeSeed: 4
  });
  assert.equal(payload.data.character.comprehension, 54);
  assert.equal(payload.data.character.physique, 63);
  assert.equal(payload.data.character.luck, 36);
  assert.equal(payload.data.game.player.maxHealth, 144);
  assert.equal(payload.data.game.player.health, 144);
  assert.equal(payload.data.game.player.maxLifespan, payload.data.character.initialLifespan + 32);
  assert.equal(payload.data.game.player.lifespan, payload.data.character.initialLifespan + 32);
});

test('POST /api/v1/game/new rejects invalid manual attribute allocations', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();

  const response = await app.handle(makeRequest('POST', '/api/v1/game/new', {
    name: '顾清河',
    rerollSeed: 52,
    attributes: {
      rootBone: 7,
      comprehension: 6,
      fortune: 4,
      willpower: 4,
      lifeSeed: 5
    }
  }));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, 'CHARACTER_ATTRIBUTES_INVALID');
});

test('POST /api/v1/game/new invalidates stale pending actions and saved turn snapshots', async () => {
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async generateNarration({ afterGame, action }) {
        return {
          status: 'generated',
          title: '旧存档叙事',
          body: `教程存档在第${afterGame.turn}回合执行了${action.title}。`,
          npcLine: '林师姐道：“这段记录应随旧命簿封存。”',
          foreshadow: '旧命簿已结。'
        };
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();
  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'cultivation',
    gameVersion: 0
  })));
  const [usedAction, staleAction] = actionsPayload.data.actions;

  await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: usedAction.id,
    clientTurn: 0
  })));

  app.getState().game.onboarding = completedOnboardingState();
  const newGamePayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/game/new', {
    name: '顾清河',
    rerollSeed: 52
  })));
  const staleActionResponse = await app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: staleAction.id,
    clientTurn: 0
  }));
  const staleActionPayload = await staleActionResponse.json();
  const staleNarrationResponse = await app.handle(makeRequest('POST', '/api/v1/turns/1/narration'));
  const staleNarrationPayload = await staleNarrationResponse.json();

  assert.equal(newGamePayload.ok, true);
  assert.equal(newGamePayload.data.game.onboarding.completed, true);
  assert.equal(app.getState().pendingActions.size, 0);
  assert.equal(app.getState().turnSnapshots.size, 0);
  assert.equal(staleActionResponse.status, 404);
  assert.equal(staleActionPayload.error.code, 'ACTION_NOT_FOUND');
  assert.equal(staleNarrationResponse.status, 404);
  assert.equal(staleNarrationPayload.error.code, 'TURN_SNAPSHOT_NOT_FOUND');
});

test('POST /api/v1/game/reset clears records and returns to formal character creation', async () => {
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async generateNarration({ afterGame, action }) {
        return {
          status: 'generated',
          title: '旧世余声',
          body: `旧世第${afterGame.turn}回合曾执行${action.title}，这段记录应在重开后清空。`,
          npcLine: '',
          foreshadow: '旧世记录应被封存。'
        };
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();
  await jsonResponse(app.handle(makeRequest('POST', '/api/v1/game/new', {
    name: '顾清河',
    rerollSeed: 52
  })));
  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'home',
    gameVersion: app.getState().game.version
  })));
  const [usedAction] = actionsPayload.data.actions;
  await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: usedAction.id,
    clientTurn: app.getState().game.turn
  })));

  const resetPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/game/reset', {
    rerollSeed: 77
  })));

  assert.equal(resetPayload.ok, true);
  assert.equal(resetPayload.data.game.mode, 'api');
  assert.equal(resetPayload.data.game.turn, 0);
  assert.equal(resetPayload.data.game.log.length, 1);
  assert.equal(resetPayload.data.game.player.name, '');  // empty to trigger character creation UI
  assert.equal(resetPayload.data.game.onboarding.completed, true);
  assert.equal(resetPayload.data.game.onboarding.unlockedCharacterCreation, true);
  assert.equal(resetPayload.data.game.characterSeed, undefined);
  assert.equal(resetPayload.data.game.character.traits.includes('新手序章'), true);
  assert.equal(app.getState().pendingActions.size, 0);
  assert.equal(app.getState().pendingDirectorChoices.size, 0);
  assert.equal(app.getState().turnSnapshots.size, 0);
});

test('prologue actions complete onboarding through daily-actions and turns', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  const startingLifespan = app.getState().game.player.lifespan;

  for (const expectedStep of ONBOARDING_STEPS.map((step) => step.id)) {
    const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
      viewId: 'home',
      gameVersion: app.getState().game.version
    })));
    const [action] = actionsPayload.data.actions;
    const onboardingStep = ONBOARDING_STEPS.find((step) => step.id === expectedStep);

    assert.equal(action.title, onboardingStep.actionTitle);
    assert.equal(action.command, onboardingStep.command);
    assertPublicActionShape(action);

    const turnPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns', {
      actionId: action.id,
      clientTurn: app.getState().game.turn
    })));

    assert.equal(turnPayload.ok, true);
    assert.equal(turnPayload.data.game.onboarding.completedStepIds.includes(expectedStep), true);
    assert.equal(turnPayload.data.game.player.lifespan, startingLifespan);
  }

  assert.equal(app.getState().game.onboarding.completed, true);
  assert.equal(app.getState().game.onboarding.unlockedCharacterCreation, true);
  assert.equal(app.getState().game.player.lifespan, startingLifespan);
});

test('POST /api/v1/daily-actions rejects stale game version during tutorial onboarding', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  const response = await app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'home',
    gameVersion: 999
  }));
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, 'GAME_VERSION_MISMATCH');
});

test('POST /api/v1/daily-actions falls back when no eligible event actions remain for a formal view', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();
  app.getState().game.cooldowns = Object.fromEntries(
    EVENT_CATALOG
      .filter((event) => event.trigger?.viewIds?.includes('cultivation'))
      .map((event) => [event.id, app.getState().game.turn])
  );
  const response = await app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'cultivation',
    gameVersion: 0
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.actions.length, 4);
  assert.ok(payload.data.actions.every((action) => action.id.startsWith('act_')));
  assert.ok(payload.data.actions.every((action) => hasOnlyPublicActionFields(action)));
  assert.ok(payload.data.actions.some((action) => action.command.includes('闭关')));
  assert.ok(payload.data.actions.every((action) => action.expiresAt === '2026-06-29T08:30:00.000Z'));
});

test('POST /api/v1/daily-actions returns event choices for formal games', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();

  const payload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'realm',
    gameVersion: 0
  })));

  assert.equal(payload.ok, true);
  assert.ok(payload.data.actions.length >= 3);
  assert.ok(payload.data.actions.every((action) => hasOnlyPublicActionFields(action)));
  assert.ok(payload.data.actions.some((action) => action.title === '靠近铜铃'));
});

test('POST /api/v1/daily-actions uses storyDirector from turn zero and after each settlement', async () => {
  const directorInputs = [];
  const narrationInputs = [];
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async generateNarration(input) {
        narrationInputs.push(input);
        return {
          status: 'generated',
          title: '命途分岔',
          body: `LLM 已续写第${input.afterGame.turn}回合的命途。`,
          npcLine: '',
          foreshadow: ''
        };
      },
      async generateStoryDirector(input) {
        directorInputs.push(input);
        return {
          scene: '雾中铜铃再次响起，窗纸上的水痕像一行未写完的旧契，提醒你必须决定下一步如何追查。',
          mode: 'choice',
          npcLines: [],
          effectHints: [],
          choices: [
            { id: 'follow_bell', text: '循着铜铃前往后山', tone: 'mystery', effectHints: [] },
            { id: 'report_bell', text: '先向玄衡长老禀报', tone: 'sect', effectHints: [] }
          ],
          memoryHints: ['雾中铜铃再次响起。']
        };
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();

  const initial = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'realm',
    gameVersion: 0
  })));
  const firstAction = initial.data.actions.find((action) => action.command === '循着铜铃前往后山');

  assert.ok(firstAction);
  assert.equal(directorInputs.length, 1);
  assert.equal(directorInputs[0].game.turn, 0);
  assert.equal(directorInputs[0].input.type, 'continue');
  assert.deepEqual(initial.data.actions.map((action) => action.title), [
    '抉择 1',
    '抉择 2'
  ]);
  assert.deepEqual(initial.data.actions.map((action) => action.command), [
    '循着铜铃前往后山',
    '先向玄衡长老禀报'
  ]);
  assert.ok(initial.data.actions.every((action) => action.title !== action.command));

  const firstTurn = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: firstAction.id,
    clientTurn: 0
  })));
  assert.equal(firstTurn.ok, true);
  assert.equal(firstTurn.data.game.turn, 1);
  assert.equal(firstTurn.data.turnResult.ruleResult.eventId, 'story_director');
  assert.equal(firstTurn.data.turnResult.narration.status, 'generated');
  assert.equal(narrationInputs.length, 1);
  assert.equal(narrationInputs[0].action.source, 'director');

  const next = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'realm',
    gameVersion: 1
  })));

  assert.equal(directorInputs.length, 2);
  assert.equal(directorInputs[1].game.turn, 1);
  assert.equal(directorInputs[1].input.type, 'continue');
  assert.deepEqual(next.data.actions.map((action) => action.title), [
    '抉择 1',
    '抉择 2'
  ]);
  assert.ok(next.data.actions.every((action) => action.id.startsWith('act_')));
  assert.ok(next.data.actions.every((action) => action.category === 'director'));

  const refreshed = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'realm',
    gameVersion: 1
  })));
  assert.equal(directorInputs.length, 2);
  assert.deepEqual(refreshed.data.actions.map((action) => action.id), next.data.actions.map((action) => action.id));

  const directorTurn = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: next.data.actions[0].id,
    clientTurn: 1
  })));

  assert.equal(directorTurn.ok, true);
  assert.equal(directorTurn.data.game.turn, 2);
  assert.equal(directorTurn.data.turnResult.ruleResult.eventId, 'story_director');
});

test('daily director actions continue through the streamed choice path', async () => {
  const nextDirectorOutput = {
    scene: '你循着铜铃踏入后山，雾线在脚边裂开一道细缝，露出残缺符纹。',
    mode: 'choice',
    npcLines: [],
    effectHints: [],
    choices: [
      { id: 'enter_mist', title: '深入雾线', text: '沿着符纹进入雾隐秘境', tone: 'mystery', effectHints: [] },
      { id: 'mark_path', title: '留下记号', text: '先在石门外刻下回返记号', tone: 'cautious', effectHints: [] }
    ],
    memoryHints: ['雾隐秘境入口已经显形。']
  };
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async generateStoryDirector() {
        return {
          scene: '雾中铜铃在窗外再响一声，水痕沿着窗纸聚成一枚残契。',
          mode: 'choice',
          npcLines: [],
          effectHints: [],
          choices: [
            { id: 'follow_bell', title: '追查铜铃', text: '循着铜铃前往后山', tone: 'mystery', effectHints: [] },
            { id: 'report_bell', title: '求助宗门', text: '先向玄衡长老禀报', tone: 'sect', effectHints: [] }
          ],
          memoryHints: ['雾中铜铃再次响起。']
        };
      },
      async *streamStoryDirector({ input }) {
        assert.equal(input.type, 'choice');
        yield JSON.stringify(nextDirectorOutput);
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();

  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'realm',
    gameVersion: 0
  })));
  const [action] = actionsPayload.data.actions;

  const response = await app.handle(makeRequest('POST', '/api/v1/turns/stream', {
    type: 'choice',
    choiceId: action.id,
    clientTurn: 0
  }));
  const body = await response.text();
  const done = parseSseEvent(body, 'done');

  assert.equal(response.status, 200);
  assert.ok(body.indexOf('event: story_delta') > -1);
  assert.ok(body.indexOf('event: story_delta') < body.indexOf('event: done'));
  assert.equal(done.ok, true);
  assert.equal(done.data.game.turn, 1);
  assert.deepEqual(done.data.turnResult.choices.map((choice) => choice.text), [
    '沿着符纹进入雾隐秘境',
    '先在石门外刻下回返记号'
  ]);
});

test('POST /api/v1/daily-actions returns at least three eligible skills event actions', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();

  const payload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'skills',
    gameVersion: 0
  })));

  assert.equal(payload.ok, true);
  assert.ok(payload.data.actions.length >= 3);
  assert.ok(payload.data.actions.every((action) => hasOnlyPublicActionFields(action)));
  assert.ok(payload.data.actions.some((action) => action.title === '请教瓶颈'));
});

test('POST /api/v1/daily-actions inserts a breakthrough action before normal cultivation events', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();

  await jsonResponse(app.handle(makeRequest('POST', '/api/v1/game/new', {
    name: '顾清河',
    rerollSeed: 52
  })));
  app.getState().game.player.cultivationProgress = 100;

  const payload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'cultivation',
    gameVersion: 0
  })));

  assert.equal(payload.ok, true);
  assert.equal(payload.data.actions[0].title, '尝试突破');
  assert.match(payload.data.actions[0].meta, /突破至炼气二层/);
  assert.match(payload.data.actions[0].meta, /成功率 \d+%/);
  assert.doesNotMatch(payload.data.actions[0].meta, /breakthrough|attempt|choice/i);
  assertPublicActionShape(payload.data.actions[0]);
});

test('POST /api/v1/daily-actions hides unaffordable crafting choices for formal bag view', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();
  app.getState().game.inventory.materials.凝露草 = 0;

  const payload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'bag',
    gameVersion: 0
  })));

  assert.equal(payload.ok, true);
  assert.equal(payload.data.actions.some((action) => action.title === '炼制聚气丹'), false);
});

test('POST /api/v1/daily-actions hides spirit-stone offers the player cannot afford', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();
  app.getState().game.player.spiritStones = 10;

  const payload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'bag',
    gameVersion: 0
  })));

  assert.equal(payload.ok, true);
  assert.equal(payload.data.actions.some((action) => action.title === '交换雷纹草'), false);
});

test('POST /api/v1/daily-actions returns breakthrough plus fallback actions when cultivation events are exhausted', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();

  await jsonResponse(app.handle(makeRequest('POST', '/api/v1/game/new', {
    name: '顾清河',
    rerollSeed: 52
  })));
  app.getState().game.player.cultivationProgress = 100;
  app.getState().game.cooldowns = Object.fromEntries(
    EVENT_CATALOG
      .filter((event) => event.trigger?.viewIds?.includes('cultivation'))
      .map((event) => [event.id, app.getState().game.turn])
  );

  const payload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'cultivation',
    gameVersion: 0
  })));

  assert.equal(payload.ok, true);
  assert.equal(payload.data.actions.length, 4);
  assert.equal(payload.data.actions[0].title, '尝试突破');
  assert.match(payload.data.actions[0].meta, /突破至炼气二层/);
  assert.match(payload.data.actions[0].meta, /成功率 \d+%/);
  assert.ok(payload.data.actions.slice(1).some((action) => action.command.includes('闭关修炼三月')));
  assert.ok(payload.data.actions.every((action) => hasOnlyPublicActionFields(action)));
});

test('POST /api/v1/daily-actions keeps routing fields server-side while returning only public action fields', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();

  await jsonResponse(app.handle(makeRequest('POST', '/api/v1/game/new', {
    name: '顾清河',
    rerollSeed: 52
  })));
  app.getState().game.player.cultivationProgress = 100;

  const payload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'cultivation',
    gameVersion: 0
  })));
  const [publicBreakthrough, publicEvent] = payload.data.actions;
  const pendingBreakthrough = app.getState().pendingActions.get(publicBreakthrough.id);
  const pendingEvent = app.getState().pendingActions.get(publicEvent.id);

  assertPublicActionShape(publicBreakthrough);
  assert.equal('source' in publicBreakthrough, false);
  assert.equal('risk' in publicBreakthrough, false);
  assert.equal('eventId' in publicBreakthrough, false);
  assert.equal('choiceId' in publicBreakthrough, false);
  assert.equal('breakthroughPreview' in publicBreakthrough, false);

  assertPublicActionShape(publicEvent);
  assert.equal('source' in publicEvent, false);
  assert.equal(publicEvent.category, pendingEvent.event.category);
  assert.equal(publicEvent.risk, pendingEvent.choice.risk);
  assert.equal('eventId' in publicEvent, false);
  assert.equal('choiceId' in publicEvent, false);
  assert.equal('event' in publicEvent, false);
  assert.equal('choice' in publicEvent, false);

  assert.equal(pendingBreakthrough.source, 'breakthrough');
  assert.equal(pendingBreakthrough.breakthroughPreview.targetRealm, '炼气二层');
  assert.equal(pendingBreakthrough.eventId, 'breakthrough_attempt');
  assert.equal(pendingBreakthrough.choiceId, 'attempt');

  assert.equal(pendingEvent.source, 'event');
  assert.equal(typeof pendingEvent.event?.id, 'string');
  assert.equal(typeof pendingEvent.choice?.id, 'string');
  assert.equal(pendingEvent.choice.label, publicEvent.title);
  assert.match(publicEvent.meta, new RegExp(pendingEvent.event.title));
});

test('public event actions expose cadence and risk without internal event rules', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();

  const payload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'realm',
    gameVersion: app.getState().game.version
  })));
  const event = payload.data.actions.find((action) => action.cadence === 'mainline' || action.cadence === 'side');

  assert.ok(event);
  assert.ok(['low', 'medium', 'high'].includes(event.risk));
  assert.ok(['mainline', 'side'].includes(event.cadence));
  for (const key of ['eventId', 'choiceId', 'event', 'choice', 'trigger', 'effects', 'narrativeContext', 'narrativeIntent']) {
    assert.equal(key in event, false, `${key} should remain server-side`);
  }
});

test('POST /api/v1/daily-actions does not expose raw risk strings in public meta', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();

  await jsonResponse(app.handle(makeRequest('POST', '/api/v1/game/new', {
    name: '顾清河',
    rerollSeed: 52
  })));
  app.getState().game.player.cultivationProgress = 100;

  const payload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'cultivation',
    gameVersion: 0
  })));

  assert.equal(payload.ok, true);
  assert.ok(payload.data.actions.every((action) => !/\b(low|medium|high)\b/.test(action.meta)));
});

test('POST /api/v1/turns resolves selected event effects deterministically', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();
  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'realm',
    gameVersion: 0
  })));
  const action = actionsPayload.data.actions.find((candidate) => candidate.title === '靠近铜铃');

  const turnPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: action.id,
    clientTurn: 0
  })));

  assert.equal(turnPayload.ok, true);
  assert.equal(turnPayload.data.game.flags.bronze_bell, true);
  assert.equal(turnPayload.data.turnResult.ruleResult.eventId, 'mist_bronze_bell');
  assert.equal(turnPayload.data.turnResult.ruleResult.lifespanCost, 2);
  assert.equal(turnPayload.data.game.player.lifespan, 91);
  assert.equal(turnPayload.data.game.turn, 1);
});

test('POST /api/v1/turns advances time and returns public time result for event actions', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();
  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'realm',
    gameVersion: 0
  })));
  const action = actionsPayload.data.actions.find((candidate) => candidate.title === '靠近铜铃');

  const turnPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: action.id,
    clientTurn: 0
  })));

  assert.equal(turnPayload.ok, true);
  assert.equal(turnPayload.data.game.time.elapsedMonths > 0, true);
  assert.equal(typeof turnPayload.data.game.timePressure.calendarLabel, 'string');
  assert.equal(typeof turnPayload.data.turnResult.ruleResult.timeResult.label, 'string');
  assert.equal('deltaMonths' in turnPayload.data.turnResult.ruleResult.timeResult, false);
  assert.equal('effectHints' in turnPayload.data.turnResult.ruleResult.timeResult, false);
});

test('POST /api/v1/turns records event history and advances the authoritative chapter', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  const game = app.getState().game;
  game.onboarding = completedOnboardingState();
  game.storyProgress = {
    ...game.storyProgress,
    chapterId: 'qi',
    chapterIndex: 1,
    status: 'active',
    completedObjectiveIds: [],
    truthFlags: [],
    sectPath: null,
    contractStance: null,
    finalChoiceMade: false,
    endingId: null
  };
  game.player = { ...game.player, realm: '炼气九层', lifespan: 40, maxLifespan: 100 };
  game.flags = {};

  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'home',
    gameVersion: game.version
  })));
  const pendingAction = [...app.getState().pendingActions.values()].find(
    (candidate) => candidate.eventId === 'qi_lifespan_alarm' && candidate.choiceId === 'seek_register'
  );
  const action = actionsPayload.data.actions.find((candidate) => candidate.id === pendingAction?.id);
  assert.ok(action, 'qi lifespan alarm should be available at the low lifespan ratio');

  const turnPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: action.id,
    clientTurn: game.turn
  })));

  assert.equal(turnPayload.ok, true);
  assert.equal(turnPayload.data.game.eventHistory.resolved.includes('qi_lifespan_alarm'), true);
  assert.equal(turnPayload.data.turnResult.chapter.id, 'foundation');
  assert.equal(turnPayload.data.turnResult.chapterTransition.toChapterId, 'foundation');
  assert.equal('eventId' in turnPayload.data.game.log.at(-1), false);
});

test('event resolution preserves a lifespan ending and deterministic fallback narration', async () => {
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    storyGraph: {
      async invoke() {
        throw new Error('story graph unavailable');
      }
    },
    llm: {
      async generateNarration() {
        throw new Error('model temporarily unavailable');
      }
    }
  });
  const game = app.getState().game;
  game.onboarding = completedOnboardingState();
  game.player = { ...game.player, lifespan: 1, maxLifespan: 100 };

  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'home',
    gameVersion: game.version
  })));
  const pendingAction = [...app.getState().pendingActions.values()].find(
    (candidate) => candidate.eventId === 'cultivation_breathing' && candidate.choiceId === 'steady'
  );
  const action = actionsPayload.data.actions.find((candidate) => candidate.id === pendingAction?.id);
  assert.ok(action);

  const turnPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: action.id,
    clientTurn: game.turn
  })));

  assert.equal(turnPayload.data.turnResult.ending.type, 'lifespan_exhausted');
  assert.equal(turnPayload.data.game.storyProgress.status, 'ended');
  assert.equal(turnPayload.data.turnResult.narration.status, 'fallback');
  assert.match(turnPayload.data.turnResult.narration.body, /收束杂念|灵气缓缓行过周天/);
});

test('lifespan terminal resolution finalizes the active resource build into meta progress', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  const game = app.getState().game;
  game.onboarding = completedOnboardingState();
  game.techniques = [{ id: 'taixu_heart_mirror' }];
  game.player = { ...game.player, lifespan: 1, maxLifespan: 100 };

  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'home',
    gameVersion: game.version
  })));
  const pendingAction = [...app.getState().pendingActions.values()].find(
    (candidate) => candidate.eventId === 'cultivation_breathing' && candidate.choiceId === 'steady'
  );
  const action = actionsPayload.data.actions.find((candidate) => candidate.id === pendingAction?.id);
  const turnPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: action.id,
    clientTurn: game.turn
  })));

  assert.equal(turnPayload.data.game.ending.type, 'lifespan_exhausted');
  assert.deepEqual(turnPayload.data.game.techniques, []);
  assert.deepEqual(turnPayload.data.game.metaProgress.unlockedTechniques, ['taixu_heart_mirror']);
  assert.equal(turnPayload.data.game.metaProgress.runCount, 1);
  assert.equal(turnPayload.data.game.resourceRun.lastRunSummary.runCount, 1);
  assert.deepEqual(
    turnPayload.data.game.resourceRun.lastRunSummary.techniques.map((entry) => entry.id),
    ['taixu_heart_mirror']
  );
});

test('reset preserves meta progress while starting with an empty active build', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  const state = app.getState();
  state.game.onboarding = completedOnboardingState();
  state.game.techniques = [{ id: 'taixu_heart_mirror' }];
  state.game.metaProgress = {
    ...state.game.metaProgress,
    discoveredTechniques: ['taixu_heart_mirror'],
    unlockedTechniques: ['taixu_heart_mirror'],
    runCount: 2,
    bestChapter: 'foundation'
  };

  const payload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/game/reset', {
    rerollSeed: 52
  })));

  assert.deepEqual(payload.data.game.techniques, []);
  assert.deepEqual(payload.data.game.metaProgress.unlockedTechniques, ['taixu_heart_mirror']);
  assert.equal(payload.data.game.metaProgress.runCount, 3);
  assert.equal(payload.data.game.resourceRun.pendingDraft, null);

  const repeated = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/game/reset', {
    rerollSeed: 52
  })));
  assert.equal(repeated.data.game.metaProgress.runCount, 3);
});

test('POST /api/v1/daily-actions rejects after lifespan ending', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();
  app.getState().game.ending = { type: 'lifespan_exhausted', title: '命簿终章', body: '命火已熄。' };

  const response = await app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'home',
    gameVersion: 0
  }));
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error.code, 'GAME_ENDED');
});

test('POST /api/v1/turns rejects pending actions after lifespan ending', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();
  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'home',
    gameVersion: 0
  })));
  const [action] = actionsPayload.data.actions;
  app.getState().game.ending = { type: 'lifespan_exhausted', title: '命簿终章', body: '命火已熄。' };

  const response = await app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: action.id,
    clientTurn: 0
  }));
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error.code, 'GAME_ENDED');
});

test('POST /api/v1/turns routes breakthrough actions through the special resolver', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();

  await jsonResponse(app.handle(makeRequest('POST', '/api/v1/game/new', {
    name: '顾清河',
    rerollSeed: 52
  })));
  app.getState().game.player.cultivationProgress = 100;

  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'cultivation',
    gameVersion: 0
  })));
  const [action] = actionsPayload.data.actions;

  const turnPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: action.id,
    clientTurn: 0
  })));

  assert.equal(action.title, '尝试突破');
  assert.equal(turnPayload.ok, true);
  assert.equal(turnPayload.data.game.turn, 1);
  assert.equal(turnPayload.data.game.player.realm, '炼气二层');
  assert.equal(turnPayload.data.game.player.cultivationProgress, 0);
  assert.equal(turnPayload.data.turnResult.ruleResult.eventId, 'breakthrough_attempt');
  assert.equal(turnPayload.data.turnResult.ruleResult.choiceId, 'attempt');
  assert.equal(turnPayload.data.turnResult.ruleResult.success, true);
});

test('POST /api/v1/turns advances one authoritative turn and ignores client state', async () => {
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async generateNarration({ afterGame, action }) {
        return {
          status: 'generated',
          title: 'LLM 闭关叙事',
          body: `这段剧情来自模型：已根据第${afterGame.turn}回合和${action.title}生成。`,
          npcLine: '林师姐轻声道：“这段剧情来自模型。”',
          foreshadow: '模型埋下新的雷木伏笔。'
        };
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();
  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'cultivation',
    gameVersion: 0
  })));
  const action = actionsPayload.data.actions.find((candidate) => candidate.command.includes('闭关'));

  const turnPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: action.id,
    clientTurn: 0,
    game: { turn: 999, player: { spiritStones: 999999 } }
  })));

  assert.equal(turnPayload.ok, true);
  assert.equal(turnPayload.data.game.turn, 1);
  assert.notEqual(turnPayload.data.game.player.spiritStones, 999999);
  assert.equal(turnPayload.data.turnResult.turn, 1);
  assert.equal(turnPayload.data.turnResult.actionId, action.id);
  assert.equal(turnPayload.data.turnResult.ruleResult.success, true);
  assert.equal(turnPayload.data.turnResult.narration.status, 'generated');
  assert.equal(turnPayload.data.turnResult.narration.title, 'LLM 闭关叙事');
  assert.match(turnPayload.data.turnResult.narration.body, /来自模型/);
  assert.equal(turnPayload.data.game.log.at(-1).title, 'LLM 闭关叙事');
  assert.match(turnPayload.data.game.log.at(-1).body, /来自模型/);
});

test('POST /api/v1/turns records generated narration in story memory for later context', async () => {
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async generateNarration({ afterGame, action }) {
        return {
          status: 'generated',
          title: '命火微澜',
          body: `顾清河在第${afterGame.turn}回合选择${action.title}后，识海里浮现青云宗旧碑与雾隐秘境铜铃的重影。他意识到所谓飞升传闻并非单纯奖赏，而像一道被宗门故意遮掩的门槛，命火也因此轻轻摇动。`,
          npcLine: '',
          foreshadow: '飞升传闻与雾隐铜铃出现同源回响。',
          continuityNotes: ['延续雾隐秘境与飞升骗局伏笔。'],
          safetyFlags: []
        };
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();
  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'cultivation',
    gameVersion: 0
  })));
  const action = actionsPayload.data.actions.find((candidate) => candidate.command.includes('闭关'));

  const turnPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: action.id,
    clientTurn: 0
  })));
  const memory = turnPayload.data.game.storyMemory;

  assert.equal(memory.lastUpdatedTurn, 1);
  assert.equal(memory.recentTurns.at(-1).title, '命火微澜');
  assert.match(memory.recentTurns.at(-1).outcome, /飞升传闻/);
  assert.equal(memory.recentTurns.at(-1).npcLine, '');
  assert.ok(memory.openThreads.some((thread) => thread.detail.includes('飞升') || thread.detail.includes('雾隐')));
  assert.doesNotMatch(JSON.stringify(memory), /eventId|choiceId|act_|debug|schema/i);
});

test('POST /api/v1/turns/stream yields narration deltas before final turn result', async () => {
  const streamedChunks = [
    '{"title":"流式闭关","body":"',
    '顾清河闭目内观，雷木灵根在经脉间一寸寸亮起。洞府外的雨声压低，像有人隔着山门翻动旧契，提醒他寿元并非无穷。可这一次他没有急着求快，而是将灵气分作三股，先护命火，再拓窍穴，最后把青云宗的入门心法重新走了一遍。',
    '","npcLine":"林师姐道：\\"别只看破境，也要看命火是否稳。\\"","foreshadow":"雾隐秘境的旧契再次浮现。","continuityNotes":[],"safetyFlags":[]}'
  ];
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async *streamNarration() {
        for (const chunk of streamedChunks) {
          yield chunk;
        }
      },
      async generateNarration() {
        assert.fail('stream endpoint should forward streamed narration instead of collecting through generateNarration');
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();
  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'cultivation',
    gameVersion: 0
  })));
  const action = actionsPayload.data.actions.find((candidate) => candidate.command.includes('闭关'));

  const response = await app.handle(makeRequest('POST', '/api/v1/turns/stream', {
    actionId: action.id,
    clientTurn: 0
  }));
  const body = await response.text();
  const donePayload = parseSseEvent(body, 'done');

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  assert.ok(body.indexOf('event: narration_delta') > -1);
  assert.ok(body.indexOf('event: narration_delta') < body.indexOf('event: done'));
  assert.equal(donePayload.ok, true);
  assert.equal(donePayload.data.game.turn, 1);
  assert.equal(donePayload.data.turnResult.narration.status, 'generated');
  assert.equal(donePayload.data.turnResult.narration.title, '流式闭关');
  assert.match(donePayload.data.game.log.at(-1).body, /雷木灵根/);
});

test('POST /api/v1/turns/stream continues story through director without daily action id', async () => {
  const streamedChunks = [
    '{"scene":"顾清河闭目内观，命火忽明忽暗，雾隐秘境的钟声在识海深处响起。',
    '他没有立刻起身，只把这份异动压入丹田，等待下一次回响。","mode":"continue",',
    '"npcLines":[],"effectHints":[{"target":"lifespan","direction":"down","intensity":"tiny"}],"choices":[],"memoryHints":["命火异常继续。"]}'
  ];
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async *streamStoryDirector() {
        for (const chunk of streamedChunks) yield chunk;
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();

  const response = await app.handle(makeRequest('POST', '/api/v1/turns/stream', {
    type: 'continue',
    clientTurn: 0
  }));
  const body = await response.text();
  const donePayload = parseSseEvent(body, 'done');

  assert.equal(response.status, 200);
  assert.ok(body.indexOf('event: story_delta') > -1);
  assert.ok(body.indexOf('event: story_delta') < body.indexOf('event: done'));
  assert.equal(donePayload.ok, true);
  assert.equal(donePayload.data.game.turn, 1);
  assert.equal(donePayload.data.game.player.lifespan, 91);
  assert.equal(donePayload.data.game.timePressure.lastDeltaTime, '一月');
  assert.equal(donePayload.data.turnResult.ruleResult.timeResult.label, '一月');
  assert.equal(donePayload.data.turnResult.ruleResult.timeResult.netLifespanDelta, -2);
  assert.equal('deltaMonths' in donePayload.data.turnResult.ruleResult.timeResult, false);
  assert.match(donePayload.data.game.log.at(-1).body, /命火忽明忽暗/);
  assert.equal(donePayload.data.turnResult.narration.status, 'generated');
});

test('POST /api/v1/turns/stream stores LLM generated choices and resolves selected choice through backend rules', async () => {
  const outputs = [
    {
      scene: '雾中钟声压近洞府，顾清河意识到今夜必须决定是否追查。',
      mode: 'choice',
      npcLines: [],
      effectHints: [],
      choices: [
        {
          id: 'follow_bell',
          text: '循着钟声前往后山',
          tone: 'explore',
          effectHints: [{ target: 'lifespan', direction: 'down', intensity: 'small' }]
        },
        {
          id: 'ask_elder',
          text: '先向玄衡长老禀报',
          tone: 'sect',
          effectHints: [{ target: 'sect_reputation', direction: 'up', intensity: 'small' }]
        }
      ],
      memoryHints: ['雾中钟声逼近。']
    },
    {
      scene: '顾清河循声入山，草叶上的雾露映出残缺符纹。',
      mode: 'continue',
      npcLines: [],
      effectHints: [{ target: 'foreshadow', direction: 'advance', intensity: 'small', topic: '雾隐秘境' }],
      choices: [],
      memoryHints: ['雾隐秘境符纹出现。']
    }
  ];
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async generateStoryDirector() {
        return outputs.shift();
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();

  const firstResponse = await app.handle(makeRequest('POST', '/api/v1/turns/stream', {
    type: 'continue',
    clientTurn: 0
  }));
  const first = parseSseEvent(await firstResponse.text(), 'done');
  const [choice] = first.data.turnResult.choices;

  assert.equal(first.data.turnResult.mode, 'choice');
  assert.equal(choice.text, '循着钟声前往后山');
  assert.equal('effectHints' in choice, false);
  assert.equal(app.getState().pendingDirectorChoices.size, 2);

  const secondResponse = await app.handle(makeRequest('POST', '/api/v1/turns/stream', {
    type: 'choice',
    choiceId: choice.id,
    clientTurn: 1
  }));
  const second = parseSseEvent(await secondResponse.text(), 'done');

  assert.equal(second.data.game.turn, 2);
  assert.ok(second.data.game.karma.futureEventFlags.includes('director_mist_thread'));
  assert.equal(app.getState().pendingDirectorChoices.size, 0);
});

test('POST /api/v1/turns saves rule progress when narration llm is unavailable', async () => {
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async generateNarration() {
        throw new Error('model temporarily unavailable');
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();
  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'cultivation',
    gameVersion: 0
  })));
  const [action] = actionsPayload.data.actions;

  const turnPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: action.id,
    clientTurn: 0
  })));
  const statePayload = await jsonResponse(app.handle(makeRequest('GET', '/api/v1/game/state')));

  assert.equal(turnPayload.ok, true);
  assert.equal(turnPayload.data.game.turn, 1);
  assert.equal(statePayload.data.game.turn, 1);
  assert.equal(turnPayload.data.turnResult.ruleResult.success, true);
  assert.equal(turnPayload.data.turnResult.narration.status, 'llm_unavailable');
  assert.equal(turnPayload.data.turnResult.narration.retryable, true);
  assert.equal(turnPayload.data.turnResult.narration.savedTurn, 1);
  assert.equal(turnPayload.data.turnResult.narration.error.code, 'LLM_UNAVAILABLE');
  assert.match(turnPayload.data.turnResult.narration.body, /模型暂不可用/);
});

test('POST /api/v1/turns/:turn/narration retries narration from saved progress', async () => {
  let llmAvailable = false;
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async generateNarration({ afterGame }) {
        if (!llmAvailable) {
          throw new Error('model temporarily unavailable');
        }
        return {
          title: '重试续写',
          body: `模型已基于第${afterGame.turn}回合保存进度重新续写。`,
          npcLine: '林师姐道：“这次续上了。”',
          foreshadow: '旧伏笔重新接回。'
        };
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();
  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'cultivation',
    gameVersion: 0
  })));
  const [action] = actionsPayload.data.actions;
  const unavailablePayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: action.id,
    clientTurn: 0
  })));

  llmAvailable = true;
  const retryPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns/1/narration')));
  const statePayload = await jsonResponse(app.handle(makeRequest('GET', '/api/v1/game/state')));

  assert.equal(unavailablePayload.data.turnResult.narration.status, 'llm_unavailable');
  assert.equal(retryPayload.ok, true);
  assert.equal(retryPayload.data.turn, 1);
  assert.equal(retryPayload.data.narration.status, 'generated');
  assert.match(retryPayload.data.narration.body, /重新续写/);
  assert.equal(statePayload.data.game.turn, 1);
});

test('POST /api/v1/turns rejects an expired action without advancing the game', async () => {
  let now = new Date('2026-06-29T08:00:00.000Z');
  const app = createBackendApp({ seed: 31, now: () => now });
  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'realm',
    gameVersion: 0
  })));
  const [action] = actionsPayload.data.actions;

  now = new Date('2026-06-29T08:31:00.000Z');
  const response = await app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: action.id,
    clientTurn: 0
  }));
  const payload = await response.json();
  const state = await jsonResponse(app.handle(makeRequest('GET', '/api/v1/game/state')));

  assert.equal(response.status, 409);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, 'ACTION_EXPIRED');
  assert.equal(state.data.game.turn, 0);
});

test('POST /api/v1/turns rejects a stale client turn without advancing the game', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'realm',
    gameVersion: 0
  })));
  const [action] = actionsPayload.data.actions;

  const response = await app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: action.id,
    clientTurn: -1
  }));
  const payload = await response.json();
  const state = await jsonResponse(app.handle(makeRequest('GET', '/api/v1/game/state')));

  assert.equal(response.status, 409);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, 'TURN_MISMATCH');
  assert.equal(state.data.game.turn, 0);
});

test('POST /api/v1/export-story exports the server-side save as text', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  const payload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/export-story', {
    format: 'txt'
  })));

  assert.equal(payload.ok, true);
  assert.match(payload.data.filename, /^问道浮生-陆青玄-第0回合\.txt$/);
  assert.match(payload.data.content, /问道浮生/);
  assert.match(payload.data.content, /陆青玄/);
});

function fixedNow() {
  return new Date('2026-06-29T08:00:00.000Z');
}

function completedOnboardingState() {
  return {
    completed: true,
    stepId: 'formal_life',
    completedStepIds: ONBOARDING_STEPS.map((step) => step.id),
    unlockedCharacterCreation: true
  };
}

function makeRequest(method, path, body) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function jsonResponse(responsePromise) {
  const response = await responsePromise;
  return response.json();
}

function parseSseEvent(body, eventName) {
  const block = body
    .split(/\r?\n\r?\n/)
    .find((part) => part.split(/\r?\n/).some((line) => line === `event: ${eventName}`));

  assert.ok(block, `expected SSE event ${eventName}`);
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');

  return JSON.parse(data);
}

function assertPublicActionShape(action) {
  assert.equal(hasOnlyPublicActionFields(action), true);
}

function hasOnlyPublicActionFields(action) {
  const expected = [
    'command',
    'expiresAt',
    'icon',
    'id',
    'meta',
    'storyHook',
    'title'
  ];
  for (const key of ['category', 'risk', 'cadence']) {
    if (key in action) expected.push(key);
  }
  return JSON.stringify(Object.keys(action).sort()) === JSON.stringify(expected.sort());
}
