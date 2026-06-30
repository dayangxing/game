import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '../backend/src/app.js';
import { getModelSelection } from '../backend/src/llm/modelSelection.js';

test('model selection defaults to Bailian qwen-plus without exposing an API key', () => {
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
  assert.equal(payload.data.game.mode, 'api');
  assert.equal(payload.data.game.onboarding.completed, true);
  assert.equal(payload.data.game.onboarding.stepId, 'formal_life');
  assert.equal(payload.data.game.onboarding.unlockedCharacterCreation, true);
  assert.deepEqual(payload.data.game.onboarding.completedStepIds, completedOnboardingState().completedStepIds);
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

test('tutorial actions complete onboarding through daily-actions and turns', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });

  for (const expectedStep of ['awakening', 'breathing', 'sect_contact', 'alchemy_trial', 'mist_bell', 'karma_choice', 'heaven_contract', 'formal_life']) {
    const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
      viewId: 'home',
      gameVersion: app.getState().game.version
    })));
    const [action] = actionsPayload.data.actions;

    assert.equal(action.source, 'tutorial');
    assert.equal(action.onboardingStepId, expectedStep);

    const turnPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns', {
      actionId: action.id,
      clientTurn: app.getState().game.turn
    })));

    assert.equal(turnPayload.ok, true);
    assert.equal(turnPayload.data.game.onboarding.completedStepIds.includes(expectedStep), true);
  }

  assert.equal(app.getState().game.onboarding.completed, true);
  assert.equal(app.getState().game.onboarding.unlockedCharacterCreation, true);
});

test('POST /api/v1/daily-actions returns validated fallback actions for the requested view', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();
  const response = await app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'cultivation',
    gameVersion: 0
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.actions.length, 4);
  assert.ok(payload.data.actions.every((action) => action.id.startsWith('act_')));
  assert.ok(payload.data.actions.every((action) => action.source === 'fallback'));
  assert.ok(payload.data.actions.some((action) => action.command.includes('闭关')));
  assert.ok(payload.data.actions.every((action) => action.expiresAt === '2026-06-29T08:30:00.000Z'));
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
    completedStepIds: ['awakening', 'breathing', 'sect_contact', 'alchemy_trial', 'mist_bell', 'karma_choice', 'heaven_contract', 'formal_life'],
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
