import { createGameApi } from '$lib/api/gameApi.js';
import { getLayoutMode } from '$lib/layoutModes.js';
import { getView, visibleViewList } from '$lib/views.js';
import { createImmediateViewActions } from '$lib/immediateViewActions.js';
import {
  createDefaultAllocation,
  randomizeAllocation,
  remainingAllocationPoints,
  updateAllocation
} from '$lib/characterCreation.js';
import {
  readStoredModelConfig,
  writeStoredModelConfig,
  clearStoredModelConfig,
  shouldPromptModelConfig,
  skipModelConfig,
  clearModelConfigSkip
} from '$lib/modelConfig.js';
import {
  getGuideStep,
  guideSteps,
  markGuideCompleted,
  shouldAutoOpenGuide
} from '$lib/onboardingGuide.js';
import { hydrateHistorySummaries, enrichGameHistory, persistHistorySummaryCache, rotateHistorySummaryScope } from '$lib/utils/historyEnrichment.js';
import { buildStoryChoiceActions, normalizeStoryChoices, inferChapterTransition } from '$lib/utils/helpers.js';
import { normalizeStoryMemory } from '$lib/storyMemory.js';

const STORAGE_KEY = 'wendao-fusheng-frontend-save-v1';
const MODE_KEY = 'wendao-fusheng-mode-v1';
const ACTIVE_VIEW_KEY = 'wendao-fusheng-active-view';
const BACKEND_BASE_URL = (typeof window !== 'undefined' ? window.WENDAO_API_BASE_URL : null) ?? 'http://127.0.0.1:8787';
const DEFAULT_MODEL_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL_NAME = 'qwen3.7-plus';
const RANDOM_COMMANDS = [
  '闭关修炼三月，尝试突破',
  '前往后山探索灵脉',
  '找林师姐打听雾隐秘境的消息',
  '炼制一炉聚气丹',
  '挑战外门第十席',
  '拜见玄衡长老求取功法'
];

const isDesktopApp = typeof window !== 'undefined' ? Boolean(window.WENDAO_DESKTOP_APP) : false;
const initialMode = (typeof localStorage !== 'undefined') ? (localStorage.getItem(MODE_KEY) || 'api') : 'api';

const api = createGameApi({
  seed: 42,
  baseUrl: BACKEND_BASE_URL,
  preferredMode: initialMode
});

// Internal reactive state (NOT exported directly — Svelte 5 forbids exporting reassigned $state)
let _game = $state(null);
let _activeViewId = $state(readInitialActiveViewId());
let _dailyActions = $state([]);
let _streamingNarration = $state(null);
let _storyChoices = $state([]);
let _chapterTransitionNotice = $state('');
let _highlightedHistoryEntryId = $state(null);
let _guideStepIndex = $state(0);
let _showGuide = $state(false);
let _showModelConfig = $state(false);
let _toast = $state({ message: '', visible: false });
let _pendingCharacterSeed = $state(Number((typeof localStorage !== 'undefined' ? localStorage.getItem('wendao-fusheng-character-seed') : null) ?? Date.now()));
let _pendingAttributes = $state(createDefaultAllocation());
let _startupNotice = $state('');
let _storyStepPending = $state(false);
let _dailyActionPending = $state(false);
let _characterCreationPending = $state(false);
let _actionLoading = $state(false);
let _actionRefreshSequence = $state(0);
let _pendingApiImmediateActions = $state(false);
let _pendingCharacterPreview = $state(null);
let _modelConfig = $state({
  baseUrl: DEFAULT_MODEL_BASE_URL,
  chatModel: DEFAULT_MODEL_NAME,
  configured: false,
  apiKeyMasked: ''
});
let _initialized = $state(false);

let toastTimer = null;
let characterPreviewRequest = 0;

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    setActiveViewId(viewIdFromHash(), { updateHash: false });
  });
}

// Static exports
export const layout = getLayoutMode();
export const isDesktop = isDesktopApp;
export const visibleViews = visibleViewList;

function resolveViewId(viewId) {
  return visibleViewList.some((view) => view.id === viewId) ? viewId : 'home';
}

function viewIdFromHash() {
  if (typeof window === 'undefined') return '';
  try {
    const value = decodeURIComponent(window.location.hash.replace(/^#/, '').trim());
    return value ? resolveViewId(value) : '';
  } catch {
    return 'home';
  }
}

function readInitialActiveViewId() {
  const hashViewId = viewIdFromHash();
  if (hashViewId) return hashViewId;
  if (typeof localStorage !== 'undefined') {
    return resolveViewId(localStorage.getItem(ACTIVE_VIEW_KEY));
  }
  return 'home';
}

// Getter functions — Svelte 5 runtime tracks $state access through these
export function getGame() { return _game; }
export function getActiveViewId() { return _activeViewId; }
export function getDailyActions() { return _dailyActions; }
export function getStreamingNarration() { return _streamingNarration; }
export function getStoryChoices() { return _storyChoices; }
export function getChapterTransitionNotice() { return _chapterTransitionNotice; }
export function getHighlightedHistoryEntryId() { return _highlightedHistoryEntryId; }
export function getGuideStepIndex() { return _guideStepIndex; }
export function getShowGuide() { return _showGuide; }
export function getShowModelConfig() { return _showModelConfig; }
export function getToast() { return _toast; }
export function getPendingCharacterSeed() { return _pendingCharacterSeed; }
export function getPendingAttributes() { return _pendingAttributes; }
export function getPendingCharacterPreview() { return _pendingCharacterPreview; }
export function getStartupNotice() { return _startupNotice; }
export function getStoryStepPending() { return _storyStepPending; }
export function getDailyActionPending() { return _dailyActionPending; }
export function getCharacterCreationPending() { return _characterCreationPending; }
export function getActionLoading() { return _actionLoading; }
export function getPendingApiImmediateActions() { return _pendingApiImmediateActions; }
export function getModelConfig() { return _modelConfig; }
export function getInitialized() { return _initialized; }

// Setter functions
export function setActiveViewId(id, { updateHash = true } = {}) {
  const nextViewId = resolveViewId(id);
  _activeViewId = nextViewId;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(ACTIVE_VIEW_KEY, nextViewId);
  }
  if (typeof window !== 'undefined' && updateHash && window.location.hash !== `#${nextViewId}`) {
    window.location.hash = `#${nextViewId}`;
  }
  if (_game) {
    showImmediateActionsForView(nextViewId);
    void refreshDailyActionsForView(nextViewId);
  }
}

export function setShowGuide(v) {
  _showGuide = v;
  if (v) _guideStepIndex = 0;
}
export function setShowModelConfig(v) { _showModelConfig = v; }
export function setPendingAttributes(attrs) { _pendingAttributes = attrs; }
export function setPendingCharacterSeed(seed) {
  _pendingCharacterSeed = seed;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('wendao-fusheng-character-seed', String(seed));
  }
}

function showToastMessage(message, duration = 1800) {
  _toast = { message, visible: true };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { _toast = { message: '', visible: false }; }, duration);
}

export function showToast(message) { showToastMessage(message); }

export function skipModelConfigAction() {
  skipModelConfig(typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  _showModelConfig = false;
  showToastMessage('本次先跳过模型配置');
}

export function getRecentHistory(limit = 5) {
  const entries = (_game?.log ?? []).slice(-limit).reverse();
  return _streamingNarration ? [_streamingNarration, ...entries] : entries;
}

function beginStreamingNarration(action) {
  _streamingNarration = {
    id: 'streaming-narration',
    streaming: true,
    title: '剧情续写中',
    command: action.title ?? action.command ?? '今日行动',
    body: '云笺已启，正在接续本回合见闻。'
  };
}

function updateStreamingNarration(preview) {
  const body = String(preview ?? '').trim();
  if (!_streamingNarration || !body || _streamingNarration.body === body) return;
  _streamingNarration = { ..._streamingNarration, body };
}

function handleStreamingReset(retry = {}) {
  const attempt = Number.isInteger(Number(retry.attempt)) && Number(retry.attempt) > 0
    ? Number(retry.attempt)
    : 1;
  const message = `模型连接中断，正在重试第 ${attempt} 次……`;
  if (_streamingNarration) {
    _streamingNarration = { ..._streamingNarration, body: message };
  }
  showToastMessage(message, 2600);
}

function clearStreamingNarration() {
  _streamingNarration = null;
}

function markHistoryRefreshed(targetGame) {
  _highlightedHistoryEntryId = targetGame?.log?.at(-1)?.id ?? null;
}

export async function initializeApp() {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = readStoredModelConfig(localStorage);
      if (stored && !isDesktopApp) {
        await api.saveModelConfig(stored).catch(() => {});
      }
    }
    try {
      _modelConfig = await api.getModelConfig();
    } catch {
      _modelConfig = {
        baseUrl: DEFAULT_MODEL_BASE_URL,
        chatModel: DEFAULT_MODEL_NAME,
        configured: false,
        apiKeyMasked: ''
      };
    }

    _game = await loadGame();

    if (!_game) {
      _startupNotice = '游戏数据加载失败，请清除浏览器缓存后刷新页面。';
      _dailyActions = [];
      return;
    }

    if (_game.character?.attributes) {
      _pendingAttributes = { ..._game.character.attributes };
    }

    if (isCharacterCreationShell(_game)) {
      void refreshCharacterPreview();
    }

    await refreshDailyActionsForView(_activeViewId);

    const modelConfigStorage = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
    if (shouldPromptModelConfig(_modelConfig, modelConfigStorage)) {
      _showModelConfig = true;
    } else if (shouldAutoOpenGuide(typeof localStorage !== 'undefined' ? localStorage : null)) {
      _showGuide = true;
    }
  } catch (error) {
    console.error('Failed to initialize app:', error);
    _startupNotice = '初始化失败，请刷新页面重试。';
  } finally {
    _initialized = true;
  }
}

function isCharacterCreationShell(game) {
  return shouldShowCharacterCreation(game);
}

export function shouldShowCharacterCreation(game) {
  if (!game?.onboarding?.completed) return false;
  if (!game.onboarding?.unlockedCharacterCreation) return false;
  return !game.characterSeed || !hasFormalCharacterData(game.character);
}

function hasFormalCharacterData(character) {
  if (!character) return false;
  if (!Array.isArray(character.traits) || character.traits.length < 2) return false;
  if (character.traits.includes('新手序章')) return false;
  return typeof character.initialLifespan === 'number'
    && typeof character.startingResources?.spiritStones === 'number'
    && typeof character.origin === 'string'
    && typeof character.spiritualRoot === 'string';
}

export async function refreshCharacterPreview({ name = '未定名' } = {}) {
  if (!isCharacterCreationShell(_game)) return;

  const requestId = ++characterPreviewRequest;
  try {
    const preview = await api.getCharacterPreview({
      name,
      rerollSeed: _pendingCharacterSeed,
      attributes: _pendingAttributes,
      mode: _game?.mode ?? initialMode
    });
    if (requestId !== characterPreviewRequest || !isCharacterCreationShell(_game)) return;
    _pendingCharacterPreview = preview;
  } catch (error) {
    console.warn('character preview unavailable:', error?.message ?? error);
    if (requestId === characterPreviewRequest && !_pendingCharacterPreview) {
      _pendingCharacterPreview = null;
    }
  }
}

async function loadGame() {
  const savedMode = typeof localStorage !== 'undefined'
    ? (localStorage.getItem(MODE_KEY) || initialMode)
    : initialMode;

  try {
    if (savedMode === 'api') {
      const apiGame = await api.createGame('api');
      return hydrateHistorySummaries({
        ...apiGame,
        storyMemory: normalizeStoryMemory(apiGame.storyMemory, apiGame)
      });
    }
  } catch (error) {
    _startupNotice = `云端暂不可用，已转为本地存档：${error?.message ?? '云端暂不可用'}`;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.player) {
            return hydrateHistorySummaries({
              ...parsed,
              mode: 'mock',
              storyMemory: normalizeStoryMemory(parsed.storyMemory, parsed)
            });
          }
          console.warn('Saved game missing player data, clearing localStorage');
          localStorage.removeItem(STORAGE_KEY);
        } catch (parseError) {
          console.warn('Saved game JSON parse error, clearing localStorage:', parseError);
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
    const mockGame = await api.createGame('mock');
    return hydrateHistorySummaries({
      ...mockGame,
      storyMemory: normalizeStoryMemory(mockGame.storyMemory, mockGame)
    });
  } catch (error) {
    console.warn('API createGame failed, falling back to mock:', error?.message);
    try {
      const fallbackGame = await api.createGame('mock');
      return hydrateHistorySummaries({
        ...fallbackGame,
        storyMemory: normalizeStoryMemory(fallbackGame.storyMemory, fallbackGame)
      });
    } catch (mockError) {
      console.error('Mock createGame also failed:', mockError);
      return null;
    }
  }
}

export function saveGame() {
  if (!_game || typeof localStorage === 'undefined') return;
  localStorage.setItem(MODE_KEY, _game.mode);
  if (_game.mode === 'mock') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_game));
  }
}

function shouldStreamInitialStory(gameState) {
  return gameState?.mode === 'api'
    && gameState.turn === 0
    && gameState.onboarding?.completed === true
    && gameState.log?.[0]?.id === 'formal-opening'
    && gameState.log?.[0]?.narrationSource !== 'llm';
}

function adoptDailyActionsResult(result) {
  if (result.game?.log?.[0]?.body && result.game.log[0].body !== _game.log?.[0]?.body) {
    _game = hydrateHistorySummaries(result.game);
    saveGame();
  }
  _dailyActions = result.actions;
}

function isSameGameSnapshot(current, snapshot) {
  return current?.turn === snapshot?.turn && current?.version === snapshot?.version;
}

export async function refreshDailyActionsForView(viewId) {
  if (!_game) return;
  const requestId = ++_actionRefreshSequence;
  const requestGame = _game;
  const requestView = getView(viewId);
  _actionLoading = true;
  const streamInitialStory = shouldStreamInitialStory(requestGame);
  try {
    let result;
    if (streamInitialStory) {
      beginStreamingNarration({ title: '命簿初开', command: '创建角色' });
      result = await api.getDailyActionsStreamWithState(requestGame, requestView, {
        onStoryPreview: updateStreamingNarration,
        onStoryReset: handleStreamingReset
      });
    } else {
      result = await api.getDailyActionsWithState(requestGame, requestView);
    }
    if (requestId !== _actionRefreshSequence || _activeViewId !== requestView.id || !isSameGameSnapshot(_game, requestGame)) return;
    _pendingApiImmediateActions = false;
    adoptDailyActionsResult(result);
  } catch {
    if (requestId !== _actionRefreshSequence || _activeViewId !== requestView.id || !isSameGameSnapshot(_game, requestGame)) return;
    clearStreamingNarration();
    try {
      if (streamInitialStory) {
        const fallback = await api.getDailyActionsWithState(requestGame, requestView);
        if (requestId === _actionRefreshSequence && _activeViewId === requestView.id && isSameGameSnapshot(_game, requestGame)) {
          _pendingApiImmediateActions = false;
          adoptDailyActionsResult(fallback);
        }
      } else {
        _pendingApiImmediateActions = requestGame.mode === 'api';
        _dailyActions = createImmediateViewActions(requestGame, requestView);
      }
    } catch {
      if (requestId === _actionRefreshSequence && _activeViewId === requestView.id && isSameGameSnapshot(_game, requestGame)) {
        _pendingApiImmediateActions = requestGame.mode === 'api';
        _dailyActions = createImmediateViewActions(requestGame, requestView);
      }
    }
  } finally {
    if (requestId === _actionRefreshSequence) {
      if (streamInitialStory) clearStreamingNarration();
      _actionLoading = false;
    }
  }
}

function showImmediateActionsForView(viewId) {
  if (!_game) return;
  _pendingApiImmediateActions = _game.mode === 'api';
  _dailyActions = createImmediateViewActions(_game, getView(viewId));
}

export async function submitDailyAction(action) {
  if (!_game) return;
  if (_game.mode === 'api' && _pendingApiImmediateActions && action.source === 'immediate') {
    showToastMessage('行动尚在刷新，请稍候再试');
    return;
  }
  if (_dailyActionPending) {
    showToastMessage('行动正在结算，请稍候');
    return;
  }

  _dailyActionPending = true;
  const previousGame = _game;
  beginStreamingNarration(action);
  try {
    const result = await api.submitDailyActionStream(_game, action, {
      onNarrationPreview: updateStreamingNarration,
      onNarrationReset: handleStreamingReset
    });
    const nextGame = result?.game ?? result;
    _chapterTransitionNotice = inferChapterTransition(previousGame.chapter, nextGame.chapter) ?? '';
    _game = hydrateHistorySummaries(nextGame);
    _game = enrichGameHistory(_game, previousGame);
    markHistoryRefreshed(_game);
    persistHistorySummaryCache(_game);
    saveGame();
    clearStreamingNarration();
    showImmediateActionsForView(_activeViewId);
    await refreshDailyActionsForView(_activeViewId);
  } catch (error) {
    clearStreamingNarration();
    showToastMessage(error?.message || '行动失败，请重试。');
  } finally {
    _dailyActionPending = false;
  }
}

export async function submitRandomAction() {
  if (!_game) return;
  if (!_dailyActions.length && _game.mode === 'api') {
    showToastMessage('行动尚未入册，请稍候再试');
    return;
  }

  const action = _dailyActions.length
    ? _dailyActions[(_game.turn + _game.seed) % _dailyActions.length]
    : {
      id: 'fallback-random',
      command: RANDOM_COMMANDS[(_game.turn + _game.seed) % RANDOM_COMMANDS.length],
      title: '随机行动',
      source: 'mock'
    };

  if (action.category === 'director' || action.source === 'story-choice' || action.source === 'story-continue') {
    await submitStoryStep(action);
    return;
  }
  await submitDailyAction(action);
}

export async function submitOnboardingAction() {
  if (!_game) return;
  if (_dailyActionPending) {
    showToastMessage('行动正在结算，请稍候');
    return;
  }
  _dailyActionPending = true;
  beginStreamingNarration({ title: '新手引导', command: '继续' });
  try {
    const view = getView('home');
    const actionRes = await api.getDailyActions(_game, view);
    const action = actionRes[0];
    if (!action) throw new Error('未获取到引导行动');

    const previousGame = _game;
    const result = await api.submitDailyActionStream(_game, action, {
      onNarrationPreview: updateStreamingNarration,
      onNarrationReset: handleStreamingReset
    });
    const nextGame = result?.game ?? result;
    _chapterTransitionNotice = inferChapterTransition(previousGame.chapter, nextGame.chapter) ?? '';
    _game = hydrateHistorySummaries(nextGame);
    _game = enrichGameHistory(_game, previousGame);
    markHistoryRefreshed(_game);
    persistHistorySummaryCache(_game);
    saveGame();
    clearStreamingNarration();
    await refreshDailyActionsForView(_activeViewId);
  } catch (error) {
    clearStreamingNarration();
    showToastMessage(error?.message || '引导失败，请重试');
  } finally {
    _dailyActionPending = false;
  }
}

export async function submitStoryStep(action) {
  if (!_game) return;
  if (_storyStepPending) {
    showToastMessage('命途正在续写，请稍候');
    return;
  }
  const selectedChoice = action.source === 'story-choice'
    ? _storyChoices.find((choice) => choice.id === action.id)
    : action.category === 'director'
      ? { id: action.id, text: action.command }
      : null;
  _storyStepPending = true;
  const previousGame = _game;
  beginStreamingNarration({
    title: selectedChoice ? '命途抉择' : '下一步',
    command: selectedChoice?.text ?? '继续'
  });
  try {
    const result = selectedChoice
      ? await api.chooseStoryStream(_game, selectedChoice, {
        onStoryPreview: updateStreamingNarration,
        onStoryReset: handleStreamingReset
      })
      : await api.continueStoryStream(_game, {
        onStoryPreview: updateStreamingNarration,
        onStoryReset: handleStreamingReset
      });
    _game = hydrateHistorySummaries(result.game);
    _game = enrichGameHistory(_game, previousGame);
    _storyChoices = normalizeStoryChoices(result.turnResult?.choices);
    _dailyActions = buildStoryChoiceActions(_storyChoices);
    _chapterTransitionNotice = inferChapterTransition(previousGame.chapter, _game.chapter) ?? '';
    markHistoryRefreshed(_game);
    persistHistorySummaryCache(_game);
    saveGame();
    clearStreamingNarration();
    _storyStepPending = false;
  } catch (error) {
    _storyStepPending = false;
    clearStreamingNarration();
    showToastMessage(error?.message || '续写失败，请重试。');
  }
}

export async function setMode(mode) {
  try {
    const modeGame = await api.setMode(_game, mode);
    rotateHistorySummaryScope(typeof localStorage !== 'undefined' ? localStorage : null);
    _game = hydrateHistorySummaries(modeGame);
    _game.mode = mode;
    _storyChoices = [];
    _chapterTransitionNotice = '';
    if (_game.character?.attributes) {
      _pendingAttributes = { ..._game.character.attributes };
    }
    saveGame();
    showToastMessage(mode === 'api' ? '已转为云端存档' : '已转为本地存档');
    await refreshDailyActionsForView(_activeViewId);
  } catch (error) {
    console.error('setMode failed:', error);
    showToastMessage(error?.message || '切换模式失败。');
  }
}

export async function resetGame() {
  _characterCreationPending = false;
  const rerollSeed = Date.now();
  try {
    const newGame = await api.resetForCharacterCreation(_game?.mode ?? initialMode, { rerollSeed });
    _game = hydrateHistorySummaries(newGame);
    _storyChoices = [];
    _chapterTransitionNotice = '';
    _streamingNarration = null;
    _dailyActionPending = false;
    _highlightedHistoryEntryId = null;
    setPendingCharacterSeed(rerollSeed);
    _pendingAttributes = createDefaultAllocation();
    _pendingCharacterPreview = null;
    void refreshCharacterPreview();
    rotateHistorySummaryScope(typeof localStorage !== 'undefined' ? localStorage : null);
    _actionLoading = true;
    saveGame();
    showToastMessage('新的一世已开启');
    await refreshDailyActionsForView(_activeViewId);
  } catch (error) {
    console.error('resetGame failed:', error);
    _actionLoading = false;
    showToastMessage(error?.message || '重开失败。');
  }
}

export async function createFormalGame({ name, attributes }) {
  if (_characterCreationPending) return;
  _characterCreationPending = true;
  characterPreviewRequest += 1;

  try {
    const newGame = await api.createFormalGame({
      name,
      rerollSeed: _pendingCharacterSeed,
      attributes,
      mode: _game?.mode ?? initialMode
    });

    // Reset all state before updating game
    _activeViewId = 'home';
    _streamingNarration = null;
    _storyChoices = [];
    _chapterTransitionNotice = '';
    _highlightedHistoryEntryId = null;
    _dailyActionPending = false;
    _dailyActions = [];
    _actionLoading = true;
    _pendingCharacterPreview = null;

    _game = hydrateHistorySummaries(newGame);
    rotateHistorySummaryScope(typeof localStorage !== 'undefined' ? localStorage : null);
    saveGame();
    showToastMessage('修行正式开始');
    await refreshDailyActionsForView(_activeViewId);
  } catch (error) {
    console.error('createFormalGame failed:', error);
    showToastMessage(error?.message || '创建角色失败。');
  } finally {
    _characterCreationPending = false;
  }
}

export async function saveModelConfigAction(config) {
  try {
    const previousBrowserConfig = isDesktopApp || typeof localStorage === 'undefined'
      ? null
      : readStoredModelConfig(localStorage);
    _modelConfig = await api.saveModelConfig(config);
    if (!isDesktopApp) {
      writeStoredModelConfig({
        ...config,
        apiKey: config.apiKey || previousBrowserConfig?.apiKey || ''
      }, localStorage);
    }
    clearModelConfigSkip();
    _showModelConfig = false;
    showToastMessage('模型配置已保存');
  } catch (error) {
    showToastMessage(error?.message || '保存配置失败。');
  }
}

export async function clearModelConfigAction() {
  try {
    _modelConfig = await api.clearModelConfig();
    if (!isDesktopApp && typeof localStorage !== 'undefined') clearStoredModelConfig(localStorage);
    showToastMessage('已清除模型配置');
  } catch (error) {
    showToastMessage(error?.message || '清除失败。');
  }
}

export function handleGuideNext() {
  if (_guideStepIndex < guideSteps.length - 1) {
    _guideStepIndex += 1;
  } else {
    _showGuide = false;
    if (typeof localStorage !== 'undefined') markGuideCompleted(localStorage);
  }
}

export function handleGuideSkip() {
  _showGuide = false;
  if (typeof localStorage !== 'undefined') markGuideCompleted(localStorage);
}

export function getCurrentGuideStep() {
  return getGuideStep(_guideStepIndex);
}

export async function exportStory() {
  if (!_game) return;
  try {
    const text = await api.exportStory(_game);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `问道浮生-${_game.player.name}-第${_game.turn}回合.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToastMessage('已导出修仙人生');
  } catch (error) {
    showToastMessage(error?.message || '导出失败。');
  }
}
