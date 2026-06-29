import { advanceTurn, createGame, exportNovel } from '../../src/engine.js';
import { createStoryGraph } from './agents/storyGraph.js';
import { createDailyActions, hasView } from './domain/actions.js';
import { buildTurnResult } from './domain/turnResult.js';
import { createBailianClient } from './llm/bailianClient.js';
import { getModelSelection } from './llm/modelSelection.js';

export function createBackendApp(options = {}) {
  const now = options.now ?? (() => new Date());
  const llm = options.llm ?? createBailianClient({ env: options.env ?? process.env, fetchImpl: options.fetchImpl });
  const state = {
    game: normalizeGame(createGame(options.seed ?? Date.now())),
    pendingActions: new Map(),
    turnSnapshots: new Map(),
    auditLog: [],
    requestSequence: 0,
    actionSequence: 0,
    modelSelection: getModelSelection(options.env ?? process.env),
    llm,
    storyGraph: options.storyGraph ?? createStoryGraph({ llm })
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

        if (route === 'POST /api/v1/daily-actions') {
          const body = await readJson(request);
          return handleDailyActions({ body, requestId, state, now });
        }

        if (route === 'POST /api/v1/turns') {
          const body = await readJson(request);
          return handleTurn({ body, requestId, state, now });
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

  const actions = createDailyActions({
    game: state.game,
    viewId,
    now: now(),
    sequenceStart: state.actionSequence
  });
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

  return jsonResponse(200, requestId, { actions });
}

async function handleTurn({ body, requestId, state, now }) {
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

  const before = state.game;
  const after = normalizeGame(advanceTurn(before, action.command));

  action.consumed = true;
  state.game = after;
  state.turnSnapshots.set(after.turn, {
    beforeGame: before,
    afterGame: after,
    action: { ...action },
    ruleEntry: after.log.at(-1)
  });
  const narration = await resolveTurnNarration({ before, after, action, state });
  state.game = applyNarrationToGame(state.game, after.turn, narration);
  const turnResult = buildTurnResult({ before, after: state.game, actionId: action.id, narration });
  state.auditLog.push({
    type: 'turn',
    actionId: action.id,
    command: action.command,
    ruleResult: turnResult.ruleResult,
    llm: turnResult.narration.status,
    at: now().toISOString()
  });

  return jsonResponse(200, requestId, {
    game: state.game,
    turnResult
  });
}

async function handleRetryNarration({ turn, requestId, state, now }) {
  const snapshot = state.turnSnapshots.get(turn);

  if (!snapshot) {
    return errorResponse(404, requestId, 'TURN_SNAPSHOT_NOT_FOUND', '找不到该回合的已保存结算，无法续写剧情。');
  }

  const result = await state.storyGraph.invoke(snapshot);
  state.game = applyNarrationToGame(state.game, turn, result.narration);
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

async function resolveTurnNarration({ before, after, action, state }) {
  const result = await state.storyGraph.invoke({
    beforeGame: before,
    afterGame: after,
    action,
    ruleEntry: after.log.at(-1)
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
  return {
    id: game.id ?? 'game_local',
    version: game.turn,
    ...game,
    id: game.id ?? 'game_local',
    version: game.turn
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
