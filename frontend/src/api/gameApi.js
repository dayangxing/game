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

    async createFormalGame({ name, rerollSeed, attributes } = {}) {
      if (canUseBackend) {
        const data = await requestJson({
          baseUrl,
          fetchImpl,
          path: '/api/v1/game/new',
          method: 'POST',
          body: { name, rerollSeed, attributes }
        });
        return withMode(data.game, 'api');
      }

      const formalSeed = rerollSeed ?? seed;
      const mockGame = createMockGame(formalSeed);
      const character = createMockFormalCharacter(mockGame, {
        name,
        rerollSeed: formalSeed,
        attributes
      });
      const maxHealth = deriveMockMaxHealth(character.attributes);
      const maxLifespan = deriveMockMaxLifespan(character.initialLifespan, character.attributes);
      return withMode({
        ...mockGame,
        player: {
          ...mockGame.player,
          name: character.name,
          origin: character.origin,
          spiritualRoot: character.spiritualRoot,
          maxHealth,
          health: maxHealth,
          maxLifespan,
          lifespan: maxLifespan,
          spiritStones: character.startingResources.spiritStones
        },
        characterSeed: formalSeed,
        character
      }, 'mock');
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
        meta: '命途回响'
      }, view, index + cards.length, 'suggestion', llmRequest));

      return [...cards, ...suggested];
    },

    async submitDailyAction(game, action) {
      if (shouldUseBackend(game, canUseBackend)) {
        if (action.source === 'immediate') {
          throw new BackendApiError('行动尚在刷新，请稍候再试。', {
            code: 'ACTION_REFRESH_PENDING'
          });
        }
        const backendAction = await resolveBackendAction({ baseUrl, fetchImpl, game, action });
        const data = await requestJson({
          baseUrl,
          fetchImpl,
          path: '/api/v1/turns',
          method: 'POST',
          body: {
            actionId: backendAction.id,
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

async function resolveBackendAction({ baseUrl, fetchImpl, game, action }) {
  if (isBackendAction(action)) return action;

  const viewId = action.llmRequest?.context?.view?.id;
  if (!viewId) {
    throw new BackendApiError('行动缺少场景信息，请切换页签重试。', {
      code: 'ACTION_VIEW_MISSING'
    });
  }

  const data = await requestJson({
    baseUrl,
    fetchImpl,
    path: '/api/v1/daily-actions',
    method: 'POST',
    body: {
      viewId,
      gameVersion: game.version
    }
  });
  const backendAction = data.actions.find((candidate) => candidate.command === action.command);

  if (!backendAction) {
    throw new BackendApiError('未找到匹配的今日行动，请刷新后重试。', {
      code: 'ACTION_NOT_MATCHED'
    });
  }

  return backendAction;
}

function isBackendAction(action) {
  return action.id?.startsWith('act_');
}

async function requestJson({ baseUrl, fetchImpl, path, method = 'GET', body }) {
  const response = await fetchImpl(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();

  if (!response.ok || payload.ok === false) {
    const message = payload.error?.message ?? '云端暂不可用，请稍后重试。';
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

function createMockFormalCharacter(game, { name, rerollSeed, attributes }) {
  const allocation = normalizeMockAllocation(attributes, rerollSeed);
  return {
    name: String(name ?? '').trim() || game.player.name,
    origin: game.player.origin,
    spiritualRoot: game.player.spiritualRoot,
    traits: buildMockTraits(rerollSeed),
    attributes: allocation,
    comprehension: allocation.comprehension * 9,
    physique: allocation.rootBone * 9,
    luck: allocation.fortune * 9,
    karmaAffinity: (rerollSeed % 21) - 10,
    initialLifespan: 80 + (rerollSeed % 31),
    startingResources: {
      spiritStones: 60 + (rerollSeed % 41),
      materials: {
        凝露草: 1 + (rerollSeed % 3),
        雷纹草: rerollSeed % 2
      },
      pills: {}
    }
  };
}

function buildMockTraits(seed) {
  const traitPool = ['早慧', '命火绵长', '经脉坚韧', '福缘深厚', '丹道亲和', '剑心微明'];
  const firstIndex = Math.abs(seed) % traitPool.length;
  const secondIndex = (firstIndex + 2) % traitPool.length;
  return [traitPool[firstIndex], traitPool[secondIndex]];
}

function normalizeMockAllocation(attributes, seed) {
  if (attributes === undefined) {
    return randomizeMockAllocation(seed);
  }

  const keys = ['rootBone', 'comprehension', 'fortune', 'willpower', 'lifeSeed'];
  const normalized = {};
  let total = 0;

  for (const key of keys) {
    const value = attributes?.[key];
    if (!Number.isInteger(value) || value < 1 || value > 10) {
      throw new Error(`ATTRIBUTE_ALLOCATION_INVALID:${key}`);
    }
    normalized[key] = value;
    total += value;
  }

  if (total !== 25) {
    throw new Error('ATTRIBUTE_ALLOCATION_INVALID:total');
  }

  return normalized;
}

function randomizeMockAllocation(seed) {
  const allocation = {
    rootBone: 1,
    comprehension: 1,
    fortune: 1,
    willpower: 1,
    lifeSeed: 1
  };
  const keys = Object.keys(allocation);
  const rng = createRng(seed);
  let remaining = 20;

  while (remaining > 0) {
    const available = keys.filter((key) => allocation[key] < 10);
    const key = available[Math.floor(rng() * available.length)];
    allocation[key] += 1;
    remaining -= 1;
  }

  return allocation;
}

function deriveMockMaxHealth(attributes) {
  return 80 + attributes.rootBone * 8 + attributes.lifeSeed * 2;
}

function deriveMockMaxLifespan(initialLifespan, attributes) {
  return initialLifespan + attributes.lifeSeed * 8;
}

function createRng(seed) {
  let value = Math.abs(Math.floor(seed)) || 1;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}
