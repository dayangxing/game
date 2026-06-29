import { advanceTurn, createGame as createMockGame, exportNovel } from '../mock/engine.js';
import { buildDailyActionsRequest } from '../ai/llmContracts.js';

export function createGameApi(options = {}) {
  const seed = options.seed ?? Date.now();
  const preferredMode = options.preferredMode ?? 'mock';
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? defaultBackendBaseUrl());
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const canUseBackend = Boolean(baseUrl && fetchImpl);

  return {
    async createGame(mode = preferredMode) {
      if (mode === 'api' && canUseBackend) {
        return withMode(await requestJson({ baseUrl, fetchImpl, path: '/api/v1/game/state' }), 'api', 'game');
      }

      return withMode(createMockGame(seed), 'mock');
    },

    async submitCommand(game, command) {
      return advanceTurn(game, command);
    },

    async getDailyActions(game, view) {
      if (shouldUseBackend(game, canUseBackend)) {
        const data = await requestJson({
          baseUrl,
          fetchImpl,
          path: '/api/v1/daily-actions',
          method: 'POST',
          body: {
            viewId: view.id,
            gameVersion: game.version
          }
        });
        return data.actions;
      }

      const llmRequest = buildDailyActionsRequest(game, view);
      const cards = view.cards.map((card, index) => normalizeAction(card, view, index, 'view', llmRequest));
      const suggested = game.suggestions.slice(0, 3).map((command, index) => normalizeAction({
        title: '天机建议',
        icon: '机',
        command,
        meta: 'AI 预留'
      }, view, index + cards.length, 'suggestion', llmRequest));

      return [...cards, ...suggested];
    },

    async submitDailyAction(game, action) {
      if (shouldUseBackend(game, canUseBackend)) {
        const data = await requestJson({
          baseUrl,
          fetchImpl,
          path: '/api/v1/turns',
          method: 'POST',
          body: {
            actionId: action.id,
            clientTurn: game.turn
          }
        });
        return withMode(data.game, 'api');
      }

      return withMode(advanceTurn(game, action.command), 'mock');
    },

    async setMode(game, mode) {
      if (mode === 'api' && canUseBackend) {
        return withMode(await requestJson({ baseUrl, fetchImpl, path: '/api/v1/game/state' }), 'api', 'game');
      }

      return { ...game, mode };
    },

    async exportStory(game) {
      if (shouldUseBackend(game, canUseBackend)) {
        const data = await requestJson({
          baseUrl,
          fetchImpl,
          path: '/api/v1/export-story',
          method: 'POST',
          body: { format: 'txt' }
        });
        return data.content;
      }

      return exportNovel(game);
    }
  };
}

async function requestJson({ baseUrl, fetchImpl, path, method = 'GET', body }) {
  const response = await fetchImpl(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();

  if (!response.ok || payload.ok === false) {
    const message = payload.error?.message ?? '后端 API 请求失败。';
    throw new BackendApiError(message, {
      status: response.status,
      code: payload.error?.code,
      requestId: payload.requestId
    });
  }

  return payload.data;
}

export class BackendApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'BackendApiError';
    this.details = details;
  }
}

function withMode(data, mode, key) {
  const game = key ? data[key] : data;
  return { ...game, mode };
}

function shouldUseBackend(game, canUseBackend) {
  return canUseBackend && game.mode === 'api';
}

function normalizeBaseUrl(url) {
  if (!url) return null;
  return url.replace(/\/+$/, '');
}

function defaultBackendBaseUrl() {
  if (typeof window === 'undefined') return null;
  return window.WENDAO_API_BASE_URL ?? 'http://127.0.0.1:8787';
}

function normalizeAction(card, view, index, source, llmRequest) {
  return {
    id: `${view.id}-${source}-${index}`,
    title: card.title,
    icon: card.icon,
    command: card.command,
    meta: card.meta,
    source,
    storyHook: buildStoryHook(card, view),
    llmRequest
  };
}

function buildStoryHook(card, view) {
  return [
    `当前界面：${view.label}`,
    `界面目标：${view.description}`,
    `行动名称：${card.title}`,
    `行动指令：${card.command}`,
    `生成要求：结合角色状态、NPC记忆和世界事件，生成本日剧情。`
  ].join('\n');
}
