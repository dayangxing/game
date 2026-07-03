import { advanceTurn, createGame, exportNovel } from '../../src/engine.js';
import { normalizeStoryMemory, recordStoryMemoryTurn } from '../../src/storyMemory.js';
import { buildFallbackDirectorOutput, createStoryDirector } from './agents/storyDirector.js';
import { buildUnavailableNarration, createStoryGraph, normalizeGeneratedNarration } from './agents/storyGraph.js';
import { createDailyActions, hasView } from './domain/actions.js';
import { applyCharacterToGame, rollCharacter } from './domain/characterCreation.js';
import { resolveDirectorEffectHints } from './domain/director/effectHints.js';
import { resolveChoice } from './domain/events/effectResolver.js';
import { selectEventActions } from './domain/events/eventSelector.js';
import { eventNarrationFallback, stripInternalActionFields } from './domain/events/eventResult.js';
import { ONBOARDING_STEPS, canCreateFormalCharacter, createOnboardingState, createTutorialAction, resolveTutorialAction } from './domain/onboarding.js';
import { resolveBreakthrough } from './domain/progression.js';
import { buildTurnResult } from './domain/turnResult.js';
import { createBailianClient } from './llm/bailianClient.js';
import { getModelSelection } from './llm/modelSelection.js';

export function createBackendApp(options = {}) {
  const now = options.now ?? (() => new Date());
  const llm = options.llm ?? createBailianClient({ env: options.env ?? process.env, fetchImpl: options.fetchImpl });
  const state = {
    game: normalizeGame(createGame(options.seed ?? Date.now())),
    pendingActions: new Map(),
    pendingDirectorChoices: new Map(),
    turnSnapshots: new Map(),
    auditLog: [],
    requestSequence: 0,
    actionSequence: 0,
    modelSelection: getModelSelection(options.env ?? process.env),
    llm,
    storyGraph: options.storyGraph ?? createStoryGraph({ llm }),
    storyDirector: options.storyDirector ?? createStoryDirector({ llm })
  };

  return {
    async handle(request) {
      const requestId = nextRequestId(state);

      try {
        if (request.method === 'OPTIONS') {
          return emptyResponse(204);
        }

        const url = new URL(request.url);
        const route = `${request.method} ${url.pathname}`;

        if (route === 'GET /api/v1/game/state') {
          return jsonResponse(200, requestId, { game: state.game });
        }

        if (route === 'GET /api/v1/model-selection') {
          return jsonResponse(200, requestId, { modelSelection: state.modelSelection });
        }

        if (route === 'GET /api/v1/model-health') {
          return jsonResponse(200, requestId, {
            modelHealth: createModelHealth(state.modelSelection)
          });
        }

        if (route === 'POST /api/v1/game/new') {
          const body = await readJson(request);
          return handleNewFormalGame({ body, requestId, state });
        }

        if (route === 'POST /api/v1/game/reset') {
          const body = await readJson(request);
          return handleResetGame({ body, requestId, state });
        }

        if (route === 'POST /api/v1/daily-actions') {
          const body = await readJson(request);
          return handleDailyActions({ body, requestId, state, now });
        }

        if (route === 'POST /api/v1/turns') {
          const body = await readJson(request);
          return handleTurn({ body, requestId, state, now });
        }

        if (route === 'POST /api/v1/turns/stream') {
          const body = await readJson(request);
          return handleTurnStream({ body, requestId, state, now });
        }

        const retryNarrationTurn = matchRetryNarrationRoute(request.method, url.pathname);
        if (retryNarrationTurn !== null) {
          return handleRetryNarration({ turn: retryNarrationTurn, requestId, state, now });
        }

        if (route === 'POST /api/v1/export-story') {
          const body = await readJson(request);
          return handleExportStory({ body, requestId, state });
        }

        return errorResponse(404, requestId, 'NOT_FOUND', '接口不存在。');
      } catch (error) {
        state.auditLog.push({
          type: 'error',
          requestId,
          message: error.message,
          at: now().toISOString()
        });
        return errorResponse(500, requestId, 'INTERNAL_ERROR', '后端处理请求时出现异常。');
      }
    },

    getState() {
      return state;
    }
  };
}

function handleDailyActions({ body, requestId, state, now }) {
  const viewId = body.viewId ?? 'home';

  if (!hasView(viewId)) {
    return errorResponse(400, requestId, 'UNKNOWN_VIEW', '未知界面，无法生成每日行动。');
  }

  if (body.gameVersion !== undefined && body.gameVersion !== state.game.version) {
    return errorResponse(409, requestId, 'GAME_VERSION_MISMATCH', '客户端存档版本过旧，请刷新游戏状态。');
  }

  if (!state.game.onboarding.completed) {
    const action = createTutorialAction({
      game: state.game,
      now: now(),
      sequenceStart: state.actionSequence
    });
    state.actionSequence += 1;
    state.pendingActions.set(action.id, {
      ...action,
      turn: state.game.turn,
      consumed: false
    });
    return jsonResponse(200, requestId, { actions: [stripInternalActionFields(action)] });
  }

  const eventActions = selectEventActions({
    game: state.game,
    viewId,
    now: now(),
    sequenceStart: state.actionSequence
  });
  const actions = composeDailyActions({
    game: state.game,
    viewId,
    now,
    sequenceStart: state.actionSequence,
    eventActions
  });

  if (actions.length > 0) {
    state.actionSequence += actions.length;

    for (const action of actions) {
      state.pendingActions.set(action.id, {
        ...action,
        turn: state.game.turn,
        consumed: false
      });
    }

    state.auditLog.push({
      type: 'daily-actions',
      viewId,
      actionIds: actions.map((action) => action.id),
      at: now().toISOString()
    });

    return jsonResponse(200, requestId, {
      actions: actions.map(stripInternalActionFields)
    });
  }
}

function composeDailyActions({ game, viewId, now, sequenceStart, eventActions }) {
  if (eventActions.length === 0) {
    return createDailyActions({
      game,
      viewId,
      now: now(),
      sequenceStart
    });
  }

  if (hasOnlyBreakthroughAction(eventActions)) {
    const fallbackActions = createDailyActions({
      game,
      viewId,
      now: now(),
      sequenceStart
    });
    return [eventActions[0], ...fallbackActions].slice(0, 4);
  }

  return eventActions;
}

function hasOnlyBreakthroughAction(actions) {
  return actions.length === 1 && actions[0].source === 'breakthrough';
}

function handleNewFormalGame({ body, requestId, state }) {
  if (!canCreateFormalCharacter(state.game.onboarding)) {
    return errorResponse(409, requestId, 'ONBOARDING_REQUIRED', '完成新手任务后才能创建正式角色。');
  }

  const name = String(body.name ?? '').trim();
  if (name.length > 12) {
    return errorResponse(400, requestId, 'CHARACTER_NAME_INVALID', '角色名最多 12 个字符。');
  }

  try {
    const seed = Number.isInteger(body.rerollSeed) ? body.rerollSeed : state.game.seed + state.requestSequence + 101;
    const character = rollCharacter({ seed, name, attributes: body.attributes });
    const nextGame = normalizeGame(applyCharacterToGame(createGame(seed), character, seed));
    nextGame.onboarding = createCompletedFormalOnboardingState();
    state.pendingActions.clear();
    state.pendingDirectorChoices.clear();
    state.turnSnapshots.clear();
    state.game = nextGame;
    state.game.mode = 'api';
    return jsonResponse(200, requestId, {
      game: state.game,
      character
    });
  } catch (error) {
    if (error.message.startsWith('ATTRIBUTE_ALLOCATION_INVALID')) {
      return errorResponse(400, requestId, 'CHARACTER_ATTRIBUTES_INVALID', '角色属性分配无效。');
    }
    if (error.message.startsWith('CHARACTER_ROLL_INVALID')) {
      return errorResponse(500, requestId, 'CHARACTER_ROLL_INVALID', '角色随机属性超出可玩范围，请重新生成。');
    }
    throw error;
  }
}

function handleResetGame({ body, requestId, state }) {
  const seed = Number.isInteger(body.rerollSeed) ? body.rerollSeed : state.game.seed + state.requestSequence + 101;
  const nextGame = normalizeGame(createGame(seed));
  nextGame.onboarding = createCompletedFormalOnboardingState();
  delete nextGame.characterSeed;
  nextGame.mode = 'api';
  state.pendingActions.clear();
  state.pendingDirectorChoices.clear();
  state.turnSnapshots.clear();
  state.auditLog.length = 0;
  state.game = nextGame;
  return jsonResponse(200, requestId, {
    game: state.game
  });
}

async function handleTurn({ body, requestId, state, now }) {
  const resolved = resolveTurnRules({ body, requestId, state, now });
  if (resolved instanceof Response) return resolved;

  if (resolved.narration) {
    const data = finalizeTurn({ resolved, state, now });
    return jsonResponse(200, requestId, data);
  }

  const narration = await resolveTurnNarration({
    before: resolved.before,
    after: state.game,
    action: resolved.action,
    ruleEntry: resolved.ruleEntry,
    state
  }).catch((error) => resolved.fallbackNarration ?? buildUnavailableNarration({
    afterGame: state.game,
    error
  }));

  const data = finalizeTurn({ resolved: { ...resolved, narration }, state, now });
  return jsonResponse(200, requestId, data);
}

function handleTurnStream({ body, requestId, state, now }) {
  if (body.type === 'continue' || body.type === 'choice') {
    return handleDirectorTurnStream({ body, requestId, state, now });
  }

  const resolved = resolveTurnRules({ body, requestId, state, now });
  if (resolved instanceof Response) return resolved;

  return sseResponse(async (emit) => {
    emit('rule', {
      turn: state.game.turn,
      actionTitle: resolved.action.title,
      command: resolved.action.command
    });

    let narration = resolved.narration;
    if (!narration) {
      narration = await resolveTurnNarrationStream({
        resolved,
        state,
        emit
      }).catch((error) => resolved.fallbackNarration ?? buildUnavailableNarration({
        afterGame: state.game,
        error
      }));
    }

    const data = finalizeTurn({ resolved: { ...resolved, narration }, state, now });
    emit('done', {
      ok: true,
      data,
      error: null,
      requestId
    });
  });
}

function handleDirectorTurnStream({ body, requestId, state, now }) {
  const validation = validateDirectorTurnRequest({ body, requestId, state });
  if (validation instanceof Response) return validation;

  return sseResponse(async (emit) => {
    const before = state.game;
    const input = buildDirectorInput({ body, pendingChoice: validation.pendingChoice });
    let directorOutput = null;

    try {
      for await (const event of state.storyDirector.stream({ game: before, input })) {
        if (event.type === 'story_delta') emit('story_delta', event.data);
        if (event.type === 'director_result') directorOutput = event.data;
      }
    } catch (error) {
      directorOutput = buildFallbackDirectorOutput({ game: before, input, error });
    }

    const resolution = resolveDirectorTurn({
      before,
      directorOutput: directorOutput ?? buildFallbackDirectorOutput({ game: before, input }),
      input,
      state,
      now: now()
    });
    state.game = normalizeGame(resolution.game);
    state.turnSnapshots.set(state.game.turn, {
      beforeGame: before,
      afterGame: state.game,
      action: resolution.action,
      ruleEntry: resolution.entry
    });

    emit('state_patch', resolution.publicStatePatch);
    if (resolution.turnResult.choices.length) emit('choices_ready', { choices: resolution.turnResult.choices });
    emit('done', {
      ok: true,
      data: {
        game: state.game,
        turnResult: resolution.turnResult
      },
      error: null,
      requestId
    });
  });
}

function validateDirectorTurnRequest({ body, requestId, state }) {
  if (!state.game.onboarding?.completed) {
    return errorResponse(409, requestId, 'ONBOARDING_REQUIRED', '完成新手任务后才能进入连续剧情。');
  }
  if (body.clientTurn !== state.game.turn) {
    return errorResponse(409, requestId, 'TURN_MISMATCH', '客户端回合已过期，请刷新游戏状态。');
  }
  if (body.type === 'choice') {
    const pendingChoice = state.pendingDirectorChoices.get(body.choiceId);
    if (!pendingChoice || pendingChoice.turn !== state.game.turn) {
      return errorResponse(404, requestId, 'CHOICE_NOT_FOUND', '该选择已失效，请继续推演。');
    }
    return { pendingChoice };
  }
  return {};
}

function buildDirectorInput({ body, pendingChoice }) {
  if (body.type === 'choice') {
    return {
      type: 'choice',
      choiceId: pendingChoice.id,
      choiceText: pendingChoice.text,
      previousScene: pendingChoice.scene
    };
  }
  return { type: 'continue' };
}

function resolveDirectorTurn({ before, directorOutput, input, state, now }) {
  const pendingChoice = input.type === 'choice' ? state.pendingDirectorChoices.get(input.choiceId) : null;
  const choiceHints = pendingChoice?.effectHints ?? [];
  const effectHints = input.type === 'choice'
    ? [...choiceHints, ...directorOutput.effectHints]
    : directorOutput.effectHints;
  const effectResolution = resolveDirectorEffectHints({ game: before, effectHints, now });
  const turn = before.turn + 1;
  const entry = {
    id: `turn-${turn}`,
    title: directorOutput.mode === 'choice' ? '命途分岔' : '命火微澜',
    command: input.type === 'choice' ? input.choiceText : '继续',
    body: directorOutput.scene,
    npcLine: formatDirectorNpcLines(directorOutput.npcLines),
    worldEvent: effectResolution.summary
  };
  let nextGame = {
    ...effectResolution.game,
    turn,
    version: turn,
    log: [...effectResolution.game.log, entry],
    timeline: [
      ...effectResolution.game.timeline,
      { type: 'director', title: entry.title, detail: directorOutput.scene }
    ],
    worldEvents: [
      ...effectResolution.game.worldEvents,
      { title: entry.title, detail: effectResolution.summary, turn }
    ]
  };

  nextGame = recordStoryMemoryTurn({
    before,
    after: nextGame,
    action: { title: entry.title, command: entry.command },
    entry,
    narration: {
      status: directorOutput.status,
      title: entry.title,
      body: directorOutput.scene,
      npcLine: entry.npcLine,
      foreshadow: directorOutput.memoryHints.at(0) ?? ''
    }
  });

  const publicChoices = storeDirectorChoices({ state, directorOutput, turn });
  const action = { id: `director-${turn}`, title: entry.title, command: entry.command, source: 'director' };

  return {
    game: nextGame,
    entry,
    action,
    publicStatePatch: pickPublicStatePatch(nextGame),
    turnResult: {
      turn,
      actionId: action.id,
      mode: publicChoices.length ? 'choice' : 'continue',
      narration: {
        status: directorOutput.status,
        title: entry.title,
        body: directorOutput.scene,
        npcLine: entry.npcLine,
        foreshadow: directorOutput.memoryHints.at(0) ?? ''
      },
      summary: effectResolution.summary,
      choices: publicChoices,
      ruleResult: {
        success: true,
        eventId: 'story_director',
        choiceId: input.type === 'choice' ? input.choiceId : 'continue',
        resolvedAt: now.toISOString(),
        rejectedEffectHints: effectResolution.rejected.length
      }
    }
  };
}

function storeDirectorChoices({ state, directorOutput, turn }) {
  state.pendingDirectorChoices.clear();
  if (directorOutput.mode !== 'choice') return [];

  return directorOutput.choices.slice(0, 4).map((choice, index) => {
    const id = `choice_${turn}_${index}_${choice.id}`;
    const pending = {
      ...choice,
      id,
      scene: directorOutput.scene,
      turn,
      consumed: false
    };
    state.pendingDirectorChoices.set(id, pending);
    return { id, text: choice.text };
  });
}

function formatDirectorNpcLines(lines = []) {
  return lines.map((line) => `${line.speaker}道：“${line.line}”`).join('\n');
}

function pickPublicStatePatch(game) {
  return {
    turn: game.turn,
    player: {
      health: game.player.health,
      lifespan: game.player.lifespan,
      qi: game.player.qi,
      mood: game.player.mood,
      cultivationProgress: game.player.cultivationProgress,
      sectRelation: game.player.sectRelation
    }
  };
}

function resolveTurnRules({ body, requestId, state, now }) {
  const action = state.pendingActions.get(body.actionId);

  if (!action) {
    return errorResponse(404, requestId, 'ACTION_NOT_FOUND', '行动不存在，请刷新每日行动。');
  }

  if (action.consumed || new Date(action.expiresAt).getTime() <= now().getTime()) {
    state.pendingActions.delete(action.id);
    return errorResponse(409, requestId, 'ACTION_EXPIRED', '该行动已过期，请刷新每日行动。');
  }

  if (body.clientTurn !== state.game.turn || action.turn !== state.game.turn) {
    return errorResponse(409, requestId, 'TURN_MISMATCH', '客户端回合已过期，请刷新游戏状态。');
  }

  if (action.source === 'tutorial') {
    const before = state.game;
    const after = normalizeGame(resolveTutorialAction({ game: before, action, now: now() }));
    action.consumed = true;
    state.game = after;
    const narration = {
      status: 'fallback',
      title: after.log.at(-1).title,
      body: after.log.at(-1).body,
      npcLine: after.log.at(-1).npcLine,
      foreshadow: after.foreshadows.at(-1) ?? ''
    };
    return {
      before,
      action,
      narration
    };
  }

  const before = state.game;
  if (action.source === 'breakthrough') {
    const resolution = resolveBreakthrough(before, now());

    action.consumed = true;
    state.game = normalizeGame(resolution.game);
    state.turnSnapshots.set(state.game.turn, {
      beforeGame: before,
      afterGame: state.game,
      action: { ...action },
      ruleEntry: resolution.entry
    });

    return {
      before,
      action,
      ruleEntry: resolution.entry,
      ruleResult: resolution.ruleResult,
      fallbackNarration: eventNarrationFallback(resolution)
    };
  }

  if (action.source === 'event') {
    const resolution = resolveChoice({
      game: before,
      event: action.event,
      choice: action.choice,
      now: now()
    });

    action.consumed = true;
    state.game = normalizeGame(resolution.game);
    state.turnSnapshots.set(state.game.turn, {
      beforeGame: before,
      afterGame: state.game,
      action: { ...action },
      ruleEntry: resolution.entry
    });

    return {
      before,
      action,
      ruleEntry: resolution.entry,
      ruleResult: resolution.ruleResult,
      fallbackNarration: eventNarrationFallback(resolution)
    };
  }

  const after = normalizeGame(advanceTurn(before, action.command));

  action.consumed = true;
  state.game = after;
  state.turnSnapshots.set(after.turn, {
    beforeGame: before,
    afterGame: after,
    action: { ...action },
    ruleEntry: after.log.at(-1)
  });

  return {
    before,
    action,
    ruleEntry: after.log.at(-1)
  };
}

function finalizeTurn({ resolved, state, now }) {
  state.game = applyNarrationToGame(state.game, state.game.turn, resolved.narration);
  state.game = recordStoryMemoryTurn({
    before: resolved.before,
    after: state.game,
    action: resolved.action,
    entry: state.game.log.find((entry) => entry.id === `turn-${state.game.turn}`) ?? state.game.log.at(-1),
    narration: resolved.narration
  });
  const baseTurnResult = buildTurnResult({
    before: resolved.before,
    after: state.game,
    actionId: resolved.action.id,
    narration: resolved.narration
  });
  const turnResult = resolved.ruleResult ? {
    ...baseTurnResult,
    ruleResult: {
      ...baseTurnResult.ruleResult,
      ...resolved.ruleResult
    }
  } : baseTurnResult;

  state.auditLog.push({
    type: 'turn',
    actionId: resolved.action.id,
    command: resolved.action.command,
    ruleResult: turnResult.ruleResult,
    llm: turnResult.narration.status,
    at: now().toISOString()
  });

  return {
    game: state.game,
    turnResult
  };
}

async function resolveTurnNarrationStream({ resolved, state, emit }) {
  if (!state.llm.streamNarration) {
    return resolveTurnNarration({
      before: resolved.before,
      after: state.game,
      action: resolved.action,
      ruleEntry: resolved.ruleEntry,
      state
    });
  }

  let rawNarration = '';
  for await (const chunk of state.llm.streamNarration({
    beforeGame: resolved.before,
    afterGame: state.game,
    action: resolved.action,
    ruleEntry: resolved.ruleEntry ?? state.game.log.at(-1)
  })) {
    const text = String(chunk ?? '');
    if (!text) continue;
    rawNarration += text;
    emit('narration_delta', { text });
  }

  if (!rawNarration.trim()) {
    throw new Error('streamed narration was empty');
  }

  return normalizeGeneratedNarration(JSON.parse(rawNarration), state.game);
}

async function handleRetryNarration({ turn, requestId, state, now }) {
  const snapshot = state.turnSnapshots.get(turn);

  if (!snapshot) {
    return errorResponse(404, requestId, 'TURN_SNAPSHOT_NOT_FOUND', '找不到该回合的已保存结算，无法续写剧情。');
  }

  const result = await state.storyGraph.invoke(snapshot);
  state.game = applyNarrationToGame(state.game, turn, result.narration);
  state.game = recordStoryMemoryTurn({
    before: snapshot.beforeGame,
    after: state.game,
    action: snapshot.action,
    entry: state.game.log.find((entry) => entry.id === `turn-${turn}`) ?? state.game.log.at(-1),
    narration: result.narration
  });
  state.auditLog.push({
    type: 'narration-retry',
    turn,
    llm: result.narration.status,
    at: now().toISOString()
  });

  return jsonResponse(200, requestId, {
    turn,
    narration: result.narration
  });
}

async function resolveTurnNarration({ before, after, action, ruleEntry, state }) {
  const result = await state.storyGraph.invoke({
    beforeGame: before,
    afterGame: after,
    action,
    ruleEntry: ruleEntry ?? after.log.at(-1)
  });
  return result.narration;
}

function handleExportStory({ body, requestId, state }) {
  if (body.format !== undefined && body.format !== 'txt') {
    return errorResponse(400, requestId, 'UNSUPPORTED_EXPORT_FORMAT', '当前只支持 txt 导出。');
  }

  const filename = `问道浮生-${state.game.player.name}-第${state.game.turn}回合.txt`;
  return jsonResponse(200, requestId, {
    filename,
    content: exportNovel(state.game)
  });
}

function normalizeGame(game) {
  const onboarding = game.onboarding ?? createOnboardingState();
  const character = game.character ?? {
    name: game.player?.name ?? '陆青玄',
    origin: game.player?.origin ?? '山野孤子',
    spiritualRoot: game.player?.spiritualRoot ?? '雷木双灵根',
    traits: ['新手序章'],
    comprehension: 50,
    physique: 50,
    luck: 50,
    karmaAffinity: 0,
    initialLifespan: game.player?.lifespan ?? 93,
    startingResources: {
      spiritStones: game.player?.spiritStones ?? 126,
      materials: { 凝露草: 2 },
      pills: {}
    }
  };

  const normalized = {
    id: game.id ?? 'game_local',
    version: game.turn,
    ...game,
    id: game.id ?? 'game_local',
    version: game.turn,
    onboarding,
    characterSeed: game.characterSeed ?? game.seed ?? 1,
    character,
    inventory: game.inventory ?? {
      materials: character.startingResources.materials,
      pills: character.startingResources.pills
    },
    karma: game.karma ?? {
      karma: 0,
      evil: 0,
      fate: character.karmaAffinity,
      debts: [],
      vendettas: [],
      futureEventFlags: []
    },
    flags: game.flags ?? {},
    cooldowns: game.cooldowns ?? {}
  };

  return {
    ...normalized,
    storyMemory: normalizeStoryMemory(game.storyMemory, normalized)
  };
}

function createCompletedFormalOnboardingState() {
  return {
    completed: true,
    stepId: 'formal_life',
    completedStepIds: ONBOARDING_STEPS.map((step) => step.id),
    unlockedCharacterCreation: true
  };
}

function createModelHealth(selection) {
  return {
    provider: selection.provider,
    baseUrl: selection.baseUrl,
    chatModel: selection.chatModel,
    fastModel: selection.fastModel,
    premiumModel: selection.premiumModel,
    hasApiKey: selection.hasApiKey,
    status: selection.hasApiKey ? 'configured' : 'missing_key'
  };
}

function applyNarrationToGame(game, turn, narration) {
  const index = game.log.findIndex((entry) => entry.id === `turn-${turn}`);
  if (index === -1) return game;

  const log = [...game.log];
  log[index] = {
    ...log[index],
    title: narration.title ?? log[index].title,
    body: narration.body ?? log[index].body,
    npcLine: narration.npcLine ?? log[index].npcLine
  };
  return { ...game, log };
}

function matchRetryNarrationRoute(method, pathname) {
  if (method !== 'POST') return null;
  const match = pathname.match(/^\/api\/v1\/turns\/(\d+)\/narration$/);
  return match ? Number(match[1]) : null;
}

async function readJson(request) {
  const text = await request.text();
  if (!text) return {};
  return JSON.parse(text);
}

function nextRequestId(state) {
  state.requestSequence += 1;
  return `req_${state.requestSequence.toString(36).padStart(6, '0')}`;
}

function jsonResponse(status, requestId, data) {
  return new Response(JSON.stringify({
    ok: true,
    data,
    error: null,
    requestId
  }), responseInit(status));
}

function sseResponse(write) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event, data) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        await write(emit);
      } catch (error) {
        emit('error', {
          ok: false,
          data: null,
          error: {
            code: 'STREAM_ERROR',
            message: '流式剧情生成中断，请稍后重试。',
            detail: error.message
          }
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization'
    }
  });
}

function errorResponse(status, requestId, code, message) {
  return new Response(JSON.stringify({
    ok: false,
    data: null,
    error: { code, message },
    requestId
  }), responseInit(status));
}

function emptyResponse(status) {
  return new Response(null, responseInit(status));
}

function responseInit(status) {
  return {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization'
    }
  };
}
