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

    async resetForCharacterCreation(mode = preferredMode, { rerollSeed } = {}) {
      if (mode === 'api' && canUseBackend) {
        const data = await requestJson({
          baseUrl,
          fetchImpl,
          path: '/api/v1/game/reset',
          method: 'POST',
          body: { rerollSeed }
        });
        return withMode(data.game, 'api');
      }

      return withMode(createMockCharacterCreationShell(createMockGame(rerollSeed ?? seed)), 'mock');
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
      return this.submitDailyActionStream(game, action);
    },

    async submitDailyActionStream(game, action, handlers = {}) {
      if (shouldUseBackend(game, canUseBackend)) {
        if (action.source === 'immediate') {
          throw new BackendApiError('行动尚在刷新，请稍候再试。', {
            code: 'ACTION_REFRESH_PENDING'
          });
        }
        const backendAction = await resolveBackendAction({ baseUrl, fetchImpl, game, action });
        const data = await requestEventStream({
          baseUrl,
          fetchImpl,
          path: '/api/v1/turns/stream',
          method: 'POST',
          body: {
            actionId: backendAction.id,
            clientTurn: game.turn
          },
          handlers
        });
        return withMode(data.game, 'api');
      }

      return withMode(advanceTurn(game, action.command), 'mock');
    },

    async continueStoryStream(game, handlers = {}) {
      if (shouldUseBackend(game, canUseBackend)) {
        const data = await requestEventStream({
          baseUrl,
          fetchImpl,
          path: '/api/v1/turns/stream',
          method: 'POST',
          body: {
            type: 'continue',
            clientTurn: game.turn
          },
          handlers
        });
        return withStoryResult(data, 'api');
      }

      const nextGame = withMode(advanceTurn(game, '继续推演命途'), 'mock');
      return {
        game: nextGame,
        turnResult: {
          mode: 'continue',
          choices: []
        }
      };
    },

    async chooseStoryStream(game, choice, handlers = {}) {
      if (shouldUseBackend(game, canUseBackend)) {
        const data = await requestEventStream({
          baseUrl,
          fetchImpl,
          path: '/api/v1/turns/stream',
          method: 'POST',
          body: {
            type: 'choice',
            choiceId: choice.id,
            clientTurn: game.turn
          },
          handlers
        });
        return withStoryResult(data, 'api');
      }

      const nextGame = withMode(advanceTurn(game, choice.text ?? '顺势而行'), 'mock');
      return {
        game: nextGame,
        turnResult: {
          mode: 'continue',
          choices: []
        }
      };
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

async function requestEventStream({ baseUrl, fetchImpl, path, method = 'GET', body, handlers = {} }) {
  const response = await fetchImpl(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!response.ok) {
    await throwResponseError(response);
  }

  const reader = response.body?.getReader?.();
  if (!reader) {
    throw new BackendApiError('云端暂不可用，请稍后重试。', {
      status: response.status,
      code: 'STREAM_UNSUPPORTED'
    });
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let rawNarration = '';
  let rawStory = '';
  let donePayload = null;
  let lastNarrationPreview = '';
  let lastStoryPreview = '';
  let narrationPreviewComplete = false;
  let storyPreviewComplete = false;

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const event = parseSseBlock(part);
      if (!event) continue;

      if (event.name === 'narration_delta') {
        const delta = String(event.data?.text ?? '');
        rawNarration += delta;
        handlers.onNarrationDelta?.(delta, rawNarration);
        const preview = extractJsonStringFieldProgress(rawNarration, 'body');
        if (!narrationPreviewComplete && preview.value && preview.value !== lastNarrationPreview) {
          lastNarrationPreview = preview.value;
          handlers.onNarrationPreview?.(preview.value, rawNarration);
        }
        if (preview.complete) narrationPreviewComplete = true;
      }

      if (event.name === 'story_delta') {
        const delta = String(event.data?.text ?? '');
        rawStory += delta;
        handlers.onStoryDelta?.(delta, rawStory);
        const preview = extractJsonStringFieldProgress(rawStory, 'scene');
        if (!storyPreviewComplete && preview.value && preview.value !== lastStoryPreview) {
          lastStoryPreview = preview.value;
          handlers.onStoryPreview?.(preview.value, rawStory);
        }
        if (preview.complete) storyPreviewComplete = true;
      }

      if (event.name === 'choices_ready') {
        handlers.onChoicesReady?.(normalizePublicChoices(event.data?.choices));
      }

      if (event.name === 'done') {
        donePayload = event.data;
      }

      if (event.name === 'error') {
        throw new BackendApiError(event.data?.error?.message ?? '流式剧情生成中断，请稍后重试。', {
          status: response.status,
          code: event.data?.error?.code
        });
      }
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const event = parseSseBlock(buffer);
    if (event?.name === 'done') donePayload = event.data;
  }

  if (!donePayload) {
    throw new BackendApiError('云端没有返回完整回合结果，请稍后重试。', {
      status: response.status,
      code: 'STREAM_DONE_MISSING'
    });
  }

  if (donePayload.ok === false) {
    throw new BackendApiError(donePayload.error?.message ?? '云端暂不可用，请稍后重试。', {
      status: response.status,
      code: donePayload.error?.code,
      requestId: donePayload.requestId
    });
  }

  return donePayload.data;
}

async function throwResponseError(response) {
  try {
    const payload = await response.json();
    const message = payload.error?.message ?? '云端暂不可用，请稍后重试。';
    throw new BackendApiError(message, {
      status: response.status,
      code: payload.error?.code,
      requestId: payload.requestId
    });
  } catch (error) {
    if (error instanceof BackendApiError) throw error;
    throw new BackendApiError('云端暂不可用，请稍后重试。', {
      status: response.status
    });
  }
}

function parseSseBlock(block) {
  const lines = block.split(/\r?\n/);
  const name = lines
    .find((line) => line.startsWith('event:'))
    ?.slice(6)
    .trim();
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');

  if (!name || !data) return null;
  return {
    name,
    data: JSON.parse(data)
  };
}

function extractJsonStringFieldProgress(raw, field) {
  const marker = `"${field}"`;
  const keyIndex = raw.indexOf(marker);
  if (keyIndex === -1) return { value: '', complete: false };

  const colonIndex = raw.indexOf(':', keyIndex + marker.length);
  if (colonIndex === -1) return { value: '', complete: false };

  const startIndex = raw.indexOf('"', colonIndex + 1);
  if (startIndex === -1) return { value: '', complete: false };

  let value = '';
  let escaping = false;
  for (let index = startIndex + 1; index < raw.length; index += 1) {
    const character = raw[index];

    if (escaping) {
      value += decodeJsonEscape(character);
      escaping = false;
      continue;
    }

    if (character === '\\') {
      escaping = true;
      continue;
    }

    if (character === '"') return { value, complete: true };
    value += character;
  }

  return { value, complete: false };
}

function decodeJsonEscape(character) {
  return {
    '"': '"',
    '\\': '\\',
    '/': '/',
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t'
  }[character] ?? character;
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
  return { ...normalizePublicGame(game), mode };
}

function withStoryResult(data, mode) {
  const publicRuleResult = normalizePublicRuleResult(data.turnResult?.ruleResult);
  return {
    ...data,
    game: withMode(data.game, mode),
    turnResult: {
      ...(data.turnResult ?? {}),
      ...(publicRuleResult ? { ruleResult: publicRuleResult } : {}),
      choices: normalizePublicChoices(data.turnResult?.choices)
    }
  };
}

function normalizePublicGame(sourceGame = {}) {
  const { lastTimeResult, ...game } = sourceGame ?? {};
  return {
    ...game,
    ...(game.timePressure ? { timePressure: normalizePublicTimePressure(game.timePressure) } : {}),
    ...(game.ending ? { ending: normalizePublicEnding(game.ending) } : {})
  };
}

function normalizePublicRuleResult(ruleResult = {}) {
  const timeResult = normalizePublicTimeResult(ruleResult.timeResult);
  return timeResult ? { timeResult } : undefined;
}

function normalizePublicTimeResult(timeResult = {}) {
  if (!timeResult || typeof timeResult !== 'object') return undefined;
  return {
    label: String(timeResult.label ?? ''),
    netLifespanDelta: Number.isFinite(timeResult.netLifespanDelta) ? timeResult.netLifespanDelta : 0,
    maxLifespanDelta: Number.isFinite(timeResult.maxLifespanDelta) ? timeResult.maxLifespanDelta : 0,
    warningLevel: String(timeResult.warningLevel ?? ''),
    note: String(timeResult.note ?? '')
  };
}

function normalizePublicTimePressure(timePressure = {}) {
  return {
    calendarLabel: String(timePressure.calendarLabel ?? ''),
    elapsedYears: Number.isFinite(timePressure.elapsedYears) ? timePressure.elapsedYears : 0,
    remainingLifespan: Number.isFinite(timePressure.remainingLifespan) ? timePressure.remainingLifespan : 0,
    maxLifespan: Number.isFinite(timePressure.maxLifespan) ? timePressure.maxLifespan : 0,
    lifespanRatio: Number.isFinite(timePressure.lifespanRatio) ? timePressure.lifespanRatio : 0,
    warningLevel: String(timePressure.warningLevel ?? ''),
    lastDeltaTime: String(timePressure.lastDeltaTime ?? ''),
    lastLifespanCost: Number.isFinite(timePressure.lastLifespanCost) ? timePressure.lastLifespanCost : 0,
    lastLongevityGain: Number.isFinite(timePressure.lastLongevityGain) ? timePressure.lastLongevityGain : 0,
    lastNetLifespanDelta: Number.isFinite(timePressure.lastNetLifespanDelta) ? timePressure.lastNetLifespanDelta : 0,
    recentRecoveryFatigue: Number.isFinite(timePressure.recentRecoveryFatigue) ? timePressure.recentRecoveryFatigue : 0
  };
}

function normalizePublicEnding(ending = {}) {
  return {
    type: String(ending.type ?? ''),
    title: String(ending.title ?? '命簿终章'),
    body: String(ending.body ?? '命火已尽。')
  };
}

function normalizePublicChoices(choices = []) {
  if (!Array.isArray(choices)) return [];
  return choices.map((choice) => ({
    id: String(choice?.id ?? ''),
    text: String(choice?.text ?? '').trim()
  })).filter((choice) => choice.id && choice.text);
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

function createMockCharacterCreationShell(game) {
  return {
    ...game,
    onboarding: {
      completed: true,
      stepId: 'formal_life',
      completedStepIds: ['opening', 'first_action', 'sect_trial', 'secret_hint', 'formal_life'],
      unlockedCharacterCreation: true
    },
    characterSeed: undefined,
    character: {
      name: game.player.name,
      origin: game.player.origin,
      spiritualRoot: game.player.spiritualRoot,
      traits: ['新手序章'],
      startingResources: {
        spiritStones: game.player.spiritStones ?? 0,
        materials: {},
        pills: {}
      }
    }
  };
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
