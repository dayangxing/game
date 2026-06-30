import { createGameApi } from './api/gameApi.js';
import { getLayoutMode } from './ui/layoutModes.js';
import { formatCharacterAttributeRows } from './ui/characterCreation.js';
import {
  getGuideStep,
  guideSteps,
  markGuideCompleted,
  shouldAutoOpenGuide
} from './ui/onboardingGuide.js';
import { createImmediateViewActions } from './ui/immediateViewActions.js';
import { getView, viewList } from './ui/views.js';

const STORAGE_KEY = 'wendao-fusheng-frontend-save-v1';
const MODE_KEY = 'wendao-fusheng-mode-v1';
const BACKEND_BASE_URL = window.WENDAO_API_BASE_URL ?? 'http://127.0.0.1:8787';
const RANDOM_COMMANDS = [
  '闭关修炼三月，尝试突破',
  '前往后山探索灵脉',
  '找林师姐打听雾隐秘境的消息',
  '炼制一炉聚气丹',
  '挑战外门第十席',
  '拜见玄衡长老求取功法'
];

const initialMode = localStorage.getItem(MODE_KEY) || 'api';
let startupNotice = '';
let actionRefreshSequence = 0;
let pendingApiImmediateActions = false;
let pendingFormalGame = null;
let pendingCharacterSeed = Number(localStorage.getItem('wendao-fusheng-character-seed') ?? Date.now());
const api = createGameApi({
  seed: 42,
  baseUrl: BACKEND_BASE_URL,
  preferredMode: initialMode
});
const layoutMode = getLayoutMode();
let game = await loadGame();
let activeViewId = localStorage.getItem('wendao-fusheng-active-view') || 'home';
let dailyActions = await loadDailyActionsForGame(game, getView(activeViewId)).catch((error) => {
  startupNotice = apiErrorMessage(error);
  return createImmediateViewActions(game, getView(activeViewId));
});
let guideStepIndex = 0;

document.documentElement.dataset.layout = layoutMode.id;
document.body.classList.add(layoutMode.shellClass);

const nodes = {
  playerName: document.querySelector('#playerName'),
  playerOrigin: document.querySelector('#playerOrigin'),
  avatar: document.querySelector('#avatar'),
  topTabs: document.querySelector('#topTabs'),
  viewTitle: document.querySelector('#viewTitle'),
  viewDescription: document.querySelector('#viewDescription'),
  actionTitle: document.querySelector('#actionTitle'),
  actionMeta: document.querySelector('#actionMeta'),
  hudResources: document.querySelector('#hudResources'),
  realm: document.querySelector('#realm'),
  spiritualRoot: document.querySelector('#spiritualRoot'),
  location: document.querySelector('#location'),
  meters: document.querySelector('#meters'),
  sectRelationLabel: document.querySelector('#sectRelationLabel'),
  sectRelationBar: document.querySelector('#sectRelationBar'),
  npcList: document.querySelector('#npcList'),
  gameDate: document.querySelector('#gameDate'),
  turnPill: document.querySelector('#turnPill'),
  logList: document.querySelector('#logList'),
  actionGrid: document.querySelector('#actionGrid'),
  timeline: document.querySelector('#timeline'),
  foreshadows: document.querySelector('#foreshadows'),
  guideBtn: document.querySelector('#guideBtn'),
  guideOverlay: document.querySelector('#guideOverlay'),
  guideTitle: document.querySelector('#guideTitle'),
  guideBody: document.querySelector('#guideBody'),
  guideProgress: document.querySelector('#guideProgress'),
  guideNextBtn: document.querySelector('#guideNextBtn'),
  guideSkipBtn: document.querySelector('#guideSkipBtn'),
  saveBtn: document.querySelector('#saveBtn'),
  exportBtn: document.querySelector('#exportBtn'),
  resetBtn: document.querySelector('#resetBtn'),
  sampleBtn: document.querySelector('#sampleBtn'),
  mockMode: document.querySelector('#mockMode'),
  apiMode: document.querySelector('#apiMode'),
  apiBanner: document.querySelector('#apiBanner'),
  worldMode: document.querySelector('#worldMode'),
  onboardingPanel: document.querySelector('#onboardingPanel'),
  onboardingTitle: document.querySelector('#onboardingTitle'),
  onboardingBody: document.querySelector('#onboardingBody'),
  onboardingActionBtn: document.querySelector('#onboardingActionBtn'),
  characterPanel: document.querySelector('#characterPanel'),
  characterNameInput: document.querySelector('#characterNameInput'),
  characterRoll: document.querySelector('#characterRoll'),
  rerollCharacterBtn: document.querySelector('#rerollCharacterBtn'),
  startFormalGameBtn: document.querySelector('#startFormalGameBtn'),
  toast: document.querySelector('#toast')
};

render();
if (startupNotice) showToast(startupNotice);
if (!startupNotice && shouldAutoOpenGuide(localStorage)) openGuide();

nodes.actionGrid.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-command]');
  if (!button) return;
  const action = dailyActions.find((item) => item.id === button.dataset.actionId);
  if (!action) return;
  await submitDailyAction(action);
});

nodes.topTabs.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-view]');
  if (!button) return;
  activeViewId = button.dataset.view;
  localStorage.setItem('wendao-fusheng-active-view', activeViewId);
  showImmediateActionsForView(activeViewId);
  refreshDailyActionsForView(activeViewId).catch(handleApiError);
});

nodes.guideBtn.addEventListener('click', () => openGuide());

nodes.guideNextBtn.addEventListener('click', () => {
  if (guideStepIndex >= guideSteps.length - 1) {
    completeGuide();
    return;
  }
  guideStepIndex += 1;
  renderGuide();
});

nodes.guideSkipBtn.addEventListener('click', () => completeGuide());

nodes.saveBtn.addEventListener('click', () => {
  saveGame();
  showToast(game.mode === 'api' ? '后端存档由服务端维护' : '前端存档已保存');
});

nodes.exportBtn.addEventListener('click', async () => {
  try {
    downloadText(await api.exportStory(game), `问道浮生-${game.player.name}-第${game.turn}回合.txt`);
    showToast('传记已导出');
  } catch (error) {
    handleApiError(error);
  }
});

nodes.resetBtn.addEventListener('click', async () => {
  try {
    const nextGame = await api.createGame(game.mode);
    const nextActions = await loadDailyActionsForGame(nextGame, getView(activeViewId));
    actionRefreshSequence += 1;
    pendingApiImmediateActions = false;
    game = nextGame;
    dailyActions = nextActions;
    saveGame();
    render();
    showToast(game.mode === 'api' ? '已刷新后端存档' : '新的一世已经开启');
  } catch (error) {
    handleApiError(error);
  }
});

nodes.sampleBtn.addEventListener('click', async () => {
  if (!dailyActions.length && game.mode === 'api') {
    showToast('后端行动未加载，请切换页签重试');
    return;
  }
  const fallbackCommand = RANDOM_COMMANDS[(game.turn + game.seed) % RANDOM_COMMANDS.length];
  const action = dailyActions.length ? dailyActions[(game.turn + game.seed) % dailyActions.length] : {
    id: 'fallback-random',
    command: fallbackCommand
  };
  await submitDailyAction(action);
});

nodes.mockMode.addEventListener('click', () => setMode('mock'));
nodes.apiMode.addEventListener('click', () => setMode('api'));
nodes.onboardingActionBtn.addEventListener('click', async () => {
  try {
    const [action] = await api.getDailyActions(game, getView(activeViewId));
    await submitDailyAction(action);
  } catch (error) {
    handleApiError(error);
  }
});

nodes.rerollCharacterBtn.addEventListener('click', async () => {
  try {
    pendingCharacterSeed += 1;
    localStorage.setItem('wendao-fusheng-character-seed', String(pendingCharacterSeed));
    pendingFormalGame = null;
    renderCharacterRoll(buildPendingCharacterPreview());
  } catch (error) {
    handleApiError(error);
  }
});

nodes.startFormalGameBtn.addEventListener('click', async () => {
  try {
    game = await api.createFormalGame({
      name: nodes.characterNameInput.value,
      rerollSeed: pendingCharacterSeed
    });
    pendingFormalGame = null;
    dailyActions = await loadDailyActionsForGame(game, getView(activeViewId));
    actionRefreshSequence += 1;
    pendingApiImmediateActions = false;
    saveGame();
    render();
  } catch (error) {
    handleApiError(error);
  }
});

async function submitDailyAction(action) {
  if (shouldBlockImmediateApiAction(action)) {
    showToast('后端行动刷新中，请稍候再试');
    return;
  }
  try {
    game = await api.submitDailyAction(game, action);
    saveGame();
    showImmediateActionsForView(activeViewId);
    refreshDailyActionsForView(activeViewId).catch(handleApiError);
    nodes.logList.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    handleApiError(error);
  }
}

async function setMode(mode) {
  try {
    const nextGame = await api.setMode(game, mode);
    const nextActions = await loadDailyActionsForGame(nextGame, getView(activeViewId));
    actionRefreshSequence += 1;
    pendingApiImmediateActions = false;
    game = nextGame;
    dailyActions = nextActions;
    saveGame();
    render();
    showToast(mode === 'api' ? '已连接后端 API' : '已切换本地 Mock');
  } catch (error) {
    handleApiError(error);
  }
}

function render() {
  renderFirstRunStage();
  renderTabs();
  renderPlayer();
  renderNpcs();
  renderStory();
  renderWorld();
  renderMode();
}

function renderFirstRunStage() {
  const needsOnboarding = game.onboarding && !game.onboarding.completed;
  const needsCharacter = shouldShowCharacterCreation(game);
  const onboardingStep = game.onboarding?.completed ? null : game.log.at(-1);

  nodes.onboardingPanel.hidden = !needsOnboarding;
  nodes.characterPanel.hidden = !needsCharacter;
  document.querySelector('.main-stage').hidden = needsOnboarding || needsCharacter;

  if (needsOnboarding && onboardingStep) {
    nodes.onboardingTitle.textContent = onboardingStep.title;
    nodes.onboardingBody.textContent = onboardingStep.body;
  }

  if (needsCharacter) {
    renderCharacterRoll(pendingFormalGame?.character ?? buildPendingCharacterPreview());
  }
}

function shouldShowCharacterCreation(game) {
  if (!game.onboarding?.completed) return false;
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

function renderCharacterRoll(character = game.character) {
  nodes.characterRoll.innerHTML = formatCharacterAttributeRows(character).map((row) => `
    <div class="attribute-row">
      <span>${row.label}</span>
      <strong>${row.value}</strong>
    </div>
  `).join('');
}

function buildPendingCharacterPreview() {
  const seed = Number.isFinite(pendingCharacterSeed) ? pendingCharacterSeed : (game.characterSeed ?? game.seed ?? 1);
  const traitPool = ['早慧', '命火绵长', '经脉坚韧', '福缘深厚', '丹道亲和', '剑心微明'];
  const firstIndex = positiveModulo(seed, traitPool.length);
  const secondIndex = (firstIndex + 2) % traitPool.length;
  const fallbackCharacter = game.character ?? {};

  return {
    name: String(nodes.characterNameInput?.value ?? '').trim() || fallbackCharacter.name || game.player.name,
    origin: fallbackCharacter.origin ?? game.player.origin,
    spiritualRoot: fallbackCharacter.spiritualRoot ?? game.player.spiritualRoot,
    traits: [traitPool[firstIndex], traitPool[secondIndex]],
    comprehension: clampStat(52 + positiveModulo(seed, 17)),
    physique: clampStat(47 + positiveModulo(seed, 19)),
    luck: clampStat(45 + positiveModulo(seed, 23)),
    karmaAffinity: positiveModulo(seed, 21) - 10,
    initialLifespan: 80 + positiveModulo(seed, 31),
    startingResources: {
      spiritStones: 60 + positiveModulo(seed, 41),
      materials: {
        凝露草: 1 + positiveModulo(seed, 3),
        雷纹草: positiveModulo(seed, 2)
      },
      pills: {}
    }
  };
}

function renderTabs() {
  const view = getView(activeViewId);
  nodes.viewTitle.textContent = view.title;
  nodes.viewDescription.textContent = view.description;
  nodes.actionTitle.textContent = view.label === '洞府' ? '今日修行' : view.title;
  nodes.actionMeta.textContent = `${view.cards.length} 项`;

  nodes.topTabs.innerHTML = viewList.map((item) => `
    <button class="${item.id === view.id ? 'active' : ''}" type="button" data-view="${item.id}">${item.label}</button>
  `).join('');
}

function renderPlayer() {
  const { player } = game;
  nodes.playerName.textContent = player.name;
  nodes.playerOrigin.textContent = player.origin;
  nodes.avatar.textContent = player.name.slice(0, 1);
  nodes.realm.textContent = player.realm;
  nodes.spiritualRoot.textContent = player.spiritualRoot;
  nodes.location.textContent = player.location;
  nodes.sectRelationLabel.textContent = player.sectRelation;
  nodes.sectRelationBar.style.width = `${player.sectRelation}%`;

  nodes.hudResources.innerHTML = [
    '<h3>寿元压力</h3>',
    `<div class="state-row"><span>寿元</span><strong>${game.player.lifespan}</strong></div>`,
    '<h3>因果</h3>',
    renderKarmaState(),
    '<h3>门派</h3>',
    renderSectState(),
    '<h3>丹药/材料</h3>',
    renderInventoryState()
  ].join('');

  const meters = [
    ['灵气', player.qi, 'qi'],
    ['心境', player.mood, 'mood'],
    ['破境', player.cultivationProgress, 'progress'],
    ['灵石', player.spiritStones, 'stones']
  ];

  nodes.meters.innerHTML = meters.map(([label, value, kind]) => {
    const percent = kind === 'stones' ? Math.min(100, value / 2) : Math.min(100, value);
    return `
      <div class="meter-row">
        <div><span>${label}</span><strong>${value}</strong></div>
        <div class="bar ${kind}"><i style="width:${percent}%"></i></div>
      </div>
    `;
  }).join('');
}

function renderNpcs() {
  nodes.npcList.innerHTML = game.npcs.map((npc) => `
    <article class="npc-card">
      <div>
        <strong>${npc.name}</strong>
        <span>${npc.role}</span>
      </div>
      <b>${npc.affinity}</b>
    </article>
  `).join('');
}

function renderStory() {
  const activeView = getView(activeViewId);
  nodes.gameDate.textContent = formatDate(game.calendar);
  nodes.turnPill.textContent = `第 ${game.turn} 回合`;

  nodes.actionGrid.innerHTML = buildActionCards(dailyActions).map((card) => `
    <button class="action-card ${card.kind}" type="button" data-action-id="${escapeAttribute(card.id)}" data-command="${escapeAttribute(card.command)}"${card.disabled ? ' disabled aria-disabled="true"' : ''}>
      <b>${card.icon}</b>
      <span>${card.title}</span>
      <strong>${card.command}</strong>
      <em>${card.meta}</em>
      ${card.eventMeta}
    </button>
  `).join('');

  nodes.logList.innerHTML = game.log.slice(-5).reverse().map((entry) => `
    <article class="log-card">
      <header><strong>${entry.title}</strong><span>${entry.command}</span></header>
      <p>${entry.body}</p>
      ${entry.npcLine ? `<blockquote>${entry.npcLine}</blockquote>` : ''}
      ${entry.worldEvent ? `<em>${entry.worldEvent}</em>` : ''}
    </article>
  `).join('');
}

function renderWorld() {
  nodes.timeline.innerHTML = game.timeline.slice(-6).reverse().map((item) => `
    <article class="timeline-item">
      <i></i>
      <div><strong>${item.title}</strong><p>${item.detail}</p></div>
    </article>
  `).join('');

  nodes.foreshadows.innerHTML = game.foreshadows.map((item) => `<article>${item}</article>`).join('');
}

function renderMode() {
  const isApi = game.mode === 'api';
  nodes.mockMode.classList.toggle('active', !isApi);
  nodes.apiMode.classList.toggle('active', isApi);
  nodes.apiBanner.hidden = !isApi;
  nodes.worldMode.textContent = isApi ? '后端 API' : 'Mock 推演';
}

function openGuide() {
  guideStepIndex = 0;
  nodes.guideOverlay.hidden = false;
  renderGuide();
}

function renderGuide() {
  const step = getGuideStep(guideStepIndex);
  nodes.guideTitle.textContent = step.title;
  nodes.guideBody.textContent = step.body;
  nodes.guideProgress.innerHTML = guideSteps.map((item, index) => `
    <span class="${index === guideStepIndex ? 'active' : ''}" aria-label="${item.title}"></span>
  `).join('');
  nodes.guideNextBtn.textContent = guideStepIndex === guideSteps.length - 1 ? '开始修行' : '下一步';
}

function completeGuide() {
  markGuideCompleted(localStorage);
  nodes.guideOverlay.hidden = true;
}

async function loadGame() {
  const savedMode = localStorage.getItem(MODE_KEY) || initialMode;
  if (savedMode === 'api') {
    try {
      return await api.createGame('api');
    } catch (error) {
      startupNotice = `后端连接失败，已切换本地 Mock：${apiErrorMessage(error)}`;
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...JSON.parse(raw), mode: 'mock' } : await api.createGame('mock');
  } catch {
    return api.createGame('mock');
  }
}

async function loadDailyActionsForGame(targetGame, targetView) {
  return api.getDailyActions(targetGame, targetView);
}

async function refreshDailyActionsForView(viewId) {
  const requestId = ++actionRefreshSequence;
  const requestGame = game;
  const requestView = getView(viewId);
  const nextActions = await loadDailyActionsForGame(requestGame, requestView);

  if (
    requestId !== actionRefreshSequence ||
    activeViewId !== requestView.id ||
    !isSameGameSnapshot(game, requestGame)
  ) {
    return false;
  }

  pendingApiImmediateActions = false;
  dailyActions = nextActions;
  render();
  return true;
}

function showImmediateActionsForView(viewId) {
  pendingApiImmediateActions = game.mode === 'api';
  dailyActions = createImmediateViewActions(game, getView(viewId));
  render();
}

function isSameGameSnapshot(current, snapshot) {
  return current.turn === snapshot.turn && current.version === snapshot.version;
}

function saveGame() {
  localStorage.setItem(MODE_KEY, game.mode);
  if (game.mode === 'mock') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  }
}

function showToast(message) {
  nodes.toast.textContent = message;
  nodes.toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => nodes.toast.classList.remove('show'), 1800);
}

function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatDate(calendar) {
  return `玄历${calendar.year}年 ${calendar.season} 第${calendar.month}月`;
}

function escapeAttribute(value) {
  return value.replaceAll('"', '&quot;');
}

function renderKarmaState() {
  const karma = game.karma ?? { karma: 0, evil: 0, futureEventFlags: [] };
  return `
    <div class="state-row"><span>善缘</span><strong>${karma.karma ?? 0}</strong></div>
    <div class="state-row"><span>业力</span><strong>${karma.evil ?? 0}</strong></div>
    <div class="state-row"><span>因果伏笔</span><strong>${karma.futureEventFlags?.length ?? 0}</strong></div>
  `;
}

function renderInventoryState() {
  const inventory = game.inventory ?? { materials: {}, pills: {} };
  const materials = Object.entries(inventory.materials ?? {}).map(([name, count]) => `${name} x${count}`).join('、') || '无';
  const pills = Object.entries(inventory.pills ?? {}).map(([name, count]) => `${name} x${count}`).join('、') || '无';
  return `
    <div class="state-row"><span>材料</span><strong>${materials}</strong></div>
    <div class="state-row"><span>丹药</span><strong>${pills}</strong></div>
  `;
}

function renderSectState() {
  const sect = game.sect ?? { name: '青云宗', contribution: game.player.sectRelation ?? 0, rank: '外门弟子' };
  return `
    <div class="state-row"><span>宗门</span><strong>${sect.name}</strong></div>
    <div class="state-row"><span>身份</span><strong>${sect.rank}</strong></div>
    <div class="state-row"><span>贡献</span><strong>${sect.contribution ?? game.player.sectRelation ?? 0}</strong></div>
  `;
}

function buildActionCards(actions) {
  return actions.map((action) => ({
    ...action,
    kind: kindForCommand(action.command),
    disabled: shouldBlockImmediateApiAction(action),
    eventMeta: action.eventId ? `<div class="event-meta">${action.eventId} / ${action.choiceId}</div>` : ''
  })).slice(0, 6);
}

function shouldBlockImmediateApiAction(action) {
  return game.mode === 'api' && pendingApiImmediateActions && action.source === 'immediate';
}

function handleApiError(error) {
  showToast(apiErrorMessage(error));
}

function apiErrorMessage(error) {
  return error?.message ?? '后端 API 暂不可用，请稍后重试。';
}

function kindForCommand(command) {
  if (command.includes('炼丹') || command.includes('丹') || command.includes('药')) {
    return 'alchemy';
  }
  if (command.includes('挑战') || command.includes('斗法') || command.includes('斩妖')) {
    return 'combat';
  }
  if (command.includes('林师姐') || command.includes('长老') || command.includes('打听') || command.includes('请教')) {
    return 'social';
  }
  if (command.includes('修炼') || command.includes('闭关') || command.includes('突破') || command.includes('稳固')) {
    return 'cultivate';
  }
  return 'explore';
}

function clampStat(value) {
  return Math.max(20, Math.min(95, value));
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}
