import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '../backend/src/app.js';
import { EVENT_CATALOG } from '../backend/src/domain/events/eventCatalog.js';
import { ONBOARDING_STEPS } from '../backend/src/domain/onboarding.js';
import { getModelSelection } from '../backend/src/llm/modelSelection.js';

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
  assert.equal(resetPayload.data.game.player.name, '陆青玄');
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
  assert.match(payload.data.actions[0].meta, /高风险/);
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
  assert.match(payload.data.actions[0].meta, /高风险/);
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
  assert.equal('risk' in publicEvent, false);
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
  assert.equal(donePayload.data.game.player.lifespan, 92);
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
  return JSON.stringify(Object.keys(action).sort()) === JSON.stringify([
    'command',
    'expiresAt',
    'icon',
    'id',
    'meta',
    'storyHook',
    'title'
  ]);
}
